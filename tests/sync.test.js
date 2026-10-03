import { test } from "node:test";
import assert from "node:assert/strict";
import { erzeugeSync, GIST_BESCHREIBUNG } from "../js/sync-gist.js";
import { leererStand } from "../js/fortschritt.js";
import { bewerte } from "../js/srs.js";

/** Simuliertes GitHub mit Gists im Speicher. */
function falschesGitHub({ token = "gut" } = {}) {
  const gists = new Map();
  let naechsteId = 1;
  const gh = {
    gists, offline: false, aufrufe: [],
    async fetch(url, opt = {}) {
      gh.aufrufe.push({ url, method: opt.method ?? "GET", keepalive: !!opt.keepalive });
      if (gh.offline) throw new TypeError("Failed to fetch");
      if (opt.headers?.Authorization !== `Bearer ${token}`) return antwort(401, { message: "Bad credentials" });
      const pfad = url.replace("https://api.github.com", "");
      const body = opt.body ? JSON.parse(opt.body) : null;
      if (pfad.startsWith("/gists?")) return antwort(200, [...gists.values()].map(g => ({ id: g.id, description: g.description })));
      if (pfad === "/gists" && opt.method === "POST") {
        const id = "g" + naechsteId++;
        gists.set(id, { id, description: body.description, public: body.public, files: Object.fromEntries(Object.entries(body.files).map(([n, f]) => [n, f.content])) });
        return antwort(201, { id });
      }
      const m = pfad.match(/^\/gists\/(\w+)$/);
      const g = m && gists.get(m[1]);
      if (!g) return antwort(404, {});
      if (opt.method === "PATCH") { for (const [n, f] of Object.entries(body.files)) g.files[n] = f.content; return antwort(200, {}); }
      return antwort(200, { id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([n, c]) => [n, { content: c, truncated: false }])) });
    },
  };
  return gh;
}
const antwort = (status, daten) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => null }, json: async () => daten });

function konfigSpeicher(start = {}) {
  const m = new Map(Object.entries(start));
  return { m, lies: k => m.get(k) ?? null, schreib: (k, v) => v == null ? m.delete(k) : m.set(k, v) };
}

/** Ein simuliertes Gerät mit eigenem Stand, eigener Konfiguration und manuell gesteuerten Timern. */
function geraet(gh, uhr, konfig = konfigSpeicher()) {
  const g = { stand: leererStand(), status: [], timer: [], konfig };
  g.sync = erzeugeSync({
    holeStand: () => g.stand,
    uebernimm: s => { g.stand = s; },
    status: s => g.status.push(s),
    konfig,
    fetchFn: gh.fetch,
    jetzt: () => uhr.t,
    timer: { setTimeout: (f, ms) => { g.timer.push({ f, ms }); return g.timer.length; }, clearTimeout: id => { if (id) g.timer[id - 1] = null; } },
    uhrzeit: () => "12:00",
  });
  g.lerne = (id, gewusst) => { uhr.t += 1000; g.stand = { ...g.stand, karten: { ...g.stand.karten, [id]: bewerte(g.stand.karten[id], gewusst, uhr.t) }, updated: uhr.t }; g.sync.geaendert(); };
  g.letzterStatus = () => g.status.at(-1);
  return g;
}

test("Verbinden legt ein privates Gist an, ein zweites Gerät findet es wieder", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  a.lerne("A-001", true);
  await a.sync.verbinde("gut");
  assert.equal(gh.gists.size, 1);
  const gist = [...gh.gists.values()][0];
  assert.equal(gist.public, false);
  assert.equal(gist.description, GIST_BESCHREIBUNG);
  assert.equal(a.letzterStatus().zustand, "ok");
  assert.match(a.letzterStatus().text, /Synchronisiert/);

  const b = geraet(gh, uhr);
  await b.sync.verbinde("gut");
  assert.equal(gh.gists.size, 1, "kein zweites Gist");
  assert.deepEqual(b.stand.karten["A-001"], a.stand.karten["A-001"]);
  assert.equal(Object.keys(gist.files).length, 2, "jedes Gerät hat seine eigene Datei");
});

test("Änderungen auf zwei Geräten gehen beide nicht verloren, die jüngere Änderung je Karte gewinnt", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr), b = geraet(gh, uhr);
  await a.sync.verbinde("gut"); await b.sync.verbinde("gut");
  a.lerne("A-001", true);           // nur A
  b.lerne("K-001", true);           // nur B
  a.lerne("H-001", true);           // beide lernen H-001, B später
  b.lerne("H-001", false);
  await a.sync.synchronisiere();
  await b.sync.synchronisiere();
  await a.sync.synchronisiere();
  for (const g of [a, b]) {
    assert.equal(g.stand.karten["A-001"].b, 1);
    assert.equal(g.stand.karten["K-001"].b, 1);
    assert.equal(g.stand.karten["H-001"].b, 0, "B hat zuletzt „nicht gewusst“ gewählt");
  }
});

test("Zurücksetzen auf einem Gerät kommt auf dem anderen an", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr), b = geraet(gh, uhr);
  await a.sync.verbinde("gut"); await b.sync.verbinde("gut");
  b.lerne("A-001", true); b.lerne("A-002", true);
  await b.sync.synchronisiere(); await a.sync.synchronisiere();
  assert.equal(Object.keys(a.stand.karten).length, 2);
  uhr.t += 1000;
  a.stand = { ...a.stand, karten: {}, resetKarten: uhr.t };
  await a.sync.synchronisiere(); await b.sync.synchronisiere();
  assert.deepEqual(b.stand.karten, {});
  assert.deepEqual(a.stand.karten, {});
});

test("Änderungen werden kurz gebündelt und dann synchronisiert", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  await a.sync.verbinde("gut");
  const vorher = gh.aufrufe.length;
  a.lerne("A-001", true); a.lerne("A-002", true); a.lerne("A-003", true);
  const aktiv = a.timer.filter(Boolean);
  assert.equal(aktiv.length, 1, "nur ein wartender Abgleich");
  assert.equal(gh.aufrufe.length, vorher, "noch keine Anfrage");
  await aktiv[0].f();
  const datei = Object.entries([...gh.gists.values()][0].files).find(([n]) => n.includes(a.sync.geraet()))[1];
  assert.equal(Object.keys(JSON.parse(datei).karten).length, 3);
});

test("Beim Schließen wird die eigene Datei sofort mit keepalive geschrieben", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  await a.sync.verbinde("gut");
  a.lerne("A-001", true);
  a.sync.sofort();
  await new Promise(r => setTimeout(r, 0));
  const letzter = gh.aufrufe.at(-1);
  assert.equal(letzter.method, "PATCH");
  assert.equal(letzter.keepalive, true);
  const datei = Object.entries([...gh.gists.values()][0].files).find(([n]) => n.includes(a.sync.geraet()))[1];
  assert.ok(JSON.parse(datei).karten["A-001"]);
  const anzahl = gh.aufrufe.length;
  a.sync.sofort(); // nichts Neues → keine Anfrage
  assert.equal(gh.aufrufe.length, anzahl);
});

test("Netzfehler: Fehlerstatus, lokaler Stand bleibt, automatischer neuer Versuch", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  await a.sync.verbinde("gut");
  a.lerne("A-001", true);
  gh.offline = true;
  await a.sync.synchronisiere();
  assert.equal(a.letzterStatus().zustand, "fehler");
  assert.match(a.letzterStatus().text, /keine Verbindung.*Auf diesem Gerät ist alles gespeichert/);
  assert.ok(a.stand.karten["A-001"]);
  const retry = a.timer.filter(Boolean).at(-1);
  assert.equal(retry.ms, 5000);
  gh.offline = false;
  await retry.f();
  assert.equal(a.letzterStatus().zustand, "ok");
});

test("Abgelaufenes Token: Fehlerstatus mit Hinweis, kein Endlos-Wiederholen", async () => {
  const gh = falschesGitHub({ token: "neu" }), uhr = { t: 1e12 };
  const konfig = konfigSpeicher({ "physio-sync-token": "alt", "physio-sync-gist": "g1", "physio-geraet": "abc" });
  const a = geraet(gh, uhr, konfig);
  await a.sync.start();
  assert.equal(a.letzterStatus().zustand, "fehler");
  assert.match(a.letzterStatus().text, /Token ungültig.*neu verbinden/);
  assert.equal(a.timer.filter(Boolean).length, 0);
});

test("Verbinden mit falschem Token schlägt fehl und speichert nichts", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  await assert.rejects(a.sync.verbinde("falsch"), /Token ungültig/);
  assert.equal(a.konfig.lies("physio-sync-token"), null);
  assert.equal(a.sync.verbunden(), false);
});

test("Trennen entfernt Token nur auf diesem Gerät, das Gist bleibt", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  await a.sync.verbinde("gut");
  a.sync.trenne();
  assert.equal(a.sync.verbunden(), false);
  assert.equal(a.konfig.lies("physio-sync-token"), null);
  assert.equal(gh.gists.size, 1);
  assert.equal(a.letzterStatus(), null);
});

test("Unlesbare Datei im Gist wird gemeldet, aber nicht überschrieben und blockiert nichts", async () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const a = geraet(gh, uhr);
  await a.sync.verbinde("gut");
  [...gh.gists.values()][0].files["fortschritt-kaputt.json"] = "{nicht json";
  a.lerne("A-001", true);
  await a.sync.synchronisiere();
  assert.match(a.letzterStatus().text, /unlesbar/);
  assert.equal([...gh.gists.values()][0].files["fortschritt-kaputt.json"], "{nicht json");
});

test("Geräte-ID bleibt erhalten", () => {
  const gh = falschesGitHub(), uhr = { t: 1e12 };
  const konfig = konfigSpeicher();
  const id = geraet(gh, uhr, konfig).sync.geraet();
  assert.match(id, /^[0-9a-f]{12}$/);
  assert.equal(geraet(gh, uhr, konfig).sync.geraet(), id);
});
