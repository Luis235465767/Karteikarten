import { useState } from "react";
import { formatKurz, formatTag, heute, plusTage, kalenderwoche } from "../logic/datum";
import { wochenListe, type Kalendertag } from "../logic/metriken";
import { useFarben } from "./farben";
import { Legende } from "./ChartTooltip";

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/**
 * Trainingskalender als Heatmap: eine Zeile pro Woche (neueste oben), sieben Spalten Mo–So.
 * So bleibt er auf dem Handy groß genug zum Antippen, auch über viele Wochen.
 */
export function Kalender({ tage, von, details }: { tage: Map<string, Kalendertag>; von: string; details: (tag: string) => string[] }) {
  const f = useFarben();
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const h = heute();
  const wochen = wochenListe(von, h).reverse();
  const flach = wochen.length > 26;

  const hintergrund = (t?: Kalendertag) => {
    if (!t || (!t.kraft && !t.handball)) return f.karte2;
    if (t.kraft && t.handball) return `linear-gradient(135deg, ${f.kraft} 50%, ${f.handball} 50%)`;
    return t.kraft ? f.kraft : f.handball;
  };
  const beschreibung = (tag: string, t?: Kalendertag) => {
    const teile = [];
    if (t?.kraft) teile.push(`${t.kraft}× Kraft`);
    if (t?.handball) teile.push(`${t.handball}× Handball`);
    return `${formatTag(tag)}: ${teile.join(", ") || "kein Training"}`;
  };

  return (
    <div className="space-y-3">
      <Legende eintraege={[
        { farbe: f.kraft, label: "Kraft" }, { farbe: f.handball, label: "Handball" },
        { farbe: f.kraft, farbe2: f.handball, label: "Beides", form: "geteilt" }, { farbe: f.karte2, label: "Kein Training" },
      ]} />
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
        <span />
        {WT.map(w => <span key={w} className="text-[11px] text-muted text-center">{w}</span>)}
        {wochen.map((w, i) => {
          const neuerMonat = i === wochen.length - 1 || w.slice(5, 7) !== wochen[i + 1].slice(5, 7);
          return [
            <span key={w} className="text-[11px] text-muted self-center tabular leading-none">
              {neuerMonat ? `${MONATE[Number(w.slice(5, 7)) - 1]}` : flach ? "" : `KW${kalenderwoche(w)}`}
            </span>,
            ...WT.map((_, d) => {
              const tag = plusTage(w, d);
              if (tag > h) return <span key={tag} />;
              const t = tage.get(tag);
              return (
                <button key={tag} type="button" onClick={() => setGewaehlt(tag === gewaehlt ? null : tag)} aria-label={beschreibung(tag, t)}
                  className={`rounded-[4px] ${flach ? "h-3.5" : "h-7"} ${tag === gewaehlt ? "ring-2 ring-text ring-offset-1 ring-offset-karte" : tag === h ? "ring-1 ring-text2" : ""}`}
                  style={{ background: hintergrund(t) }} />
              );
            }),
          ];
        })}
      </div>
      {gewaehlt && (
        <div className="rounded-xl bg-karte2 px-3 py-2 text-sm" aria-live="polite">
          <p className="font-semibold">{formatTag(gewaehlt)}</p>
          {details(gewaehlt).length ? details(gewaehlt).map((d, i) => <p key={i} className="text-text2">{d}</p>) : <p className="text-text2">Kein Training</p>}
        </div>
      )}
      <p className="text-xs text-muted">Tippe auf einen Tag für Details. {formatKurz(wochen.at(-1)!)}–{formatKurz(h)}</p>
    </div>
  );
}
