import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pruefeInhalte, baueInhalte } from "../js/inhalte.js";
import { ladeDateien } from "../scripts/lade-inhalte.js";
import { ladeLegacyInhalte } from "../scripts/legacy-inhalte.js";

const echte = ladeDateien();
const kopie = o => JSON.parse(JSON.stringify(o));

function miniInhalte() {
  return {
    themen: { themen: [{ kuerzel: "X", name: "Test", datei: "x.json", farbe: { hell: "#111111", dunkel: "#eeeeee" } }] },
    zettel: {
      "x.json": {
        thema: "X",
        karten: [{ id: "X-001", frage: "F1", antwort: "A1" }, { id: "X-002", frage: "F2", antwort: "A2" }],
        mc: [{ id: "X-mc-001", frage: "Q", richtig: "r", falsch: ["a", "b", "c"], erklaerung: "E" }],
        offen: [{ id: "X-of-001", frage: "O", loesung: "L" }],
      },
    },
  };
}

test("die echten Lernzettel bestehen die Prüfung", () => {
  assert.deepEqual(echte.fehler, []);
  assert.deepEqual(pruefeInhalte(echte.themen, echte.zettel), []);
});

test("Lernzettel-Reihenfolge: Themen in Reihenfolge der Themenliste, darin Dateireihenfolge", () => {
  const { karten, themen } = baueInhalte(echte.themen, echte.zettel);
  assert.deepEqual(themen.map(t => t.kuerzel), ["A", "K", "H", "N", "L", "B", "M"]);
  assert.equal(karten[0].id, "A-001");
  assert.equal(karten.at(-1).id, "M-018");
  const reihenfolge = [...new Set(karten.map(k => k.thema))].join("");
  assert.equal(reihenfolge, "AKHNLBM");
});

test("MC: optionen[0] ist die richtige Antwort", () => {
  const { mc } = baueInhalte(echte.themen, echte.zettel);
  const m = mc.find(x => x.id === "M-mc-001");
  assert.deepEqual(m.optionen, ["Belegzellen", "Hauptzellen", "G-Zellen", "ECL-Zellen"]);
});

test("gültige Mini-Inhalte haben keine Fehler", () => {
  const { themen, zettel } = miniInhalte();
  assert.deepEqual(pruefeInhalte(themen, zettel), []);
});

test("doppelte ID wird gemeldet", () => {
  const { themen, zettel } = miniInhalte();
  zettel["x.json"].karten[1].id = "X-001";
  assert.match(pruefeInhalte(themen, zettel).join("\n"), /X-001.*doppelt/);
});

test("ID mit falschem Muster wird gemeldet", () => {
  const { themen, zettel } = miniInhalte();
  zettel["x.json"].mc[0].id = "X-007";
  assert.match(pruefeInhalte(themen, zettel).join("\n"), /Muster X-mc-001/);
});

test("MC mit nur zwei falschen Antworten oder doppelten Optionen wird gemeldet", () => {
  let { themen, zettel } = miniInhalte();
  zettel["x.json"].mc[0].falsch = ["a", "b"];
  assert.match(pruefeInhalte(themen, zettel).join("\n"), /genau 3/);
  ({ themen, zettel } = miniInhalte());
  zettel["x.json"].mc[0].falsch = ["a", "a", "r"];
  assert.match(pruefeInhalte(themen, zettel).join("\n"), /nicht alle verschieden/);
});

test("leere Felder, fehlende Datei, falsches Thema und ungültige Farbe werden gemeldet", () => {
  let { themen, zettel } = miniInhalte();
  zettel["x.json"].karten[0].antwort = "  ";
  assert.match(pruefeInhalte(themen, zettel).join("\n"), /„antwort“ fehlt oder ist leer/);
  ({ themen, zettel } = miniInhalte());
  assert.match(pruefeInhalte(themen, {}).join("\n"), /x\.json fehlt/);
  zettel["x.json"].thema = "Y";
  assert.match(pruefeInhalte(themen, zettel).join("\n"), /erwartet "X"/);
  const t2 = kopie(themen); t2.themen[0].farbe.hell = "rot";
  assert.match(pruefeInhalte(t2, miniInhalte().zettel).join("\n"), /farbe/);
});

test("eingefrorene Zuordnung passt zur alten Datei und alle IDs existieren noch", () => {
  const map = JSON.parse(readFileSync(new URL("../legacy/index-map.json", import.meta.url), "utf8"));
  const alt = ladeLegacyInhalte();
  assert.equal(map.karten.length, alt.CARDS.length);
  assert.equal(map.mc.length, alt.MC.length);
  map.karten.forEach((e, i) => { assert.equal(e.index, i); assert.equal(e.frage, alt.CARDS[i][1]); });
  map.mc.forEach((e, i) => { assert.equal(e.index, i); assert.equal(e.frage, alt.MC[i][1]); });
  const { karten, mc } = baueInhalte(echte.themen, echte.zettel);
  const ids = new Set([...karten, ...mc].map(e => e.id));
  for (const e of [...map.karten, ...map.mc]) assert.ok(ids.has(e.id), `${e.id} fehlt`);
  assert.equal(new Set(map.karten.map(e => e.id)).size, map.karten.length);
});
