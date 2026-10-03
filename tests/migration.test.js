import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migriereLegacy, MigrationsFehler } from "../js/migration.js";
import { pruefeStand } from "../js/fortschritt.js";
import { baueInhalte } from "../js/inhalte.js";
import { ladeDateien } from "../scripts/lade-inhalte.js";
import { ladeLegacyInhalte } from "../scripts/legacy-inhalte.js";
import { pruefeMigration } from "../scripts/migriere-datei.js";

const MAP = JSON.parse(readFileSync(new URL("../legacy/index-map.json", import.meta.url), "utf8"));
const LEGACY = ladeLegacyInhalte();
const { themen, zettel } = ladeDateien();
const INHALTE = baueInhalte(themen, zettel);
const T = Date.parse("2026-10-03T20:21:44Z");

// Synthetischer Stand im alten Format, deckt Anfang, Grenzen zwischen Themen und das angehängte Magen-Thema ab
function altStand() {
  const srs = {};
  for (const i of [0, 62, 63, 100, 131, 132, 171, 172, 196, 197, 218, 219, 236]) srs[i] = { b: i % 6, d: T + i * 1000 };
  const answers = {};
  for (const i of [0, 18, 19, 72, 73, 83]) answers[i] = { order: [3, 0, 2, 1], pick: i === 73 ? 2 : null };
  return { srs, answers, session: { deck: [74, 70, 236], pos: 1, mode: "due", sys: "all", t: T, day: "Sat Oct 03 2026" }, updated: T };
}

test("Migration ordnet jeden Eintrag der richtigen ID zu (über die Original-HTML nachgeprüft)", () => {
  const alt = altStand();
  const neu = migriereLegacy(alt, MAP);
  assert.deepEqual(pruefeStand(neu).fehler, []);
  const ergebnis = pruefeMigration(alt, neu, LEGACY, INHALTE);
  assert.deepEqual(ergebnis.fehler, []);
  assert.equal(neu.karten["A-001"].b, 0);
  assert.deepEqual(neu.karten["M-018"], { b: 236 % 6, d: T + 236000, u: T }); // letzte Karte (Magen, per push angehängt)
  assert.deepEqual(neu.karten["K-001"], { b: 63 % 6, d: T + 63000, u: T });   // erste Kreislauf-Karte
  assert.equal(neu.karten["A-063"].b, 62 % 6);
  assert.deepEqual(neu.mc["M-mc-001"], { order: [3, 0, 2, 1], pick: 2, u: T });
  assert.deepEqual(neu.session.deck, ["K-012", "K-008", "M-018"]);
  assert.equal(neu.session.pos, 1);
});

test("Indexgrenzen zwischen Themen stimmen mit der alten Datei überein", () => {
  const grenzen = { 0: "A-001", 62: "A-063", 63: "K-001", 100: "K-038", 101: "H-001", 131: "H-031", 132: "N-001", 236: "M-018" };
  for (const [i, id] of Object.entries(grenzen)) assert.equal(MAP.karten[i].id, id, `Index ${i}`);
  const mcGrenzen = { 0: "A-mc-001", 18: "A-mc-019", 19: "K-mc-001", 72: "B-mc-011", 73: "M-mc-001", 83: "M-mc-011" };
  for (const [i, id] of Object.entries(mcGrenzen)) assert.equal(MAP.mc[i].id, id, `MC-Index ${i}`);
});

test("Migration ist verlustfrei: gleiche Anzahl, identische Werte", () => {
  const alt = altStand();
  const neu = migriereLegacy(alt, MAP);
  assert.equal(Object.keys(neu.karten).length, Object.keys(alt.srs).length);
  assert.equal(Object.keys(neu.mc).length, Object.keys(alt.answers).length);
  for (const [i, e] of Object.entries(alt.srs)) {
    const n = neu.karten[MAP.karten[i].id];
    assert.equal(n.b, e.b); assert.equal(n.d, e.d);
  }
});

test("unbekannter Index bricht ab, statt still zu verwerfen", () => {
  const alt = altStand();
  alt.srs[237] = { b: 1, d: T };
  assert.throws(() => migriereLegacy(alt, MAP), e => e instanceof MigrationsFehler && /Index 237/.test(e.message));
  const alt2 = altStand();
  alt2.answers[84] = { order: [0, 1, 2, 3], pick: null };
  assert.throws(() => migriereLegacy(alt2, MAP), /MC-Frage mit Index 84/);
  const alt3 = altStand();
  alt3.session.deck.push(999);
  assert.throws(() => migriereLegacy(alt3, MAP), /Runde/);
});

test("ungültige Einträge brechen ab", () => {
  const alt = altStand();
  alt.srs[5] = { b: 7, d: T };
  assert.throws(() => migriereLegacy(alt, MAP), /Karte 5/);
  const alt2 = altStand();
  alt2.answers[3] = { order: [0, 1, 1, 3], pick: null };
  assert.throws(() => migriereLegacy(alt2, MAP), /MC-Frage 3/);
});

test("Nachprüfung erkennt eine falsche Zuordnung", () => {
  const alt = altStand();
  const neu = migriereLegacy(alt, MAP);
  // Werte zweier Karten vertauschen, als hätte die Zuordnung einen Fehler
  [neu.karten["A-001"], neu.karten["A-063"]] = [neu.karten["A-063"], neu.karten["A-001"]];
  assert.match(pruefeMigration(alt, neu, LEGACY, INHALTE).fehler.join("\n"), /Stufe\/Fälligkeit/);
  const neu2 = migriereLegacy(alt, MAP);
  neu2.mc["A-mc-001"].order = [0, 1, 2, 3];
  assert.match(pruefeMigration(alt, neu2, LEGACY, INHALTE).fehler.join("\n"), /Antwortreihenfolge/);
  const neu3 = migriereLegacy(alt, MAP);
  delete neu3.karten["M-018"];
  assert.match(pruefeMigration(alt, neu3, LEGACY, INHALTE).fehler.join("\n"), /Anzahl Karten/);
});

test("fehlende Teile im alten Format sind erlaubt", () => {
  const neu = migriereLegacy({ srs: { 0: { b: 1, d: T } } }, MAP, T);
  assert.deepEqual(neu.mc, {});
  assert.equal(neu.session, null);
  assert.equal(neu.karten["A-001"].u, T);
});
