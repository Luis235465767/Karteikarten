// Einmaliges Werkzeug: erzeugt aus der alten HTML-Datei die Lernzettel-Dateien,
// inhalte/themen.json und legacy/index-map.json. Danach werden die JSON-Dateien
// direkt gepflegt; dieses Skript bleibt nur zur Nachvollziehbarkeit im Repo.
// Aufruf: node scripts/extrahiere-inhalte.js
import { writeFileSync } from "node:fs";
import { ladeLegacyInhalte } from "./legacy-inhalte.js";

const THEMEN = [
  { kuerzel: "A", name: "Atmung", datei: "atmung.json", farbe: { hell: "#127a78", dunkel: "#3fb3ae" } },
  { kuerzel: "K", name: "Kreislauf & Gefäße", datei: "kreislauf.json", farbe: { hell: "#3a4ea0", dunkel: "#8295e6" } },
  { kuerzel: "H", name: "Herz", datei: "herz.json", farbe: { hell: "#bf3a2b", dunkel: "#ee7a68" } },
  { kuerzel: "N", name: "Harnsystem", datei: "harnsystem.json", farbe: { hell: "#a8700f", dunkel: "#e0a93f" } },
  { kuerzel: "L", name: "Lymphsystem", datei: "lymphsystem.json", farbe: { hell: "#4a7a26", dunkel: "#8cc063" } },
  { kuerzel: "B", name: "Blut", datei: "blut.json", farbe: { hell: "#8c2556", dunkel: "#e07aa8" } },
  { kuerzel: "M", name: "Magen", datei: "magen.json", farbe: { hell: "#6b4fa0", dunkel: "#b39ae8" } },
];

const { CARDS, MC, OPEN } = ladeLegacyInhalte();
const nr = n => String(n).padStart(3, "0");
const zaehler = {};
const naechsteId = (thema, art) => {
  const k = thema + art;
  zaehler[k] = (zaehler[k] || 0) + 1;
  return `${thema}-${art ? art + "-" : ""}${nr(zaehler[k])}`;
};

const zettel = Object.fromEntries(THEMEN.map(t => [t.kuerzel, { thema: t.kuerzel, karten: [], mc: [], offen: [] }]));
const indexMap = { hinweis: "Eingefrorene Zuordnung der alten Array-Indizes (claude.ai-Version) zu den neuen IDs. Nie ändern.", karten: [], mc: [] };

CARDS.forEach(([thema, frage, antwort], i) => {
  const id = naechsteId(thema, "");
  zettel[thema].karten.push({ id, frage, antwort });
  indexMap.karten.push({ index: i, id, frage });
});
MC.forEach(([thema, frage, [richtig, ...falsch], erklaerung], i) => {
  const id = naechsteId(thema, "mc");
  zettel[thema].mc.push({ id, frage, richtig, falsch, erklaerung });
  indexMap.mc.push({ index: i, id, frage });
});
OPEN.forEach(([thema, frage, loesung]) => {
  zettel[thema].offen.push({ id: naechsteId(thema, "of"), frage, loesung });
});

const json = o => JSON.stringify(o, null, 2) + "\n";
for (const t of THEMEN) writeFileSync(new URL(`../inhalte/${t.datei}`, import.meta.url), json(zettel[t.kuerzel]));
writeFileSync(new URL("../inhalte/themen.json", import.meta.url), json({ themen: THEMEN }));
writeFileSync(new URL("../legacy/index-map.json", import.meta.url), json(indexMap));
console.log(`${CARDS.length} Karten, ${MC.length} MC, ${OPEN.length} offene Fragen geschrieben.`);
