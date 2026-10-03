// Wiederholungssystem (Leitner), unverändert aus der claude.ai-Version übernommen.
// „Gewusst“: Stufe +1 (höchstens 5), nächste Wiederholung nach STUFEN_TAGE[Stufe] Tagen.
// „Nicht gewusst“: Stufe 0, sofort wieder fällig, kommt in derselben Runde nach 4 anderen Karten erneut.

export const TAG = 864e5;
export const STUFEN_TAGE = [0, 1, 3, 7, 14, 30];
export const MAX_STUFE = STUFEN_TAGE.length - 1;
export const GEFESTIGT_AB = 4;
export const WIEDERHOLEN_NACH = 4;

/** Neuer Lernstand einer Karte nach einer Bewertung. `eintrag` darf fehlen (neue Karte). */
export function bewerte(eintrag, gewusst, now) {
  if (!gewusst) return { b: 0, d: now, u: now };
  const b = Math.min((eintrag ? eintrag.b : 0) + 1, MAX_STUFE);
  return { b, d: now + STUFEN_TAGE[b] * TAG, u: now };
}

export const istNeu = eintrag => !eintrag;
export const istFaellig = (eintrag, now) => !!eintrag && eintrag.d <= now;
export const istGelernt = eintrag => !!eintrag && eintrag.b > 0;
export const istGefestigt = eintrag => !!eintrag && eintrag.b >= GEFESTIGT_AB;
