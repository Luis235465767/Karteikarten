// Stellt die veröffentlichte Seite in _site/ zusammen und trägt Version und Dateiliste in den Service Worker ein.
// Aufruf: node scripts/baue-site.js [version]
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = fileURLToPath(new URL("..", import.meta.url));
const ZIEL = join(WURZEL, "_site");
const INHALT = ["index.html", "manifest.webmanifest", "css", "js", "fonts", "inhalte", "icons", "legacy/index-map.json"];
const version = process.argv[2] || new Date().toISOString().replace(/\D/g, "").slice(0, 14);

rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(ZIEL);
for (const pfad of INHALT) cpSync(join(WURZEL, pfad), join(ZIEL, pfad), { recursive: true });

const dateien = [];
(function sammle(ordner) {
  for (const name of readdirSync(ordner)) {
    const voll = join(ordner, name);
    if (statSync(voll).isDirectory()) sammle(voll);
    else if (!name.endsWith(".txt")) dateien.push(relative(ZIEL, voll).split("\\").join("/"));
  }
})(ZIEL);
const liste = ["./", ...dateien.filter(d => d !== "index.html").sort()];

const sw = readFileSync(join(WURZEL, "sw.js"), "utf8")
  .replace('const VERSION = "dev";', `const VERSION = ${JSON.stringify(version)};`)
  .replace("const DATEIEN = [];", `const DATEIEN = ${JSON.stringify(liste)};`);
if (!sw.includes(version) || sw.includes("const DATEIEN = [];")) throw new Error("Service Worker konnte nicht vorbereitet werden");
writeFileSync(join(ZIEL, "sw.js"), sw);
writeFileSync(join(ZIEL, ".nojekyll"), "");
console.log(`_site/ gebaut: Version ${version}, ${liste.length} Dateien im Offline-Speicher.`);
