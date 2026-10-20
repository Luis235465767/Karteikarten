import { useMemo, useState } from "react";
import type { Id, Uebung } from "../model/types";
import { useUebungen } from "../db/hooks";
import { Blatt, Button, eingabeKlasse } from "./ui";
import { Icon } from "./Icon";
import { UebungsFormular } from "./UebungsFormular";

/** Übung suchen und auswählen; neue Übung direkt anlegen. */
export function UebungsAuswahl({ offen, onClose, onWahl, schonDrin = [] }: { offen: boolean; onClose: () => void; onWahl: (u: Uebung) => void; schonDrin?: Id[] }) {
  const alle = useUebungen() ?? [];
  const [suche, setSuche] = useState("");
  const [neu, setNeu] = useState(false);
  const gruppen = useMemo(() => {
    const s = suche.trim().toLowerCase();
    const m = new Map<string, Uebung[]>();
    for (const u of alle.filter(u => !s || u.name.toLowerCase().includes(s) || u.kategorie.toLowerCase().includes(s))) {
      m.set(u.kategorie, [...(m.get(u.kategorie) ?? []), u]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [alle, suche]);

  const waehle = (u: Uebung) => { onWahl(u); setSuche(""); onClose(); };

  return (
    <>
      <Blatt offen={offen && !neu} titel="Übung wählen" onClose={onClose}>
        <div className="space-y-3">
          <div className="relative">
            <Icon name="suche" className="size-5 absolute left-3 top-3.5 text-muted" />
            <input className={`${eingabeKlasse} pl-10`} placeholder="Suchen …" value={suche} onChange={e => setSuche(e.target.value)} />
          </div>
          <Button variante="leise" className="w-full justify-start" onClick={() => setNeu(true)}>
            <Icon name="plus" /> {suche.trim() ? `„${suche.trim()}“ neu anlegen` : "Neue Übung anlegen"}
          </Button>
          {gruppen.map(([kat, us]) => (
            <div key={kat}>
              <p className="text-xs font-semibold uppercase text-muted px-1 py-1">{kat}</p>
              <ul className="divide-y divide-linie">
                {us.map(u => (
                  <li key={u.id}>
                    <button type="button" onClick={() => waehle(u)} className="w-full min-h-12 text-left px-2 flex items-center gap-2 active:bg-karte2 rounded-lg">
                      <span className="flex-1">{u.name}</span>
                      {schonDrin.includes(u.id) && <span className="text-xs text-muted">schon im Training</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!gruppen.length && <p className="text-center text-text2 py-6">Keine Übung gefunden.</p>}
        </div>
      </Blatt>
      <UebungsFormular offen={offen && neu} vorschlag={suche.trim()} onClose={() => setNeu(false)} onGespeichert={u => { setNeu(false); waehle(u); }} />
    </>
  );
}
