// Oberfläche: verbindet Inhalte, Wiederholungslogik, Speicher und Bedienung.
import { pruefeInhalte, baueInhalte } from "./inhalte.js";
import { kartenpool, baueStapel, neueRunde, fortsetzbareRunde, beantworte, statistik, naechsteFaelligkeit, formatiereAbstand, mische } from "./stapel.js";
import { erzeugeSpeicher } from "./speicher.js";
import { erkenneFormat, pruefeStand, fuehreZusammen, beschreibe, exportiere, exportDateiname } from "./fortschritt.js";
import { migriereLegacy, MigrationsFehler } from "./migration.js";

const $ = id => document.getElementById(id);
const jetzt = () => Date.now();
const uhrzeit = ms => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const datumZeit = ms => new Date(ms).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });

/** Kleiner DOM-Baukasten; Texte werden immer als Text eingesetzt, nie als HTML. */
function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kinder.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}

// localStorage-Zugriff selbst kann im privaten Modus werfen; Fehler sollen beim Aufruf entstehen und gemeldet werden
const browserSpeicher = {
  getItem: k => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
};
const merke = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* nur Komfort */ } };
const erinnere = k => { try { return window.localStorage.getItem(k); } catch { return null; } };

let inhalte, SYS, gueltigeKarten;
let stand;
let lokalStatus = null;   // { ok, zeit?, fehler? }
let syncStatus = null;    // wird von der Synchronisierung gesetzt: { text, zustand: "ok" | "warten" | "fehler" }
let sync = null;          // optionale Synchronisierung (siehe sync-gist.js)
const speicher = erzeugeSpeicher({ storage: browserSpeicher, beiStatus: s => { lokalStatus = s; zeigeStatus(); } });

/* ---------- Inhalte ---------- */

async function ladeInhalte() {
  const lies = async pfad => {
    const r = await fetch(pfad, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${pfad} konnte nicht geladen werden (${r.status})`);
    try { return await r.json(); } catch { throw new Error(`${pfad} ist kein gültiges JSON`); }
  };
  const themen = await lies("inhalte/themen.json");
  const zettel = {};
  await Promise.all((themen.themen ?? []).map(async t => { zettel[t.datei] = await lies("inhalte/" + t.datei); }));
  const fehler = pruefeInhalte(themen, zettel);
  if (fehler.length) throw new Error("Die Lerninhalte enthalten Fehler:\n" + fehler.join("\n"));
  return baueInhalte(themen, zettel);
}

function setzeThemenfarben(themen) {
  const vars = art => themen.map(t => `--${t.kuerzel}:${t.farbe[art]};`).join("");
  const css = `:root{${vars("hell")}}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars("dunkel")}}}:root[data-theme="dark"]{${vars("dunkel")}}`;
  document.head.append(el("style", {}, css));
}

/* ---------- Speichern und Status ---------- */

function aendern(veraendere) {
  veraendere();
  stand.updated = jetzt();
  const ok = speicher.speichern(stand);
  zeigeSpeicherFehler(ok ? null : lokalStatus.fehler);
  if (sync) sync.geaendert(stand);
}

function zeigeStatus() {
  const teile = [];
  let zustand = "warten";
  if (!lokalStatus) teile.push("Fortschritt wird auf diesem Gerät gespeichert.");
  else if (lokalStatus.ok) { teile.push(`Gespeichert um ${uhrzeit(lokalStatus.zeit)} Uhr`); zustand = "ok"; }
  else { teile.push(`Nicht gespeichert: ${lokalStatus.fehler}`); zustand = "fehler"; }
  if (syncStatus) {
    teile.push(syncStatus.text);
    if (zustand !== "fehler" && syncStatus.zustand !== "ok") zustand = syncStatus.zustand;
  }
  $("statusText").textContent = teile.join(" · ");
  $("status").dataset.zustand = zustand;
}

function zeigeHinweis(id, text, knoepfe = [], art = "") {
  $(id)?.remove();
  if (!text) return;
  $("alerts").append(el("div", { class: "alert " + art, id, role: art ? "status" : "alert" }, el("div", {}, text),
    knoepfe.length ? el("div", { class: "row" }, knoepfe.map(([t, f]) => el("button", { class: "btn", onclick: f }, t))) : null));
}

function zeigeSpeicherFehler(fehler) {
  zeigeHinweis("speicherFehler", fehler && `Dein Fortschritt konnte auf diesem Gerät nicht gespeichert werden (${fehler}). Exportiere ihn jetzt als Datei, damit nichts verloren geht.`,
    [["Exportieren", exportieren], ["Erneut versuchen", () => aendern(() => {})]]);
}

function sofortSichern() {
  if (!stand) return;
  const ok = speicher.speichern(stand);
  zeigeSpeicherFehler(ok ? null : lokalStatus.fehler);
  if (sync) sync.sofort(stand);
}

/* ---------- Export / Import ---------- */

function herunterladen(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = el("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportieren() { herunterladen(exportiere(stand, jetzt()), exportDateiname(jetzt())); }
const hatFortschritt = s => Object.keys(s.karten).length > 0 || Object.values(s.mc).some(e => e.pick !== null);

let importKandidat = null;

async function importDatei(datei) {
  let daten;
  try { daten = JSON.parse(await datei.text()); }
  catch { return zeigeImport({ fehler: ["Die Datei ist keine gültige JSON-Datei."] }); }
  const format = erkenneFormat(daten);
  if (format === "legacy") {
    try {
      const r = await fetch("legacy/index-map.json");
      if (!r.ok) throw new Error("Zuordnungstabelle konnte nicht geladen werden");
      return zeigeImport({ stand: migriereLegacy(daten, await r.json()), legacy: true });
    } catch (e) {
      return zeigeImport({ fehler: [e instanceof MigrationsFehler ? e.message : "Die alte Datei konnte nicht übertragen werden: " + e.message] });
    }
  }
  if (format === "v2") {
    const { stand: s, fehler } = pruefeStand(daten);
    return zeigeImport(fehler.length ? { fehler: ["Die Datei enthält ungültige Einträge, deshalb wird nichts importiert:", ...fehler.slice(0, 10)] } : { stand: s });
  }
  zeigeImport({ fehler: ["Diese Datei enthält keinen Lernstand dieser App."] });
}

function standTabelle(a, b) {
  const da = beschreibe(a), db = beschreibe(b);
  const zeile = (name, x, y) => el("tr", {}, el("th", {}, name), el("td", {}, x), el("td", {}, y));
  return el("table", {},
    el("tr", {}, el("th", {}), el("th", {}, "Datei"), el("th", {}, "Dieses Gerät")),
    zeile("Karten mit Lernstand", da.karten, db.karten),
    zeile("davon Stufe 0/1/2/3/4/5", da.stufen.join("/"), db.stufen.join("/")),
    zeile("Quizfragen beantwortet", da.beantworteteFragen, db.beantworteteFragen),
    zeile("Stand vom", da.updated ? datumZeit(da.updated) : "–", db.updated ? datumZeit(db.updated) : "–"));
}

function zeigeImport({ stand: neu, fehler, legacy }) {
  importKandidat = neu ?? null;
  const info = $("importInfo");
  info.replaceChildren();
  if (fehler) info.append(...fehler.map(f => el("p", {}, f)));
  else {
    if (legacy) info.append(el("p", {}, "Datei aus der alten claude.ai-Version erkannt. Der Lernstand wurde auf die neuen Karten-IDs übertragen und geprüft."));
    info.append(standTabelle(neu, stand));
    info.append(el("p", { class: "klein" }, "Ersetzen übernimmt nur den Stand aus der Datei. Zusammenführen behält bei jeder Karte die jüngere Änderung. " +
      (hatFortschritt(stand) ? "Vor dem Ersetzen wird der bisherige Stand dieses Geräts automatisch als Datei gesichert." : "")));
  }
  $("importMerge").hidden = $("importErsetzen").hidden = !neu;
  $("importMerge").className = "btn" + (neu && hatFortschritt(stand) ? " known" : "");
  $("importErsetzen").className = "btn" + (neu && !hatFortschritt(stand) ? " known" : "");
  $("menu").close();
  $("importDlg").showModal();
}

function importAbschliessen(art) {
  const neu = importKandidat;
  if (!neu) return;
  if (art === "ersetzen") {
    if (hatFortschritt(stand)) exportieren();
    // Alle Einträge als „jetzt geändert“ markieren, damit das Ersetzen auch auf anderen Geräten ankommt
    const t = jetzt();
    const neuStempeln = obj => Object.fromEntries(Object.entries(obj).map(([id, e]) => [id, { ...e, u: t }]));
    aendern(() => { stand = { ...neu, karten: neuStempeln(neu.karten), mc: neuStempeln(neu.mc), resetKarten: t - 1, resetQuiz: t - 1, session: neu.session && { ...neu.session, t } }; });
  } else {
    aendern(() => { stand = fuehreZusammen(stand, neu); });
  }
  importKandidat = null;
  $("importDlg").close();
  zeigeHinweis("ersterStart", null);
  fortsetzen(); renderQuiz();
}

/* ---------- Karteikarten ---------- */

let sysSel = "all", gemischt = false;
const pool = () => kartenpool(inhalte.karten, sysSel);
const kartenNachId = new Map();

function bauen() {
  const now = jetzt();
  const stapel = baueStapel({ pool: pool(), karten: stand.karten, modus: $("mode").value, gemischt, now });
  stand.session = neueRunde({ stapel, modus: $("mode").value, thema: sysSel, now });
  render();
}

function fortsetzen() {
  const r = fortsetzbareRunde(stand.session, jetzt(), gueltigeKarten);
  if (r && (r.sys === "all" || SYS[r.sys])) {
    stand.session = r;
    sysSel = r.sys; setzeKartenChip(sysSel); $("mode").value = r.mode;
    render();
  } else bauen();
}

function render() {
  const p = pool(), now = jetzt();
  const s = statistik(p, stand.karten, now);
  $("prog").style.width = s.anteilGelernt * 100 + "%";
  $("stats").textContent = `${s.faellig} zur Wiederholung fällig, ${s.neu} neu, ${s.gelernt} gelernt, davon ${s.gefestigt} gefestigt`;
  const runde = stand.session;
  if (runde.pos >= runde.deck.length) {
    $("deck").hidden = true; $("done").hidden = false;
    const next = naechsteFaelligkeit(p, stand.karten, now);
    $("doneTitle").textContent = $("mode").value === "all" ? "Stapel durch" : "Für heute geschafft";
    $("doneText").textContent = next ? `Die nächsten Karten sind ${formatiereAbstand(next - now)} wieder dran.` : "Alle Karten in diesem Bereich sind gelernt.";
    return;
  }
  $("deck").hidden = false; $("done").hidden = true;
  const karte = kartenNachId.get(runde.deck[runde.pos]);
  const st = stand.karten[karte.id];
  $("card").classList.remove("flipped");
  $("card").style.setProperty("--c", `var(--${karte.thema})`);
  $("fSys").textContent = $("bSys").textContent = SYS[karte.thema];
  const lvl = !st ? "neu" : st.b === 0 ? "nicht gewusst, nochmal" : `Stufe ${st.b} von 5`;
  $("fPos").textContent = $("bPos").textContent = `noch ${runde.deck.length - runde.pos}`;
  $("fHint").textContent = `Tippen zum Umdrehen (${lvl})`;
  $("fQ").textContent = karte.frage; $("bQ").textContent = karte.frage; $("bA").textContent = karte.antwort;
}

const umdrehen = () => $("card").classList.toggle("flipped");

function bewerten(gewusst) {
  if (stand.session.pos >= stand.session.deck.length) return;
  aendern(() => {
    const r = beantworte({ runde: stand.session, karten: stand.karten, gewusst, now: jetzt() });
    stand.session = r.runde; stand.karten = r.karten;
  });
  render();
}

function chips(container, beiWahl) {
  const opts = [["all", "Alle"], ...Object.entries(SYS)];
  container.replaceChildren(...opts.map(([k, n]) => el("button", { class: "chip", "data-k": k, "aria-pressed": String(k === "all"), style: `--c:var(--${k === "all" ? "ink" : k})` },
    k === "all" ? null : el("span", { class: "dot" }), n)));
  const setze = k => container.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.k === k)));
  container.addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; setze(b.dataset.k); beiWahl(b.dataset.k); });
  return setze;
}
let setzeKartenChip = () => {};

/* ---------- Quiz ---------- */

let qSel = "all";
const quizListe = () => inhalte.mc.filter(m => qSel === "all" || m.thema === qSel);

function renderQuiz() {
  const liste = quizListe();
  const neueReihenfolgen = liste.filter(m => !stand.mc[m.id]);
  if (neueReihenfolgen.length) {
    // Eine noch nie gezeigte Frage bekommt eine zufällige Reihenfolge. u = 0, damit eine echte Antwort
    // von einem anderen Gerät beim Zusammenführen immer Vorrang hat.
    aendern(() => { for (const m of neueReihenfolgen) stand.mc[m.id] = { order: mische([0, 1, 2, 3]), pick: null, u: 0 }; });
  }
  $("mc").replaceChildren(...liste.map((m, n) => {
    const { order, pick } = stand.mc[m.id];
    const karte = el("div", { class: "qcard", style: `--c:var(--${m.thema})`, "data-id": m.id },
      el("div", { class: "num" }, `${n + 1}. ${SYS[m.thema]}`),
      el("p", { class: "qt" }, m.frage),
      el("div", { class: "opts" }, order.map(k => {
        let cls = "opt";
        if (pick !== null) { if (k === 0) cls += " right"; else if (k === pick) cls += " wrong"; }
        return el("button", { class: cls, "data-k": k, disabled: pick !== null }, m.optionen[k]);
      })));
    if (pick !== null) karte.append(el("p", { class: "expl" }, (pick === 0 ? "Richtig. " : "Falsch. ") + m.erklaerung));
    return karte;
  }));
  $("open").replaceChildren(...inhalte.offen.filter(o => qSel === "all" || o.thema === qSel).map(o =>
    el("details", { class: "open", style: `--c:var(--${o.thema})` }, el("summary", {}, o.frage), el("p", { class: "sol" }, o.loesung))));
  punktestand();
}

function punktestand() {
  const fertig = quizListe().filter(m => stand.mc[m.id] && stand.mc[m.id].pick !== null);
  $("st").textContent = fertig.length;
  $("sc").textContent = fertig.filter(m => stand.mc[m.id].pick === 0).length;
}

function quizKlick(e) {
  const b = e.target.closest(".opt");
  if (!b || b.disabled) return;
  const karte = b.closest(".qcard"), id = karte.dataset.id, k = +b.dataset.k;
  const m = inhalte.mc.find(x => x.id === id);
  aendern(() => { stand.mc[id] = { ...stand.mc[id], pick: k, u: jetzt() }; });
  karte.querySelectorAll(".opt").forEach(x => {
    x.disabled = true;
    const kk = +x.dataset.k;
    if (kk === 0) x.classList.add("right"); else if (kk === k) x.classList.add("wrong");
  });
  karte.append(el("p", { class: "expl" }, (k === 0 ? "Richtig. " : "Falsch. ") + m.erklaerung));
  punktestand();
}

/* ---------- Tabs und Menü ---------- */

function tab(welcher) {
  const c = welcher === "cards";
  $("t-cards").setAttribute("aria-selected", c); $("t-quiz").setAttribute("aria-selected", !c);
  $("v-cards").hidden = !c; $("v-quiz").hidden = c;
  merke("physio-tab", welcher);
}

async function oeffneMenue() {
  const d = beschreibe(stand);
  let dauerhaft = "";
  try { if (navigator.storage?.persisted) dauerhaft = (await navigator.storage.persisted()) ? " Der Browser hat dauerhaften Speicher zugesagt." : " Der Browser hat keinen dauerhaften Speicher zugesagt, daher regelmäßig exportieren oder synchronisieren."; } catch { /* egal */ }
  $("menuStand").textContent = `${d.karten} Karten mit Lernstand, ${d.beantworteteFragen} Quizfragen beantwortet${d.updated ? ", zuletzt geändert " + datumZeit(d.updated) : ""}.${dauerhaft}`;
  if (sync) sync.zeigeEinstellungen($("syncBereich"));
  $("menu").showModal();
}

/* ---------- Offline-Betrieb (PWA) ---------- */

function registriereServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hatteKontrolle = !!navigator.serviceWorker.controller;
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hatteKontrolle || neuGeladen) return;
    neuGeladen = true;
    sofortSichern();
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").then(reg => {
    const angebot = wartend => zeigeHinweis("update", "Eine neue Version der App ist verfügbar.",
      [["Jetzt neu laden", () => wartend.postMessage("aktivieren")]], "info");
    const beobachte = neu => {
      if (!neu) return;
      if (neu.state === "installed" && navigator.serviceWorker.controller) return angebot(neu);
      neu.addEventListener("statechange", () => { if (neu.state === "installed" && navigator.serviceWorker.controller) angebot(neu); });
    };
    // Ein Update kann schon während des Seitenaufrufs gefunden worden sein
    beobachte(reg.waiting);
    beobachte(reg.installing);
    reg.addEventListener("updatefound", () => beobachte(reg.installing));
    // Beim Zurückkehren zur App nach Updates schauen
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => { /* ohne Service Worker läuft die App trotzdem, nur nicht offline */ });
}

/* ---------- Start ---------- */

function verdrahten() {
  $("card").addEventListener("click", umdrehen);
  $("known").onclick = () => bewerten(true);
  $("again").onclick = () => bewerten(false);
  $("shuffle").onclick = () => { gemischt = true; aendern(bauen); };
  $("mode").onchange = () => aendern(bauen);
  $("resetCards").onclick = () => {
    if (!confirm("Lernfortschritt aller Karten zurücksetzen? Vorher wird automatisch eine Sicherung heruntergeladen.")) return;
    if (hatFortschritt(stand)) exportieren();
    aendern(() => { stand.karten = {}; stand.resetKarten = jetzt(); bauen(); });
  };
  $("redoAll").onclick = () => { $("mode").value = "all"; aendern(bauen); };
  document.addEventListener("keydown", e => {
    if ($("v-cards").hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || document.querySelector("dialog[open]")) return;
    if (e.key === " " || e.key === "Enter") { if (document.activeElement.tagName === "BUTTON") return; e.preventDefault(); umdrehen(); }
    else if (e.key === "1") bewerten(false);
    else if (e.key === "2") bewerten(true);
  });
  setzeKartenChip = chips($("chips-cards"), s => { sysSel = s; aendern(bauen); });

  $("mc").addEventListener("click", quizKlick);
  $("resetQuiz").onclick = () => {
    if (!confirm("Alle Quiz-Antworten löschen und neu starten?")) return;
    aendern(() => { stand.mc = {}; stand.resetQuiz = jetzt(); });
    renderQuiz(); window.scrollTo(0, 0);
  };
  chips($("chips-quiz"), s => { qSel = s; renderQuiz(); });

  $("t-cards").onclick = () => tab("cards"); $("t-quiz").onclick = () => tab("quiz");
  $("menuOpen").onclick = oeffneMenue;
  $("menuClose").onclick = () => $("menu").close();
  $("exportBtn").onclick = exportieren;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importDatei(f); };
  $("importAbbrechen").onclick = () => { importKandidat = null; $("importDlg").close(); };
  $("importMerge").onclick = () => importAbschliessen("zusammenfuehren");
  $("importErsetzen").onclick = () => importAbschliessen("ersetzen");

  // Beim Schließen, Wechseln der App oder Sperren des Handys sofort sichern
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sofortSichern(); });
  window.addEventListener("pagehide", sofortSichern);
}

/** Wird von der Synchronisierung aufgerufen, wenn ein zusammengeführter Stand von außen kommt. */
export function uebernehmeStand(neu) {
  const vorher = JSON.stringify(stand);
  stand = neu;
  speicher.speichern(stand);
  if (JSON.stringify(stand) !== vorher) { fortsetzen(); renderQuiz(); }
}
export const aktuellerStand = () => stand;
export function setzeSyncStatus(s) { syncStatus = s; zeigeStatus(); }
export function setzeSync(s) { sync = s; }

async function start() {
  try {
    inhalte = await ladeInhalte();
  } catch (e) {
    document.querySelector(".wrap").replaceChildren(el("div", { class: "fehlerseite" }, el("h2", {}, "Die App konnte nicht starten"), el("pre", { style: "white-space:pre-wrap" }, e.message)));
    return;
  }
  SYS = Object.fromEntries(inhalte.themen.map(t => [t.kuerzel, t.name]));
  for (const k of inhalte.karten) kartenNachId.set(k.id, k);
  gueltigeKarten = new Set(kartenNachId.keys());
  setzeThemenfarben(inhalte.themen);

  const geladen = speicher.laden();
  stand = geladen.stand;
  if (geladen.warnung) zeigeHinweis("ladeWarnung", geladen.warnung, [["Exportieren", exportieren]]);
  zeigeStatus();

  verdrahten();
  fortsetzen();
  renderQuiz();
  tab(erinnere("physio-tab") === "quiz" ? "quiz" : "cards");
  if (!hatFortschritt(stand)) zeigeHinweis("ersterStart", "Noch kein Lernstand auf diesem Gerät. Du kannst deinen bisherigen Fortschritt über „Fortschritt → Importieren“ übernehmen.", [["Importieren …", () => $("importFile").click()]], "info");
  registriereServiceWorker();
  try { await navigator.storage?.persist?.(); } catch { /* nur ein Wunsch an den Browser */ }
  window.dispatchEvent(new CustomEvent("lernapp-bereit"));
}

start();
