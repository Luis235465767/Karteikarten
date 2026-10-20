# Trainingstagebuch

Web-App zum Aufzeichnen und Auswerten von Krafttraining und Handball. Läuft komplett im Browser, funktioniert offline und lässt sich auf dem Handy wie eine App installieren. Kein Konto, kein Server: Alle Daten liegen in IndexedDB auf dem jeweiligen Gerät.

**App:** https://luis235465767.github.io/Karteikarten/training/

## Auf dem Handy installieren

- **iPhone (Safari):** Link öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.
- **Android (Chrome):** Link öffnen → Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Danach startet die App vom Home-Bildschirm im Vollbild und läuft auch ohne Internet. Nach einem Update lädt sie beim nächsten Öffnen automatisch die neue Version.

> Wer die Karteikarten-App schon auf demselben Gerät benutzt hat: Falls unter `/training/` beim allerersten Aufruf die Karteikarten erscheinen, dort „Jetzt neu laden“ tippen und `/training/` erneut öffnen. Das passiert nur einmal, bis die neue Version der Karteikarten aktiv ist.

## Funktionen

- **Training:** leer oder aus einer Vorlage starten. „Satz hinzufügen“ übernimmt die Werte des letzten Satzes. Zu jeder Übung steht, was beim letzten Mal geschafft wurde. Neue Bestleistungen (schwerstes Gewicht oder bestes geschätztes 1RM) werden sofort hervorgehoben. Jede Eingabe wird direkt gespeichert. Ein laufendes Training lässt sich nach dem Schließen der App fortsetzen.
- **Handball:** Training oder Spiel mit Dauer und RPE (1–10). Belastung = Session-RPE = Dauer × RPE.
- **Verlauf:** alle Einheiten nach Monat, antippen zum Bearbeiten oder Löschen.
- **Statistik:** Gewichtsverlauf und geschätztes 1RM pro Übung, Wochenvolumen (gesamt oder pro Übung), Bestleistungen, Trainingskalender, wöchentliche Handball-Belastung. Zeitraum: 12 Wochen, 6 Monate, 1 Jahr oder alles.
- **Übungen, Vorlagen, Daten:** Übungen und Vorlagen verwalten. Export als CSV (für Excel), vollständiges Backup als JSON, Wiederherstellen aus dem Backup.
- **Beispieldaten:** Beim ersten Start werden 12 Wochen Beispieldaten angelegt. Entfernen über den Hinweis oben oder unter Übungen › Daten. Eigene Einträge bleiben dabei erhalten.

**Wichtig:** Die Daten liegen nur im Browser des Geräts. Regelmäßig unter Übungen › Daten ein Backup machen. Auf dem iPhone die App unbedingt auf dem Home-Bildschirm installieren, sonst kann Safari die Daten nach 7 Tagen ohne Besuch löschen.

### Rechenregeln

| Kennzahl | Formel |
|---|---|
| Volumen | Summe aus Wiederholungen × Gewicht (pro Satz) |
| Geschätztes 1RM (Epley) | Gewicht × (1 + Wdh./30), bester Satz einer Einheit |
| Gewichtsverlauf | schwerster Satz pro Einheit (bei gleichem Gewicht der mit mehr Wdh.) |
| Session-RPE | Dauer in Minuten × RPE |
| Woche | Montag bis Sonntag, Kalenderwoche nach ISO |

## Entwicklung

Voraussetzung: Node 20 oder neuer.

```sh
cd training
npm install        # einmalig
npm run dev        # Entwicklungsserver: http://localhost:5173
npm test           # Tests der Rechenlogik
npm run build      # fertige App nach dist/
npm run preview    # gebaute App lokal ansehen (mit Offline-Betrieb)
```

Zum Testen auf dem Handy im selben WLAN: `npm run dev -- --host`, dann die angezeigte Netzwerk-Adresse öffnen. Installieren und offline nutzen geht erst mit HTTPS, also über die veröffentlichte Version.

| Pfad | Inhalt |
|---|---|
| `src/model/types.ts` | Datenmodell |
| `src/db/` | Datenbank (Dexie): Schema, Speichern/Laden, Live-Abfragen |
| `src/logic/` | Rechenlogik als reine Funktionen: Kennzahlen, Datum, CSV/Backup |
| `src/seed/` | Beispieldaten |
| `src/components/` | Bausteine der Oberfläche |
| `src/pages/` | Seiten |
| `src/charts/` | Diagramme (Recharts) und Trainingskalender |
| `tests/` | Tests (Vitest) |

## Veröffentlichen

**GitHub Pages (eingerichtet):** Jeder Push auf `main` testet und baut beide Apps über `.github/workflows/pages.yml` und veröffentlicht sie: Karteikarten unter `/Karteikarten/`, die Trainings-App unter `/Karteikarten/training/`. Den Fortschritt siehst du im Repo unter „Actions“.

**Netlify (Alternative, ebenfalls kostenlos):** Bei netlify.com mit GitHub anmelden → „Add new site“ → „Import an existing project“ → dieses Repo wählen → **Base directory: `training`**. Build-Befehl und Ausgabeordner kommen aus `netlify.toml`. Die App liegt dann unter `https://<name>.netlify.app/`. Achtung: Das ist eine andere Adresse und damit ein anderer Speicher. Daten zwischen den Adressen per Backup übertragen.
