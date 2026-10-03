# Physiologie – Karteikarten & Quiz

Lernapp mit Karteikarten (Leitner-Wiederholungssystem), Multiple-Choice-Quiz und offenen Fragen zu Atmung, Kreislauf, Herz, Harnsystem, Lymphsystem, Blut und Magen.

**App:** https://luis235465767.github.io/Karteikarten/

Die App läuft komplett im Browser, funktioniert offline und lässt sich auf dem Handy über „Zum Home-Bildschirm“ wie eine App installieren. Auf dem iPhone ist das wichtig: Safari löscht die Daten normaler Webseiten nach 7 Tagen ohne Besuch, eine installierte App ist davon ausgenommen.

## Fortschritt

- **Speichern:** Jede Antwort wird sofort im Browser gespeichert und zur Kontrolle zurückgelesen. Oben steht immer der Status („Gespeichert um …“). Schlägt das Speichern fehl, erscheint ein roter Hinweis mit Export-Knopf.
- **Export/Import:** Unter „Fortschritt“ kannst du deinen Lernstand als Datei sichern und wieder einlesen. Der Import zeigt vorher eine Vorschau und fragt, ob ersetzt oder zusammengeführt werden soll. Dateien aus der alten claude.ai-Version werden erkannt und automatisch übertragen.
- **Zurücksetzen und Ersetzen** laden vorher automatisch eine Sicherung herunter.

### Synchronisieren zwischen Geräten

Der Fortschritt kann über ein privates Gist in deinem GitHub-Konto abgeglichen werden. Einmal pro Gerät:

1. [Fine-grained Token erstellen](https://github.com/settings/personal-access-tokens/new): Namen vergeben, Ablaufdatum wählen, unter **Permissions → Account permissions → Gists** „Read and write“ wählen. Sonst nichts.
2. In der App „Fortschritt“ öffnen, Token einfügen, „Verbinden“.

Beim ersten Gerät legt die App das private Gist an, weitere Geräte finden es automatisch. Jedes Gerät schreibt seine eigene Datei im Gist, abgeglichen wird pro Karte nach der jüngsten Änderung. Das Token liegt nur im Browser des jeweiligen Geräts. Weil alle GitHub-Pages-Seiten unter `luis235465767.github.io` sich den Browser-Speicher teilen, sollte das Token wirklich nur Gists dürfen. Läuft es ab, zeigt der Status das an. Dann ein neues Token erstellen und erneut verbinden.

## Neuen Lernzettel ergänzen (ohne Code)

1. In `inhalte/` eine neue Datei anlegen, z. B. `inhalte/darm.json`:

   ```json
   {
     "thema": "D",
     "karten": [
       { "id": "D-001", "frage": "…", "antwort": "…" }
     ],
     "mc": [
       { "id": "D-mc-001", "frage": "…", "richtig": "…", "falsch": ["…", "…", "…"], "erklaerung": "…" }
     ],
     "offen": [
       { "id": "D-of-001", "frage": "…", "loesung": "…" }
     ]
   }
   ```

2. In `inhalte/themen.json` eine Zeile ergänzen (Kürzel, Name, Datei, Farbe für hell und dunkel):

   ```json
   { "kuerzel": "D", "name": "Darm", "datei": "darm.json", "farbe": { "hell": "#2f6f8f", "dunkel": "#6fb7d9" } }
   ```

3. Speichern und auf `main` committen. GitHub prüft die Inhalte automatisch und veröffentlicht nur, wenn alles stimmt. Fehlermeldungen stehen unter „Actions“.

**Regeln für IDs:** Jede ID wird einmal vergeben und nie geändert oder wiederverwendet, denn der Lernstand hängt an ihr. Neue Einträge bekommen die nächste freie Nummer, egal an welcher Stelle der Datei sie stehen. Die Reihenfolge in der Datei ist die Lernreihenfolge für neue Karten. Einträge, die schon Lernstand haben, nicht löschen. Die Prüfung verhindert das für alle Karten aus der claude.ai-Zeit.

Neue Karten zu einem bestehenden Thema einfach in dessen Datei ergänzen, mit der nächsten freien Nummer.

## Für Entwicklung

Voraussetzung ist Node 20 oder neuer. Es gibt keine Abhängigkeiten.

```sh
npm test                       # alle Tests
npm run pruefen                # Inhaltsprüfung
python3 -m http.server         # lokal öffnen: http://localhost:8000
node scripts/baue-site.js      # veröffentlichte Seite nach _site/ bauen
```

| Pfad | Inhalt |
|---|---|
| `index.html`, `css/`, `js/app.js` | Oberfläche |
| `js/srs.js`, `js/stapel.js` | Wiederholungslogik und Stapel (reine Funktionen) |
| `js/fortschritt.js`, `js/speicher.js` | Fortschrittsformat, Zusammenführen, lokales Speichern |
| `js/sync-gist.js` | Synchronisierung über Gist |
| `js/migration.js` | Übertragung des alten claude.ai-Lernstands |
| `js/inhalte.js` | Lerninhalte laden und prüfen |
| `inhalte/` | Lernzettel |
| `legacy/` | Ursprüngliche claude.ai-Version und eingefrorene Zuordnung alter Indizes zu IDs |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline-Betrieb und Installation |
| `scripts/` | Inhaltsprüfung, Seitenbau, Migrations- und Extraktionswerkzeuge |

### Wiederholungssystem

„Gewusst“ hebt die Stufe um 1 (höchstens 5). Die nächste Wiederholung ist nach 0/1/3/7/14/30 Tagen fällig. „Nicht gewusst“ setzt auf Stufe 0, die Karte kommt in derselben Runde nach 4 anderen Karten wieder. „Fällige Karten“ zeigt zuerst überfällige Wiederholungen (die älteste zuerst), dann neue Karten in Lernzettel-Reihenfolge. Ab Stufe 4 gilt eine Karte als gefestigt.

## Lizenzen

Schriften: Atkinson Hyperlegible und Newsreader, beide SIL Open Font License 1.1 (siehe `fonts/`).
