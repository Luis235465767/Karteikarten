import { useLiveQuery } from "dexie-react-hooks";
import type { Vorlage } from "../model/types";
import { db } from "../db/schema";
import { neueId, speichereKraft } from "../db/repo";
import { useHandballEinheiten, useKraftEinheiten, useVorlagen } from "../db/hooks";
import { aktiveEinheit, setzeAktiveEinheit } from "../logic/aktiv";
import { heute, wochenStart, formatTag } from "../logic/datum";
import { fmt, sessionRpe, volumen } from "../logic/metriken";
import { Abschnitt, Button, Inhalt, Karte, Seitenkopf } from "../components/ui";
import { Icon } from "../components/Icon";
import { BeispielHinweis } from "../components/BeispielHinweis";
import { navigiere } from "../router";

export async function starteTraining(vorlage?: Vorlage) {
  const id = neueId();
  await speichereKraft({
    id, datum: heute(), vorlageId: vorlage?.id,
    eintraege: (vorlage?.uebungen ?? []).map(u => ({ uebungId: u.uebungId, saetze: [] })),
  });
  setzeAktiveEinheit(id);
  navigiere(`/einheit/${id}`);
}

export function TrainingStart() {
  const vorlagen = useVorlagen();
  const kraft = useKraftEinheiten();
  const handball = useHandballEinheiten();
  const aktivId = aktiveEinheit();
  const aktiv = useLiveQuery(async () => (aktivId ? (await db.kraftEinheiten.get(aktivId)) ?? null : null), [aktivId]);

  const woche = wochenStart(heute());
  const kraftWoche = (kraft ?? []).filter(e => e.datum >= woche);
  const hbWoche = (handball ?? []).filter(h => h.datum >= woche);
  const vol = kraftWoche.reduce((s, e) => s + volumen(e.eintraege.flatMap(x => x.saetze)), 0);
  const last = hbWoche.reduce((s, h) => s + sessionRpe(h), 0);

  return (
    <>
      <Seitenkopf titel="Training" />
      <Inhalt>
        <BeispielHinweis />
        {aktiv && (
          <button type="button" className="w-full text-left" onClick={() => navigiere(`/einheit/${aktiv.id}`)}>
            <Karte className="!border-akzent border-2 flex items-center gap-3 active:bg-karte2">
              <span className="size-3 rounded-full bg-akzent animate-pulse shrink-0" />
              <span className="flex-1">
                <span className="block font-bold">Laufendes Training fortsetzen</span>
                <span className="block text-sm text-text2">
                  {formatTag(aktiv.datum)} · {aktiv.eintraege.length} Übungen · {aktiv.eintraege.reduce((s, x) => s + x.saetze.length, 0)} Sätze
                </span>
              </span>
              <Icon name="weiter" className="size-5 text-muted" />
            </Karte>
          </button>
        )}

        <Abschnitt titel="Krafttraining starten">
          <div className="space-y-2">
            <Button variante={aktiv ? "sekundaer" : "primaer"} className="w-full !min-h-14 text-lg" onClick={() => starteTraining()}>
              <Icon name="hantel" /> Leeres Training
            </Button>
            {vorlagen?.map(v => (
              <Button key={v.id} className="w-full !min-h-14 !justify-start" onClick={() => starteTraining(v)}>
                <span className="flex-1 text-left">
                  <span className="block">{v.name}</span>
                  <span className="block text-xs font-normal text-text2">{v.uebungen.length} Übungen</span>
                </span>
                <Icon name="weiter" className="size-5 text-muted" />
              </Button>
            ))}
            {vorlagen && !vorlagen.length && (
              <p className="text-sm text-text2 px-1">
                Tipp: Unter <button type="button" className="text-akzent underline" onClick={() => navigiere("/bibliothek/vorlagen")}>Übungen › Vorlagen</button> kannst du feste Trainingspläne anlegen.
              </p>
            )}
          </div>
        </Abschnitt>

        <Abschnitt titel="Handball">
          <Button className="w-full !min-h-14 text-lg" onClick={() => navigiere("/handball/neu")}>
            <Icon name="ball" className="size-6 text-handball" /> Handball eintragen
          </Button>
        </Abschnitt>

        <Abschnitt titel="Diese Woche">
          <div className="grid grid-cols-2 gap-2">
            <Karte>
              <p className="text-sm text-text2">Krafttraining</p>
              <p className="text-2xl font-bold">{kraftWoche.length}×</p>
              <p className="text-sm text-text2">{fmt(vol)} kg Volumen</p>
            </Karte>
            <Karte>
              <p className="text-sm text-text2">Handball</p>
              <p className="text-2xl font-bold">{hbWoche.length}×</p>
              <p className="text-sm text-text2">{fmt(last)} Belastung</p>
            </Karte>
          </div>
        </Abschnitt>
      </Inhalt>
    </>
  );
}
