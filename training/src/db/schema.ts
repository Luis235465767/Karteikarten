import Dexie, { type EntityTable } from "dexie";
import type { HandballEinheit, KraftEinheit, Uebung, Vorlage } from "../model/types";

export class TrainingDB extends Dexie {
  uebungen!: EntityTable<Uebung, "id">;
  kraftEinheiten!: EntityTable<KraftEinheit, "id">;
  vorlagen!: EntityTable<Vorlage, "id">;
  handballEinheiten!: EntityTable<HandballEinheit, "id">;

  constructor(name = "trainingstagebuch") {
    super(name);
    this.version(1).stores({
      uebungen: "id, name, kategorie",
      kraftEinheiten: "id, datum",
      vorlagen: "id, name",
      handballEinheiten: "id, datum",
    });
  }
}

export const db = new TrainingDB();
