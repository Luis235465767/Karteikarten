import { describe, expect, it } from "vitest";
import { epley, letztesMal, pruefeRekord, schwersterSatz, sessionRpe, verlauf, volumen, wochenBelastung, wochenVolumen, bestleistungen, kalender } from "../src/logic/metriken";
import { kalenderwoche, plusTage, wochenStart } from "../src/logic/datum";
import { alsCsv, pruefeBackup } from "../src/logic/export";
import { erzeugeBeispieldaten } from "../src/seed/beispieldaten";
import type { KraftEinheit } from "../src/model/types";

const e = (id: string, datum: string, saetze: [number, number][], uebungId = "bank"): KraftEinheit => ({
  id, datum, eintraege: [{ uebungId, saetze: saetze.map(([wdh, kg]) => ({ wdh, kg })) }],
});

describe("Formeln", () => {
  it("Epley", () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 2);
    expect(epley(100, 0)).toBe(0);
  });
  it("Volumen = Summe Wdh × kg", () => {
    expect(volumen([{ wdh: 5, kg: 100 }, { wdh: 3, kg: 110 }])).toBe(830);
  });
  it("Session-RPE = Dauer × RPE", () => {
    expect(sessionRpe({ dauerMin: 90, rpe: 6 })).toBe(540);
  });
  it("schwerster Satz bevorzugt bei Gleichstand mehr Wdh", () => {
    expect(schwersterSatz([{ wdh: 3, kg: 100 }, { wdh: 5, kg: 100 }, { wdh: 8, kg: 90 }])).toEqual({ wdh: 5, kg: 100 });
    expect(schwersterSatz([{ wdh: 0, kg: 200 }])).toBeUndefined();
  });
});

describe("Datum", () => {
  it("Woche beginnt am Montag", () => {
    expect(wochenStart("2026-10-20")).toBe("2026-10-19"); // Dienstag
    expect(wochenStart("2026-10-25")).toBe("2026-10-19"); // Sonntag
    expect(wochenStart("2026-10-19")).toBe("2026-10-19");
  });
  it("über Monats- und Zeitumstellungsgrenzen", () => {
    expect(plusTage("2026-10-24", 2)).toBe("2026-10-26");
    expect(plusTage("2026-03-28", 2)).toBe("2026-03-30");
  });
  it("Kalenderwoche", () => {
    expect(kalenderwoche("2026-01-01")).toBe(1);
    expect(kalenderwoche("2026-10-20")).toBe(43);
    expect(kalenderwoche("2027-01-01")).toBe(53);
  });
});

describe("Verlauf und Bestleistungen", () => {
  const daten = [e("2", "2026-10-08", [[5, 105], [8, 90]]), e("1", "2026-10-01", [[5, 100]]), e("3", "2026-10-15", [[3, 105]])];
  it("Verlauf sortiert, ein Punkt pro Einheit", () => {
    const v = verlauf(daten, "bank");
    expect(v.map(p => p.datum)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
    expect(v[1]).toMatchObject({ maxKg: 105, wdhBeiMax: 5, volumen: 1245 });
    expect(v[1].e1rm).toBeCloseTo(122.5);
  });
  it("Bestleistungen", () => {
    const b = bestleistungen(daten, "bank");
    expect(b.maxKg).toEqual({ kg: 105, wdh: 5, datum: "2026-10-08" });
    expect(b.e1rm?.datum).toBe("2026-10-08");
    expect(b.einheiten).toBe(3);
  });
  it("letztes Mal ignoriert die aktuelle Einheit und spätere", () => {
    expect(letztesMal(daten, "bank", "3", "2026-10-15")?.datum).toBe("2026-10-08");
    expect(letztesMal(daten, "bank", "x", "2026-10-05")?.datum).toBe("2026-10-01");
    expect(letztesMal(daten, "kniebeuge", "x", "2026-12-01")).toBeUndefined();
  });
});

describe("Rekorde", () => {
  const frueher = [{ wdh: 5, kg: 100 }];
  it("schwerer = Gewichtsrekord", () => {
    expect(pruefeRekord({ wdh: 1, kg: 102.5 }, frueher, [])).toEqual({ gewicht: true, e1rm: false });
  });
  it("mehr Wdh = 1RM-Rekord", () => {
    expect(pruefeRekord({ wdh: 7, kg: 100 }, frueher, [])).toEqual({ gewicht: false, e1rm: true });
  });
  it("gleicher Satz zweimal in einer Einheit zählt nur einmal", () => {
    expect(pruefeRekord({ wdh: 5, kg: 105 }, frueher, [{ wdh: 5, kg: 105 }])).toEqual({ gewicht: false, e1rm: false });
  });
  it("ohne frühere Daten kein Rekord", () => {
    expect(pruefeRekord({ wdh: 5, kg: 105 }, [], [])).toEqual({ gewicht: false, e1rm: false });
  });
});

describe("Wochen", () => {
  it("Wochenvolumen lückenlos, gefiltert", () => {
    const daten = [e("1", "2026-10-06", [[5, 100]]), e("2", "2026-10-20", [[10, 50]], "knie")];
    expect(wochenVolumen(daten, null, "2026-10-21", 3)).toEqual([
      { woche: "2026-10-05", volumen: 500 }, { woche: "2026-10-12", volumen: 0 }, { woche: "2026-10-19", volumen: 500 },
    ]);
    expect(wochenVolumen(daten, "bank", "2026-10-21", 3).map(w => w.volumen)).toEqual([500, 0, 0]);
  });
  it("Handball-Belastung nach Art", () => {
    const w = wochenBelastung([
      { id: "a", datum: "2026-10-20", art: "Training", dauerMin: 90, rpe: 5 },
      { id: "b", datum: "2026-10-24", art: "Spiel", dauerMin: 60, rpe: 8 },
    ], "2026-10-25", 1);
    expect(w).toEqual([{ woche: "2026-10-19", training: 450, spiel: 480, gesamt: 930 }]);
  });
  it("Kalender zählt pro Tag", () => {
    const k = kalender([e("1", "2026-10-06", [[5, 100]])], [{ id: "h", datum: "2026-10-06", art: "Spiel", dauerMin: 60, rpe: 8 }]);
    expect(k.get("2026-10-06")).toEqual({ kraft: 1, handball: 1 });
  });
});

describe("Export und Backup", () => {
  const d = erzeugeBeispieldaten("2026-10-20");
  it("Beispieldaten sind vollständig markiert und verweisen auf vorhandene Übungen", () => {
    const ids = new Set(d.uebungen.map(u => u.id));
    expect(d.kraftEinheiten.length).toBeGreaterThan(15);
    expect(d.handballEinheiten.length).toBeGreaterThan(20);
    expect([...d.uebungen, ...d.kraftEinheiten, ...d.vorlagen, ...d.handballEinheiten].every(x => x.beispiel)).toBe(true);
    expect(d.kraftEinheiten.every(k => k.eintraege.every(x => ids.has(x.uebungId)))).toBe(true);
    expect(d.kraftEinheiten.every(k => k.datum <= "2026-10-20")).toBe(true);
  });
  it("Backup übersteht Hin- und Rückweg", () => {
    const b = { app: "trainingstagebuch" as const, version: 1 as const, erstellt: "x", ...d };
    expect(pruefeBackup(JSON.stringify(b))).toEqual(b);
  });
  it("ungültige Backups werden mit Meldung abgelehnt", () => {
    expect(() => pruefeBackup("kein json")).toThrow("kein gültiges JSON");
    expect(() => pruefeBackup("{}")).toThrow("kein Backup");
    const b = { app: "trainingstagebuch", version: 1, uebungen: [], vorlagen: [], handballEinheiten: [], kraftEinheiten: [{ id: "1", datum: "gestern", eintraege: [] }] };
    expect(() => pruefeBackup(JSON.stringify(b))).toThrow("Eintrag 1 in „kraftEinheiten“");
  });
  it("CSV mit Semikolon, Dezimalkomma und maskierten Feldern", () => {
    const csv = alsCsv({
      uebungen: [{ id: "b", name: "Bank; eng", kategorie: "Brust" }],
      kraftEinheiten: [{ id: "1", datum: "2026-10-01", notiz: 'sagte "gut"', eintraege: [{ uebungId: "b", saetze: [{ wdh: 5, kg: 62.5 }] }] }],
      vorlagen: [], handballEinheiten: [{ id: "h", datum: "2026-10-02", art: "Spiel", dauerMin: 60, rpe: 8 }],
    });
    const zeilen = csv.replace("﻿", "").trim().split("\r\n");
    expect(zeilen[0].startsWith("Typ;Datum;Übung")).toBe(true);
    expect(zeilen[1]).toBe('Kraft;2026-10-01;"Bank; eng";Brust;1;5;62,5;312,5;72,92;;;;;"sagte ""gut"""');
    expect(zeilen[2]).toBe("Handball;2026-10-02;;;;;;;;Spiel;60;8;480;");
  });
});
