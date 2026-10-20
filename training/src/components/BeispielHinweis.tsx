import { useLiveQuery } from "dexie-react-hooks";
import { hatBeispieldaten, loescheBeispieldaten } from "../db/repo";
import { useRueckmeldung } from "./Rueckmeldung";

/** Hinweis mit Lösch-Knopf, solange Beispieldaten vorhanden sind. */
export function BeispielHinweis() {
  const da = useLiveQuery(hatBeispieldaten, []);
  const { melde, frage } = useRueckmeldung();
  if (!da) return null;
  const loeschen = async () => {
    if (!(await frage({ titel: "Beispieldaten löschen?", text: "Deine eigenen Einträge bleiben erhalten.", ja: "Löschen", gefahr: true }))) return;
    await loescheBeispieldaten();
    melde("Beispieldaten gelöscht");
  };
  return (
    <div className="rounded-2xl border border-dashed border-achse bg-karte2 p-3 flex items-center gap-3 text-sm">
      <span className="flex-1 text-text2">Zum Ausprobieren sind <b className="text-text">Beispieldaten</b> geladen.</span>
      <button type="button" onClick={loeschen} className="min-h-10 px-3 rounded-lg font-semibold text-gefahr active:bg-gefahr/10">Löschen</button>
    </div>
  );
}
