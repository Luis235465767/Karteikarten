// Übersetzt den Lernstand der claude.ai-Version (Array-Indizes) in das ID-Format v2.
// Grundlage ist die eingefrorene Zuordnung legacy/index-map.json. Nichts wird still verworfen:
// Unbekannte Indizes oder ungültige Einträge brechen die Migration mit einer Fehlermeldung ab.
import { leererStand } from "./fortschritt.js";

export class MigrationsFehler extends Error {}

const istZahl = x => typeof x === "number" && Number.isFinite(x);

export function migriereLegacy(daten, indexMap, jetzt = Date.now()) {
  const kartenId = new Map(indexMap.karten.map(e => [String(e.index), e.id]));
  const mcId = new Map(indexMap.mc.map(e => [String(e.index), e.id]));
  const probleme = [];
  const u = istZahl(daten.updated) ? daten.updated : jetzt;
  const stand = leererStand();
  stand.updated = u;

  for (const [index, e] of Object.entries(daten.srs ?? {})) {
    const id = kartenId.get(index);
    if (!id) { probleme.push(`Karte mit Index ${index} gibt es in der alten Version nicht`); continue; }
    if (!e || !Number.isInteger(e.b) || e.b < 0 || e.b > 5 || !istZahl(e.d)) { probleme.push(`Karte ${index} (${id}): ungültiger Eintrag ${JSON.stringify(e)}`); continue; }
    stand.karten[id] = { b: e.b, d: e.d, u };
  }
  for (const [index, e] of Object.entries(daten.answers ?? {})) {
    const id = mcId.get(index);
    if (!id) { probleme.push(`MC-Frage mit Index ${index} gibt es in der alten Version nicht`); continue; }
    const orderOk = e && Array.isArray(e.order) && [...e.order].sort().join() === "0,1,2,3";
    const pickOk = e && (e.pick === null || e.pick === undefined || (Number.isInteger(e.pick) && e.pick >= 0 && e.pick <= 3));
    if (!orderOk || !pickOk) { probleme.push(`MC-Frage ${index} (${id}): ungültiger Eintrag ${JSON.stringify(e)}`); continue; }
    stand.mc[id] = { order: e.order.slice(), pick: e.pick ?? null, u };
  }
  const s = daten.session;
  if (s) {
    const deck = Array.isArray(s.deck) ? s.deck.map(i => kartenId.get(String(i))) : null;
    if (!deck || deck.some(x => !x)) probleme.push("Angefangene Runde enthält unbekannte Karten");
    else stand.session = { deck, pos: Number.isInteger(s.pos) ? s.pos : 0, mode: s.mode === "all" ? "all" : "due", sys: typeof s.sys === "string" ? s.sys : "all", t: istZahl(s.t) ? s.t : u, day: String(s.day ?? "") };
  }
  if (probleme.length) throw new MigrationsFehler("Migration abgebrochen, nichts wurde übernommen:\n- " + probleme.join("\n- "));
  return stand;
}
