import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKurz, kalenderwoche, plusTage } from "../logic/datum";
import { fmt } from "../logic/metriken";
import { useFarben } from "./farben";
import { TooltipBox } from "./ChartTooltip";

export interface Serie { schluessel: string; label: string; farbe: string }

const kurz = (x: number) => (x >= 10000 ? `${fmt(Math.round(x / 1000))}k` : fmt(x));

/** Balken pro Woche, einfach oder gestapelt. */
export function WochenChart({ daten, serien, einheit }: { daten: Record<string, number | string>[]; serien: Serie[]; einheit: string }) {
  const f = useFarben();
  const gestapelt = serien.length > 1;
  if (!daten.some(d => serien.some(s => Number(d[s.schluessel]) > 0))) {
    return <p className="text-sm text-text2 py-8 text-center">Im Zeitraum gibt es keine Einträge.</p>;
  }
  return (
    <div className="h-56 -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={daten} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={f.linie} />
          <XAxis dataKey="woche" tickFormatter={w => `KW ${kalenderwoche(w)}`} tick={{ fill: f.muted, fontSize: 12 }} stroke={f.achse} tickLine={false} minTickGap={16} />
          <YAxis width={44} tick={{ fill: f.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={kurz} />
          <Tooltip cursor={{ fill: f.karte2 }}
            content={({ active, payload }) => {
              const d = active && (payload?.[0]?.payload as Record<string, number | string> | undefined);
              if (!d) return null;
              const w = String(d.woche);
              const zeilen = serien.map(s => ({ farbe: s.farbe, label: s.label, wert: `${fmt(Number(d[s.schluessel]))} ${einheit}` }));
              return <TooltipBox titel={`KW ${kalenderwoche(w)} · ${formatKurz(w)}–${formatKurz(plusTage(w, 6))}`} zeilen={zeilen}
                fuss={gestapelt ? `Summe ${fmt(serien.reduce((a, s) => a + Number(d[s.schluessel]), 0))} ${einheit}` : undefined} />;
            }} />
          {serien.map((s, i) => (
            <Bar key={s.schluessel} dataKey={s.schluessel} name={s.label} stackId={gestapelt ? "a" : undefined} fill={s.farbe}
              stroke={f.karte} strokeWidth={gestapelt ? 1 : 0} maxBarSize={32} isAnimationActive={false}
              radius={!gestapelt || i === serien.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
