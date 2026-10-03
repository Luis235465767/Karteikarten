// Lerninhalte zusammenführen und prüfen. Reine Funktionen, laufen im Browser und in Node.

const ID_MUSTER = {
  karten: k => new RegExp(`^${k}-\\d{3,}$`),
  mc: k => new RegExp(`^${k}-mc-\\d{3,}$`),
  offen: k => new RegExp(`^${k}-of-\\d{3,}$`),
};
const PFLICHTFELDER = {
  karten: ["frage", "antwort"],
  mc: ["frage", "richtig", "erklaerung"],
  offen: ["frage", "loesung"],
};
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Prüft Themenliste und Lernzettel. Gibt eine Liste verständlicher Fehlermeldungen zurück (leer = alles gut). */
export function pruefeInhalte(themenDatei, zettelNachDatei) {
  const fehler = [];
  const themen = themenDatei && Array.isArray(themenDatei.themen) ? themenDatei.themen : null;
  if (!themen || !themen.length) return ["themen.json: Liste „themen“ fehlt oder ist leer"];
  const ids = new Map();
  const kuerzel = new Set();
  for (const t of themen) {
    const wo = `themen.json (${t.kuerzel || "?"})`;
    if (!/^[A-Z]{1,3}$/.test(t.kuerzel || "")) fehler.push(`${wo}: Kürzel muss aus 1–3 Großbuchstaben bestehen`);
    if (kuerzel.has(t.kuerzel)) fehler.push(`${wo}: Kürzel doppelt`);
    kuerzel.add(t.kuerzel);
    if (!t.name) fehler.push(`${wo}: Name fehlt`);
    if (!t.farbe || !HEX.test(t.farbe.hell || "") || !HEX.test(t.farbe.dunkel || "")) fehler.push(`${wo}: farbe.hell und farbe.dunkel müssen Farben wie #127a78 sein`);
    const z = zettelNachDatei[t.datei];
    if (!z) { fehler.push(`${wo}: Datei ${t.datei} fehlt`); continue; }
    if (z.thema !== t.kuerzel) fehler.push(`${t.datei}: „thema“ ist ${JSON.stringify(z.thema)}, erwartet "${t.kuerzel}"`);
    for (const art of ["karten", "mc", "offen"]) {
      const liste = z[art] ?? [];
      if (!Array.isArray(liste)) { fehler.push(`${t.datei}: „${art}“ muss eine Liste sein`); continue; }
      liste.forEach((e, n) => {
        const wo = `${t.datei}, ${art} Nr. ${n + 1}${e && e.id ? ` (${e.id})` : ""}`;
        if (!e || typeof e !== "object") { fehler.push(`${wo}: kein gültiger Eintrag`); return; }
        if (!ID_MUSTER[art](t.kuerzel).test(e.id || "")) fehler.push(`${wo}: ID fehlt oder passt nicht zum Muster ${art === "karten" ? `${t.kuerzel}-001` : art === "mc" ? `${t.kuerzel}-mc-001` : `${t.kuerzel}-of-001`}`);
        else if (ids.has(e.id)) fehler.push(`${wo}: ID ist doppelt vergeben (auch in ${ids.get(e.id)})`);
        else ids.set(e.id, t.datei);
        for (const f of PFLICHTFELDER[art]) if (typeof e[f] !== "string" || !e[f].trim()) fehler.push(`${wo}: Feld „${f}“ fehlt oder ist leer`);
        if (art === "mc") {
          if (!Array.isArray(e.falsch) || e.falsch.length !== 3 || e.falsch.some(x => typeof x !== "string" || !x.trim())) fehler.push(`${wo}: „falsch“ braucht genau 3 nicht leere Antworten`);
          else if (new Set([e.richtig, ...e.falsch]).size !== 4) fehler.push(`${wo}: Antwortmöglichkeiten sind nicht alle verschieden`);
        }
      });
    }
  }
  return fehler;
}

/** Baut aus den Dateien die flachen Listen, in Lernzettel-Reihenfolge (Themenreihenfolge, dann Dateireihenfolge). */
export function baueInhalte(themenDatei, zettelNachDatei) {
  const themen = themenDatei.themen.map(({ kuerzel, name, farbe }) => ({ kuerzel, name, farbe }));
  const karten = [], mc = [], offen = [];
  for (const t of themenDatei.themen) {
    const z = zettelNachDatei[t.datei];
    for (const k of z.karten ?? []) karten.push({ ...k, thema: t.kuerzel });
    // optionen[0] ist immer die richtige Antwort, wie in der alten App
    for (const m of z.mc ?? []) mc.push({ id: m.id, thema: t.kuerzel, frage: m.frage, optionen: [m.richtig, ...m.falsch], erklaerung: m.erklaerung });
    for (const o of z.offen ?? []) offen.push({ ...o, thema: t.kuerzel });
  }
  return { themen, karten, mc, offen };
}
