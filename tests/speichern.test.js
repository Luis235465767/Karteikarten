import { test } from "node:test";
import assert from "node:assert/strict";
import { erzeugeSpeicher, SCHLUESSEL, DEFEKT_PREFIX } from "../js/speicher.js";
import { leererStand, pruefeStand, fuehreZusammen, erkenneFormat, exportiere, exportDateiname, beschreibe } from "../js/fortschritt.js";

const T = Date.parse("2026-10-03T20:00:00Z");

class TestSpeicher {
  constructor() { this.daten = new Map(); this.fehlerBeimSchreiben = null; this.verfaelschen = false; this.leseFehler = false; }
  getItem(k) { if (this.leseFehler) throw new Error("SecurityError"); return this.daten.has(k) ? this.daten.get(k) : null; }
  setItem(k, v) {
    if (this.fehlerBeimSchreiben) throw this.fehlerBeimSchreiben;
    this.daten.set(k, this.verfaelschen ? v.slice(0, 10) : String(v));
  }
}

function beispielStand() {
  const s = leererStand();
  s.karten["A-001"] = { b: 2, d: T + 3 * 864e5, u: T };
  s.karten["K-010"] = { b: 0, d: T, u: T - 5 };
  s.mc["A-mc-001"] = { order: [3, 0, 2, 1], pick: null, u: T };
  s.mc["B-mc-002"] = { order: [0, 1, 2, 3], pick: 2, u: T };
  s.session = { deck: ["K-010", "K-011"], pos: 1, mode: "due", sys: "K", t: T, day: "Sat Oct 03 2026" };
  s.updated = T;
  return s;
}

test("Speichern und Laden ergeben exakt denselben Stand", () => {
  const storage = new TestSpeicher();
  const status = [];
  const sp = erzeugeSpeicher({ storage, jetzt: () => T + 1, beiStatus: s => status.push(s) });
  const stand = beispielStand();
  assert.equal(sp.speichern(stand), true);
  assert.deepEqual(status.at(-1), { ok: true, zeit: T + 1 });
  const geladen = erzeugeSpeicher({ storage }).laden();
  assert.equal(geladen.warnung, null);
  assert.deepEqual(geladen.stand, stand);
});

test("leerer Speicher ergibt leeren Stand ohne Warnung", () => {
  const { stand, warnung } = erzeugeSpeicher({ storage: new TestSpeicher() }).laden();
  assert.deepEqual(stand, leererStand());
  assert.equal(warnung, null);
});

test("Speicher voll: Fehlerstatus, nie „gespeichert“", () => {
  const storage = new TestSpeicher();
  const e = new Error("quota"); e.name = "QuotaExceededError";
  storage.fehlerBeimSchreiben = e;
  const status = [];
  const sp = erzeugeSpeicher({ storage, beiStatus: s => status.push(s) });
  assert.equal(sp.speichern(beispielStand()), false);
  assert.equal(status.length, 1);
  assert.equal(status[0].ok, false);
  assert.match(status[0].fehler, /voll/);
});

test("Kontrolle nach dem Speichern erkennt verfälschte Daten", () => {
  const storage = new TestSpeicher();
  storage.verfaelschen = true;
  const sp = erzeugeSpeicher({ storage });
  assert.equal(sp.speichern(beispielStand()), false);
  assert.equal(sp.status().ok, false);
  assert.match(sp.status().fehler, /Kontrolle/);
});

test("Speicher blockiert (privater Modus): Laden und Speichern melden Fehler", () => {
  const storage = new TestSpeicher();
  storage.leseFehler = true;
  const sp = erzeugeSpeicher({ storage });
  sp.laden();
  assert.equal(sp.status().ok, false);
  storage.fehlerBeimSchreiben = new Error("SecurityError");
  assert.equal(sp.speichern(beispielStand()), false);
});

test("beschädigte Daten werden gesichert und nicht still überschrieben", () => {
  const storage = new TestSpeicher();
  storage.daten.set(SCHLUESSEL, "{kaputt");
  const sp = erzeugeSpeicher({ storage, jetzt: () => T });
  const { stand, warnung } = sp.laden();
  assert.deepEqual(stand, leererStand());
  assert.match(warnung, /beschädigt/);
  assert.equal(storage.daten.get(DEFEKT_PREFIX + T), "{kaputt");
  assert.equal(sp.speichern(stand), true); // Original liegt gesichert, Weiterarbeiten ist erlaubt
});

test("beschädigte Daten, die nicht gesichert werden können, sperren das Speichern", () => {
  const storage = new TestSpeicher();
  storage.daten.set(SCHLUESSEL, "{kaputt");
  storage.fehlerBeimSchreiben = new Error("voll");
  const sp = erzeugeSpeicher({ storage, jetzt: () => T });
  sp.laden();
  storage.fehlerBeimSchreiben = null;
  assert.equal(sp.speichern(leererStand()), false);
  assert.equal(storage.daten.get(SCHLUESSEL), "{kaputt");
  assert.match(sp.status().fehler, /gesperrt/);
});

test("teilweise ungültige Einträge: gültige bleiben, Warnung erscheint, Original wird gesichert", () => {
  const storage = new TestSpeicher();
  const roh = beispielStand();
  roh.karten["A-002"] = { b: 9, d: "morgen" };
  storage.daten.set(SCHLUESSEL, JSON.stringify(roh));
  const { stand, warnung } = erzeugeSpeicher({ storage, jetzt: () => T }).laden();
  assert.match(warnung, /A-002/);
  assert.deepEqual(Object.keys(stand.karten).sort(), ["A-001", "K-010"]);
  assert.ok(storage.daten.has(DEFEKT_PREFIX + T));
});

test("Export → Import ergibt denselben Stand", () => {
  const stand = beispielStand();
  const text = exportiere(stand, T + 99);
  const daten = JSON.parse(text);
  assert.equal(erkenneFormat(daten), "v2");
  const { stand: zurueck, fehler } = pruefeStand(daten);
  assert.deepEqual(fehler, []);
  assert.deepEqual(zurueck, stand);
  assert.match(exportDateiname(T), /^physiologie-fortschritt-2026-10-03-\d{4}\.json$/);
});

test("Formaterkennung: neu, alt (claude.ai) und Unsinn", () => {
  assert.equal(erkenneFormat(beispielStand()), "v2");
  assert.equal(erkenneFormat({ srs: { 0: { b: 1, d: T } }, answers: {}, session: null, updated: T }), "legacy");
  assert.equal(erkenneFormat({ foo: 1 }), null);
  assert.equal(erkenneFormat([1, 2]), null);
  assert.equal(erkenneFormat(null), null);
});

test("Prüfung lehnt ungültige Quiz-Einträge und Runden ab", () => {
  const s = beispielStand();
  s.mc["X-mc-001"] = { order: [0, 0, 1, 2], pick: null };
  s.mc["X-mc-002"] = { order: [0, 1, 2, 3], pick: 7 };
  s.session = { deck: [1, 2], pos: 0, t: T };
  const { fehler, stand } = pruefeStand(s);
  assert.equal(fehler.length, 3);
  assert.equal(stand.mc["X-mc-001"], undefined);
  assert.equal(stand.session, null);
});

test("Beschreibung für die Import-Vorschau", () => {
  assert.deepEqual(beschreibe(beispielStand()), { karten: 2, beantworteteFragen: 1, fragenMitStand: 2, stufen: [1, 0, 1, 0, 0, 0], updated: T });
});

test("Zusammenführen: pro Karte gewinnt die jüngere Änderung, nichts geht verloren", () => {
  const a = leererStand(), b = leererStand();
  a.karten.x = { b: 3, d: 1, u: 100 };
  b.karten.x = { b: 1, d: 2, u: 200 };   // jünger → gewinnt, auch mit niedrigerer Stufe
  a.karten.y = { b: 2, d: 3, u: 300 };
  b.karten.y = { b: 4, d: 4, u: 250 };   // älter → verliert
  a.karten.nurA = { b: 1, d: 5, u: 10 };
  b.karten.nurB = { b: 1, d: 6, u: 10 };
  a.mc.q = { order: [0, 1, 2, 3], pick: null, u: 50 };
  b.mc.q = { order: [0, 1, 2, 3], pick: 1, u: 60 };
  const z = fuehreZusammen(a, b);
  assert.deepEqual(z.karten, { x: b.karten.x, y: a.karten.y, nurA: a.karten.nurA, nurB: b.karten.nurB });
  assert.equal(z.mc.q.pick, 1);
  assert.deepEqual(fuehreZusammen(b, a).karten, z.karten);
});

test("Zusammenführen: Zurücksetzen auf einem Gerät kommt auf dem anderen an", () => {
  const a = leererStand(), b = leererStand();
  b.karten.alt = { b: 3, d: 1, u: 100 };
  b.karten.danach = { b: 1, d: 1, u: 600 };   // nach dem Reset gelernt → bleibt
  b.session = { deck: ["alt"], pos: 0, mode: "due", sys: "all", t: 100, day: "" };
  a.resetKarten = 500;
  a.mc.q = { order: [0, 1, 2, 3], pick: 0, u: 100 };
  const z = fuehreZusammen(a, b);
  assert.deepEqual(Object.keys(z.karten), ["danach"]);
  assert.equal(z.resetKarten, 500);
  assert.equal(z.session, null);
  assert.equal(z.mc.q.pick, 0); // Quiz wurde nicht zurückgesetzt
});

test("Zusammenführen: die neuere Runde gewinnt", () => {
  const a = leererStand(), b = leererStand();
  a.session = { deck: ["a"], pos: 0, mode: "due", sys: "all", t: 10, day: "" };
  b.session = { deck: ["b"], pos: 0, mode: "due", sys: "all", t: 20, day: "" };
  assert.deepEqual(fuehreZusammen(a, b).session.deck, ["b"]);
});
