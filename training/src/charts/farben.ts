import { useEffect, useState } from "react";

// SVG-Attribute verstehen nicht überall CSS-Variablen, daher die echten Farbwerte auslesen.
const NAMEN = ["kraft", "handball", "spiel", "karte", "karte2", "text", "text2", "muted", "linie", "achse", "rekord"] as const;
export type Farben = Record<(typeof NAMEN)[number], string>;

const lies = (): Farben => {
  const s = getComputedStyle(document.documentElement);
  return Object.fromEntries(NAMEN.map(n => [n, s.getPropertyValue(`--${n}`).trim()])) as Farben;
};

export function useFarben() {
  const [f, setF] = useState(lies);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const neu = () => setF(lies());
    mq.addEventListener("change", neu);
    return () => mq.removeEventListener("change", neu);
  }, []);
  return f;
}
