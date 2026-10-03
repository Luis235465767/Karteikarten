// Lädt die Lerninhalte aus inhalte/ in Node (für Tests und die Inhaltsprüfung).
import { readFileSync } from "node:fs";

const INHALTE = new URL("../inhalte/", import.meta.url);

function lies(ordner, name) {
  try { return JSON.parse(readFileSync(new URL(name, ordner), "utf8")); }
  catch (e) { throw new Error(`${name}: ${e.code === "ENOENT" ? "Datei fehlt" : "kein gültiges JSON (" + e.message + ")"}`); }
}

/** Gibt { themen, zettel, fehler } zurück; Lesefehler einzelner Lernzettel landen in „fehler“. */
export function ladeDateien(ordner = INHALTE) {
  const themen = lies(ordner, "themen.json");
  const zettel = {}, fehler = [];
  for (const t of themen.themen ?? []) {
    try { zettel[t.datei] = lies(ordner, t.datei); } catch (e) { fehler.push(e.message); }
  }
  return { themen, zettel, fehler };
}
