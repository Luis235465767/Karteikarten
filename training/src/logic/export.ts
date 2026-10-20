// CSV-Export und Prüfung von JSON-Backups. Reine Funktionen.
import type { Backup, HandballEinheit, KraftEinheit, Satz, Uebung, Vorlage } from "../model/types";
import { epley, sessionRpe } from "./metriken";

// Semikolon und Dezimalkomma, damit Excel mit deutscher Einstellung die Datei direkt richtig öffnet.
const SPALTEN = [
  "Typ", "Datum", "Übung", "Kategorie", "Satz", "Wiederholungen", "Gewicht (kg)", "Volumen (kg)",
  "1RM geschätzt (kg)", "Art", "Dauer (min)", "RPE", "Session-RPE", "Notiz",
] as const;

const zahl = (x: number | undefined) => (x === undefined ? "" : String(Math.round(x * 100) / 100).replace(".", ","));

export const csvFeld = (wert: string) => (/[";\n\r]/.test(wert) ? `"${wert.replace(/"/g, '""')}"` : wert);

export function alsCsv(b: Pick<Backup, "uebungen" | "kraftEinheiten" | "vorlagen" | "handballEinheiten">): string {
  const uebung = new Map(b.uebungen.map(u => [u.id, u]));
  const zeilen: string[][] = [];
  const zeile = (werte: Partial<Record<(typeof SPALTEN)[number], string>>) => zeilen.push(SPALTEN.map(s => werte[s] ?? ""));

  const kraft = [...b.kraftEinheiten].sort((x, y) => x.datum.localeCompare(y.datum));
  for (const e of kraft) {
    for (const eintrag of e.eintraege) {
      const u = uebung.get(eintrag.uebungId);
      eintrag.saetze.forEach((s: Satz, i) =>
        zeile({
          Typ: "Kraft", Datum: e.datum, "Übung": u?.name ?? "(gelöscht)", Kategorie: u?.kategorie ?? "",
          Satz: String(i + 1), Wiederholungen: String(s.wdh), "Gewicht (kg)": zahl(s.kg),
          "Volumen (kg)": zahl(s.wdh * s.kg), "1RM geschätzt (kg)": zahl(epley(s.kg, s.wdh)), Notiz: e.notiz ?? "",
        }),
      );
    }
  }
  const handball = [...b.handballEinheiten].sort((x, y) => x.datum.localeCompare(y.datum));
  for (const h of handball) {
    zeile({
      Typ: "Handball", Datum: h.datum, Art: h.art, "Dauer (min)": String(h.dauerMin), RPE: String(h.rpe),
      "Session-RPE": String(sessionRpe(h)), Notiz: h.notiz ?? "",
    });
  }
  for (const v of b.vorlagen) {
    v.uebungen.forEach((x, i) => {
      const u = uebung.get(x.uebungId);
      zeile({
        Typ: `Vorlage: ${v.name}`, "Übung": u?.name ?? "(gelöscht)", Kategorie: u?.kategorie ?? "", Satz: String(i + 1),
        Wiederholungen: x.zielWdh ? String(x.zielWdh) : "", Notiz: x.zielSaetze ? `${x.zielSaetze} Sätze` : "",
      });
    });
  }
  for (const u of b.uebungen) zeile({ Typ: "Übung", "Übung": u.name, Kategorie: u.kategorie, Notiz: u.notiz ?? "" });

  return "﻿" + [SPALTEN as readonly string[], ...zeilen].map(z => z.map(csvFeld).join(";")).join("\r\n") + "\r\n";
}

// ---------- Backup prüfen ----------

const istText = (x: unknown): x is string => typeof x === "string";
const istZahl = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const istTag = (x: unknown) => istText(x) && /^\d{4}-\d{2}-\d{2}$/.test(x);
const optText = (x: unknown) => x === undefined || istText(x);
const optZahl = (x: unknown) => x === undefined || istZahl(x);

function liste<T>(daten: Record<string, unknown>, feld: string, pruefe: (x: any) => boolean): T[] {
  const a = daten[feld];
  if (!Array.isArray(a)) throw new Error(`Im Backup fehlt die Liste „${feld}“.`);
  a.forEach((x, i) => {
    if (!x || typeof x !== "object" || !istText(x.id) || !pruefe(x)) throw new Error(`Eintrag ${i + 1} in „${feld}“ ist ungültig.`);
  });
  return a as T[];
}

const satzOk = (s: any) => s && istZahl(s.wdh) && istZahl(s.kg);

/** Liest ein Backup ein und prüft alles, bevor etwas überschrieben wird. Wirft Fehler mit deutscher Meldung. */
export function pruefeBackup(text: string): Backup {
  let daten: unknown;
  try {
    daten = JSON.parse(text);
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON.");
  }
  if (!daten || typeof daten !== "object" || (daten as any).app !== "trainingstagebuch") {
    throw new Error("Die Datei ist kein Backup dieser App.");
  }
  const d = daten as Record<string, unknown>;
  if (d.version !== 1) throw new Error(`Unbekannte Backup-Version: ${String(d.version)}.`);

  const uebungen = liste<Uebung>(d, "uebungen", u => istText(u.name) && istText(u.kategorie) && optText(u.notiz));
  const kraftEinheiten = liste<KraftEinheit>(d, "kraftEinheiten", e =>
    istTag(e.datum) && optText(e.notiz) && Array.isArray(e.eintraege) &&
    e.eintraege.every((x: any) => x && istText(x.uebungId) && Array.isArray(x.saetze) && x.saetze.every(satzOk)));
  const vorlagen = liste<Vorlage>(d, "vorlagen", v =>
    istText(v.name) && Array.isArray(v.uebungen) &&
    v.uebungen.every((x: any) => x && istText(x.uebungId) && optZahl(x.zielSaetze) && optZahl(x.zielWdh)));
  const handballEinheiten = liste<HandballEinheit>(d, "handballEinheiten", h =>
    istTag(h.datum) && (h.art === "Training" || h.art === "Spiel") && istZahl(h.dauerMin) && istZahl(h.rpe) && optText(h.notiz));

  return { app: "trainingstagebuch", version: 1, erstellt: istText(d.erstellt) ? d.erstellt : "", uebungen, kraftEinheiten, vorlagen, handballEinheiten };
}
