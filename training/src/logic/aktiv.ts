// Merkt sich das laufende Training, damit es nach Schließen der App fortgesetzt werden kann.
const SCHLUESSEL = "trainingstagebuch.aktiveEinheit";

export const aktiveEinheit = (): string | null => {
  try { return localStorage.getItem(SCHLUESSEL); } catch { return null; }
};
export const setzeAktiveEinheit = (id: string | null) => {
  try { id ? localStorage.setItem(SCHLUESSEL, id) : localStorage.removeItem(SCHLUESSEL); } catch { /* privat-Modus */ }
};
