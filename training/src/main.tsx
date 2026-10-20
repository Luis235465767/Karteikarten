import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { RueckmeldungProvider } from "./components/Rueckmeldung";
import { db } from "./db/schema";
import { legeBeispieldatenAn } from "./db/repo";
import "./index.css";

// Beim allerersten Start Beispieldaten anlegen, damit die Diagramme sofort etwas zeigen.
async function ersterStart() {
  const SCHLUESSEL = "trainingstagebuch.gestartet";
  try {
    if (localStorage.getItem(SCHLUESSEL)) return;
    localStorage.setItem(SCHLUESSEL, "1");
  } catch { return; }
  if ((await db.uebungen.count()) === 0 && (await db.kraftEinheiten.count()) === 0) await legeBeispieldatenAn();
}
ersterStart();

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RueckmeldungProvider>
      <App />
    </RueckmeldungProvider>
  </StrictMode>,
);
