// Live-Abfragen: Komponenten aktualisieren sich automatisch, wenn sich die Daten ändern.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./schema";
import type { Id, Uebung } from "../model/types";

const sortiere = (a: Uebung, b: Uebung) => a.name.localeCompare(b.name, "de");

export const useUebungen = () => useLiveQuery(async () => (await db.uebungen.toArray()).sort(sortiere), []);
export const useUebungsMap = () => useLiveQuery(async () => new Map((await db.uebungen.toArray()).map(u => [u.id, u] as const)), []);
export const useKraftEinheiten = () => useLiveQuery(() => db.kraftEinheiten.orderBy("datum").reverse().toArray(), []);
export const useHandballEinheiten = () => useLiveQuery(() => db.handballEinheiten.orderBy("datum").reverse().toArray(), []);
export const useVorlagen = () => useLiveQuery(async () => (await db.vorlagen.toArray()).sort((a, b) => a.name.localeCompare(b.name, "de")), []);
export const useKraftEinheit = (id: Id) => useLiveQuery(() => db.kraftEinheiten.get(id), [id]);
