// Kurze Meldungen (Toast) und Bestätigungsdialoge, app-weit über Context.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./ui";
import { Icon } from "./Icon";

type Art = "info" | "rekord" | "fehler";
interface Meldung { id: number; text: string; art: Art }
interface Frage { titel: string; text?: string; ja: string; gefahr?: boolean; aufloesen: (ok: boolean) => void }

const Ctx = createContext<{ melde: (text: string, art?: Art) => void; frage: (f: Omit<Frage, "aufloesen">) => Promise<boolean> } | null>(null);

export function RueckmeldungProvider({ children }: { children: ReactNode }) {
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const [frageOffen, setFrage] = useState<Frage | null>(null);
  const zaehler = useRef(0);

  const melde = useCallback((text: string, art: Art = "info") => {
    const id = ++zaehler.current;
    setMeldungen(m => [...m.slice(-2), { id, text, art }]);
    setTimeout(() => setMeldungen(m => m.filter(x => x.id !== id)), art === "fehler" ? 6000 : 3000);
  }, []);

  const frage = useCallback((f: Omit<Frage, "aufloesen">) => new Promise<boolean>(aufloesen => setFrage({ ...f, aufloesen })), []);
  const antworte = (ok: boolean) => { frageOffen?.aufloesen(ok); setFrage(null); };

  return (
    <Ctx.Provider value={{ melde, frage }}>
      {children}
      <div className="fixed top-0 inset-x-0 z-[60] pt-safe pointer-events-none flex flex-col items-center gap-2 px-4 mt-2" aria-live="polite">
        {meldungen.map(m => (
          <div key={m.id} className={`toast pointer-events-auto max-w-md w-full rounded-xl px-4 py-3 shadow-lg font-semibold flex items-center gap-2 border ${
            m.art === "rekord" ? "bg-rekord-bg text-text border-rekord" : m.art === "fehler" ? "bg-karte text-gefahr border-gefahr" : "bg-karte text-text border-linie"}`}>
            {m.art === "rekord" && <Icon name="pokal" className="size-5 text-rekord shrink-0" />}
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      {frageOffen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-label={frageOffen.titel}>
          <div className="absolute inset-0 bg-black/50" onClick={() => antworte(false)} />
          <div className="relative bg-karte rounded-2xl p-5 w-full max-w-sm space-y-4 border border-linie">
            <h2 className="text-lg font-bold">{frageOffen.titel}</h2>
            {frageOffen.text && <p className="text-text2 text-sm">{frageOffen.text}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => antworte(false)}>Abbrechen</Button>
              <Button className={`flex-1 ${frageOffen.gefahr ? "!bg-gefahr !text-white" : ""}`} variante="primaer" onClick={() => antworte(true)}>{frageOffen.ja}</Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useRueckmeldung() {
  const c = useContext(Ctx);
  if (!c) throw new Error("RueckmeldungProvider fehlt");
  return c;
}
