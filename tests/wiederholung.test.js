import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerte, TAG, STUFEN_TAGE, MAX_STUFE } from "../js/srs.js";
import { baueStapel, kartenpool, neueRunde, fortsetzbareRunde, beantworte, statistik, naechsteFaelligkeit, formatiereAbstand, mische, tagesKennung } from "../js/stapel.js";

const JETZT = Date.parse("2026-10-03T18:00:00Z");
const ids = n => Array.from({ length: n }, (_, i) => `X-${String(i + 1).padStart(3, "0")}`);
// deterministischer Zufall für Misch-Tests
const zufallAus = werte => { let i = 0; return () => werte[i++ % werte.length]; };

test("Fälligkeitsabstände je Stufe sind 0/1/3/7/14/30 Tage", () => {
  assert.deepEqual(STUFEN_TAGE, [0, 1, 3, 7, 14, 30]);
  assert.equal(MAX_STUFE, 5);
});

test("Gewusst: neue Karte kommt auf Stufe 1 und ist morgen fällig", () => {
  assert.deepEqual(bewerte(undefined, true, JETZT), { b: 1, d: JETZT + TAG, u: JETZT });
});

test("Gewusst: jede Stufe steigt um 1 mit passender Fälligkeit, höchstens Stufe 5", () => {
  let e;
  const erwartet = [[1, 1], [2, 3], [3, 7], [4, 14], [5, 30], [5, 30], [5, 30]];
  for (const [b, tage] of erwartet) {
    e = bewerte(e, true, JETZT);
    assert.equal(e.b, b);
    assert.equal(e.d - JETZT, tage * TAG);
  }
});

test("Nicht gewusst: Stufe 0 und sofort fällig, egal von welcher Stufe", () => {
  for (const b of [0, 1, 3, 5]) assert.deepEqual(bewerte({ b, d: JETZT + 9 * TAG }, false, JETZT), { b: 0, d: JETZT, u: JETZT });
  assert.deepEqual(bewerte(undefined, false, JETZT), { b: 0, d: JETZT, u: JETZT });
});

test("Nach Nicht gewusst führt Gewusst von Stufe 0 auf Stufe 1 (morgen)", () => {
  const e = bewerte(bewerte({ b: 3, d: 0 }, false, JETZT), true, JETZT + 1000);
  assert.deepEqual(e, { b: 1, d: JETZT + 1000 + TAG, u: JETZT + 1000 });
});

test("Nicht gewusst: Karte erscheint in derselben Runde nach 4 anderen Karten wieder", () => {
  let runde = neueRunde({ stapel: ids(8), modus: "due", thema: "all", now: JETZT });
  let karten = {};
  ({ runde, karten } = beantworte({ runde, karten, gewusst: false, now: JETZT }));
  assert.equal(runde.pos, 1);
  assert.deepEqual(runde.deck.slice(1, 6), ["X-002", "X-003", "X-004", "X-005", "X-001"]);
  assert.equal(runde.deck.length, 9);
  assert.deepEqual(karten["X-001"], { b: 0, d: JETZT, u: JETZT });
});

test("Nicht gewusst kurz vor Rundenende: Karte kommt ans Ende, bis sie gewusst wird", () => {
  let runde = neueRunde({ stapel: ids(2), modus: "due", thema: "all", now: JETZT });
  let karten = {};
  ({ runde, karten } = beantworte({ runde, karten, gewusst: true, now: JETZT })); // X-001 gewusst
  ({ runde, karten } = beantworte({ runde, karten, gewusst: false, now: JETZT })); // X-002 nicht
  assert.deepEqual(runde.deck, ["X-001", "X-002", "X-002"]);
  ({ runde, karten } = beantworte({ runde, karten, gewusst: false, now: JETZT })); // wieder nicht
  assert.deepEqual(runde.deck, ["X-001", "X-002", "X-002", "X-002"]);
  ({ runde, karten } = beantworte({ runde, karten, gewusst: true, now: JETZT }));
  assert.equal(runde.pos, runde.deck.length);
  assert.equal(karten["X-002"].b, 1);
});

test("beantworte ändert die übergebenen Objekte nicht und ignoriert eine beendete Runde", () => {
  const runde = neueRunde({ stapel: ["X-001"], modus: "all", thema: "all", now: JETZT });
  const karten = {};
  const r = beantworte({ runde, karten, gewusst: false, now: JETZT });
  assert.deepEqual(runde.deck, ["X-001"]);
  assert.deepEqual(karten, {});
  const fertig = { ...r.runde, pos: r.runde.deck.length };
  assert.equal(beantworte({ runde: fertig, karten: r.karten, gewusst: true, now: JETZT }).runde, fertig);
});

test("Modus Fällige: erst überfällige nach ältester Fälligkeit, dann neue in Lernzettel-Reihenfolge; nicht fällige fehlen", () => {
  const pool = ids(6);
  const karten = {
    "X-001": { b: 2, d: JETZT + TAG },      // nicht fällig
    "X-002": { b: 1, d: JETZT - 1000 },     // fällig
    "X-004": { b: 0, d: JETZT - 5 * TAG },  // fällig, älter
    "X-006": { b: 3, d: JETZT },            // genau jetzt fällig
  };
  assert.deepEqual(baueStapel({ pool, karten, modus: "due", now: JETZT }), ["X-004", "X-002", "X-006", "X-003", "X-005"]);
});

test("Modus Alle: alle Karten in Reihenfolge, gemischt alle in neuer Reihenfolge", () => {
  const pool = ids(5);
  const karten = { "X-001": { b: 5, d: JETZT + 30 * TAG } };
  assert.deepEqual(baueStapel({ pool, karten, modus: "all", now: JETZT }), pool);
  const gemischt = baueStapel({ pool, karten, modus: "all", gemischt: true, now: JETZT, zufall: zufallAus([0.1, 0.7, 0.3, 0.9]) });
  assert.deepEqual([...gemischt].sort(), pool);
  assert.notDeepEqual(gemischt, pool);
});

test("Mischen im Modus Fällige mischt Wiederholungen und neue Karten getrennt", () => {
  const pool = ids(6);
  const karten = { "X-001": { b: 1, d: JETZT - 3 }, "X-002": { b: 1, d: JETZT - 2 }, "X-003": { b: 1, d: JETZT - 1 } };
  for (const z of [[0], [0.99], [0.5, 0.2]]) {
    const s = baueStapel({ pool, karten, modus: "due", gemischt: true, now: JETZT, zufall: zufallAus(z) });
    assert.deepEqual(s.slice(0, 3).sort(), ["X-001", "X-002", "X-003"]);
    assert.deepEqual(s.slice(3).sort(), ["X-004", "X-005", "X-006"]);
  }
});

test("mische behält alle Elemente und ändert das Original nicht", () => {
  const a = [1, 2, 3, 4, 5];
  const m = mische(a);
  assert.deepEqual(a, [1, 2, 3, 4, 5]);
  assert.deepEqual([...m].sort(), a);
});

test("Themenfilter", () => {
  const karten = [{ id: "A-001", thema: "A" }, { id: "K-001", thema: "K" }, { id: "A-002", thema: "A" }];
  assert.deepEqual(kartenpool(karten, "A"), ["A-001", "A-002"]);
  assert.deepEqual(kartenpool(karten, "all"), ["A-001", "K-001", "A-002"]);
});

test("Statistik: fällig, neu, gelernt, gefestigt ab Stufe 4, Anteil für den Fortschrittsbalken", () => {
  const pool = ids(6);
  const karten = {
    "X-001": { b: 0, d: JETZT },              // fällig, nicht gelernt
    "X-002": { b: 1, d: JETZT + TAG },        // gelernt
    "X-003": { b: 4, d: JETZT - 1 },          // fällig, gelernt, gefestigt
    "X-004": { b: 5, d: JETZT + 30 * TAG },   // gelernt, gefestigt
  };
  assert.deepEqual(statistik(pool, karten, JETZT), { gesamt: 6, faellig: 2, neu: 2, gelernt: 3, gefestigt: 2, anteilGelernt: 0.5 });
  assert.equal(statistik([], {}, JETZT).anteilGelernt, 0);
});

test("Nächste Fälligkeit und ihre Anzeige", () => {
  const karten = { a: { b: 1, d: JETZT + 3 * TAG }, b: { b: 1, d: JETZT + TAG }, c: { b: 0, d: JETZT } };
  assert.equal(naechsteFaelligkeit(["a", "b", "c"], karten, JETZT), JETZT + TAG);
  assert.equal(naechsteFaelligkeit(["c"], karten, JETZT), null);
  assert.equal(formatiereAbstand(TAG), "morgen");
  assert.equal(formatiereAbstand(1000), "morgen");
  assert.equal(formatiereAbstand(3 * TAG + 1000), "in 3 Tagen");
});

test("Runde wird nur am selben Tag fortgesetzt, gelöschte Karten fallen heraus", () => {
  const gueltig = new Set(["X-001", "X-002", "X-003"]);
  const runde = { ...neueRunde({ stapel: ["X-001", "X-099", "X-002", "X-003"], modus: "due", thema: "K", now: JETZT }), pos: 1 };
  const r = fortsetzbareRunde(runde, JETZT + 3600e3, gueltig);
  assert.deepEqual(r.deck, ["X-001", "X-002", "X-003"]);
  assert.equal(r.pos, 1);
  assert.equal(r.sys, "K");
  assert.equal(fortsetzbareRunde(runde, JETZT + 2 * TAG, gueltig), null);
  assert.equal(fortsetzbareRunde({ ...runde, pos: 4 }, JETZT, gueltig), null);
  assert.equal(fortsetzbareRunde(null, JETZT, gueltig), null);
});

test("Tageskennung ist im Format der alten App", () => {
  assert.match(tagesKennung(JETZT), /^\w{3} \w{3} \d{2} \d{4}$/);
});
