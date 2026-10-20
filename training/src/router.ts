// Minimaler Router über den URL-Hash (#/pfad), damit Zurück-Taste und Neuladen funktionieren.
import { useEffect, useState } from "react";

const aktuell = () => location.hash.replace(/^#/, "") || "/training";

export function useRoute() {
  const [pfad, setPfad] = useState(aktuell);
  useEffect(() => {
    const f = () => setPfad(aktuell());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return pfad;
}

export const navigiere = (pfad: string, ersetzen = false) => {
  if (ersetzen) location.replace("#" + pfad);
  else location.hash = pfad;
  window.scrollTo(0, 0);
};

/** Zerlegt z. B. "/einheit/abc" anhand des Musters "/einheit/:id". */
export function passt(muster: string, pfad: string): Record<string, string> | null {
  const m = muster.split("/"), p = pfad.split("/");
  if (m.length !== p.length) return null;
  const r: Record<string, string> = {};
  for (let i = 0; i < m.length; i++) {
    if (m[i].startsWith(":")) r[m[i].slice(1)] = decodeURIComponent(p[i]);
    else if (m[i] !== p[i]) return null;
  }
  return r;
}
