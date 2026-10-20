// Kalendertage als Text JJJJ-MM-TT in lokaler Zeit, damit Zeitzonen keine Tage verschieben.

const zwei = (n: number) => String(n).padStart(2, "0");

export const alsTag = (d: Date) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;

export const ausTag = (s: string) => {
  const [j, m, t] = s.split("-").map(Number);
  return new Date(j, m - 1, t);
};

export const heute = () => alsTag(new Date());

export const plusTage = (tag: string, n: number) => {
  const d = ausTag(tag);
  d.setDate(d.getDate() + n);
  return alsTag(d);
};

/** Montag der Woche, in der der Tag liegt. */
export const wochenStart = (tag: string) => {
  const d = ausTag(tag);
  const wt = (d.getDay() + 6) % 7; // Mo = 0
  d.setDate(d.getDate() - wt);
  return alsTag(d);
};

/** Kalenderwoche nach ISO 8601. */
export const kalenderwoche = (tag: string) => {
  const d = ausTag(tag);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // Donnerstag dieser Woche
  const ersterDo = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - ersterDo.getTime()) / 86400000 - 3 + ((ersterDo.getDay() + 6) % 7)) / 7);
};

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export const formatTag = (tag: string) => {
  const d = ausTag(tag);
  return `${WT[d.getDay()]}, ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export const formatKurz = (tag: string) => {
  const d = ausTag(tag);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.`;
};

export const tageZwischen = (von: string, bis: string) =>
  Math.round((ausTag(bis).getTime() - ausTag(von).getTime()) / 86400000);
