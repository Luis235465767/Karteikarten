import { useState } from "react";
import type { Uebung } from "../model/types";
import { useUebungen, useVorlagen, useUebungsMap } from "../db/hooks";
import { loescheUebung } from "../db/repo";
import { Abschnitt, Button, Inhalt, Karte, Leer, Segmente, Seitenkopf } from "../components/ui";
import { Icon } from "../components/Icon";
import { UebungsFormular } from "../components/UebungsFormular";
import { useRueckmeldung } from "../components/Rueckmeldung";
import { navigiere } from "../router";
import { DatenSeite } from "./DatenSeite";

type Tab = "uebungen" | "vorlagen" | "daten";

export function Bibliothek({ tab }: { tab: Tab }) {
  return (
    <>
      <Seitenkopf titel={tab === "daten" ? "Daten & Backup" : tab === "vorlagen" ? "Vorlagen" : "Übungen"} />
      <Inhalt>
        <Segmente label="Bereich" wert={tab} onChange={t => navigiere(t === "uebungen" ? "/bibliothek" : `/bibliothek/${t}`, true)}
          werte={[{ wert: "uebungen", label: "Übungen" }, { wert: "vorlagen", label: "Vorlagen" }, { wert: "daten", label: "Daten" }]} />
        {tab === "uebungen" && <UebungsListe />}
        {tab === "vorlagen" && <VorlagenListe />}
        {tab === "daten" && <DatenSeite />}
      </Inhalt>
    </>
  );
}

function UebungsListe() {
  const uebungen = useUebungen();
  const { melde, frage } = useRueckmeldung();
  const [bearbeite, setBearbeite] = useState<Uebung | undefined>();
  const [offen, setOffen] = useState(false);
  if (!uebungen) return null;

  const gruppen = new Map<string, Uebung[]>();
  uebungen.forEach(u => gruppen.set(u.kategorie, [...(gruppen.get(u.kategorie) ?? []), u]));

  const loeschen = async () => {
    if (!bearbeite) return;
    if (!(await frage({ titel: `„${bearbeite.name}“ löschen?`, ja: "Löschen", gefahr: true }))) return;
    const r = await loescheUebung(bearbeite.id);
    if (r.ok) { melde("Übung gelöscht"); setOffen(false); }
    else melde(`${r.grund} Entferne sie dort zuerst.`, "fehler");
  };

  return (
    <>
      <Button variante="primaer" className="w-full" onClick={() => { setBearbeite(undefined); setOffen(true); }}><Icon name="plus" /> Neue Übung</Button>
      {!uebungen.length && <Leer titel="Noch keine Übungen" text="Lege deine erste Übung an, z. B. Bankdrücken." />}
      {[...gruppen.entries()].sort((a, b) => a[0].localeCompare(b[0], "de")).map(([kat, us]) => (
        <Abschnitt key={kat} titel={kat}>
          <Karte className="!p-0 divide-y divide-linie">
            {us.map(u => (
              <button key={u.id} type="button" onClick={() => { setBearbeite(u); setOffen(true); }}
                className="w-full min-h-14 px-4 py-2 text-left flex items-center gap-3 active:bg-karte2">
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{u.name}</span>
                  {u.notiz && <span className="block text-sm text-text2 truncate">{u.notiz}</span>}
                </span>
                {u.beispiel && <span className="text-xs text-muted">Beispiel</span>}
                <Icon name="stift" className="size-5 text-muted" />
              </button>
            ))}
          </Karte>
        </Abschnitt>
      ))}
      <UebungsFormular offen={offen} uebung={bearbeite} onClose={() => setOffen(false)} onLoeschen={loeschen}
        onGespeichert={() => melde(bearbeite ? "Übung gespeichert" : "Übung angelegt")} />
    </>
  );
}

function VorlagenListe() {
  const vorlagen = useVorlagen();
  const map = useUebungsMap();
  if (!vorlagen || !map) return null;
  return (
    <>
      <Button variante="primaer" className="w-full" onClick={() => navigiere("/vorlage/neu")}><Icon name="plus" /> Neue Vorlage</Button>
      {!vorlagen.length && <Leer titel="Noch keine Vorlagen" text="Mit einer Vorlage startest du ein Training mit festen Übungen auf einen Tipp." />}
      <div className="space-y-2">
        {vorlagen.map(v => (
          <button key={v.id} type="button" onClick={() => navigiere(`/vorlage/${v.id}`)} className="w-full text-left">
            <Karte className="active:bg-karte2 flex items-center gap-3">
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{v.name}</span>
                <span className="block text-sm text-text2 truncate">
                  {v.uebungen.map(x => map.get(x.uebungId)?.name ?? "?").join(" · ") || "Keine Übungen"}
                </span>
              </span>
              <Icon name="weiter" className="size-5 text-muted" />
            </Karte>
          </button>
        ))}
      </div>
    </>
  );
}
