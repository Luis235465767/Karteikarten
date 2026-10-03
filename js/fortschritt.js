// Fortschrittsformat (Version 2): prüfen, zusammenführen, exportieren. Reine Funktionen.
//
// {
//   version: 2,
//   karten:  { "<Karten-ID>": { b: Stufe 0–5, d: fällig ab (Unix-ms), u: letzte Änderung (Unix-ms) } },
//   mc:      { "<MC-ID>": { order: [Reihenfolge der Optionen, 0 = richtig], pick: gewählte Option oder null, u } },
//   session: angefangene Runde { deck: [IDs], pos, mode, sys, t, day } oder null,
//   resetKarten, resetQuiz: Zeitpunkt des letzten Zurücksetzens (0 = nie),
//   updated: Zeitpunkt der letzten Änderung
// }

export const VERSION = 2;

export const leererStand = () => ({ version: VERSION, karten: {}, mc: {}, session: null, resetKarten: 0, resetQuiz: 0, updated: 0 });

const istZahl = x => typeof x === "number" && Number.isFinite(x);
const istObjekt = x => x !== null && typeof x === "object" && !Array.isArray(x);
const istReihenfolge = o => Array.isArray(o) && o.length === 4 && [...o].sort().join() === "0,1,2,3";

/** Erkennt das Format einer geladenen Datei: "v2", "legacy" (claude.ai-Version mit Indizes) oder null. */
export function erkenneFormat(daten) {
  if (!istObjekt(daten)) return null;
  if (daten.version === VERSION && istObjekt(daten.karten)) return "v2";
  if (daten.version === undefined && (istObjekt(daten.srs) || istObjekt(daten.answers))) return "legacy";
  return null;
}

/**
 * Prüft einen Stand im Format v2 streng. Ungültige Einträge werden nicht still verworfen:
 * dann ist `fehler` nicht leer und der Aufrufer entscheidet (z. B. Import abbrechen).
 */
export function pruefeStand(daten) {
  const fehler = [];
  if (erkenneFormat(daten) !== "v2") return { stand: null, fehler: ["Kein Fortschritt im Format Version 2"] };
  const stand = leererStand();
  stand.updated = istZahl(daten.updated) ? daten.updated : 0;
  for (const f of ["resetKarten", "resetQuiz"]) {
    if (daten[f] === undefined) continue;
    if (istZahl(daten[f])) stand[f] = daten[f]; else fehler.push(`${f} ist keine Zahl`);
  }
  for (const [id, e] of Object.entries(daten.karten)) {
    if (!istObjekt(e) || !Number.isInteger(e.b) || e.b < 0 || e.b > 5 || !istZahl(e.d)) { fehler.push(`Karte ${id}: ungültiger Eintrag`); continue; }
    stand.karten[id] = { b: e.b, d: e.d, u: istZahl(e.u) ? e.u : stand.updated };
  }
  if (daten.mc !== undefined && !istObjekt(daten.mc)) fehler.push("mc ist kein Objekt");
  for (const [id, e] of Object.entries(istObjekt(daten.mc) ? daten.mc : {})) {
    const pickOk = e && (e.pick === null || (Number.isInteger(e.pick) && e.pick >= 0 && e.pick <= 3));
    if (!istObjekt(e) || !istReihenfolge(e.order) || !pickOk) { fehler.push(`Frage ${id}: ungültiger Eintrag`); continue; }
    stand.mc[id] = { order: e.order.slice(), pick: e.pick, u: istZahl(e.u) ? e.u : stand.updated };
  }
  const s = daten.session;
  if (s != null) {
    if (istObjekt(s) && Array.isArray(s.deck) && s.deck.every(x => typeof x === "string") && Number.isInteger(s.pos) && istZahl(s.t)) {
      stand.session = { deck: s.deck.slice(), pos: s.pos, mode: s.mode === "all" ? "all" : "due", sys: typeof s.sys === "string" ? s.sys : "all", t: s.t, day: String(s.day ?? "") };
    } else fehler.push("Angefangene Runde ist ungültig");
  }
  return { stand, fehler };
}

/**
 * Führt zwei Stände zusammen (z. B. zwei Geräte). Pro Karte bzw. Frage gewinnt die jüngere Änderung (u).
 * Ein Zurücksetzen gilt für alle Einträge, die älter sind als der Reset. Die neuere Runde gewinnt.
 */
export function fuehreZusammen(a, b) {
  const resetKarten = Math.max(a.resetKarten, b.resetKarten);
  const resetQuiz = Math.max(a.resetQuiz, b.resetQuiz);
  const mische = (x, y, reset) => {
    const out = {};
    for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const ex = x[id], ey = y[id];
      const sieger = !ey ? ex : !ex ? ey : ey.u > ex.u ? ey : ex;
      if (sieger.u >= reset) out[id] = sieger;
    }
    return out;
  };
  const sa = a.session, sb = b.session;
  const session = !sa ? sb : !sb ? sa : sb.t > sa.t ? sb : sa;
  return {
    version: VERSION,
    karten: mische(a.karten, b.karten, resetKarten),
    mc: mische(a.mc, b.mc, resetQuiz),
    session: session && session.t >= resetKarten ? session : null,
    resetKarten, resetQuiz,
    updated: Math.max(a.updated, b.updated),
  };
}

/** Kurzbeschreibung für die Import-Vorschau. */
export function beschreibe(stand) {
  const karten = Object.values(stand.karten);
  return {
    karten: karten.length,
    beantworteteFragen: Object.values(stand.mc).filter(e => e.pick !== null).length,
    fragenMitStand: Object.keys(stand.mc).length,
    stufen: [0, 1, 2, 3, 4, 5].map(b => karten.filter(e => e.b === b).length),
    updated: stand.updated,
  };
}

export function exportiere(stand, now) {
  return JSON.stringify({ app: "physiologie-lernkarten", exportiert: now, ...stand }, null, 1);
}

export function exportDateiname(now) {
  const d = new Date(now);
  const zwei = n => String(n).padStart(2, "0");
  return `physiologie-fortschritt-${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}.json`;
}
