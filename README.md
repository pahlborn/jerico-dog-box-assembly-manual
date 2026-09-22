# Jerico RH02374 &ndash; Dog Box Assembly Manual

Arbeitsfassung der Zusammenbau-Anleitung f&uuml;r das Jerico 4-Speed Klauengetriebe
**RH02374** (Oval Road Race, Rev. 2, Top Loader Only, mit &Ouml;lpumpe) aus dem
Projekt Ford Mustang 1966 (6R).

Drei statische Seiten, gedacht f&uuml;r das Telefon an der Werkbank:

| Seite | Inhalt |
|---|---|
| `index.html` | Übersicht: Projektdaten, Getriebe-Steckbrief, Fortschritt der sechs Phasen, Arbeitsreihenfolge, Kernwerte, Werkzeugliste |
| `specs.html` | Spezifikationen: Identifikation, Übersetzungen, Abmessungen, Anzugsmomente, Schmierstoffe, Kleinteile, Kühlsystem, Öl und Einfahren, Quellen |
| `build-log.html` | Zusammenbau in sechs Phasen mit 56 Kapiteln, je mit Status, Befunden, Messwertfeldern und Fotodokumentation |

Aufbau, Bedienung und Technik entsprechen dem Schwesterprojekt
[pahlborn/gt40-engine](https://github.com/pahlborn/gt40-engine) (Motor-Build-Log).

## Inhaltliche Grundlage

Alles stammt aus der OEM-Prim&auml;rliteratur von Jerico (Quellenklasse A):

* **A-01** Assembly/Disassembly Manual &ndash; Variante *Winston Cup / Top Loader Only, Road Race*
* **A-02** Break-In &amp; Operating Instructions Sheet
* **A-03** Gear Ratio Chart (4-Speed)
* **A-04** Transmission Guide

Bei Widerspr&uuml;chen zwischen der deutschen &Uuml;bersetzung und dem englischen
Original gilt das **englische Original** — die Schritte hier folgen durchweg dem
Original. Inhaltlich strittige Aussagen wurden am 21./22.09.2026 gegen die
Original-PDFs geprüft; die Befunde stehen im Changelog (v3).

## Bedienung

* **Kapitelstatus** hat drei Stufen: offen &rarr; in Arbeit &rarr; erledigt. "In Arbeit" z&auml;hlt im Fortschrittsbalken halb.
* **Befunde** sind beliebig viele Eintr&auml;ge je Kapitel mit eigenem Status. Die offenen stehen gesammelt in der Kopfzeile des Build Logs.
* **Messwerte** werden beim Tippen lokal gespeichert. Ein geleertes Feld bleibt geleert.
* **Sprache** DE/EN &uuml;ber die Flagge in der Kopfzeile.
* **Glossar** &uuml;ber den Knopf unten rechts; der zweite Knopf ist der Einheiten-Umrechner (lb./ft, lb./in, inch, quart).
* **Offline**: Ein Service Worker legt die Seiten ab, das Telefon braucht in der Werkstatt kein Netz.

## Cloud Sync einrichten (optional)

Ohne Einrichtung l&auml;uft alles lokal im Browser; die Kopfzeile zeigt dann *Lokal*.
F&uuml;r den Abgleich zwischen Ger&auml;ten:

1. Einen **eigenen, privaten Gist** anlegen (nicht den des Motor-Builds &ndash; sonst mischen sich die Daten).
2. Einen GitHub Fine-grained Token mit **Gists: Read and Write** erstellen; f&uuml;r den Foto-Upload zus&auml;tzlich **Contents: Read and Write** auf dieses Repository.
3. Im Zahnrad-Men&uuml; &rarr; *Einstellungen* Token und Gist-ID eintragen.

Dateien im Gist: `jerico-build-log-data.json` (Messwerte), `jerico-build-findings.json`
(Befunde), `jerico-build-photos.json` (Bildbeschriftungen). Die Bilder selbst
liegen im Repository unter `img/user/<gruppe>/`.

## Entwicklung

```bash
npm install
npx playwright install chromium
npm test           # tests/ui.test.mjs
```

In Umgebungen mit vorinstalliertem Browser:
`CHROMIUM_PATH=/pfad/zu/chrome npm test`

Bei jeder &Auml;nderung an ausgelieferten Dateien die Version in `version.js`
hochz&auml;hlen, die Cache-Version in `sw.js` mitziehen (`jerico-v<N>`) und einen
Eintrag in `changelog.js` erg&auml;nzen &ndash; der Test pr&uuml;ft, dass die drei zusammenpassen.

### Dateien

```
index.html  specs.html  build-log.html   die drei Seiten
styles.css                               gemeinsames Stylesheet
app.js                                   gemeinsames Verhalten (Speichern, Status, Befunde, Sprache)
field-sync.js                            Messwerte zusammenfuehren (Zeitstempel je Feld)
findings.js                              Befunde je Kapitel
gallery.js / gallery.css                 Fotogalerie (Repository = Wahrheit, Gist = Beschriftung)
search.js                                Suche ueber alle Seiten
changelog.js / version.js                Release-Dokumentation und Version
manifest.json / sw.js / icon*            PWA und Offline-Betrieb
tests/                                   Browser-Tests
```

## Ver&ouml;ffentlichung

GitHub Pages aus dem Branch `main`, Verzeichnis `/` &ndash;
dann erreichbar unter `https://pahlborn.github.io/jerico-dog-box-assembly-manual/`.
