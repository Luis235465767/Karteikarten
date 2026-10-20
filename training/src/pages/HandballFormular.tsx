import { useEffect, useState } from "react";
import type { HandballArt, HandballEinheit } from "../model/types";
import { db } from "../db/schema";
import { loescheHandball, neueId, speichereHandball } from "../db/repo";
import { heute } from "../logic/datum";
import { fmt, sessionRpe } from "../logic/metriken";
import { Button, Feld, IconButton, Inhalt, Karte, Segmente, Seitenkopf, ZahlFeld, eingabeKlasse } from "../components/ui";
import { useRueckmeldung } from "../components/Rueckmeldung";
import { navigiere } from "../router";

const RPE_TEXT: Record<number, string> = {
  1: "sehr leicht", 2: "leicht", 3: "moderat", 4: "etwas schwer", 5: "schwer",
  6: "schwer", 7: "sehr schwer", 8: "sehr schwer", 9: "extrem schwer", 10: "maximal",
};

export function HandballFormular({ id }: { id: string }) {
  const neu = id === "neu";
  const { melde, frage } = useRueckmeldung();
  const [h, setH] = useState<HandballEinheit | null>(neu ? { id: neueId(), datum: heute(), art: "Training", dauerMin: 90, rpe: 6 } : null);

  useEffect(() => {
    if (!neu) db.handballEinheiten.get(id).then(x => setH(x ?? null));
  }, [id, neu]);

  if (!h) return <Seitenkopf titel="Handball" zurueck={() => history.back()} />;
  const ok = h.dauerMin > 0 && h.rpe >= 1 && h.rpe <= 10;

  const speichern = async () => {
    await speichereHandball({ ...h, notiz: h.notiz?.trim() || undefined });
    melde(`Gespeichert: Belastung ${fmt(sessionRpe(h))}`);
    navigiere(neu ? "/training" : "/verlauf", true);
  };
  const loeschen = async () => {
    if (!(await frage({ titel: "Einheit löschen?", ja: "Löschen", gefahr: true }))) return;
    await loescheHandball(h.id);
    melde("Einheit gelöscht");
    navigiere("/verlauf", true);
  };

  return (
    <>
      <Seitenkopf titel={neu ? "Handball eintragen" : "Handball bearbeiten"} zurueck={() => history.back()}
        rechts={!neu && <IconButton icon="loeschen" label="Löschen" onClick={loeschen} />} />
      <Inhalt>
        <Feld label="Datum">
          <input type="date" className={eingabeKlasse} value={h.datum} onChange={e => e.target.value && setH({ ...h, datum: e.target.value })} />
        </Feld>
        <Segmente<HandballArt> label="Art" wert={h.art} onChange={art => setH({ ...h, art })}
          werte={[{ wert: "Training", label: "Training" }, { wert: "Spiel", label: "Spiel" }]} />
        <div>
          <span className="block text-sm font-medium text-text2 mb-1">Dauer (Minuten)</span>
          <ZahlFeld label="Dauer in Minuten" wert={h.dauerMin} schritt={5} onChange={n => setH({ ...h, dauerMin: Math.round(n) })} />
          <div className="flex gap-2 mt-2">
            {[60, 75, 90, 120].map(m => (
              <button key={m} type="button" onClick={() => setH({ ...h, dauerMin: m })}
                className={`flex-1 min-h-10 rounded-lg text-sm font-semibold border ${h.dauerMin === m ? "bg-akzent text-akzent-text border-akzent" : "border-linie text-text2"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="block text-sm font-medium text-text2 mb-1">Anstrengung (RPE 1–10): <b className="text-text">{h.rpe} · {RPE_TEXT[h.rpe]}</b></span>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="RPE">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" role="radio" aria-checked={h.rpe === n} aria-label={`RPE ${n}, ${RPE_TEXT[n]}`} onClick={() => setH({ ...h, rpe: n })}
                className={`h-12 rounded-xl text-lg font-bold border ${h.rpe === n ? "bg-handball text-white border-handball" : "border-linie bg-karte2"}`}>{n}</button>
            ))}
          </div>
        </div>
        <Feld label="Notiz (optional)">
          <textarea className={`${eingabeKlasse} py-2`} rows={2} value={h.notiz ?? ""} onChange={e => setH({ ...h, notiz: e.target.value })} placeholder="z. B. Gegner, Ergebnis, Beschwerden" />
        </Feld>
        <Karte className="flex items-baseline justify-between">
          <span className="text-text2">Belastung (Session-RPE)</span>
          <span className="text-right"><b className="text-2xl tabular">{fmt(sessionRpe(h))}</b><span className="block text-xs text-muted">{h.dauerMin} min × RPE {h.rpe}</span></span>
        </Karte>
        <Button variante="primaer" className="w-full !min-h-14 text-lg" disabled={!ok} onClick={speichern}>Speichern</Button>
      </Inhalt>
    </>
  );
}
