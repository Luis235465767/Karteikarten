import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Backup } from "../model/types";
import { db } from "../db/schema";
import { erstelleBackup, hatBeispieldaten, legeBeispieldatenAn, loescheBeispieldaten, stelleWiederHer } from "../db/repo";
import { alsCsv, pruefeBackup } from "../logic/export";
import { speichereDatei, zeitstempel } from "../logic/datei";
import { formatTag } from "../logic/datum";
import { Abschnitt, Blatt, Button, Karte } from "../components/ui";
import { Icon } from "../components/Icon";
import { useRueckmeldung } from "../components/Rueckmeldung";

const anzahlText = (b: Pick<Backup, "uebungen" | "kraftEinheiten" | "vorlagen" | "handballEinheiten">) =>
  `${b.uebungen.length} Übungen, ${b.kraftEinheiten.length} Krafteinheiten, ${b.handballEinheiten.length} Handball-Einheiten, ${b.vorlagen.length} Vorlagen`;

export function DatenSeite() {
  const { melde, frage } = useRueckmeldung();
  const datei = useRef<HTMLInputElement>(null);
  const [import_, setImport] = useState<Backup | null>(null);
  const [dauerhaft, setDauerhaft] = useState<boolean | null>(null);
  const beispiel = useLiveQuery(hatBeispieldaten, []);
  const bestand = useLiveQuery(async () => ({
    uebungen: await db.uebungen.toArray(), kraftEinheiten: await db.kraftEinheiten.toArray(),
    vorlagen: await db.vorlagen.toArray(), handballEinheiten: await db.handballEinheiten.toArray(),
  }), []);

  useEffect(() => { navigator.storage?.persisted?.().then(setDauerhaft).catch(() => setDauerhaft(null)); }, []);

  const csv = async () => {
    await speichereDatei(`training_${zeitstempel()}.csv`, alsCsv(await erstelleBackup()), "text/csv;charset=utf-8");
  };
  const backup = async () => {
    await speichereDatei(`training-backup_${zeitstempel()}.json`, JSON.stringify(await erstelleBackup(), null, 1), "application/json");
  };
  const gewaehlt = async (f?: File) => {
    if (!f) return;
    try {
      setImport(pruefeBackup(await f.text()));
    } catch (e) {
      melde((e as Error).message, "fehler");
    } finally {
      if (datei.current) datei.current.value = "";
    }
  };
  const wiederherstellen = async () => {
    if (!import_) return;
    // Vorher automatisch eine Sicherung des aktuellen Stands anbieten
    if (bestand && (bestand.kraftEinheiten.length || bestand.handballEinheiten.length)) {
      if (await frage({ titel: "Aktuellen Stand vorher sichern?", text: "Empfohlen: Die jetzigen Daten werden beim Wiederherstellen ersetzt.", ja: "Sichern" })) await backup();
    }
    await stelleWiederHer(import_);
    setImport(null);
    melde("Backup wiederhergestellt");
  };

  return (
    <div className="space-y-5">
      <Abschnitt titel="Gespeichert auf diesem Gerät">
        <Karte className="space-y-2 text-sm">
          <p>{bestand ? anzahlText(bestand) : "…"}</p>
          <p className="text-text2">
            Die Daten liegen nur in diesem Browser. Mach ab und zu ein Backup, besonders vor dem Löschen der Browserdaten oder einem Gerätewechsel.
          </p>
          {dauerhaft === false && (
            <Button variante="leise" className="!px-0" onClick={async () => {
              const ok = await navigator.storage.persist();
              setDauerhaft(ok);
              melde(ok ? "Speicher ist jetzt dauerhaft" : "Der Browser hat abgelehnt. Installiere die App auf dem Startbildschirm.", ok ? "info" : "fehler");
            }}>Speicher dauerhaft machen</Button>
          )}
          {dauerhaft && <p className="text-gut font-semibold flex items-center gap-1"><Icon name="haken" className="size-4" /> Dauerhafter Speicher aktiv</p>}
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Exportieren">
        <div className="space-y-2">
          <Button className="w-full !justify-start" onClick={backup}><Icon name="download" /> Vollständiges Backup (JSON)</Button>
          <Button className="w-full !justify-start" onClick={csv}><Icon name="download" /> Alle Daten als CSV (Excel)</Button>
        </div>
      </Abschnitt>

      <Abschnitt titel="Wiederherstellen">
        <input ref={datei} type="file" accept="application/json,.json" className="hidden" onChange={e => gewaehlt(e.target.files?.[0])} />
        <Button className="w-full !justify-start" onClick={() => datei.current?.click()}><Icon name="upload" /> Backup-Datei (JSON) einlesen</Button>
      </Abschnitt>

      <Abschnitt titel="Beispieldaten">
        <Karte className="space-y-3 text-sm">
          <p className="text-text2">12 Wochen Kraft- und Handball-Einheiten zum Ausprobieren der Diagramme. Sie sind markiert und lassen sich jederzeit wieder entfernen, ohne deine eigenen Einträge zu berühren.</p>
          {beispiel ? (
            <Button variante="gefahr" className="w-full" onClick={async () => {
              if (!(await frage({ titel: "Beispieldaten löschen?", ja: "Löschen", gefahr: true }))) return;
              await loescheBeispieldaten();
              melde("Beispieldaten gelöscht");
            }}>Beispieldaten löschen</Button>
          ) : (
            <Button className="w-full" onClick={async () => { await legeBeispieldatenAn(); melde("Beispieldaten angelegt"); }}>Beispieldaten anlegen</Button>
          )}
        </Karte>
      </Abschnitt>

      <Blatt offen={!!import_} titel="Backup wiederherstellen" onClose={() => setImport(null)}>
        {import_ && (
          <div className="space-y-4">
            <Karte className="text-sm space-y-1">
              {import_.erstellt && <p className="text-text2">Erstellt am {formatTag(import_.erstellt.slice(0, 10))}, {import_.erstellt.slice(11, 16)} Uhr (UTC)</p>}
              <p><b>Inhalt:</b> {anzahlText(import_)}</p>
            </Karte>
            <p className="text-sm text-gefahr font-semibold">Alle aktuellen Daten auf diesem Gerät werden durch das Backup ersetzt.</p>
            <Button variante="primaer" className="w-full" onClick={wiederherstellen}>Ersetzen und wiederherstellen</Button>
            <Button className="w-full" onClick={() => setImport(null)}>Abbrechen</Button>
          </div>
        )}
      </Blatt>
    </div>
  );
}
