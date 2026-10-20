// Schlichte Linien-Icons (24×24), Farbe über currentColor.
const PFADE: Record<string, string> = {
  hantel: "M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12",
  verlauf: "M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4",
  statistik: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  liste: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  zurueck: "M15 18l-6-6 6-6",
  weiter: "M9 18l6-6-6-6",
  loeschen: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  stift: "M4 20h4L19 9l-4-4L4 16v4z",
  ball: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9.5c3 1 6 0 8.5-3M20.5 9.5c-3 1-6 0-8.5-3M7 19.5c1-3 3-5 5-6.5 2 1.5 4 3.5 5 6.5",
  pokal: "M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  hoch: "M12 19V5M6 11l6-6 6 6",
  runter: "M12 5v14M6 13l6 6 6-6",
  x: "M6 6l12 12M18 6L6 18",
  haken: "M5 12l5 5 9-10",
  suche: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  upload: "M12 20V8M7 13l5-5 5 5M5 4h14",
};

export function Icon({ name, className = "size-6" }: { name: keyof typeof PFADE | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PFADE[name]} />
    </svg>
  );
}
