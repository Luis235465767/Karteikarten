// Lokales Speichern im Browser (localStorage). Jeder Schreibvorgang wird zurückgelesen und geprüft;
// ein Fehler wird immer gemeldet und nie als „gespeichert“ angezeigt.
import { leererStand, pruefeStand } from "./fortschritt.js";

export const SCHLUESSEL = "physio-v2-stand";
export const DEFEKT_PREFIX = "physio-v2-defekt-";

/**
 * @param {object} opt
 * @param {Storage} opt.storage  z. B. window.localStorage (in Tests ein Ersatz)
 * @param {() => number} opt.jetzt
 * @param {(status: {ok: boolean, zeit?: number, fehler?: string}) => void} opt.beiStatus
 */
export function erzeugeSpeicher({ storage, jetzt = Date.now, beiStatus = () => {} }) {
  let letzterStatus = null;
  let gesperrt = false; // true, wenn beschädigte Daten nicht gesichert werden konnten: dann nie überschreiben
  const melde = s => { letzterStatus = s; beiStatus(s); };

  /** Lädt den Stand. Beschädigte Daten werden unter einem eigenen Schlüssel aufbewahrt, nie überschrieben. */
  function laden() {
    let roh;
    try { roh = storage.getItem(SCHLUESSEL); }
    catch (e) { melde({ ok: false, fehler: "Der Browser erlaubt keinen Zugriff auf den Speicher (privater Modus oder Speichern blockiert)." }); return { stand: leererStand(), warnung: null }; }
    if (roh == null) return { stand: leererStand(), warnung: null };
    let daten = null, fehler;
    try { daten = JSON.parse(roh); } catch { fehler = ["kein gültiges JSON"]; }
    let stand = null;
    if (daten) ({ stand, fehler } = pruefeStand(daten));
    if (stand && !fehler.length) return { stand, warnung: null };
    const sicherung = DEFEKT_PREFIX + jetzt();
    let gesichert = false;
    try { storage.setItem(sicherung, roh); gesichert = storage.getItem(sicherung) === roh; } catch { /* unten gemeldet */ }
    gesperrt = !gesichert;
    const warnung = `Gespeicherter Fortschritt war beschädigt (${fehler.slice(0, 3).join("; ")}). ` +
      (gesichert ? `Die Originaldaten liegen unter „${sicherung}“ im Browser-Speicher.` : "Die Originaldaten konnten nicht gesichert werden, deshalb wird vorerst nichts gespeichert.");
    // Gültige Teile weiterverwenden, damit nichts Lesbares verloren geht
    return { stand: stand ?? leererStand(), warnung, gesichert };
  }

  /** Speichert sofort und prüft durch Zurücklesen. Gibt true/false zurück und meldet den Status. */
  function speichern(stand) {
    const zeit = jetzt();
    if (gesperrt) {
      melde({ ok: false, fehler: "Speichern ist gesperrt, damit beschädigte, nicht gesicherte Daten nicht überschrieben werden. Bitte exportieren." });
      return false;
    }
    const text = JSON.stringify({ ...stand, updated: stand.updated || zeit });
    try {
      storage.setItem(SCHLUESSEL, text);
      if (storage.getItem(SCHLUESSEL) !== text) throw new Error("Kontrolle nach dem Speichern fehlgeschlagen");
    } catch (e) {
      const voll = e && (e.name === "QuotaExceededError" || e.code === 22);
      melde({ ok: false, fehler: voll ? "Der Browser-Speicher ist voll." : `Speichern fehlgeschlagen (${e && e.message ? e.message : e}).` });
      return false;
    }
    melde({ ok: true, zeit });
    return true;
  }

  return { laden, speichern, status: () => letzterStatus };
}
