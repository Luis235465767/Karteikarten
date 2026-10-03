// Prüft alle Lernzettel. Läuft vor jedem Deploy; bei Fehlern wird nicht veröffentlicht.
// Aufruf: npm run pruefen
import { ladeDateien } from "./lade-inhalte.js";
import { pruefeInhalte, baueInhalte } from "../js/inhalte.js";
import { readFileSync } from "node:fs";

let fehler;
let dateien;
try {
  dateien = ladeDateien();
  fehler = dateien.fehler.length ? dateien.fehler : pruefeInhalte(dateien.themen, dateien.zettel);
} catch (e) {
  fehler = [e.message];
}

// Alle IDs aus der Zeit der claude.ai-Version müssen weiter existieren, sonst ginge Fortschritt verloren.
if (!fehler.length) {
  const { karten, mc } = baueInhalte(dateien.themen, dateien.zettel);
  const vorhanden = new Set([...karten, ...mc].map(e => e.id));
  const map = JSON.parse(readFileSync(new URL("../legacy/index-map.json", import.meta.url), "utf8"));
  for (const e of [...map.karten, ...map.mc]) if (!vorhanden.has(e.id)) fehler.push(`ID ${e.id} wurde entfernt, ist aber Teil der alten Zuordnung (legacy/index-map.json). Einträge mit Lernstand nicht löschen.`);
}

if (fehler.length) {
  console.error(`Inhaltsprüfung fehlgeschlagen (${fehler.length}):`);
  for (const f of fehler) console.error("  - " + f);
  process.exit(1);
}
const { karten, mc, offen, themen } = baueInhalte(dateien.themen, dateien.zettel);
console.log(`Inhalte in Ordnung: ${themen.length} Themen, ${karten.length} Karten, ${mc.length} MC, ${offen.length} offene Fragen.`);
