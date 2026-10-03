// Liest CARDS, MC und OPEN aus der ursprünglichen claude.ai-Datei, genau so,
// wie die alte App sie zur Laufzeit hatte (inklusive der per push() angehängten Einträge).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LEGACY_HTML = fileURLToPath(new URL("../legacy/physiologie-lernkarten.original.html", import.meta.url));

export function ladeLegacyInhalte(pfad = LEGACY_HTML) {
  const html = readFileSync(pfad, "utf8");
  const script = html.split("<script>")[1];
  const ende = script.indexOf("const SYS=");
  if (!script || ende < 0) throw new Error("Inhalts-Arrays in der alten Datei nicht gefunden");
  return new Function(script.slice(0, ende) + ";return {CARDS, MC, OPEN};")();
}
