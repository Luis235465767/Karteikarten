// Synchronisierung über ein privates GitHub-Gist.
//
// Jedes Gerät schreibt nur seine eigene Datei „fortschritt-<Gerät>.json“ im Gist und liest beim Abgleich
// alle Dateien. So kann kein Gerät die Änderungen eines anderen überschreiben, auch nicht beim
// Sofort-Sichern während des Schließens. Zusammengeführt wird pro Karte nach der jüngsten Änderung
// (siehe fuehreZusammen in fortschritt.js). Lokal ist immer zuerst gespeichert; die Synchronisierung
// ist eine zusätzliche Kopie.
import { fuehreZusammen, pruefeStand } from "./fortschritt.js";

export const GIST_BESCHREIBUNG = "Physiologie-Lernkarten: Fortschritt (automatisch gepflegt, bitte nicht umbenennen)";
export const DATEI_MUSTER = /^fortschritt-[\w-]+\.json$/;
const API = "https://api.github.com";
const VERZOEGERUNG = 2000;
const WIEDERHOLUNG = [5000, 15000, 60000, 300000];
const KEEPALIVE_GRENZE = 60000; // Browser erlauben bei keepalive höchstens 64 KB

export class SyncFehler extends Error {
  constructor(text, art) { super(text); this.art = art; } // art: "token" | "netz" | "daten" | "api"
}

/** Kleiner Client für die Gist-API. `fetchFn` ist in Tests ersetzbar. */
export function gistApi(token, fetchFn = fetch) {
  async function anfrage(pfad, { methode = "GET", koerper, keepalive = false } = {}) {
    let r;
    try {
      r = await fetchFn(API + pfad, {
        method: methode, keepalive, cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(koerper ? { "Content-Type": "application/json" } : {}) },
        body: koerper ? JSON.stringify(koerper) : undefined,
      });
    } catch {
      throw new SyncFehler("keine Verbindung zu GitHub", "netz");
    }
    if (r.status === 401) throw new SyncFehler("Token ungültig oder abgelaufen", "token");
    if (r.status === 403 || r.status === 404) {
      const rest = r.headers?.get?.("x-ratelimit-remaining");
      if (r.status === 403 && rest === "0") throw new SyncFehler("GitHub-Anfragelimit erreicht, später erneut", "netz");
      throw new SyncFehler(r.status === 404 && pfad.startsWith("/gists/") ? "Gist nicht gefunden" : "Token hat keine Berechtigung für Gists", r.status === 404 ? "api" : "token");
    }
    if (!r.ok) throw new SyncFehler(`GitHub antwortet mit Fehler ${r.status}`, r.status >= 500 ? "netz" : "api");
    return r.status === 204 ? null : r.json();
  }
  return {
    async findeGist() {
      for (let seite = 1; seite <= 10; seite++) {
        const liste = await anfrage(`/gists?per_page=100&page=${seite}`);
        const treffer = liste.find(g => g.description === GIST_BESCHREIBUNG);
        if (treffer) return treffer.id;
        if (liste.length < 100) return null;
      }
      return null;
    },
    async erstelleGist(dateiname, inhalt) {
      const g = await anfrage("/gists", { methode: "POST", koerper: { description: GIST_BESCHREIBUNG, public: false, files: { [dateiname]: { content: inhalt } } } });
      return g.id;
    },
    async ladeDateien(gistId) {
      const g = await anfrage(`/gists/${gistId}`);
      const out = {};
      for (const [name, f] of Object.entries(g.files ?? {})) {
        if (!DATEI_MUSTER.test(name)) continue;
        if (f.truncated) {
          try { out[name] = await (await fetchFn(f.raw_url)).text(); } catch { throw new SyncFehler("keine Verbindung zu GitHub", "netz"); }
        } else out[name] = f.content;
      }
      return out;
    },
    schreibeDatei(gistId, dateiname, inhalt, keepalive = false) {
      return anfrage(`/gists/${gistId}`, { methode: "PATCH", koerper: { files: { [dateiname]: { content: inhalt } } }, keepalive });
    },
  };
}

const zufallsId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, "0")).join("");
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param {object} o
 * @param {() => object} o.holeStand            aktueller lokaler Stand
 * @param {(stand: object) => void} o.uebernimm  zusammengeführten Stand übernehmen (lokal speichern, neu anzeigen)
 * @param {(s: {text: string, zustand: string}|null) => void} o.status
 * @param {{lies: (k: string) => string|null, schreib: (k: string, v: string|null) => void}} o.konfig
 */
export function erzeugeSync({ holeStand, uebernimm, status, konfig, fetchFn = (...a) => fetch(...a), jetzt = Date.now, timer = { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) }, uhrzeit = ms => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) }) {
  let token = konfig.lies("physio-sync-token");
  let gistId = konfig.lies("physio-sync-gist");
  let geraet = konfig.lies("physio-geraet");
  if (!geraet) { geraet = zufallsId(); konfig.schreib("physio-geraet", geraet); }
  const dateiname = `fortschritt-${geraet}.json`;

  let laeuft = null, nochmal = false, verzoegert = null, wiederholung = null, versuche = 0;
  let zuletztGeschrieben = null; // Inhalt, den dieses Gerät zuletzt erfolgreich geschrieben hat
  let ungesichert = false;       // lokale Änderungen, die noch nicht im Gist sind
  let letzterErfolg = null;

  const verbunden = () => !!(token && gistId);
  const melde = (text, zustand) => status(verbunden() || zustand === "fehler" ? { text, zustand } : null);

  async function abgleichen() {
    const api = gistApi(token, fetchFn);
    const dateien = await api.ladeDateien(gistId);
    let stand = holeStand();
    let ungueltig = 0;
    for (const text of Object.values(dateien)) {
      let daten; try { daten = JSON.parse(text); } catch { ungueltig++; continue; }
      const { stand: fremd } = pruefeStand(daten); // gültige Einträge einer teilweise defekten Datei trotzdem nutzen
      if (!fremd) { ungueltig++; continue; }
      stand = fuehreZusammen(stand, fremd);
    }
    if (!gleich(stand, holeStand())) uebernimm(stand);
    const inhalt = JSON.stringify(holeStand());
    if (dateien[dateiname] !== inhalt) await api.schreibeDatei(gistId, dateiname, inhalt);
    zuletztGeschrieben = inhalt;
    ungesichert = false;
    return ungueltig;
  }

  async function synchronisiere() {
    if (!verbunden()) return;
    if (laeuft) { nochmal = true; return laeuft; }
    timer.clearTimeout(verzoegert); verzoegert = null;
    timer.clearTimeout(wiederholung); wiederholung = null;
    melde(letzterErfolg ? `Synchronisiere … (zuletzt ${uhrzeit(letzterErfolg)} Uhr)` : "Synchronisiere …", "warten");
    laeuft = (async () => {
      try {
        const ungueltig = await abgleichen();
        versuche = 0;
        letzterErfolg = jetzt();
        melde(`Synchronisiert um ${uhrzeit(letzterErfolg)} Uhr` + (ungueltig ? ` (${ungueltig} Datei im Gist unlesbar)` : ""), ungueltig ? "warten" : "ok");
      } catch (e) {
        const art = e instanceof SyncFehler ? e.art : "api";
        const text = e instanceof SyncFehler ? e.message : "unerwarteter Fehler";
        if (art === "token") melde(`Nicht synchronisiert: ${text}. Bitte unter „Fortschritt“ neu verbinden.`, "fehler");
        else {
          const warte = WIEDERHOLUNG[Math.min(versuche++, WIEDERHOLUNG.length - 1)];
          melde(`Nicht synchronisiert: ${text}. Auf diesem Gerät ist alles gespeichert, neuer Versuch läuft.`, "fehler");
          wiederholung = timer.setTimeout(() => synchronisiere(), warte);
        }
      } finally {
        laeuft = null;
      }
      if (nochmal) { nochmal = false; await synchronisiere(); }
    })();
    return laeuft;
  }

  return {
    verbunden,
    geraet: () => geraet,
    start() { if (verbunden()) return synchronisiere(); },
    synchronisiere,
    /** Nach jeder lokalen Änderung: kurz warten, damit schnelle Klicks gebündelt werden. */
    geaendert() {
      if (!verbunden()) return;
      ungesichert = true;
      timer.clearTimeout(verzoegert);
      verzoegert = timer.setTimeout(() => synchronisiere(), VERZOEGERUNG);
    },
    /** Beim Schließen: eigene Datei sofort schreiben (keepalive), ohne auf eine Antwort zu warten. */
    sofort() {
      if (!verbunden() || !ungesichert) return;
      const inhalt = JSON.stringify(holeStand());
      if (inhalt === zuletztGeschrieben) return;
      timer.clearTimeout(verzoegert); verzoegert = null;
      const keepalive = inhalt.length < KEEPALIVE_GRENZE;
      gistApi(token, fetchFn).schreibeDatei(gistId, dateiname, inhalt, keepalive)
        .then(() => { zuletztGeschrieben = inhalt; ungesichert = false; })
        .catch(() => { /* beim nächsten Öffnen wird erneut abgeglichen */ });
    },
    /** Token prüfen, vorhandenes Gist suchen oder anlegen, dann abgleichen. */
    async verbinde(neuesToken) {
      const api = gistApi(neuesToken.trim(), fetchFn);
      let id = await api.findeGist();
      if (!id) id = await api.erstelleGist(dateiname, JSON.stringify(holeStand()));
      token = neuesToken.trim(); gistId = id;
      konfig.schreib("physio-sync-token", token);
      konfig.schreib("physio-sync-gist", gistId);
      zuletztGeschrieben = null;
      await synchronisiere();
    },
    /** Entfernt Token und Gist-Verknüpfung nur auf diesem Gerät; das Gist bleibt erhalten. */
    trenne() {
      token = gistId = null;
      konfig.schreib("physio-sync-token", null);
      konfig.schreib("physio-sync-gist", null);
      timer.clearTimeout(verzoegert); timer.clearTimeout(wiederholung);
      status(null);
    },
    gistUrl: () => gistId ? `https://gist.github.com/${gistId}` : null,
  };
}
