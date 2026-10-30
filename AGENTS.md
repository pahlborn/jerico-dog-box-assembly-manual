# Arbeitsregeln fuer dieses Repository

Gilt fuer alle, die hier Code aendern - Menschen wie Agenten. Die Regeln
stehen hier, weil sie schon verletzt worden sind, nicht vorsorglich. Jede
nennt den Vorfall, aus dem sie stammt.

Das Schwesterprojekt `gt40-engine` hat eine eigene, aehnliche Fassung. Wo
beide dasselbe meinen, ist der Wortlaut absichtlich derselbe.

## 1. Jede Aenderung an einer ausgelieferten Datei zaehlt die Version hoch

Ausgeliefert ist alles im Wurzelverzeichnis mit der Endung `.html`, `.js`
oder `.css`. Wer eine davon aendert, aendert drei Dinge zusammen:

| Datei | was |
|---|---|
| `version.js` | `APP_VERSION` hochzaehlen, `APP_BUILT` auf jetzt setzen |
| `sw.js` | `CACHE_NAME` auf `jerico-v<N>` mitziehen |
| `changelog.js` | Eintrag ganz oben, mit `date` und `time` |

Ausgenommen sind nur diese drei Dateien selbst - sie sind die Buchfuehrung
des Release, nicht sein Inhalt.

**Warum:** v13 ging zweimal raus, am 23.09. um 06:45 und um 06:57, beide
mit `CACHE_NAME = jerico-v13`. Ein Geraet, das den ersten Stand geladen
hatte, bekam den zweiten nicht - der Service Worker sah denselben
Cache-Namen, und die Nachschlagekarte kam dort erst mit v14 an. Der Job
`Versionsdisziplin` prueft das seit v17.

## 2. Keine Luecke und keine Nummer zweimal

Jede Nummer zwischen der aeltesten und der aktuellsten braucht genau einen
Eintrag in `changelog.js`.

**Warum:** derselbe Vorfall. Im Journal standen zwei Eintraege mit
`version: 'v13'`, und die vorhandene Pruefung sah nur, ob die oberste
Nummer zu `APP_VERSION` passt - das war die ganze Zeit erfuellt.

## 3. Rote CI wird nicht ueberschrieben

Ein roter Lauf auf `main` ist ein Befund, kein Rauschen.

## 4. Kein Wert an zwei Orten

Steht derselbe Wert zweimal im Markup, laufen die Kopien auseinander. Das
ist der haeufigste Fehler in diesem Projekt, und er ist bisher neunmal
aufgetreten - zweimal davon nicht als Wert, sondern als Handgriff, der
nur in einer Datei stand:

| Was | Shipped in |
|---|---|
| Quellenregister mit widerlegter Pauschalaussage | v11 |
| Zwei Kuehlsystem-Kapitel, beide `id="sec-cooling"` | v12 |
| Kapitel 8 als kuerzere Zweitfassung der Build-Schritte | v15 |
| Feste Uebersetzungstabelle, die ihren eigenen Main Drive widerlegt | v16 |
| Leistungsseite mit zweiter Kopie derselben Ratios | v17 |
| Glossar viermal im Markup, dritte Kopie mit altem Wert | v22 |
| Zwei Eingabefelder fuer denselben Messwert | v23 |
| Aenderungstyp `verbessert` in changelog.js und gallery.css gepflegt, in beiden fehlend | v24 |
| Browserstart und Testkontext nur in `ui.test.mjs` - die zweite Testdatei lief nirgends | v25 |

**Die Regel:** ein Wert, eine Quelle, Renderer drumherum. Soll er an einer
zweiten Stelle erscheinen, wird er dort **gerechnet oder gebunden**, nicht
abgeschrieben:

- Uebersetzungen: `ratios.js`
- Betriebsmittel und Anzugswerte: `reference.js`, mit `belege` je Zeile
- Glossar: `glossar.js`
- Spezifikationswerte aus dem Build Log: `befund.js`
- Browserstart und Testkontext: `tests/helpers.mjs`
- Spezifikationswerte aus Messungen: `befund.js` mit `data-befund`
- Token pruefen und mit dem Gist verbinden: `github-zugang.js`, wortgleich
  mit gt40 und alignment. Die Pruefsumme steht in
  `tests/github-zugang.test.mjs`; wer den Baustein aendert, zieht alle drei
  Repos nach (v45, Peters Vorgabe vom 2026-10-30: Token-Anforderungen stehen
  fest, bevor eine App auf einen Fehler stoesst)

Und jede dieser Stellen hat einen Test, der rot wird, wenn sie divergiert.

## 5. Kein Sollwert ohne Quelle

Messwerte, Drehmomente und Zaehnezahlen stehen nur mit Beleg da. Ist keiner
da, wird der Wert als offen gekennzeichnet, nicht geraten. Die
Quellenklassen A bis F sind in `specs.html` erklaert.

**Warum:** die Oelvorgabe berief sich auf A-02, dessen gespiegelte Kopie
maschinell nicht lesbar ist. Belegt ist sie aus A-01 - die Zuschreibung war
also nicht nachpruefbar und steht seit v19 als Klasse F.

## 6. Tests werden gegengeprueft

Ein neuer Test zaehlt erst, wenn er nachweislich rot wird, sobald man den
Fehler wieder einbaut. Ohne diese Probe laesst sich nicht unterscheiden, ob
er greift oder nur nichts findet.

**Warum:** viermal hat die Gegenprobe einen eigenen Test als wertlos
entlarvt.

- v19: die Pruefung, dass die Einheit nicht an die Vorgabe geraet, suchte
  `/cm\)? mm/` und traf die Stelle nicht, weil davor ein `)` stand.
- v21: der Test auf den Einstieg nahm 900 Pixel als Grenze - der schlechte
  Zustand lag bei 877. Nachgemessen statt geschaetzt: jetzt 600.
- v23: der Abgleich der Zaehnezahlen wurde mit `new Event('input')`
  geprueft. Das steigt nicht auf, der Lauscher am Dokument sah es nie.
  Echte Tastatureingaben steigen auf - also `{ bubbles: true }`.
- v24: die Pruefung der Aenderungstypen lief zuerst gegen eine Liste
  erlaubter Typen. Die haette den Fehler durchgelassen, um den es ging - ein
  unbekannter Typ kommt in so einer Liste einfach nicht vor. Jetzt gegen die
  tatsaechlich benutzten.
- v27: der Toast trug die Klasse 'show', aber die CSS-Regel dazu fehlte - er
  stand 76 px unter dem Fensterrand. Ein Test auf classList.contains('show')
  waere die ganze Zeit gruen gewesen. Geprueft wird jetzt die Lage im Fenster.
  **Die Regel daraus:** sichtbar heisst gemessen, nicht "Klasse gesetzt".

**Und ein Umkehrfall aus v25:** eine Pruefung schlug fehl, obwohl der Code
richtig war. Der Service Worker war im Testkontext aktiv und fing die
Requests ab, an den Stubs vorbei - der Test sah einen Fehler, den er selbst
erzeugt hatte. Zu erkennen war das daran, dass dieselbe Pruefung mit einer
Wartezeit davor fehlschlug und ohne sie nicht. Testkontexte sperren den
Service Worker jetzt in `tests/helpers.mjs`. Ein roter Test ist also nicht
automatisch ein Befund am Code - erst wenn der Weg dorthin geklaert ist.

## 7. Jeder deutsche Textblock braucht eine englische Entsprechung

Die Seiten sind zweisprachig. Fehlt die Uebersetzung, bleibt beim Umschalten
nichts stehen - und auffallen kann es niemandem, weil die deutsche Ansicht
vollstaendig aussieht.

**Warum:** v18 hat einen `<span class="de">` ohne Gegenstueck eingebaut, in
v21 von Hand gefunden. Seitdem paart ein Test die Spans in
Dokumentreihenfolge; ein blosser Zahlenvergleich wuerde zwei Fehler
gegeneinander aufheben.

## 8. Eingetragene Werte muessen wirken

Ein Eingabefeld, dessen Wert nirgends erscheint, ist eine Falle. Wer misst
und eintraegt, erwartet, dass die Anzeige folgt.

**Warum:** `perf_umfang` und `perf_achse` existierten seit v9 und hatten
keine Wirkung - die Diagramme rechneten mit festen Werten. Und die
Spezifikationen zeigten "26 Spline - Validierung ausstehend" als festen
Text, waehrend im Build Log das Feld dafuer danebenlag.

## 9. Kein Rueckblick im Seitentext

Was in einer frueheren Version falsch war, gehoert in `changelog.js` und in
die Kommentare im Code - nicht in die Anleitung. Die Seite beschreibt den
heutigen Zustand.

## 10. Parallel arbeiten: PR statt Direktpush

Arbeiten mehrere gleichzeitig, geht jede Aenderung ueber einen Pull Request.
Was kollidiert, ist die gemeinsame Buchfuehrung aus Regel 1, und die sieht
man nur im PR rechtzeitig.

## Tests

`node tests/ui.test.mjs`, oder alle zusammen so, wie der Workflow sie
aufruft. Jede Datei `tests/*.test.mjs` muss in `.github/workflows/tests.yml`
verdrahtet sein; `tests/workflow.test.mjs` prueft genau das.

Lokal mit vorinstalliertem Browser:
`CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/ui.test.mjs`
