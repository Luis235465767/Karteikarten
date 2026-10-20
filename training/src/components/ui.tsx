// Grundbausteine der Oberfläche. Alle Touch-Flächen sind mindestens 44–48 px hoch.
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";

type Variante = "primaer" | "sekundaer" | "gefahr" | "leise";

const VARIANTEN: Record<Variante, string> = {
  primaer: "bg-akzent text-akzent-text active:brightness-90",
  sekundaer: "bg-karte2 text-text active:brightness-95",
  gefahr: "bg-transparent text-gefahr border border-gefahr/40 active:bg-gefahr/10",
  leise: "bg-transparent text-akzent active:bg-akzent/10",
};

export function Button({ variante = "sekundaer", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`min-h-12 rounded-xl px-4 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 transition ${VARIANTEN[variante]} ${className}`}
      {...rest}
    />
  );
}

export function IconButton({ icon, label, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`size-12 shrink-0 rounded-xl inline-flex items-center justify-center text-text2 active:bg-karte2 ${className}`} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function Karte({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-karte rounded-2xl border border-linie p-4 ${className}`} {...rest}>{children}</div>;
}

export function Seitenkopf({ titel, zurueck, rechts }: { titel: string; zurueck?: () => void; rechts?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-seite/95 backdrop-blur pt-safe border-b border-linie">
      <div className="max-w-2xl mx-auto flex items-center gap-1 px-2 h-14">
        {zurueck ? <IconButton icon="zurueck" label="Zurück" onClick={zurueck} /> : <span className="w-2" />}
        <h1 className="text-xl font-bold flex-1 truncate">{titel}</h1>
        {rechts}
      </div>
    </header>
  );
}

export function Inhalt({ children }: { children: ReactNode }) {
  return <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">{children}</main>;
}

export function Feld({ label, children, hinweis }: { label: string; children: ReactNode; hinweis?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text2 mb-1">{label}</span>
      {children}
      {hinweis && <span className="block text-xs text-muted mt-1">{hinweis}</span>}
    </label>
  );
}

export const eingabeKlasse = "w-full min-h-12 rounded-xl bg-karte2 border border-linie px-3 outline-none focus:border-akzent";

export function Segmente<T extends string>({ werte, wert, onChange, label }: { werte: { wert: T; label: string }[]; wert: T; onChange: (w: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex bg-karte2 rounded-xl p-1 gap-1">
      {werte.map(w => (
        <button key={w.wert} type="button" role="radio" aria-checked={w.wert === wert} onClick={() => onChange(w.wert)}
          className={`flex-1 min-h-10 rounded-lg text-sm font-semibold transition ${w.wert === wert ? "bg-karte text-text shadow-sm" : "text-text2"}`}>
          {w.label}
        </button>
      ))}
    </div>
  );
}

/** Zahl als Text, damit Komma, leeres Feld und Zwischenstände („62,“) beim Tippen erlaubt sind. */
export function parseZahl(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
const zeigeZahl = (n: number) => (n ? String(n).replace(".", ",") : "");

export function ZahlFeld({ wert, onChange, schritt, min = 0, label, einheit, dezimal = false, className = "flex-1" }: {
  wert: number; onChange: (n: number) => void; schritt: number; min?: number; label: string; einheit?: string; dezimal?: boolean; className?: string;
}) {
  const [text, setText] = useState(zeigeZahl(wert));
  useEffect(() => {
    if (parseZahl(text) !== wert) setText(zeigeZahl(wert));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert]);
  const setze = (n: number) => {
    const r = Math.max(min, Math.round(n * 100) / 100);
    setText(zeigeZahl(r));
    onChange(r);
  };
  return (
    <div className={`flex items-stretch rounded-xl bg-karte2 border border-linie overflow-hidden min-w-0 ${className}`}>
      <button type="button" aria-label={`${label} verringern`} onClick={() => setze(wert - schritt)} className="w-9 shrink-0 flex items-center justify-center text-text2 active:bg-linie">
        <Icon name="minus" className="size-5" />
      </button>
      <div className="flex-1 min-w-0 relative">
        <input
          aria-label={label}
          inputMode={dezimal ? "decimal" : "numeric"}
          value={text}
          placeholder="0"
          onFocus={e => e.target.select()}
          onChange={e => {
            const t = e.target.value.replace(/[^0-9.,]/g, "");
            setText(t);
            onChange(Math.max(min, parseZahl(t)));
          }}
          className="w-full h-12 bg-transparent text-center text-[17px] font-semibold tabular px-0 outline-none"
        />
        {einheit && <span className="absolute right-1 bottom-0.5 text-[10px] text-muted pointer-events-none">{einheit}</span>}
      </div>
      <button type="button" aria-label={`${label} erhöhen`} onClick={() => setze(wert + schritt)} className="w-9 shrink-0 flex items-center justify-center text-text2 active:bg-linie">
        <Icon name="plus" className="size-5" />
      </button>
    </div>
  );
}

/** Unteres Blatt (Bottom Sheet) für Auswahl und Formulare. */
export function Blatt({ offen, titel, onClose, children }: { offen: boolean; titel: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!offen) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", f); document.body.style.overflow = ""; };
  }, [offen, onClose]);
  if (!offen) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={titel}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="sheet relative bg-karte rounded-t-3xl max-h-[88dvh] flex flex-col pb-safe max-w-2xl w-full mx-auto">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-linie">
          <h2 className="text-lg font-bold flex-1">{titel}</h2>
          <IconButton icon="x" label="Schließen" onClick={onClose} />
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function Leer({ titel, text, children }: { titel: string; text?: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 space-y-3">
      <p className="font-semibold">{titel}</p>
      {text && <p className="text-sm text-text2">{text}</p>}
      {children}
    </div>
  );
}

export function Abschnitt({ titel, children, rechts }: { titel: string; children: ReactNode; rechts?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{titel}</h2>
        {rechts}
      </div>
      {children}
    </section>
  );
}
