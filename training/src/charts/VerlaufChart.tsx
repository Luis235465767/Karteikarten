import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKurz, formatTag } from "../logic/datum";
import { fmt } from "../logic/metriken";
import { useFarben } from "./farben";
import { TooltipBox } from "./ChartTooltip";

export interface Punkt { datum: string; wert: number; info: string; rekord: boolean }

/** Linienverlauf pro Einheit; Punkte mit neuer Bestleistung sind hervorgehoben. */
export function VerlaufChart({ daten, label }: { daten: Punkt[]; label: string }) {
  const f = useFarben();
  if (daten.length < 2) {
    return <p className="text-sm text-text2 py-8 text-center">Für einen Verlauf braucht es mindestens zwei Einheiten mit dieser Übung im Zeitraum.</p>;
  }
  return (
    <div className="h-56 -ml-2" role="img" aria-label={`${label}: ${daten.map(d => `${formatKurz(d.datum)} ${fmt(d.wert)} kg`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={daten} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={f.linie} />
          <XAxis dataKey="datum" tickFormatter={formatKurz} tick={{ fill: f.muted, fontSize: 12 }} stroke={f.achse} tickLine={false} minTickGap={24} />
          <YAxis width={44} domain={["auto", "auto"]} tick={{ fill: f.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
          <Tooltip cursor={{ stroke: f.achse, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as Punkt | undefined;
              if (!p) return null;
              return <TooltipBox titel={formatTag(p.datum)} zeilen={[{ farbe: f.kraft, label, wert: `${fmt(p.wert)} kg` }]}
                fuss={<>{p.info}{p.rekord && <b className="block text-rekord">Neue Bestleistung</b>}</>} />;
            }} />
          <Line type="monotone" dataKey="wert" stroke={f.kraft} strokeWidth={2} isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: Punkt }) => {
              const { cx, cy, payload, index } = props;
              if (cx === undefined || cy === undefined) return <g key={index} />;
              return payload?.rekord
                ? <circle key={index} cx={cx} cy={cy} r={5} fill={f.rekord} stroke={f.karte} strokeWidth={2} />
                : <circle key={index} cx={cx} cy={cy} r={4} fill={f.kraft} stroke={f.karte} strokeWidth={2} />;
            }}
            activeDot={{ r: 6, stroke: f.karte, strokeWidth: 2, fill: f.kraft }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
