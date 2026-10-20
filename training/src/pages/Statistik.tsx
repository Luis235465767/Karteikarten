import { useMemo, useState } from "react";
import { useHandballEinheiten, useKraftEinheiten, useUebungen, useUebungsMap } from "../db/hooks";
import { formatKurz, formatMittel, heute, plusTage, tageZwischen, wochenStart } from "../logic/datum";
import { bestleistungen, fmt, kalender, runde, sessionRpe, verlauf, wochenBelastung, wochenVolumen, type VerlaufsPunkt } from "../logic/metriken";
import { Abschnitt, Inhalt, Karte, Leer, Segmente, Seitenkopf, eingabeKlasse } from "../components/ui";
import { BeispielHinweis } from "../components/BeispielHinweis";
import { VerlaufChart, type Punkt } from "../charts/VerlaufChart";
import { WochenChart } from "../charts/WochenChart";
import { Kalender } from "../charts/Kalender";
import { Legende } from "../charts/ChartTooltip";
import { useFarben } from "../charts/farben";

type Zeitraum = "12" | "26" | "52" | "alle";

/** Markiert Punkte, die den bisherigen Bestwert übertreffen (ab dem zweiten Punkt). */
function mitRekorden(punkte: VerlaufsPunkt[], wert: (p: VerlaufsPunkt) => number, info: (p: VerlaufsPunkt) => string): Punkt[] {
  let best = -Infinity;
  return punkte.map((p, i) => {
    const w = wert(p);
    const rekord = i > 0 && w > best + 1e-9;
    best = Math.max(best, w);
    return { datum: p.datum, wert: Math.round(w * 10) / 10, info: info(p), rekord };
  });
}

function Kachel({ titel, wert, unter }: { titel: string; wert: string; unter?: string }) {
  return (
    <Karte className="!p-3">
      <p className="text-xs text-text2">{titel}</p>
      <p className="text-xl font-bold leading-tight">{wert}</p>
      {unter && <p className="text-xs text-muted">{unter}</p>}
    </Karte>
  );
}

export default function Statistik() {
  const kraft = useKraftEinheiten();
  const handball = useHandballEinheiten();
  const uebungen = useUebungen();
  const map = useUebungsMap();
  const f = useFarben();
  const [zeitraum, setZeitraum] = useState<Zeitraum>("12");
  const [gewaehlteUebung, setUebung] = useState<string>("");
  const [volumenFilter, setVolumenFilter] = useState<"gesamt" | "uebung">("gesamt");

  // Übungen nach Häufigkeit, die meistgenutzte ist vorausgewählt
  const haeufig = useMemo(() => {
    const n = new Map<string, number>();
    kraft?.forEach(e => new Set(e.eintraege.filter(x => x.saetze.length).map(x => x.uebungId)).forEach(id => n.set(id, (n.get(id) ?? 0) + 1)));
    return n;
  }, [kraft]);

  if (!kraft || !handball || !uebungen || !map) return <Seitenkopf titel="Statistik" />;

  const h = heute();
  const erstes = [...kraft, ...handball].reduce((m, e) => (e.datum < m ? e.datum : m), h);
  const wochen = zeitraum === "alle" ? Math.max(1, tageZwischen(wochenStart(erstes), wochenStart(h)) / 7 + 1) : Number(zeitraum);
  const von = wochenStart(plusTage(h, -7 * (wochen - 1)));

  const mitDaten = uebungen.filter(u => haeufig.has(u.id)).sort((a, b) => (haeufig.get(b.id) ?? 0) - (haeufig.get(a.id) ?? 0));
  const uebungId = gewaehlteUebung && haeufig.has(gewaehlteUebung) ? gewaehlteUebung : mitDaten[0]?.id ?? "";
  const uebung = map.get(uebungId);

  const kraftImZeitraum = kraft.filter(e => e.datum >= von);
  const punkte = verlauf(kraft, uebungId); // Rekorde über die ganze Historie bestimmen, dann zuschneiden
  const gewicht = mitRekorden(punkte, p => p.maxKg, p => `Schwerster Satz: ${p.wdhBeiMax} × ${fmt(p.maxKg)} kg`).filter(p => p.datum >= von);
  const e1rm = mitRekorden(punkte, p => p.e1rm, p => `Volumen ${fmt(p.volumen)} kg`).filter(p => p.datum >= von);
  const best = bestleistungen(kraft, uebungId);

  const volumen = wochenVolumen(kraft, volumenFilter === "uebung" ? uebungId : null, h, wochen).map(w => ({ ...w }));
  const belastung = wochenBelastung(handball, h, wochen).map(w => ({ ...w }));
  const hbImZeitraum = handball.filter(x => x.datum >= von);
  const schnittLast = belastung.reduce((s, w) => s + w.gesamt, 0) / belastung.length;
  const dieseWoche = belastung.at(-1)?.gesamt ?? 0;

  const tage = kalender(kraftImZeitraum, hbImZeitraum);
  const details = (tag: string) => [
    ...kraft.filter(e => e.datum === tag).map(e => `Kraft: ${e.eintraege.map(x => map.get(x.uebungId)?.name ?? "?").join(", ")}`),
    ...handball.filter(x => x.datum === tag).map(x => `Handball ${x.art}: ${x.dauerMin} min, RPE ${x.rpe} (Belastung ${fmt(sessionRpe(x))})`),
  ];

  const alleBest = mitDaten.map(u => ({ u, b: bestleistungen(kraft, u.id) }));

  return (
    <>
      <Seitenkopf titel="Statistik" />
      <Inhalt>
        <BeispielHinweis />
        <Segmente label="Zeitraum" wert={zeitraum} onChange={setZeitraum}
          werte={[{ wert: "12", label: "12 Wo." }, { wert: "26", label: "6 Mon." }, { wert: "52", label: "1 Jahr" }, { wert: "alle", label: "Alles" }]} />

        {!kraft.length && !handball.length && <Leer titel="Noch keine Daten" text="Sobald du Einheiten einträgst, erscheinen hier deine Diagramme." />}

        {mitDaten.length > 0 && (
          <Abschnitt titel="Krafttraining">
            <select aria-label="Übung wählen" className={eingabeKlasse} value={uebungId} onChange={e => setUebung(e.target.value)}>
              {mitDaten.map(u => <option key={u.id} value={u.id}>{u.name} ({haeufig.get(u.id)}×)</option>)}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <Kachel titel="Schwerster Satz" wert={best.maxKg ? `${fmt(best.maxKg.kg)} kg` : "–"} unter={best.maxKg && `${best.maxKg.wdh} Wdh. · ${formatKurz(best.maxKg.datum)}`} />
              <Kachel titel="Bestes 1RM (geschätzt)" wert={best.e1rm ? `${fmt(runde(best.e1rm.wert))} kg` : "–"} unter={best.e1rm && `${best.e1rm.wdh} × ${fmt(best.e1rm.kg)} kg · ${formatKurz(best.e1rm.datum)}`} />
              <Kachel titel="Bestes Volumen" wert={best.volumen ? `${fmt(best.volumen.wert)} kg` : "–"} unter={best.volumen && formatKurz(best.volumen.datum)} />
              <Kachel titel="Einheiten gesamt" wert={String(best.einheiten)} />
            </div>

            <Karte className="space-y-2">
              <h3 className="font-semibold">Gewichtsverlauf <span className="font-normal text-text2">· schwerster Satz pro Einheit</span></h3>
              <VerlaufChart daten={gewicht} label={`Gewicht ${uebung?.name ?? ""}`} />
              <Legende eintraege={[{ farbe: f.kraft, label: "Schwerster Satz", form: "linie" }, { farbe: f.rekord, label: "Neue Bestleistung" }]} />
            </Karte>

            <Karte className="space-y-2">
              <h3 className="font-semibold">Geschätztes 1RM <span className="font-normal text-text2">· Epley</span></h3>
              <VerlaufChart daten={e1rm} label="1RM" />
              <p className="text-xs text-muted">Gewicht × (1 + Wdh./30), bester Satz pro Einheit.</p>
            </Karte>
          </Abschnitt>
        )}

        {kraft.length > 0 && (
          <Karte className="space-y-3">
            <h3 className="font-semibold">Wochenvolumen <span className="font-normal text-text2">· Wdh. × Gewicht</span></h3>
            <Segmente label="Volumen-Filter" wert={volumenFilter} onChange={setVolumenFilter}
              werte={[{ wert: "gesamt", label: "Alle Übungen" }, { wert: "uebung", label: uebung?.name ?? "Übung" }]} />
            <WochenChart daten={volumen} einheit="kg" serien={[{ schluessel: "volumen", label: "Volumen", farbe: f.kraft }]} />
          </Karte>
        )}

        {(kraft.length > 0 || handball.length > 0) && (
          <Abschnitt titel="Trainingskalender">
            <Karte><Kalender tage={tage} von={von} details={details} /></Karte>
          </Abschnitt>
        )}

        {handball.length > 0 && (
          <Abschnitt titel="Handball-Belastung">
            <div className="grid grid-cols-2 gap-2">
              <Kachel titel="Diese Woche" wert={fmt(dieseWoche)} unter="Session-RPE" />
              <Kachel titel="Ø pro Woche" wert={fmt(Math.round(schnittLast))} unter={`im Zeitraum, ${hbImZeitraum.length} Einheiten`} />
            </div>
            <Karte className="space-y-2">
              <h3 className="font-semibold">Wöchentliche Belastung <span className="font-normal text-text2">· Summe Dauer × RPE</span></h3>
              <WochenChart daten={belastung} einheit=""
                serien={[{ schluessel: "training", label: "Training", farbe: f.handball }, { schluessel: "spiel", label: "Spiel", farbe: f.spiel }]} />
              <Legende eintraege={[{ farbe: f.handball, label: "Training" }, { farbe: f.spiel, label: "Spiel" }]} />
            </Karte>
          </Abschnitt>
        )}

        {alleBest.length > 0 && (
          <Abschnitt titel="Bestleistungen aller Übungen">
            <Karte className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-text2 text-left">
                  <tr className="border-b border-linie"><th className="p-3 font-medium">Übung</th><th className="p-3 font-medium text-right">Schwerster Satz</th><th className="p-3 font-medium text-right">1RM</th></tr>
                </thead>
                <tbody className="tabular">
                  {alleBest.map(({ u, b }) => (
                    <tr key={u.id} className="border-b border-linie last:border-0">
                      <td className="p-3">{u.name}</td>
                      <td className="p-3 text-right whitespace-nowrap">{b.maxKg ? `${b.maxKg.wdh} × ${fmt(b.maxKg.kg)} kg` : "–"}<span className="block text-xs text-muted">{b.maxKg && formatMittel(b.maxKg.datum)}</span></td>
                      <td className="p-3 text-right font-semibold whitespace-nowrap">{b.e1rm ? `${fmt(runde(b.e1rm.wert))} kg` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Karte>
          </Abschnitt>
        )}
      </Inhalt>
    </>
  );
}
