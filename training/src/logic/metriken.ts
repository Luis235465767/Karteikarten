// Kennzahlen fürs Krafttraining und Handball. Reine Funktionen ohne Datenbank.
import type { HandballEinheit, Id, KraftEinheit, Satz } from "../model/types";
import { plusTage, wochenStart } from "./datum";

/** Geschätztes 1RM nach Epley: Gewicht × (1 + Wdh/30). */
export const epley = (kg: number, wdh: number) => (wdh > 0 && kg > 0 ? kg * (1 + wdh / 30) : 0);

export const satzVolumen = (s: Satz) => s.wdh * s.kg;

export const volumen = (saetze: Satz[]) => saetze.reduce((summe, s) => summe + satzVolumen(s), 0);

export const sessionRpe = (h: Pick<HandballEinheit, "dauerMin" | "rpe">) => h.dauerMin * h.rpe;

/** Ein Satz zählt, wenn mindestens eine Wiederholung eingetragen ist. */
export const gueltig = (s: Satz) => s.wdh > 0;

/** Schwerster Satz: höchstes Gewicht, bei Gleichstand mehr Wiederholungen. */
export function schwersterSatz(saetze: Satz[]): Satz | undefined {
  let best: Satz | undefined;
  for (const s of saetze.filter(gueltig)) {
    if (!best || s.kg > best.kg || (s.kg === best.kg && s.wdh > best.wdh)) best = s;
  }
  return best;
}

export const bestesE1rm = (saetze: Satz[]) => Math.max(0, ...saetze.filter(gueltig).map(s => epley(s.kg, s.wdh)));

const nachDatum = <T extends { datum: string }>(a: T[]) => [...a].sort((x, y) => x.datum.localeCompare(y.datum));

/** Sätze einer Übung in einer Einheit (mehrfach aufgeführte Übungen werden zusammengefasst). */
export const saetzeVon = (e: KraftEinheit, uebungId: Id) =>
  e.eintraege.filter(x => x.uebungId === uebungId).flatMap(x => x.saetze).filter(gueltig);

export interface VerlaufsPunkt {
  datum: string;
  einheitId: Id;
  maxKg: number;
  wdhBeiMax: number;
  e1rm: number;
  volumen: number;
}

/** Ein Punkt pro Einheit, in der die Übung vorkommt, nach Datum sortiert. */
export function verlauf(einheiten: KraftEinheit[], uebungId: Id): VerlaufsPunkt[] {
  const punkte: VerlaufsPunkt[] = [];
  for (const e of nachDatum(einheiten)) {
    const saetze = saetzeVon(e, uebungId);
    const top = schwersterSatz(saetze);
    if (!top) continue;
    punkte.push({ datum: e.datum, einheitId: e.id, maxKg: top.kg, wdhBeiMax: top.wdh, e1rm: bestesE1rm(saetze), volumen: volumen(saetze) });
  }
  return punkte;
}

export interface Bestleistung {
  maxKg?: { kg: number; wdh: number; datum: string };
  e1rm?: { wert: number; kg: number; wdh: number; datum: string };
  volumen?: { wert: number; datum: string };
  einheiten: number;
}

export function bestleistungen(einheiten: KraftEinheit[], uebungId: Id): Bestleistung {
  const r: Bestleistung = { einheiten: 0 };
  for (const e of nachDatum(einheiten)) {
    const saetze = saetzeVon(e, uebungId);
    if (!saetze.length) continue;
    r.einheiten++;
    for (const s of saetze) {
      if (!r.maxKg || s.kg > r.maxKg.kg || (s.kg === r.maxKg.kg && s.wdh > r.maxKg.wdh)) r.maxKg = { kg: s.kg, wdh: s.wdh, datum: e.datum };
      const w = epley(s.kg, s.wdh);
      if (!r.e1rm || w > r.e1rm.wert) r.e1rm = { wert: w, kg: s.kg, wdh: s.wdh, datum: e.datum };
    }
    const v = volumen(saetze);
    if (!r.volumen || v > r.volumen.wert) r.volumen = { wert: v, datum: e.datum };
  }
  return r;
}

/**
 * Letzte frühere Einheit mit dieser Übung (vor oder am selben Tag, ohne die aktuelle Einheit).
 */
export function letztesMal(einheiten: KraftEinheit[], uebungId: Id, aktuelleId: Id, bisDatum: string) {
  const kandidaten = einheiten
    .filter(e => e.id !== aktuelleId && e.datum <= bisDatum && saetzeVon(e, uebungId).length)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const e = kandidaten[0];
  return e ? { datum: e.datum, saetze: saetzeVon(e, uebungId) } : undefined;
}

export interface Rekord {
  gewicht: boolean;
  e1rm: boolean;
}

/**
 * Prüft, ob ein Satz eine neue Bestleistung ist: schwerer oder höheres geschätztes 1RM als alles
 * aus früheren Einheiten und als die vorherigen Sätze derselben Übung in dieser Einheit.
 * Ohne frühere Daten gibt es keine Bestleistung (sonst wäre jeder erste Satz eine).
 */
export function pruefeRekord(satz: Satz, frueher: Satz[], vorherInEinheit: Satz[]): Rekord {
  const nein = { gewicht: false, e1rm: false };
  if (!gueltig(satz) || satz.kg <= 0 || !frueher.length) return nein;
  const alle = [...frueher, ...vorherInEinheit].filter(gueltig);
  const maxKg = Math.max(0, ...alle.map(s => s.kg));
  const maxE = Math.max(0, ...alle.map(s => epley(s.kg, s.wdh)));
  const e = epley(satz.kg, satz.wdh);
  return { gewicht: satz.kg > maxKg, e1rm: e > maxE + 1e-9 };
}

/** Alle Sätze einer Übung aus Einheiten vor der aktuellen (früheres Datum oder gleicher Tag, andere Einheit). */
export function fruehereSaetze(einheiten: KraftEinheit[], uebungId: Id, aktuelleId: Id, bisDatum: string) {
  return einheiten.filter(e => e.id !== aktuelleId && e.datum <= bisDatum).flatMap(e => saetzeVon(e, uebungId));
}

/** Lückenlose Liste von Wochenanfängen (Montage) von bis einschließlich. */
export function wochenListe(vonTag: string, bisTag: string): string[] {
  const r: string[] = [];
  for (let w = wochenStart(vonTag), ende = wochenStart(bisTag); w <= ende; w = plusTage(w, 7)) r.push(w);
  return r;
}

export interface WochenVolumen {
  woche: string;
  volumen: number;
}

/** Volumen pro Woche über die letzten `anzahl` Wochen bis `bis`; uebungId = null für alle Übungen. */
export function wochenVolumen(einheiten: KraftEinheit[], uebungId: Id | null, bis: string, anzahl: number): WochenVolumen[] {
  const wochen = wochenListe(plusTage(bis, -7 * (anzahl - 1)), bis);
  const summen = new Map(wochen.map(w => [w, 0]));
  for (const e of einheiten) {
    const w = wochenStart(e.datum);
    if (!summen.has(w)) continue;
    const saetze = uebungId ? saetzeVon(e, uebungId) : e.eintraege.flatMap(x => x.saetze).filter(gueltig);
    summen.set(w, summen.get(w)! + volumen(saetze));
  }
  return wochen.map(w => ({ woche: w, volumen: summen.get(w)! }));
}

export interface WochenBelastung {
  woche: string;
  training: number;
  spiel: number;
  gesamt: number;
}

export function wochenBelastung(einheiten: HandballEinheit[], bis: string, anzahl: number): WochenBelastung[] {
  const wochen = wochenListe(plusTage(bis, -7 * (anzahl - 1)), bis);
  const m = new Map(wochen.map(w => [w, { woche: w, training: 0, spiel: 0, gesamt: 0 }]));
  for (const h of einheiten) {
    const eintrag = m.get(wochenStart(h.datum));
    if (!eintrag) continue;
    const last = sessionRpe(h);
    if (h.art === "Spiel") eintrag.spiel += last;
    else eintrag.training += last;
    eintrag.gesamt += last;
  }
  return wochen.map(w => m.get(w)!);
}

export interface Kalendertag {
  kraft: number;
  handball: number;
}

export function kalender(kraft: KraftEinheit[], handball: HandballEinheit[]): Map<string, Kalendertag> {
  const m = new Map<string, Kalendertag>();
  const hole = (t: string) => m.get(t) ?? (m.set(t, { kraft: 0, handball: 0 }), m.get(t)!);
  kraft.forEach(e => hole(e.datum).kraft++);
  handball.forEach(h => hole(h.datum).handball++);
  return m;
}

export const runde = (x: number, stellen = 1) => Math.round(x * 10 ** stellen) / 10 ** stellen;

const zahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
export const fmt = (x: number) => zahl.format(x);
