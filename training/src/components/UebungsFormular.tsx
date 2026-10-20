import { useState } from "react";
import { KATEGORIEN, type Uebung } from "../model/types";
import { neueId, speichereUebung } from "../db/repo";
import { Blatt, Button, Feld, eingabeKlasse } from "./ui";
import { useUebungen } from "../db/hooks";

/** Formular zum Anlegen oder Bearbeiten einer Übung, als unteres Blatt. */
export function UebungsFormular({ offen, uebung, vorschlag = "", onClose, onGespeichert, onLoeschen }: {
  offen: boolean; uebung?: Uebung; vorschlag?: string; onClose: () => void; onGespeichert?: (u: Uebung) => void; onLoeschen?: () => void;
}) {
  return (
    <Blatt offen={offen} titel={uebung ? "Übung bearbeiten" : "Neue Übung"} onClose={onClose}>
      {offen && <Inhalt key={uebung?.id ?? "neu"} uebung={uebung} vorschlag={vorschlag} onClose={onClose} onGespeichert={onGespeichert} onLoeschen={onLoeschen} />}
    </Blatt>
  );
}

function Inhalt({ uebung, vorschlag, onClose, onGespeichert, onLoeschen }: {
  uebung?: Uebung; vorschlag: string; onClose: () => void; onGespeichert?: (u: Uebung) => void; onLoeschen?: () => void;
}) {
  const alle = useUebungen() ?? [];
  const [name, setName] = useState(uebung?.name ?? vorschlag);
  const [kategorie, setKategorie] = useState(uebung?.kategorie ?? "Brust");
  const [notiz, setNotiz] = useState(uebung?.notiz ?? "");
  const eigeneKategorien = [...new Set(alle.map(u => u.kategorie))].filter(k => !(KATEGORIEN as readonly string[]).includes(k));
  const doppelt = alle.some(u => u.id !== uebung?.id && u.name.trim().toLowerCase() === name.trim().toLowerCase());

  const speichern = async () => {
    const u: Uebung = { ...uebung, id: uebung?.id ?? neueId(), name: name.trim(), kategorie: kategorie.trim() || "Sonstiges", notiz: notiz.trim() || undefined };
    await speichereUebung(u);
    onGespeichert?.(u);
    onClose();
  };

  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (name.trim() && !doppelt) speichern(); }}>
      <Feld label="Name" hinweis={doppelt ? "Eine Übung mit diesem Namen gibt es schon." : undefined}>
        <input className={eingabeKlasse} value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="z. B. Bankdrücken" />
      </Feld>
      <Feld label="Kategorie / Muskelgruppe">
        <input className={eingabeKlasse} list="kategorien" value={kategorie} onChange={e => setKategorie(e.target.value)} />
        <datalist id="kategorien">
          {[...KATEGORIEN, ...eigeneKategorien].map(k => <option key={k} value={k} />)}
        </datalist>
      </Feld>
      <div className="flex flex-wrap gap-2">
        {KATEGORIEN.map(k => (
          <button key={k} type="button" onClick={() => setKategorie(k)}
            className={`min-h-10 px-3 rounded-full text-sm border ${kategorie === k ? "bg-akzent text-akzent-text border-akzent" : "border-linie text-text2"}`}>{k}</button>
        ))}
      </div>
      <Feld label="Notiz (optional)">
        <textarea className={`${eingabeKlasse} py-2`} rows={2} value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z. B. Griffbreite, Sitzposition" />
      </Feld>
      <Button type="submit" variante="primaer" className="w-full" disabled={!name.trim() || doppelt}>Speichern</Button>
      {uebung && onLoeschen && <Button variante="gefahr" className="w-full" onClick={onLoeschen}>Übung löschen</Button>}
    </form>
  );
}
