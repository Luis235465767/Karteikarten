import { useState } from "react";
import { useHandballEinheiten, useKraftEinheiten, useUebungsMap, useVorlagen } from "../db/hooks";
import type { HandballEinheit, KraftEinheit } from "../model/types";
import { formatTag } from "../logic/datum";
import { fmt, gueltig, sessionRpe, volumen } from "../logic/metriken";
import { aktiveEinheit } from "../logic/aktiv";
import { Inhalt, Karte, Leer, Segmente, Seitenkopf } from "../components/ui";
import { Icon } from "../components/Icon";
import { navigiere } from "../router";

type Filter = "alle" | "kraft" | "handball";
type Eintrag = { typ: "kraft"; e: KraftEinheit } | { typ: "handball"; e: HandballEinheit };

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const monat = (tag: string) => `${MONATE[Number(tag.slice(5, 7)) - 1]} ${tag.slice(0, 4)}`;

export function Verlauf() {
  const kraft = useKraftEinheiten();
  const handball = useHandballEinheiten();
  const map = useUebungsMap();
  const vorlagen = useVorlagen();
  const [filter, setFilter] = useState<Filter>("alle");
  const [anzahl, setAnzahl] = useState(60);
  if (!kraft || !handball || !map || !vorlagen) return <Seitenkopf titel="Verlauf" />;

  const vorlagenName = new Map(vorlagen.map(v => [v.id, v.name]));
  const eintraege: Eintrag[] = [
    ...(filter !== "handball" ? kraft.map(e => ({ typ: "kraft" as const, e })) : []),
    ...(filter !== "kraft" ? handball.map(e => ({ typ: "handball" as const, e })) : []),
  ].sort((a, b) => b.e.datum.localeCompare(a.e.datum));

  const sichtbar = eintraege.slice(0, anzahl);
  const gruppen: [string, Eintrag[]][] = [];
  for (const x of sichtbar) {
    const m = monat(x.e.datum);
    if (gruppen.at(-1)?.[0] !== m) gruppen.push([m, []]);
    gruppen.at(-1)![1].push(x);
  }

  return (
    <>
      <Seitenkopf titel="Verlauf" />
      <Inhalt>
        <Segmente label="Filter" wert={filter} onChange={setFilter}
          werte={[{ wert: "alle", label: "Alle" }, { wert: "kraft", label: "Kraft" }, { wert: "handball", label: "Handball" }]} />
        {!eintraege.length && <Leer titel="Noch keine Einheiten" text="Starte ein Training oder trage eine Handball-Einheit ein." />}
        {gruppen.map(([m, xs]) => (
          <section key={m} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted px-1">{m}</h2>
            {xs.map(x => x.typ === "kraft" ? (
              <button key={x.e.id} type="button" className="w-full text-left" onClick={() => navigiere(`/einheit/${x.e.id}`)}>
                <Karte className="flex gap-3 items-center active:bg-karte2">
                  <span className="w-1 self-stretch rounded-full bg-kraft" aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2">
                      <b className="truncate">{(x.e.vorlageId && vorlagenName.get(x.e.vorlageId)) || "Krafttraining"}</b>
                      <span className="text-sm text-text2 shrink-0">{formatTag(x.e.datum)}</span>
                    </span>
                    <span className="block text-sm text-text2 truncate">
                      {x.e.eintraege.map(u => map.get(u.uebungId)?.name ?? "?").join(" · ") || "Keine Übungen"}
                    </span>
                    <span className="block text-sm tabular">
                      {x.e.eintraege.reduce((s, u) => s + u.saetze.filter(gueltig).length, 0)} Sätze · {fmt(volumen(x.e.eintraege.flatMap(u => u.saetze)))} kg
                      {aktiveEinheit() === x.e.id && <span className="ml-2 text-akzent font-semibold">läuft</span>}
                    </span>
                  </span>
                  <Icon name="weiter" className="size-5 text-muted shrink-0" />
                </Karte>
              </button>
            ) : (
              <button key={x.e.id} type="button" className="w-full text-left" onClick={() => navigiere(`/handball/${x.e.id}`)}>
                <Karte className="flex gap-3 items-center active:bg-karte2">
                  <span className={`w-1 self-stretch rounded-full ${x.e.art === "Spiel" ? "bg-spiel" : "bg-handball"}`} aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2">
                      <b>Handball · {x.e.art}</b>
                      <span className="text-sm text-text2 shrink-0">{formatTag(x.e.datum)}</span>
                    </span>
                    <span className="block text-sm tabular">{x.e.dauerMin} min · RPE {x.e.rpe} · Belastung {fmt(sessionRpe(x.e))}</span>
                    {x.e.notiz && <span className="block text-sm text-text2 truncate">{x.e.notiz}</span>}
                  </span>
                  <Icon name="weiter" className="size-5 text-muted shrink-0" />
                </Karte>
              </button>
            ))}
          </section>
        ))}
        {eintraege.length > anzahl && (
          <button type="button" className="w-full min-h-12 text-akzent font-semibold" onClick={() => setAnzahl(a => a + 60)}>Mehr anzeigen</button>
        )}
      </Inhalt>
    </>
  );
}
