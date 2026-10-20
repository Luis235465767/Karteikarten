import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { KraftEinheit, Satz, Uebung, VorlagenUebung } from "../model/types";
import { db } from "../db/schema";
import { loescheKraft, speichereKraft } from "../db/repo";
import { useKraftEinheiten, useUebungsMap } from "../db/hooks";
import { aktiveEinheit, setzeAktiveEinheit } from "../logic/aktiv";
import { formatKurz, formatTag } from "../logic/datum";
import { fmt, fruehereSaetze, gueltig, letztesMal, pruefeRekord, volumen, type Rekord } from "../logic/metriken";
import { Button, IconButton, Inhalt, Karte, Seitenkopf, ZahlFeld, eingabeKlasse } from "../components/ui";
import { Icon } from "../components/Icon";
import { UebungsAuswahl } from "../components/UebungsAuswahl";
import { useRueckmeldung } from "../components/Rueckmeldung";
import { navigiere } from "../router";

const satzText = (s: Satz) => `${s.wdh}×${fmt(s.kg)}`;

export function EinheitEditor({ id }: { id: string }) {
  const [einheit, setEinheit] = useState<KraftEinheit | null | undefined>(undefined);
  const geladen = useRef(false);
  const alle = useKraftEinheiten();
  const map = useUebungsMap();
  const vorlage = useLiveQuery(async () => (einheit?.vorlageId ? (await db.vorlagen.get(einheit.vorlageId)) ?? null : null), [einheit?.vorlageId]);
  const { melde, frage } = useRueckmeldung();
  const [auswahl, setAuswahl] = useState(false);
  const istAktiv = aktiveEinheit() === id;

  useEffect(() => {
    geladen.current = false;
    db.kraftEinheiten.get(id).then(e => setEinheit(e ?? null));
  }, [id]);

  // Jede Änderung wird sofort gespeichert, damit nichts verloren geht.
  useEffect(() => {
    if (!einheit) return;
    if (!geladen.current) { geladen.current = true; return; }
    speichereKraft(einheit);
  }, [einheit]);

  // Rekorde aller Sätze berechnen
  const rekorde = useMemo(() => {
    const r = new Map<string, Rekord>();
    if (!einheit || !alle) return r;
    const bisher = new Map<string, Satz[]>();
    einheit.eintraege.forEach((x, i) => {
      const frueher = fruehereSaetze(alle, x.uebungId, einheit.id, einheit.datum);
      x.saetze.forEach((s, j) => {
        const vorher = bisher.get(x.uebungId) ?? [];
        r.set(`${i}-${j}`, pruefeRekord(s, frueher, vorher));
        bisher.set(x.uebungId, [...vorher, s]);
      });
    });
    return r;
  }, [einheit, alle]);

  // Neue Bestleistungen kurz hervorheben (mit Verzögerung, damit Zwischenstände beim Tippen nicht zählen)
  const bekannt = useRef<Set<string> | null>(null);
  const [blitz, setBlitz] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!einheit || !map || !alle) return;
    const schluessel = (k: string, r: Rekord) => {
      const [i, j] = k.split("-").map(Number);
      const s = einheit.eintraege[i]?.saetze[j];
      return s ? `${einheit.eintraege[i].uebungId}:${s.wdh}x${s.kg}:${r.gewicht ? "g" : ""}${r.e1rm ? "e" : ""}` : k;
    };
    const jetzt = [...rekorde].filter(([, r]) => r.gewicht || r.e1rm);
    if (bekannt.current === null) { bekannt.current = new Set(jetzt.map(([k, r]) => schluessel(k, r))); return; }
    const t = setTimeout(() => {
      const neu = jetzt.filter(([k, r]) => !bekannt.current!.has(schluessel(k, r)));
      if (!neu.length) return;
      neu.forEach(([k, r]) => bekannt.current!.add(schluessel(k, r)));
      const [k, r] = neu[neu.length - 1];
      const [i, j] = k.split("-").map(Number);
      const s = einheit.eintraege[i].saetze[j];
      const name = map.get(einheit.eintraege[i].uebungId)?.name ?? "";
      melde(`Neue Bestleistung! ${name}: ${satzText(s)} kg${r.gewicht ? "" : " (1RM)"}`, "rekord");
      setBlitz(new Set(neu.map(([k]) => k)));
      setTimeout(() => setBlitz(new Set()), 1300);
    }, 700);
    return () => clearTimeout(t);
  }, [rekorde, einheit, map, alle, melde]);

  if (einheit === undefined || !map || !alle) return <Seitenkopf titel="Training" />;
  if (einheit === null) {
    return (
      <>
        <Seitenkopf titel="Training" zurueck={() => navigiere("/training", true)} />
        <Inhalt><p className="text-text2">Dieses Training gibt es nicht mehr.</p></Inhalt>
      </>
    );
  }

  const aendere = (f: (e: KraftEinheit) => KraftEinheit) => setEinheit(e => (e ? f(e) : e));
  const setzeSaetze = (i: number, saetze: Satz[]) =>
    aendere(e => ({ ...e, eintraege: e.eintraege.map((x, k) => (k === i ? { ...x, saetze } : x)) }));

  const satzHinzufuegen = (i: number) => {
    const x = einheit.eintraege[i];
    const letzter = x.saetze[x.saetze.length - 1];
    const vorher = letztesMal(alle, x.uebungId, einheit.id, einheit.datum);
    const ziel = vorlage?.uebungen.find(v => v.uebungId === x.uebungId);
    const vorschlag: Satz = letzter
      ? { ...letzter }
      : vorher?.saetze[0] ? { ...vorher.saetze[0] } : { wdh: ziel?.zielWdh ?? 8, kg: 0 };
    setzeSaetze(i, [...x.saetze, vorschlag]);
  };

  const verschiebe = (i: number, d: number) => aendere(e => {
    const u = [...e.eintraege];
    [u[i], u[i + d]] = [u[i + d], u[i]];
    return { ...e, eintraege: u };
  });

  const entferneUebung = async (i: number) => {
    const x = einheit.eintraege[i];
    if (x.saetze.length && !(await frage({ titel: `${map.get(x.uebungId)?.name ?? "Übung"} entfernen?`, text: `${x.saetze.length} Sätze gehen verloren.`, ja: "Entfernen", gefahr: true }))) return;
    aendere(e => ({ ...e, eintraege: e.eintraege.filter((_, k) => k !== i) }));
  };

  const beenden = async () => {
    const bereinigt: KraftEinheit = {
      ...einheit,
      eintraege: einheit.eintraege.map(x => ({ ...x, saetze: x.saetze.filter(gueltig) })).filter(x => x.saetze.length),
    };
    if (!bereinigt.eintraege.length) {
      if (!(await frage({ titel: "Keine Sätze eingetragen", text: "Das leere Training wird verworfen.", ja: "Verwerfen" }))) return;
      await loescheKraft(einheit.id);
      setzeAktiveEinheit(null);
      navigiere("/training", true);
      return;
    }
    geladen.current = false; // nicht doppelt speichern
    await speichereKraft(bereinigt);
    if (istAktiv) setzeAktiveEinheit(null);
    const saetze = bereinigt.eintraege.reduce((s, x) => s + x.saetze.length, 0);
    melde(`Gespeichert: ${saetze} Sätze, ${fmt(volumen(bereinigt.eintraege.flatMap(x => x.saetze)))} kg Volumen`);
    navigiere(istAktiv ? "/training" : "/verlauf", true);
  };

  const loeschen = async () => {
    if (!(await frage({ titel: "Training löschen?", text: `${formatTag(einheit.datum)} – das lässt sich nicht rückgängig machen.`, ja: "Löschen", gefahr: true }))) return;
    await loescheKraft(einheit.id);
    if (istAktiv) setzeAktiveEinheit(null);
    melde("Training gelöscht");
    navigiere(istAktiv ? "/training" : "/verlauf", true);
  };

  return (
    <>
      <Seitenkopf titel={vorlage?.name ?? "Krafttraining"} zurueck={() => history.length > 1 ? history.back() : navigiere("/training")}
        rechts={<IconButton icon="loeschen" label="Training löschen" onClick={loeschen} />} />
      <Inhalt>
        <div className="flex gap-2 items-center">
          <input type="date" aria-label="Datum" className={`${eingabeKlasse} flex-1`} value={einheit.datum}
            onChange={e => e.target.value && aendere(x => ({ ...x, datum: e.target.value }))} />
        </div>

        {einheit.eintraege.map((x, i) => (
          <UebungsKarte key={`${x.uebungId}-${i}`} index={i} anzahl={einheit.eintraege.length}
            uebung={map.get(x.uebungId)} saetze={x.saetze}
            ziel={vorlage?.uebungen.find(v => v.uebungId === x.uebungId)}
            vorher={letztesMal(alle, x.uebungId, einheit.id, einheit.datum)}
            rekorde={rekorde} blitz={blitz}
            onSaetze={s => setzeSaetze(i, s)} onHinzu={() => satzHinzufuegen(i)}
            onHoch={() => verschiebe(i, -1)} onRunter={() => verschiebe(i, 1)} onEntfernen={() => entferneUebung(i)} />
        ))}

        <Button className="w-full !min-h-14" onClick={() => setAuswahl(true)}><Icon name="plus" /> Übung hinzufügen</Button>

        <textarea className={`${eingabeKlasse} py-2`} rows={2} placeholder="Notiz zum Training (optional)" value={einheit.notiz ?? ""}
          onChange={e => aendere(x => ({ ...x, notiz: e.target.value || undefined }))} />

        <Button variante="primaer" className="w-full !min-h-14 text-lg" onClick={beenden}>
          <Icon name="haken" /> {istAktiv ? "Training beenden" : "Fertig"}
        </Button>
      </Inhalt>
      <UebungsAuswahl offen={auswahl} onClose={() => setAuswahl(false)} schonDrin={einheit.eintraege.map(x => x.uebungId)}
        onWahl={u => aendere(e => ({ ...e, eintraege: [...e.eintraege, { uebungId: u.id, saetze: [] }] }))} />
    </>
  );
}

function UebungsKarte({ index, anzahl, uebung, saetze, ziel, vorher, rekorde, blitz, onSaetze, onHinzu, onHoch, onRunter, onEntfernen }: {
  index: number; anzahl: number; uebung?: Uebung; saetze: Satz[]; ziel?: VorlagenUebung;
  vorher?: { datum: string; saetze: Satz[] }; rekorde: Map<string, Rekord>; blitz: Set<string>;
  onSaetze: (s: Satz[]) => void; onHinzu: () => void; onHoch: () => void; onRunter: () => void; onEntfernen: () => void;
}) {
  const setze = (j: number, teil: Partial<Satz>) => onSaetze(saetze.map((s, k) => (k === j ? { ...s, ...teil } : s)));
  return (
    <Karte className="space-y-3">
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0 pt-1">
          <h2 className="font-bold text-lg leading-tight">{uebung?.name ?? "Gelöschte Übung"}</h2>
          {uebung?.notiz && <p className="text-xs text-muted">{uebung.notiz}</p>}
        </div>
        <IconButton icon="hoch" label="Nach oben" disabled={index === 0} onClick={onHoch} className="disabled:opacity-30 !size-10" />
        <IconButton icon="runter" label="Nach unten" disabled={index === anzahl - 1} onClick={onRunter} className="disabled:opacity-30 !size-10" />
        <IconButton icon="x" label="Übung entfernen" onClick={onEntfernen} className="!size-10" />
      </div>

      <div className="rounded-xl bg-karte2 px-3 py-2 text-sm space-y-0.5">
        {vorher ? (
          <p><span className="text-muted">Letztes Mal ({formatKurz(vorher.datum)}): </span>
            <span className="font-semibold tabular">{vorher.saetze.map(satzText).join(" · ")} kg</span></p>
        ) : <p className="text-muted">Noch keine früheren Einträge.</p>}
        {ziel && (ziel.zielSaetze || ziel.zielWdh) && (
          <p><span className="text-muted">Ziel: </span><span className="font-semibold">{ziel.zielSaetze ?? "–"} Sätze × {ziel.zielWdh ?? "–"} Wdh.</span></p>
        )}
      </div>

      {saetze.length > 0 && (
        <div className="space-y-2">
          <div className="flex text-xs text-muted px-1 gap-2">
            <span className="w-6">Satz</span><span className="flex-1 text-center">Wdh.</span><span className="flex-1 text-center">Gewicht (kg)</span><span className="w-10" />
          </div>
          {saetze.map((s, j) => {
            const r = rekorde.get(`${index}-${j}`);
            const pr = r && (r.gewicht || r.e1rm);
            return (
              <div key={j} className={`rounded-xl ${pr ? "bg-rekord-bg p-1 -m-1" : ""} ${blitz.has(`${index}-${j}`) ? "rekord-blitz" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center font-semibold text-text2 tabular">{j + 1}</span>
                  <ZahlFeld label={`Satz ${j + 1} Wiederholungen`} wert={s.wdh} schritt={1} onChange={n => setze(j, { wdh: Math.round(n) })} />
                  <ZahlFeld label={`Satz ${j + 1} Gewicht`} wert={s.kg} schritt={2.5} dezimal onChange={n => setze(j, { kg: n })} />
                  <IconButton icon="x" label={`Satz ${j + 1} löschen`} className="!size-10" onClick={() => onSaetze(saetze.filter((_, k) => k !== j))} />
                </div>
                {pr && (
                  <p className="text-xs font-semibold text-rekord flex items-center gap-1 pl-8 pt-1">
                    <Icon name="pokal" className="size-4" /> Neue Bestleistung{r.gewicht ? " · schwerstes Gewicht" : ""}{r.e1rm ? " · bestes 1RM" : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button variante="leise" className="w-full border border-akzent/30" onClick={onHinzu}><Icon name="plus" /> Satz hinzufügen</Button>
    </Karte>
  );
}
