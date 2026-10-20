import type { ReactNode } from "react";

export interface TooltipZeile { farbe: string; label: string; wert: string }

/** Einheitlicher Tooltip: Wert fett vorn, Serienname dahinter, mit kurzem Farbstrich. */
export function TooltipBox({ titel, zeilen, fuss }: { titel: string; zeilen: TooltipZeile[]; fuss?: ReactNode }) {
  return (
    <div className="rounded-xl border border-linie bg-karte px-3 py-2 shadow-lg text-sm min-w-36">
      <p className="text-text2 mb-1">{titel}</p>
      {zeilen.map(z => (
        <p key={z.label} className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: z.farbe }} />
          <b className="tabular">{z.wert}</b>
          <span className="text-text2">{z.label}</span>
        </p>
      ))}
      {fuss && <div className="text-xs text-muted mt-1">{fuss}</div>}
    </div>
  );
}

export function Legende({ eintraege }: { eintraege: { farbe: string; label: string; form?: "linie" | "flaeche" | "geteilt"; farbe2?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text2">
      {eintraege.map(e => (
        <span key={e.label} className="inline-flex items-center gap-1.5">
          {e.form === "linie"
            ? <span className="inline-block w-4 h-0.5 rounded" style={{ background: e.farbe }} />
            : <span className="inline-block size-3 rounded-sm"
                style={{ background: e.form === "geteilt" ? `linear-gradient(135deg, ${e.farbe} 50%, ${e.farbe2} 50%)` : e.farbe }} />}
          {e.label}
        </span>
      ))}
    </div>
  );
}
