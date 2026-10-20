import { useEffect, useState } from "react";
import type { Vorlage, VorlagenUebung } from "../model/types";
import { db } from "../db/schema";
import { loescheVorlage, neueId, speichereVorlage } from "../db/repo";
import { useUebungsMap } from "../db/hooks";
import { Button, Feld, IconButton, Inhalt, Karte, Seitenkopf, ZahlFeld, eingabeKlasse } from "../components/ui";
import { Icon } from "../components/Icon";
import { UebungsAuswahl } from "../components/UebungsAuswahl";
import { useRueckmeldung } from "../components/Rueckmeldung";
import { navigiere } from "../router";

export function VorlageEditor({ id }: { id: string }) {
  const neu = id === "neu";
  const map = useUebungsMap();
  const { melde, frage } = useRueckmeldung();
  const [v, setV] = useState<Vorlage | null>(neu ? { id: neueId(), name: "", uebungen: [] } : null);
  const [auswahl, setAuswahl] = useState(false);

  useEffect(() => {
    if (!neu) db.vorlagen.get(id).then(x => setV(x ?? null));
  }, [id, neu]);

  if (!v || !map) return <Seitenkopf titel="Vorlage" zurueck={() => history.back()} />;

  const setzeUebung = (i: number, teil: Partial<VorlagenUebung>) =>
    setV({ ...v, uebungen: v.uebungen.map((x, j) => (j === i ? { ...x, ...teil } : x)) });
  const verschiebe = (i: number, d: number) => {
    const u = [...v.uebungen];
    [u[i], u[i + d]] = [u[i + d], u[i]];
    setV({ ...v, uebungen: u });
  };

  const speichern = async () => {
    await speichereVorlage({ ...v, name: v.name.trim() });
    melde("Vorlage gespeichert");
    navigiere("/bibliothek/vorlagen", true);
  };
  const loeschen = async () => {
    if (!(await frage({ titel: `Vorlage „${v.name}“ löschen?`, text: "Bisherige Trainings bleiben erhalten.", ja: "Löschen", gefahr: true }))) return;
    await loescheVorlage(v.id);
    melde("Vorlage gelöscht");
    navigiere("/bibliothek/vorlagen", true);
  };

  return (
    <>
      <Seitenkopf titel={neu ? "Neue Vorlage" : "Vorlage bearbeiten"} zurueck={() => history.back()} />
      <Inhalt>
        <Feld label="Name">
          <input className={eingabeKlasse} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="z. B. Oberkörper" autoFocus={neu} />
        </Feld>
        <div className="space-y-2">
          {v.uebungen.map((x, i) => (
            <Karte key={`${x.uebungId}-${i}`} className="space-y-3">
              <div className="flex items-center gap-1">
                <span className="flex-1 font-semibold">{map.get(x.uebungId)?.name ?? "Gelöschte Übung"}</span>
                <IconButton icon="hoch" label="Nach oben" disabled={i === 0} onClick={() => verschiebe(i, -1)} className="disabled:opacity-30" />
                <IconButton icon="runter" label="Nach unten" disabled={i === v.uebungen.length - 1} onClick={() => verschiebe(i, 1)} className="disabled:opacity-30" />
                <IconButton icon="x" label="Entfernen" onClick={() => setV({ ...v, uebungen: v.uebungen.filter((_, j) => j !== i) })} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-muted">Ziel-Sätze</span>
                  <ZahlFeld label="Ziel-Sätze" wert={x.zielSaetze ?? 0} schritt={1} onChange={n => setzeUebung(i, { zielSaetze: n || undefined })} />
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-muted">Ziel-Wdh.</span>
                  <ZahlFeld label="Ziel-Wiederholungen" wert={x.zielWdh ?? 0} schritt={1} onChange={n => setzeUebung(i, { zielWdh: n || undefined })} />
                </div>
              </div>
            </Karte>
          ))}
        </div>
        <Button className="w-full" onClick={() => setAuswahl(true)}><Icon name="plus" /> Übung hinzufügen</Button>
        <Button variante="primaer" className="w-full" disabled={!v.name.trim()} onClick={speichern}>Vorlage speichern</Button>
        {!neu && <Button variante="gefahr" className="w-full" onClick={loeschen}>Vorlage löschen</Button>}
      </Inhalt>
      <UebungsAuswahl offen={auswahl} onClose={() => setAuswahl(false)} schonDrin={v.uebungen.map(x => x.uebungId)}
        onWahl={u => setV(alt => alt && { ...alt, uebungen: [...alt.uebungen, { uebungId: u.id, zielSaetze: 3, zielWdh: 8 }] })} />
    </>
  );
}
