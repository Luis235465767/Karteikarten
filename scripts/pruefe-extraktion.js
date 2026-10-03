// Einmalige Kontrolle nach der Extraktion: Sind die Lernzettel zeichengenau identisch mit der alten Datei?
// Schlägt absichtlich fehl, sobald Inhalte später bewusst geändert werden; daher kein dauerhafter Test.
// Aufruf: node scripts/pruefe-extraktion.js
import { ladeLegacyInhalte } from "./legacy-inhalte.js";
import { ladeDateien } from "./lade-inhalte.js";
import { baueInhalte } from "../js/inhalte.js";

const alt = ladeLegacyInhalte();
const { themen, zettel } = ladeDateien();
const neu = baueInhalte(themen, zettel);
const abweichungen = [];
const vergleiche = (art, altListe, neuListe, alsArray) => {
  if (altListe.length !== neuListe.length) abweichungen.push(`${art}: ${altListe.length} alt, ${neuListe.length} neu`);
  altListe.forEach((a, i) => {
    const n = neuListe[i];
    if (!n || JSON.stringify(a) !== JSON.stringify(alsArray(n))) abweichungen.push(`${art} Index ${i}: ${JSON.stringify(a).slice(0, 80)}`);
  });
};
vergleiche("Karten", alt.CARDS, neu.karten, k => [k.thema, k.frage, k.antwort]);
vergleiche("MC", alt.MC, neu.mc, m => [m.thema, m.frage, m.optionen, m.erklaerung]);
vergleiche("Offen", alt.OPEN, neu.offen, o => [o.thema, o.frage, o.loesung]);

if (abweichungen.length) { console.error(abweichungen.join("\n")); process.exit(1); }
console.log(`Zeichengenau identisch: ${alt.CARDS.length} Karten, ${alt.MC.length} MC, ${alt.OPEN.length} offene Fragen, gleiche Reihenfolge.`);
