// Alle Schreib- und Lesezugriffe auf die Datenbank an einer Stelle.
import { db } from "./schema";
import type { Backup, HandballEinheit, Id, KraftEinheit, Uebung, Vorlage } from "../model/types";

export const neueId = (): Id =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export async function speichereUebung(u: Uebung) {
  await db.uebungen.put(u);
}

/** Löscht eine Übung. Wird sie noch verwendet, wird das verhindert. */
export async function loescheUebung(id: Id): Promise<{ ok: true } | { ok: false; grund: string }> {
  const einheiten = await db.kraftEinheiten.filter(e => e.eintraege.some(x => x.uebungId === id)).count();
  const vorlagen = await db.vorlagen.filter(v => v.uebungen.some(x => x.uebungId === id)).count();
  if (einheiten || vorlagen) {
    const teile = [];
    if (einheiten) teile.push(`${einheiten} Einheit${einheiten === 1 ? "" : "en"}`);
    if (vorlagen) teile.push(`${vorlagen} Vorlage${vorlagen === 1 ? "" : "n"}`);
    return { ok: false, grund: `Die Übung wird noch in ${teile.join(" und ")} verwendet.` };
  }
  await db.uebungen.delete(id);
  return { ok: true };
}

export const speichereKraft = (e: KraftEinheit) => db.kraftEinheiten.put(e);
export const loescheKraft = (id: Id) => db.kraftEinheiten.delete(id);
export const speichereVorlage = (v: Vorlage) => db.vorlagen.put(v);
export const loescheVorlage = (id: Id) => db.vorlagen.delete(id);
export const speichereHandball = (h: HandballEinheit) => db.handballEinheiten.put(h);
export const loescheHandball = (id: Id) => db.handballEinheiten.delete(id);

export async function erstelleBackup(): Promise<Backup> {
  const [uebungen, kraftEinheiten, vorlagen, handballEinheiten] = await Promise.all([
    db.uebungen.toArray(),
    db.kraftEinheiten.toArray(),
    db.vorlagen.toArray(),
    db.handballEinheiten.toArray(),
  ]);
  return { app: "trainingstagebuch", version: 1, erstellt: new Date().toISOString(), uebungen, kraftEinheiten, vorlagen, handballEinheiten };
}

/** Ersetzt alle Daten durch das Backup (in einer Transaktion: ganz oder gar nicht). */
export async function stelleWiederHer(b: Backup) {
  await db.transaction("rw", [db.uebungen, db.kraftEinheiten, db.vorlagen, db.handballEinheiten], async () => {
    await Promise.all([db.uebungen.clear(), db.kraftEinheiten.clear(), db.vorlagen.clear(), db.handballEinheiten.clear()]);
    await db.uebungen.bulkPut(b.uebungen);
    await db.kraftEinheiten.bulkPut(b.kraftEinheiten);
    await db.vorlagen.bulkPut(b.vorlagen);
    await db.handballEinheiten.bulkPut(b.handballEinheiten);
  });
}

export async function hatBeispieldaten() {
  return (await db.uebungen.filter(u => !!u.beispiel).count()) > 0;
}

/**
 * Entfernt alle Beispieldaten. Eigene Einheiten, die Beispiel-Übungen verwenden, bleiben erhalten,
 * ebenso die Übungen, die sie brauchen (sie werden dann zu eigenen Übungen).
 */
export async function loescheBeispieldaten() {
  await db.transaction("rw", [db.uebungen, db.kraftEinheiten, db.vorlagen, db.handballEinheiten], async () => {
    await db.kraftEinheiten.filter(e => !!e.beispiel).delete();
    await db.vorlagen.filter(v => !!v.beispiel).delete();
    await db.handballEinheiten.filter(h => !!h.beispiel).delete();
    const benutzt = new Set<Id>();
    (await db.kraftEinheiten.toArray()).forEach(e => e.eintraege.forEach(x => benutzt.add(x.uebungId)));
    (await db.vorlagen.toArray()).forEach(v => v.uebungen.forEach(x => benutzt.add(x.uebungId)));
    const beispiel = await db.uebungen.filter(u => !!u.beispiel).toArray();
    await db.uebungen.bulkDelete(beispiel.filter(u => !benutzt.has(u.id)).map(u => u.id));
    await db.uebungen.bulkPut(beispiel.filter(u => benutzt.has(u.id)).map(u => ({ ...u, beispiel: undefined })));
  });
}

export async function legeBeispieldatenAn() {
  const { erzeugeBeispieldaten } = await import("../seed/beispieldaten");
  const d = erzeugeBeispieldaten();
  await db.transaction("rw", [db.uebungen, db.kraftEinheiten, db.vorlagen, db.handballEinheiten], async () => {
    await db.uebungen.bulkPut(d.uebungen);
    await db.vorlagen.bulkPut(d.vorlagen);
    await db.kraftEinheiten.bulkPut(d.kraftEinheiten);
    await db.handballEinheiten.bulkPut(d.handballEinheiten);
  });
}
