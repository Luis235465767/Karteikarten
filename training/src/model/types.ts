// Datenmodell der App. Datumswerte sind lokale Kalendertage im Format JJJJ-MM-TT.

export type Id = string;

export interface Uebung {
  id: Id;
  name: string;
  kategorie: string;
  notiz?: string;
  beispiel?: boolean;
}

export interface Satz {
  wdh: number;
  kg: number;
}

export interface UebungsEintrag {
  uebungId: Id;
  saetze: Satz[];
}

export interface KraftEinheit {
  id: Id;
  datum: string;
  vorlageId?: Id;
  notiz?: string;
  eintraege: UebungsEintrag[];
  beispiel?: boolean;
}

export interface VorlagenUebung {
  uebungId: Id;
  zielSaetze?: number;
  zielWdh?: number;
}

export interface Vorlage {
  id: Id;
  name: string;
  uebungen: VorlagenUebung[];
  beispiel?: boolean;
}

export type HandballArt = "Training" | "Spiel";

export interface HandballEinheit {
  id: Id;
  datum: string;
  art: HandballArt;
  dauerMin: number;
  rpe: number;
  notiz?: string;
  beispiel?: boolean;
}

export const KATEGORIEN = [
  "Brust",
  "Rücken",
  "Schultern",
  "Beine",
  "Gesäß",
  "Bizeps",
  "Trizeps",
  "Core",
  "Ganzkörper",
  "Sonstiges",
] as const;

/** Inhalt eines vollständigen Backups. */
export interface Backup {
  app: "trainingstagebuch";
  version: 1;
  erstellt: string;
  uebungen: Uebung[];
  kraftEinheiten: KraftEinheit[];
  vorlagen: Vorlage[];
  handballEinheiten: HandballEinheit[];
}
