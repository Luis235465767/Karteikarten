// Migriert eine Fortschrittsdatei der claude.ai-Version und prüft die Zuordnung unabhängig nach.
// Aufruf: node scripts/migriere-datei.js <alte-datei.json> <neue-datei.json> [prueftabelle.md]
//
// Die Prüfung vergleicht für jeden Eintrag den Fragetext an Index i in der ORIGINAL-HTML mit dem Fragetext,
// den die zugeordnete ID in den AKTUELLEN Lernzetteln hat. Sie nutzt also nicht die in der Zuordnung
// gespeicherten Texte, sondern die beiden unabhängigen Quellen.
import { readFileSync, writeFileSync } from "node:fs";
import { migriereLegacy } from "../js/migration.js";
import { erkenneFormat, exportiere, pruefeStand } from "../js/fortschritt.js";
import { baueInhalte } from "../js/inhalte.js";
import { ladeDateien } from "./lade-inhalte.js";
import { ladeLegacyInhalte } from "./legacy-inhalte.js";

export function pruefeMigration(alt, neu, legacyInhalte, inhalte) {
  const fehler = [];
  const zeilen = [];
  const kartenNachId = new Map(inhalte.karten.map(k => [k.id, k]));
  const mcNachId = new Map(inhalte.mc.map(m => [m.id, m]));
  const vergebeneIds = new Map();
  const merke = (id, wo) => { if (vergebeneIds.has(id)) fehler.push(`${id} doppelt vergeben (${vergebeneIds.get(id)} und ${wo})`); vergebeneIds.set(id, wo); };

  const altKarten = Object.entries(alt.srs ?? {});
  const neuKartenIds = Object.keys(neu.karten);
  if (altKarten.length !== neuKartenIds.length) fehler.push(`Anzahl Karten: alt ${altKarten.length}, neu ${neuKartenIds.length}`);
  for (const [index, e] of altKarten) {
    const original = legacyInhalte.CARDS[+index];
    const treffer = neuKartenIds.filter(id => kartenNachId.get(id)?.frage === original?.[1] && kartenNachId.get(id)?.thema === original?.[0]);
    if (treffer.length !== 1) { fehler.push(`Karte ${index}: ${treffer.length} passende neue Einträge`); continue; }
    const id = treffer[0];
    merke(id, `Karte ${index}`);
    const n = neu.karten[id];
    if (n.b !== e.b || n.d !== e.d) fehler.push(`Karte ${index} → ${id}: Stufe/Fälligkeit weichen ab`);
    zeilen.push({ art: "Karte", index: +index, id, thema: original[0], frage: original[1], b: e.b, d: e.d });
  }
  const altMc = Object.entries(alt.answers ?? {});
  if (altMc.length !== Object.keys(neu.mc).length) fehler.push(`Anzahl MC: alt ${altMc.length}, neu ${Object.keys(neu.mc).length}`);
  for (const [index, e] of altMc) {
    const original = legacyInhalte.MC[+index];
    const treffer = Object.keys(neu.mc).filter(id => mcNachId.get(id)?.frage === original?.[1]);
    if (treffer.length !== 1) { fehler.push(`MC ${index}: ${treffer.length} passende neue Einträge`); continue; }
    const id = treffer[0];
    merke(id, `MC ${index}`);
    const n = neu.mc[id];
    if (JSON.stringify(n.order) !== JSON.stringify(e.order) || n.pick !== (e.pick ?? null)) fehler.push(`MC ${index} → ${id}: Antwortreihenfolge/Antwort weichen ab`);
    // Die gespeicherte Reihenfolge verweist auf Optionen; die müssen ebenfalls gleich sein
    if (JSON.stringify(mcNachId.get(id).optionen) !== JSON.stringify(original[2])) fehler.push(`MC ${index} → ${id}: Antwortoptionen weichen ab`);
    zeilen.push({ art: "MC", index: +index, id, thema: original[0], frage: original[1], order: e.order, pick: e.pick });
  }
  if (alt.session) {
    const ueber = alt.session.deck.map(i => inhalte.karten.find(k => k.frage === legacyInhalte.CARDS[i]?.[1])?.id);
    if (JSON.stringify(ueber) !== JSON.stringify(neu.session?.deck)) fehler.push("Angefangene Runde: Reihenfolge oder Karten weichen ab");
    if (neu.session && (neu.session.pos !== alt.session.pos || neu.session.sys !== alt.session.sys || neu.session.mode !== alt.session.mode || neu.session.day !== alt.session.day)) fehler.push("Angefangene Runde: Position, Thema, Modus oder Tag weichen ab");
  }
  const proThema = (liste, f) => liste.reduce((m, x) => ({ ...m, [f(x)]: (m[f(x)] ?? 0) + 1 }), {});
  return {
    fehler, zeilen,
    zaehlung: {
      kartenAlt: proThema(altKarten, ([i]) => legacyInhalte.CARDS[+i][0]),
      kartenNeu: proThema(neuKartenIds, id => kartenNachId.get(id).thema),
      mcAlt: proThema(altMc, ([i]) => legacyInhalte.MC[+i][0]),
      mcNeu: proThema(Object.keys(neu.mc), id => mcNachId.get(id).thema),
    },
  };
}

function prueftabelle(ergebnis, alt, neu) {
  const datum = ms => new Date(ms).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
  const esc = s => String(s).replace(/\|/g, "\\|");
  const z = ergebnis.zaehlung;
  const themen = ["A", "K", "H", "N", "L", "B", "M"];
  let md = `# Prüftabelle Migration\n\nQuelle: Fortschrittsdatei vom ${datum(alt.updated)}\n\n`;
  md += ergebnis.fehler.length ? `**${ergebnis.fehler.length} Abweichungen:**\n\n${ergebnis.fehler.map(f => "- " + f).join("\n")}\n\n` : "**Ergebnis: keine Abweichungen.** Jeder Eintrag wurde über den Fragetext der Original-HTML seiner neuen ID zugeordnet; Stufe, Fälligkeit und Antwortreihenfolge sind identisch.\n\n";
  md += "| Thema | Karten alt | Karten neu | MC alt | MC neu |\n|---|---|---|---|---|\n";
  for (const t of themen) md += `| ${t} | ${z.kartenAlt[t] ?? 0} | ${z.kartenNeu[t] ?? 0} | ${z.mcAlt[t] ?? 0} | ${z.mcNeu[t] ?? 0} |\n`;
  if (neu.session) md += `\nAngefangene Runde: ${neu.session.deck.length} Karten (${neu.session.deck.join(", ")}), Position ${neu.session.pos}, Thema ${neu.session.sys}, Tag ${neu.session.day}\n`;
  md += "\n## Karten\n\n| Alter Index | Neue ID | Frage | Stufe | Fällig ab |\n|---|---|---|---|---|\n";
  for (const r of ergebnis.zeilen.filter(r => r.art === "Karte").sort((a, b) => a.index - b.index)) md += `| ${r.index} | ${r.id} | ${esc(r.frage)} | ${r.b} | ${datum(r.d)} |\n`;
  md += "\n## Multiple Choice\n\n| Alter Index | Neue ID | Frage | Reihenfolge | Antwort |\n|---|---|---|---|---|\n";
  for (const r of ergebnis.zeilen.filter(r => r.art === "MC").sort((a, b) => a.index - b.index)) md += `| ${r.index} | ${r.id} | ${esc(r.frage)} | ${r.order.join(",")} | ${r.pick ?? "–"} |\n`;
  return md;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [quelle, ziel, tabelle] = process.argv.slice(2);
  if (!quelle || !ziel) { console.error("Aufruf: node scripts/migriere-datei.js <alt.json> <neu.json> [prueftabelle.md]"); process.exit(2); }
  const alt = JSON.parse(readFileSync(quelle, "utf8"));
  if (erkenneFormat(alt) !== "legacy") { console.error("Die Datei ist nicht im alten Format."); process.exit(1); }
  const map = JSON.parse(readFileSync(new URL("../legacy/index-map.json", import.meta.url), "utf8"));
  const neu = migriereLegacy(alt, map);
  if (pruefeStand(neu).fehler.length) throw new Error("Migrierter Stand ist ungültig");
  const { themen, zettel } = ladeDateien();
  const ergebnis = pruefeMigration(alt, neu, ladeLegacyInhalte(), baueInhalte(themen, zettel));
  if (tabelle) writeFileSync(tabelle, prueftabelle(ergebnis, alt, neu));
  if (ergebnis.fehler.length) { console.error(ergebnis.fehler.join("\n")); process.exit(1); }
  writeFileSync(ziel, exportiere(neu, Date.now()));
  console.log(`OK: ${Object.keys(neu.karten).length} Karten, ${Object.keys(neu.mc).length} MC-Einträge, Runde mit ${neu.session?.deck.length ?? 0} Karten migriert und geprüft.`);
  console.log("Karten je Thema:", JSON.stringify(ergebnis.zaehlung.kartenNeu));
}
