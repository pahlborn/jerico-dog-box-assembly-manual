/**
 * changelog.js - Release-Dokumentation.
 *
 * Erreichbar ueber die Versionsnummer im Werkzeugmenue und im Header.
 * Wird von index.html, specs.html, build-log.html und performance.html geladen.
 *
 * Neuer Eintrag: oben einfuegen und version.js plus die Cache-Version in
 * sw.js hochzaehlen. tests/ui.test.mjs prueft, dass alle drei zusammenpassen.
 */
(function (global) {
  'use strict';

  // Neueste Version zuerst.
  var RELEASES = [
    {
      version: 'v44',
      date: '2026-10-26',
      time: '17:48',
      title: 'Neue Versionen kommen von selbst',
      changes: [
        { type: 'verbessert', text: 'Eine offene Seite laedt eine neue Version jetzt von selbst - bisher erst, wenn man sie von Hand neu lud. Sie fragt jede Minute und beim Zurueckkehren, etwa am iPad aus einer anderen App, und laedt erst neu, wenn kein Feld in Arbeit ist; beim allerersten Besuch gar nicht.' },
        { type: 'intern', text: 'aktualisieren.js, wortgleich mit gt40-engine v114 und alignment; nur dort wird der Service Worker angemeldet, app.js tut es nicht mehr. Fuenf Tests; Gegenprobe mit dem alten Stand rot.' }
      ]
    },
    {
      version: 'v43',
      date: '2026-10-26',
      time: '15:57',
      title: 'Ein Schreiber fuer alle Dateien',
      changes: [
        { type: 'fix', text: 'Messwerte, Befunde, Foto-Beschriftungen und Fehlerprotokoll schrieben jeder fuer sich in den Gist. Zwei Schreibvorgaenge zur selben Zeit lehnt GitHub ab (409), auch fuer verschiedene Dateien. Jetzt gehen alle Dateien eines Geraets in einem Lauf hoch: einmal lesen, je Datei mischen, einmal schreiben - mit Buendeln, Nachholen und Wiederholen fuer alle (wie gt40-engine v112).' },
        { type: 'fix', text: 'Das Fehlerprotokoll loest keinen eigenen Schreibvorgang mehr aus. Es geht mit dem naechsten Lauf mit, spaetestens nach 5 Minuten, und vereinigt weiterhin die Eintraege aller Geraete.' },
        { type: 'intern', text: 'field-sync.js: cloudAbgleichen und Hochlade-Block wortgleich mit gt40-engine v112 (weitere Dateien, Marke je Datei, auftragSetzen). findings.js, gallery.js und errorlog.js (gistKanal) laufen darueber; der eigene Spiegel in app.js entfaellt. Fuenf Tests; Gegenprobe mit dem alten Stand und je Mechanismus rot.' }
      ]
    },
    {
      version: 'v42',
      date: '2026-10-25',
      time: '22:04',
      title: 'Ein Import kommt in die Cloud',
      changes: [
        { type: 'fix', text: 'Ein Import blieb auf diesem Geraet, bis zufaellig ein Abgleich lief. Jetzt geht er wie jede Eingabe gebuendelt in die Cloud und ist bis dahin als "Nicht hochgeladen" vermerkt. Gemischt wird wie bisher je Feld nach dem neueren Eintrag - eine aeltere Sicherung ueberschreibt nichts Neueres (gt40-engine hat das in v110 nachgezogen).' },
        { type: 'intern', text: 'importJSON merkt das Hochladen vor. Ein Test; Gegenprobe ohne die Zeile: der Wert aus der Datei fehlt in der Cloud.' }
      ]
    },
    {
      version: 'v41',
      date: '2026-10-25',
      time: '21:35',
      title: 'Leeren geht wieder, Eingaben waehrend des Abgleichs bleiben',
      changes: [
        { type: 'fix', text: 'Ein Feld bewusst zu leeren geht wieder: Es bleibt leer und wandert auf die anderen Geraete. Seit v35 holte der Abgleich den alten Wert zurueck. Jetzt zaehlt ein Leeren nur bei einem Feld, das man selbst beruehrt hat - durch Tippen, Auswaehlen oder Antippen (wie gt40-engine v109).' },
        { type: 'fix', text: 'Brachte ein Abgleich etwas Neues, waehrend man gerade tippte, sprang das Feld auf den alten Wert zurueck. Jetzt ueberschreibt der Abgleich nichts, was gerade eingegeben wird.' },
        { type: 'intern', text: 'field-sync.js wie gt40-engine v109: beruehrte Felder, _geleert als Vermerk fuer bewusstes Leeren, LEER_LOESCHT wieder an. app.js: Speichern gibt die beruehrten Felder mit, applyData laesst sie aus. Drei Tests neu, zwei umgestellt; Gegenprobe je Mechanismus rot.' }
      ]
    },
    {
      version: 'v40',
      date: '2026-10-25',
      time: '20:31',
      title: 'Ein veralteter Stand schlaegt keinen gestempelten Wert mehr',
      changes: [
        { type: 'fix', text: 'Felder ohne eigenen Zeitstempel wurden nach dem Speicherzeitpunkt des ganzen Datensatzes entschieden: ein Geraet mit veraltetem Stand, das irgendein anderes Feld speicherte, gewann sie. Jetzt gewinnt der gestempelte Wert (wie gt40-engine v108). Im jerico-Gist hat derzeit jedes Feld einen Stempel - die Aenderung schuetzt fuer die Zukunft.' },
        { type: 'intern', text: 'field-sync.js: mergeRecords ohne Rueckfall auf _savedAt, sobald eine Seite einen Stempel hat; der Gewinner ohne Stempel bekommt keinen erfundenen; fieldTime entfaellt. Ein Test; Gegenprobe mit dem alten Stand rot.' }
      ]
    },
    {
      version: 'v39',
      date: '2026-10-25',
      time: '20:08',
      title: 'Zwei Geraete gleichzeitig verlieren nichts mehr',
      changes: [
        { type: 'fix', text: 'Speicherten zwei Geraete fast gleichzeitig, konnte die Aenderung des einen in der Cloud fehlen - sie kam erst an, wenn dieses Geraet wieder etwas speicherte. Jetzt prueft jedes Geraet zwei Sekunden nach dem Hochladen nach und schreibt erneut, falls dabei etwas verloren ging. Wird gerade getippt, uebernimmt das das ohnehin anstehende Hochladen.' },
        { type: 'intern', text: 'field-sync.js wie gt40-engine v107: Nachpruefung nach jedem Schreibvorgang (hoechstens dreimal in Folge), cloudAbgleichen meldet geschrieben; dazu: keine eigene Nachpruefung, solange ein gebuendeltes Hochladen ansteht. Ein Test mit zwei Geraeten; Gegenproben: ohne Nachpruefung fehlt eine Aenderung, ohne die Ausnahme werden aus fuenf Eingaben drei Schreibvorgaenge.' }
      ]
    },
    {
      version: 'v38',
      date: '2026-10-25',
      time: '19:43',
      title: 'Ein alter Tab schreibt nicht mehr ueber Neueres',
      changes: [
        { type: 'fix', text: 'Ein vergessener Tab mit altem Code konnte seinen veralteten Stand ueber neuere Eintraege schreiben (in gt40-engine am 25.10. so geschehen). Jetzt traegt jeder Schreibvorgang die Version ein. Hat eine neuere Version geschrieben, schreibt ein aelterer Tab nicht mehr und laedt sich einmal neu, sobald niemand tippt. Was dort eingetragen war, bleibt erhalten und geht danach hoch.' },
        { type: 'intern', text: 'field-sync.js: _neuesteVersion in der Cloud-Datei, veraltetBehandeln mit Schutz gegen endloses Neuladen (einmal je Version und Sitzung). Hochlade-Block wieder wortgleich mit gt40-engine. Zwei Tests; Gegenprobe ohne Pruefung, ohne Eintrag und ohne Schleifenschutz: je einer rot.' }
      ]
    },
    {
      version: 'v37',
      date: '2026-10-25',
      time: '19:30',
      title: 'Was nicht hochgeladen wurde, wird nachgeholt',
      changes: [
        { type: 'fix', text: 'Scheiterte das Hochladen (GitHub: "Gist cannot be updated" oder "zu viele Anfragen"), wurde es erst bei der naechsten Eingabe wieder versucht - die Anzeige sagte trotzdem "Cloud Sync". Jetzt merkt sich das Geraet "nicht hochgeladen" und wiederholt selbst (nach 5 s, 15 s, 1 min, 2 min, dann alle 5 min), bei "zu viele Anfragen" fruehestens nach einer Minute.' },
        { type: 'fix', text: 'Speichern und der Abgleich beim Oeffnen oder Zurueckholen liefen unabhaengig voneinander und konnten gleichzeitig schreiben - GitHub lehnte dann einen davon ab. Jetzt laeuft immer nur ein Vorgang; was waehrenddessen dazukommt, geht im naechsten mit.' },
        { type: 'neu', text: 'Solange etwas nicht in der Cloud ist, steht oben orange "Nicht hochgeladen". Eine Fehlermeldung erscheint einmal pro Fehlerserie; jeder Fehlversuch steht im Protokoll.' },
        { type: 'intern', text: 'Buendeln (jetzt 3 statt 4 Sekunden), Warteschlange und Wiederholung stehen in field-sync.js, wortgleich mit gt40-engine v105, dazu abgleichen fuer den Abgleich ohne Vormerken. Fuenf Tests; Gegenprobe ohne Anbindung: alle fuenf rot, je Mechanismus abgeschaltet: der zugehoerige rot.' }
      ]
    },
    {
      version: 'v36',
      date: '2026-10-25',
      time: '17:20',
      title: 'Ein erledigter Schritt laesst sich wieder zuruecksetzen',
      changes: [
        { type: 'fix', text: 'Ein Statusknopf auf "erledigt" liess sich nicht mehr auf "offen" stellen: "offen" war ein leerer Wert, und seit v35 schlaegt ein leerer Wert beim Abgleich keinen eingetragenen - der Abgleich holte "erledigt" sofort zurueck. "Offen" ist jetzt ein eigener Wert und setzt sich wie jede andere Eingabe nach Aktualitaet durch.' },
        { type: 'fix', text: 'Das Anzeigen schreibt alte Statuswerte ("false") nicht mehr um. Bis v35 wurde daraus beim naechsten Speichern - egal welches Feld - ein Leeren, das niemand gemacht hatte.' },
        { type: 'intern', text: 'Drei Tests: erledigt -> offen -> in Arbeit -> erledigt mit Cloud, offen kommt in der Cloud an, ein alter Status bleibt unberuehrt. Gegenprobe: alle drei rot ohne die Aenderung. Dieselbe Loesung in gt40-engine v104.' }
      ]
    },
    {
      version: 'v35',
      date: '2026-10-25',
      time: '16:10',
      title: 'Ein leeres Feld loescht vorerst keinen Wert eines anderen Geraets',
      changes: [
        { type: 'fix', text: 'Ab dem 26.10. haette ein Statusknopf das "erledigt" eines anderen Geraets loeschen koennen, ohne dass ihn jemand beruehrt: Alte Werte ("false") werden beim Anzeigen umgeschrieben, und beim naechsten Speichern - egal welches Feld - wurde daraus ein frisch gestempeltes Leeren. Bis die Zeitstempel verlaesslich sind, gewinnt beim Abgleich wieder immer der eingetragene Wert. Der Preis ist derselbe wie bis heute: ein bewusst geleertes Feld bekommt beim naechsten Abgleich seinen Wert zurueck, wenn die Cloud noch einen hat.' },
        { type: 'intern', text: 'Schalter FieldSync.LEER_LOESCHT (aus). Zwei Tests halten fest, dass ein Status-Altwert keinen Wert schlaegt und dass ein Leer vorerst nicht gewinnt; beide werden rot, sobald der Schalter wieder an ist. Dieselbe Massnahme in gt40-engine v103.' }
      ]
    },
    {
      version: 'v34',
      date: '2026-10-25',
      time: '08:41',
      title: 'Jetzt abgleichen, und Fehlerprotokolle aller Geraete',
      changes: [
        { type: 'neu', text: 'Im Werkzeugmenue jeder Seite steht "Jetzt abgleichen", direkt unter "Speichern". Abgeglichen wird ohnehin beim Oeffnen und beim Zurueckholen der App; der Knopf ist fuer den Moment, in dem man es gleich wissen will - etwa nachdem auf dem anderen Geraet gerade etwas eingetragen wurde.' },
        { type: 'fix', text: 'Der Spiegel des Fehlerprotokolls in der Cloud ersetzte bei jedem Fehler die Eintraege der anderen Geraete. Dort stand immer nur das Protokoll des Geraets, das zuletzt einen Fehler hatte. Jetzt werden die Protokolle vereinigt, und ohne gelesenen Cloud-Stand wird nicht geschrieben - auf dem Geraet selbst bleibt jeder Eintrag ohnehin erhalten.' }
      ]
    },
    {
      version: 'v33',
      date: '2026-10-25',
      time: '06:21',
      title: 'Abgleich beim Oeffnen, und geleerte Felder bleiben leer',
      changes: [
        { type: 'fix', text: 'Hereingeholt wurde bisher nur nach einer eigenen Eingabe: syncFromCloud war an nichts angeschlossen. Ein Geraet zeigte den alten Stand, bis man dort etwas eintrug, und Befunde und Beschriftungen der Galerie vom anderen Geraet kamen nie von selbst an. Jetzt wird beim Oeffnen abgeglichen, beim Zurueckholen der App (hoechstens alle 30 Sekunden) und wenn nach einem Funkloch die Verbindung zurueck ist - Messwerte, Befunde und Galerie-Texte aus einem Abruf.' },
        { type: 'fix', text: 'War der Cloud-Stand nicht lesbar, wurde trotzdem geschrieben - in allen drei Bereichen der rein lokale Stand. Was nur das andere Geraet kannte, war danach aus der Cloud weg. Jetzt wird ohne gelesenen Stand nichts geschrieben, und der Fehler steht im Protokoll statt nur in der Konsole.' },
        { type: 'fix', text: 'Seit v32 liess sich ein bewusst geleertes Feld nicht leeren: beim naechsten Speichern holte das Mischen den alten Cloud-Wert zurueck. Jetzt gilt ein Stichtag, den 26.10.2026: Leer-Stempel davor zaehlen nicht, dort gewinnt weiter der Wert - genau die 196 alten Stempel im Cloud-Stand. Was danach bewusst geleert wird, bleibt leer und wandert auf die anderen Geraete. Bis zum Stichtag verhaelt es sich noch wie in v32.' },
        { type: 'verbessert', text: 'Beschriftungen der Galerie werden nicht mehr aufgeraeumt, wenn die Bildliste aus dem Repository nur gekuerzt ankam - sie galten sonst als verwaist.' },
        { type: 'intern', text: 'Lesen, mischen, schreiben steht jetzt in field-sync.js (cloudAbgleichen) - wortgleich mit gt40-engine, das in v101 dieselben Fehler hatte. Die Stichtag-Regel gilt in beiden Projekten gleich. Ein Test aus v32 haette ab dem Stichtag rot werden muessen, ohne dass sich am Code etwas aendert: er stempelte die Leere mit Date.now(). Er nimmt jetzt Zeiten vor dem Stichtag, wie im echten Fall. Vor der Aenderung wurde der Gist vollstaendig gesichert.' }
      ]
    },
    {
      version: 'v32',
      date: '2026-10-19',
      time: '23:10',
      title: 'Ein leerer Wert schlaegt nie einen vorhandenen',
      changes: [
        { type: 'fix', text: 'Beim Zusammenfuehren entschied der Zeitstempel ohne Ansehen des Inhalts. v30 hat das Stempeln leerer Felder abgestellt, aber die bis dahin gestempelten blieben liegen und wirkten weiter: im Cloud-Stand trugen 171 leere Felder einen neueren Zeitstempel als die Eintragungen des anderen Geraets. Beim Abgleich gewann die Leere, und 69 Felder Dokumentation wurden durch Leerstrings ersetzt - Seriennummer, kompletter Schrittstatus der Phasen 2 bis 6, alle Anzugswerte. Jetzt entscheidet der Inhalt: steht nur auf einer Seite ein Wert, gewinnt er, egal wie alt er ist.' },
        { type: 'verbessert', text: 'Der Preis dieser Regel, offen genannt: ein absichtliches Leeren wandert nicht mehr auf das andere Geraet. Wer einen Wert loescht, muss das dort wiederholen. Das ist die sichere Richtung - ein stehengebliebener Wert faellt auf und ist in zwei Sekunden erneut geloescht, eine ausradierte Dokumentation nicht. Bei zwei vorhandenen Werten gewinnt weiterhin der spaetere.' },
        { type: 'intern', text: 'Gegen die echten Datensaetze simuliert, nicht nur gegen Testdaten: aus 15 gefuellten Feldern im Cloud-Stand und 84 auf dem Geraet werden 84 - mit dem neueren Streckeneintrag des Laptops und dem neueren Nutzungseintrag des iPads. Dazu ein Test, der die umgekehrte Richtung festhaelt: zwei echte Werte entscheiden weiter nach Zeitstempel, sonst waere der Abgleich wertlos.' }
      ]
    },
    {
      version: 'v31',
      date: '2026-10-19',
      time: '20:40',
      title: 'Kuehlkreis nach dem Befund am Geraet, aus einer Quelle',
      changes: [
        { type: 'fix', text: 'Die Reihenfolge des Oelkreises war falsch und trug trotzdem Klasse A, also Herstellervorgabe. A-01 sagt dazu nichts: im maschinell ausgelesenen Text kommen "cooler", "filter" und "LF-100" null Mal vor, A-02 ist wegen Subset-Font nicht lesbar. Die Zuschreibung war erfunden. Es gilt jetzt der Befund am Geraet - Oelablass, Filter, Pumpe, Thermostat, Kuehler (IN unten, OUT oben), Jerico-Deckel - als Klasse E, bis Jerico sie bestaetigt. Ein zweites Thermostat schaltet den Ventilator; es liegt nicht im Oelweg und ist darum gestrichelt gezeichnet.' },
        { type: 'fix', text: 'Die Reihenfolge stand an vier Stellen: im Titel und in der Beschreibung der Zeichnung, in deren Beschriftungen, in der Zeile "Reihenfolge" der Spezifikationen und zweimal im Build Log. Jetzt steht sie in kuehlkreis.js, und die Zeichnung entsteht aus denselben Daten wie der Text - sie kann ihm nicht mehr widersprechen.' },
        { type: 'intern', text: 'Der bestehende Test hielt die Zeichnung bei Klasse D fest, der Ableitung aus A-01 und A-02. Das war die alte Wahrheit; der Kreis stammt jetzt aus dem Befund. Die Pruefung, dass sich die Zeichnung nicht als Jerico-Original ausgibt, bleibt - sie ist weiter eine eigene Darstellung.' }
      ]
    },
    {
      version: 'v30',
      date: '2026-10-19',
      time: '18:15',
      title: 'Zwei Geraete loeschen sich nichts mehr',
      changes: [
        { type: 'fix', text: 'Ein leeres Feld bekam einen Zeitstempel von jetzt, allein weil die Seite es anzeigt. Beim Abgleich gewinnt je Feld der spaetere Zeitstempel - dieses frisch gestempelte Leer schlug also jeden echten Wert, den ein anderes Geraet vorher eingetragen hatte. Ein Geraet musste eine Seite nur oeffnen, um die Eintraege des anderen zu loeschen. Im Bestand eines Geraets trugen 128 von 212 Feldern einen Zeitstempel, ohne je einen Wert gehabt zu haben, in Bloecken mit identischem Zeitstempel - also pro Seitenaufruf gesetzt. Ein leeres Feld, das nie etwas enthielt, ist jetzt kein Ereignis mehr.' },
        { type: 'fix', text: 'Die Felder wurden ohne Rueckfrage in den Gist geschrieben: der lokale Datensatz ersetzte die Datei komplett. Ein Geraet, das den Stand des anderen noch nicht kannte, nahm dessen Felder damit aus der Cloud, obwohl niemand sie geloescht hat. Jetzt wird erst gelesen, dann zusammengefuehrt, dann geschrieben - und was aus der Cloud dazukommt, erscheint auch in der Anzeige. Galerie-Metadaten und Befunde machen das seit immer so; nur der Kanal mit dem meisten Inhalt tat es nicht.' },
        { type: 'fix', text: 'Hochgeschoben wurde nur beim ausdruecklichen "Speichern". Wer das nie drueckt - und warum sollte man, wenn der Kopf "gespeichert" meldet - hatte alles ausschliesslich auf seinem Geraet. Eine Eingabe wird jetzt vier Sekunden nach der letzten Aenderung von selbst hochgeschoben, wie es Galerie und Befunde seit immer tun.' },
        { type: 'intern', text: 'Fuenf Pruefungen dazu, jede gegengeprueft. Die erste Fassung einer davon schrieb in genau das Feld, das sie prueft, und eine andere legte ihren Wert nur in den Speicher statt auch in das Feld - ein leeres Feld ueber einem gespeicherten Wert ist aber ein Leeren. Beide Fehlschlaege lagen am Testaufbau; der Befund dahinter war echt.' }
      ]
    },
    {
      version: 'v29',
      date: '2026-10-19',
      time: '16:30',
      title: 'Die Sicherung kann nicht mehr scheitern',
      changes: [
        { type: 'fix', text: 'Der Export gab die Datei ausschliesslich ueber einen programmatischen Klick auf einen Blob-Link heraus. In einer vom Home-Bildschirm gestarteten Web-App auf iOS ist das nicht verlaesslich - und ausgerechnet dort wird dokumentiert. Jetzt drei Wege in dieser Reihenfolge: das Teilen-Menue des Geraets (darueber fuehrt "In Dateien speichern"), der Download, und zuletzt der Datensatz als markierbarer Text. Der letzte kann nicht scheitern.' },
        { type: 'neu', text: 'Eigener Menuepunkt "Sicherung als Text". Damit niemand erst zweimal exportieren muss, um an den Weg zu kommen, der sicher funktioniert. Der Text laesst sich in Notizen oder eine Mail kopieren und ueber Import wieder einlesen - eine vollwertige Sicherung.' },
        { type: 'fix', text: 'Ein leerer Speicher wurde als gelungene Sicherung ausgegeben. Das ist der gefaehrlichste Fall: auf iOS hat eine vom Home-Bildschirm gestartete App einen eigenen, von Safari getrennten Speicher. Wer dort exportiert, wo er nicht eingetragen hat, bekam eine leere Datei und durfte sie fuer eine Sicherung halten. Jetzt bricht der Export ab und nennt den wahrscheinlichen Grund.' },
        { type: 'verbessert', text: 'Jede Sicherung nennt ihren Umfang - so viele Werte, so viele Befunde, so viele Foto-Beschriftungen. Eine Zahl, die man nachsehen kann, statt einer Zusage.' }
      ]
    },
    {
      version: 'v28',
      date: '2026-10-19',
      time: '15:05',
      title: 'Die Sicherung ist vollstaendig, der Abgleich sagt warum er nicht laeuft',
      changes: [
        { type: 'fix', text: 'Der Export enthielt die Beschriftungen der Fotos nicht. Sie stehen in den Galerie-Metadaten und gingen bisher ausschliesslich ueber den Gist - wer ohne eingerichteten Abgleich arbeitet, hatte sie damit in keiner Sicherung. Die Bilddateien liegen im Repository, ihre Beschriftungen, Aufnahmezeiten, Reihenfolge und das Hauptbild nur auf dem Geraet. Export und Import nehmen sie jetzt mit; der Import fuehrt sie je Eintrag nach Zeitstempel zusammen, statt vorhandene zu ersetzen.' },
        { type: 'fix', text: 'Beide Gist-Aufrufe beim Verbinden gaben bei jedem Fehlschlag stillschweigend nichts zurueck. Damit war "kein Datenspeicher gefunden" nicht von "kommt nicht an die Gists heran" zu unterscheiden, und die Meldung lautete am Ende nur "Gist konnte nicht erstellt werden" - ohne Statuscode, ohne GitHubs Antwort. Genau dieser Unterschied ist der entscheidende: ein Token, der Fotos ins Repository schreiben darf, aber nicht an Gists kommt, laesst die Fotos auf jedem Geraet erscheinen und die Inhalte liegen. Jetzt nennt die Meldung Status und Antwort, erklaert den Unterschied zu den Fotos, und beides steht im Fehlerprotokoll.' },
        { type: 'fix', text: 'Die Statuszeile im Einstellungsdialog behauptete "Token gesetzt, suche Datenspeicher..." - es suchte aber nichts. Das ist ein Ruhezustand, kein Vorgang. Sie sagt jetzt, was gilt: kein Datenspeicher, Inhalte bleiben auf diesem Geraet.' },
        { type: 'neu', text: 'Der Einstellungsdialog erklaert die beiden getrennten Wege: Fotos liegen im Repository und sind auch ohne Token auf jedem Geraet sichtbar, Inhalte liegen im Gist und brauchen die Verbindung. Sichtbare Fotos sind also kein Beleg dafuer, dass der Abgleich laeuft.' },
        { type: 'intern', text: 'Im Test waren weder GET /user noch die Gist-Liste gestubbt - der ganze Weg, auf dem sich die App verbindet, war nie geprueft. Die Liste fiel durch das Muster: "/gists/**" verlangt einen Schraegstrich nach gists, "/gists?per_page=..." hat keinen. Beide sind jetzt gestubbt, mit Schaltern fuer den Fehlschlag.' },
        { type: 'intern', text: 'Fuenf Pruefungen zur Datensicherheit, jede gegengeprueft: dass der Export die Foto-Beschriftungen enthaelt, dass ein Import sie zurueckspielt, dass "Verbindung trennen" keine Daten anfasst, dass ein Versionswechsel sie unberuehrt laesst - nachgestellt, indem alle Caches verworfen und neu geladen wird -, und dass kein Code im Projekt die Nutzdaten entfernt. Erlaubt sind genau drei Schluessel: Token und Gist-Id beim Trennen, das Fehlerprotokoll beim Leeren.' }
      ]
    },
    {
      version: 'v27',
      date: '2026-10-19',
      time: '12:40',
      title: 'Meldungen sind wieder sichtbar',
      changes: [
        { type: 'fix', text: 'Keine einzige Meldung dieser App war sichtbar. Die Regel .toast.show fehlte in styles.css - sie ist beim Zusammenlegen der Seitenstile verlorengegangen. Ohne sie bleibt der Toast dort stehen, wohin .toast ihn setzt: 76 px unter dem unteren Fensterrand. Betroffen war jede Meldung, auch "Token ungueltig!", "Gist konnte nicht erstellt werden" und jeder Sync-Fehler. Beim Einrichten des Cloud-Sync sah es damit aus, als passiere gar nichts.' },
        { type: 'verbessert', text: 'Eine geglueckte Verbindung sagt das jetzt auch, mit dem Kontonamen. Vorher wechselte nur das Abzeichen die Farbe - zusammen mit den unsichtbaren Meldungen gab es damit ueberhaupt keine Rueckmeldung.' },
        { type: 'intern', text: 'Der neue Test misst, ob die Meldung im Fenster steht, statt zu pruefen, ob die Klasse gesetzt ist - die war ja gesetzt. Ein Klassentest waere die ganze Zeit gruen gewesen. Dazu eine Pruefung, dass jede Klasse, die der Code auf "show" setzt, auch eine CSS-Regel dafuer hat; sechs weitere Overlays haben sie, nur der Toast nicht.' }
      ]
    },
    {
      version: 'v26',
      date: '2026-10-07',
      time: '14:20',
      title: 'PS mit dem PS-Teiler, Annahmen aus der Kurve',
      changes: [
        { type: 'fix', text: 'Die Leistungsangaben waren 1,4 % zu klein. Gerechnet wurde Drehmoment mal Drehzahl geteilt durch 7121 - das ist der Teiler fuer hp, beschriftet war aber PS. Die Kurve ist fuer PS gebaut: mit dem richtigen Teiler erreicht sie 350 PS und passt damit zu den 350 PS (257 kW), die die Seite nennt; mit 7121 kamen 345 heraus. Der Teiler steht jetzt als Herleitung im Code (735,49875 W je PS, mal 60 durch 2*pi), nicht als abgeschriebene Zahl.' },
        { type: 'fix', text: 'Nennleistung und maximales Drehmoment standen als feste Zahlen im Markup - dieselbe Angabe wie in der Motorkurve, nur an einem zweiten Ort. Sie waren bereits auseinandergelaufen: die Seite nannte ~5200/min fuer die Spitzenleistung, die Kurve erreicht sie bei 5250. Beide Zeilen werden jetzt aus der Kurve geschrieben.' },
        { type: 'intern', text: 'Der neue Test prueft die Leistung gegen die Definition (1 PS = 75 kgf*m/s), nicht gegen eine zweite Konstante im Test - sonst waere derselbe Zahlendreher an zwei Orten gelandet und der Test haette ihn bestaetigt.' }
      ]
    },
    {
      version: 'v25',
      date: '2026-10-05',
      time: '11:55',
      title: 'Fehlerprotokoll, das auch bei klemmendem Sync schreibt',
      changes: [
        { type: 'fix', text: 'Das Fehlerprotokoll schrieb den Eintrag ausschliesslich in den Gist - und las ihn vorher von dort. Beim Sync-Fehler, dem haeufigsten Fall, schlug beides fehl und es wurde nichts protokolliert. Ohne eingerichteten Cloud-Sync gar nichts. Jetzt liegt der Puffer auf dem Geraet, der Gist ist nur noch der Spiegel. Uebernommen aus dem Schwesterprojekt, wo dieselbe Funktion in v89 ersetzt wurde.' },
        { type: 'fix', text: 'Vom Sync-Fehler blieb nur der Satz aus der Einblendung uebrig; Statuscode und Antworttext der API wurden verworfen - genau die beiden Angaben, die man zur Analyse braucht. Beide werden jetzt mitgeschrieben, dazu Zeit, Seite, Version, Geraet und Online-Zustand.' },
        { type: 'neu', text: 'Unbehandelte Fehler und abgewiesene Promises laufen nicht mehr stumm in die Konsole, sondern in das Protokoll. Auf einem Telefon sieht die Konsole niemand.' },
        { type: 'neu', text: 'Das Protokoll ist im Werkzeugmenue jeder Seite erreichbar und laesst sich kopieren oder als Datei speichern. Es haelt die letzten 100 Eintraege.' },
        { type: 'intern', text: 'Der Browserstart und der Testkontext standen nur in ui.test.mjs. Die neue Testdatei startete ohne den Handgriff fuer einen vorinstallierten Browser und lief darum nirgends, wo keiner heruntergeladen ist. Beides steht jetzt einmal in tests/helpers.mjs.' },
        { type: 'fix', text: 'Der Testkontext laesst den Service Worker jetzt aus. War er aktiv, liefen die Requests der Seite durch ihn und an den Stubs vorbei - der Aufruf scheiterte als "Failed to fetch", und die Pruefung sah einen Fehler, den sie selbst erzeugt hatte. Dieselbe Pruefung schlug mit einer Wartezeit davor fehl und ohne sie nicht; das war der Hinweis.' },
        { type: 'fix', text: 'Der Gist-Stub in den Tests antwortete ohne CORS-Kopfzeile, der Tree-Stub mit. Ein PATCH mit Authorization-Header loest aber einen Preflight aus, und dessen Antwort braucht sie - sonst kam der Statuscode im Code nie an.' }
      ]
    },
    {
      version: 'v24',
      date: '2026-10-05',
      time: '03:10',
      title: 'Aenderungstyp "verbessert" wird wieder dargestellt',
      changes: [
        { type: 'fix', text: 'Vierzehn Eintraege in diesem Journal trugen den Typ "verbessert", den weder die Beschriftungstabelle noch das Stylesheet kannten. Sie erschienen mit dem rohen Schluessel und ohne Farbe. Beschriftung und Badge-Farbe sind nachgetragen.' },
        { type: 'intern', text: 'Der neue Test prueft nicht gegen eine Liste erlaubter Typen, sondern gegen die im Journal tatsaechlich benutzten - eine Liste haette denselben Fehler durchgelassen, weil ein unbekannter Typ darin einfach nicht vorkommt. Geprueft wird beides: Beschriftung in changelog.js und eigene Regel in gallery.css.' }
      ]
    },
    {
      version: 'v23',
      date: '2026-10-05',
      time: '01:30',
      title: 'Kein Wert mit zwei Eingabefeldern, Arbeitsregeln festgeschrieben',
      changes: [
        { type: 'fix', text: 'Vier Werte hatten je zwei Eingabefelder: Splines, Yoke-Zaehne und Gehaeusematerial standen in den Spezifikationen ein zweites Mal als Formularfeld, der Ausruecklager-Typ im Einbauschritt neben dem Bestimmungsschritt. Wer in das falsche tippte, sah keine Wirkung - genau der Befund, der zu v18 gefuehrt hatte, an vier weiteren Stellen. Die doppelten Felder sind weg; die Anzeige liest ueber data-alt weiter den alten Feldnamen mit, damit nichts verlorengeht, was schon eingetragen war.' },
        { type: 'fix', text: 'Die gezaehlten Zaehne und das gewaehlte Zahnradpaar waren zwei Eingaben fuer dieselbe Sache und sprachen nicht miteinander: wer 33/17 zaehlte und 34/16 anklickte, bekam keinen Hinweis. Die Auswahl steht jetzt im Zaehlschritt selbst, und ein Abgleich meldet beides - Abweichung zwischen Zaehlung und Auswahl, und eine Paarung, die im Chart gar nicht vorkommt.' },
        { type: 'neu', text: 'AGENTS.md: die Arbeitsregeln dieses Repositories, aus den Vorfaellen hergeleitet, die sie ausgeloest haben. Zehn Regeln, darunter "kein Wert an zwei Orten" mit der Liste der sieben Faelle, in denen genau das schiefgegangen ist, und "Tests werden gegengeprueft" mit den drei Gegenproben, die einen eigenen Test als wertlos entlarvt haben.' },
        { type: 'neu', text: 'tests/workflow.test.mjs aus dem Schwesterprojekt uebernommen. Es prueft das Workflow-YAML selbst - dort hatte ein ungequoteter Doppelpunkt in einem Schrittnamen die Datei zerlegt, und der Lauf scheiterte vor jedem Job. Das erzeugt keine Check-Runs und sieht aus wie "noch nicht gestartet".' },
        { type: 'neu', text: 'tests/smoke-live.mjs prueft die tatsaechlich ausgelieferte Seite auf GitHub Pages: dass sie fehlerfrei laedt, dass die Galerie sich ohne Token aus dem Repository aufbaut, und dass die ausgelieferte Cache-Version zur erwarteten passt. Eigener CI-Job, nur auf main, blockiert nichts - ein Aussetzer bei Pages sagt nichts ueber den Code.' },
        { type: 'intern', text: 'Die erste Fassung der Pruefung des Zaehlabgleichs feuerte ein Ereignis mit new Event("input"). Das steigt nicht auf, der Lauscher am Dokument sah es nie - der Test haette gruen gemeldet, ohne etwas zu pruefen. Echte Tastatureingaben steigen auf, also { bubbles: true }.' }
      ]
    },
    {
      version: 'v22',
      date: '2026-10-04',
      time: '23:50',
      title: 'Glossar einmal statt viermal, Quellen zum Mitnehmen',
      changes: [
        { type: 'fix', text: 'Das Glossar lag als Markup in allen vier Seiten - 24 KB je Kopie, 96 KB fuer denselben Inhalt. Und die Kopien waren bereits auseinandergelaufen: der Eintrag "Main Drive" trug noch die in v16 widerlegte Uebersetzung 22/27, weil v16 nur Kapitel 2 und v17 nur Startseite und Leistungsseite korrigiert hat. Die vierte Kopie blieb stehen, bis es in v18 auffiel. Jetzt steht es in glossar.js, mit Test gegen beides: dass keine Seite es wieder im Markup fuehrt, und dass es tatsaechlich ankommt - eine leere Huelle waere schlimmer als vier Kopien.' },
        { type: 'verbessert', text: 'Der Glossareintrag zum Main Drive nennt nur noch den abgezaehlten Stand. Der Satz, der die alte Angabe erklaerte, war ein Rueckblick im Seitentext - das gehoert in dieses Journal.' },
        { type: 'neu', text: 'Jede Quelle hat jetzt einen Speichern-Knopf neben dem Oeffnen. Hintergrund: eine installierte PWA hat bei Links im eigenen Scope keinen Zurueck-Knopf, nur die Wischgeste vom Bildschirmrand - wer eine Quelle oeffnet, verliert die Seite samt eingetragener Messwerte aus dem Blick. Eine PDF im Rahmen anzuzeigen hilft nicht, Safari auf iOS zeigt dort nur die erste Seite. Gespeichert landet sie in Dateien und laesst sich per Split View neben die App legen; die App bleibt dabei stehen.' },
        { type: 'fix', text: 'Der Originallink zum Gear Ratio Chart zeigte auf die www-Adresse und lief ueber eine Umleitung. Jetzt direkt.' },
        { type: 'intern', text: 'Die Ausnahme fuer das Glossar im Test gegen Wertetabellen in den Spezifikationen ist entfallen - sie war nur noetig, solange der Glossartext in der Datei stand.' }
      ]
    },
    {
      version: 'v21',
      date: '2026-10-04',
      time: '22:15',
      title: 'Kopfzeile und Einstieg wie im Schwesterprojekt',
      changes: [
        { type: 'fix', text: 'Auf dem Telefon bestand die Kopfzeile nur noch aus vier Symbolen. Unter 520px wich der Seitentitel komplett - und mit ihm Version und Freigabezeitpunkt. Welcher Stand geladen ist, stand damit genau dort nicht, wo man es braucht: an der Werkbank. Jetzt weichen stattdessen die Navigationsbeschriftungen; ein Symbol bleibt erkennbar, eine namenlose Seite nicht. gt40 haelt es ebenso.' },
        { type: 'neu', text: 'Der Freigabezeitpunkt steht jetzt im Kopf neben der Version, getrennt gewichtet: die Nummer sagt, welcher Stand das ist, der Zeitstempel, ob ein Geraet ihn schon geladen hat. Bisher waren beide zu einer Zeichenkette zusammengesetzt und liessen sich nicht abstufen. Im Werkzeugmenue steht derselbe Zeitstempel, der volle ISO-Wert als Tooltip.' },
        { type: 'fix', text: 'Vor der ersten Phase standen vier Textkaesten - auf dem Telefon rund 1200 Pixel Prosa, bevor man etwas tun konnte. Die Risikoliste bleibt sichtbar, sie verhindert Schaden; Arbeitsgrundlage, Quellenklassen und Reihenfolge sind in einen einklappbaren Block gewandert. Der erste Phasenkopf steht jetzt bei 463 statt 877 Pixeln.' },
        { type: 'fix', text: 'Ein deutscher Textblock im Schritt zum Ausruecklager hatte keine englische Entsprechung - eingebaut in v18. Beim Umschalten blieb die Stelle leer, und auffallen konnte es niemandem: in der deutschen Ansicht sah die Seite vollstaendig aus. Ein neuer Test paart die Spans in Dokumentreihenfolge; ein blosser Zahlenvergleich wuerde zwei Fehler gegeneinander aufheben.' },
        { type: 'fix', text: 'Drei Zwischenueberschriften verwiesen auf "TODO 1 und 2" bzw. "TODO 3 und 4" - die Arbeitsreihenfolge der Startseite, die es seit v19 nicht mehr gibt.' },
        { type: 'intern', text: 'Der neue Test auf den Einstieg hatte zuerst eine Grenze von 900 Pixeln und waere nie angeschlagen - der schlechte Zustand lag bei 877. Nachgemessen statt geschaetzt: 463 eingeklappt, 877 ausgeklappt, Grenze jetzt 600.' }
      ]
    },
    {
      version: 'v20',
      date: '2026-10-04',
      time: '20:40',
      title: 'Kuehlsystem: eine Zeichnung statt einer Pfeilkette',
      changes: [
        { type: 'fix', text: 'Das Kapitel trug eine Zeile "Schnittzeichnung Kuehlkreislauf" und darunter keine Zeichnung, sondern "Pump OUT - Kuehler - Filter - Pump IN" als Text. Jetzt steht dort eine gezeichnete Skizze: Pumpe im Tail Housing mit Ansaugung aus dem Sumpf, Druckleitung zum Kuehler, Kuehler mit OUT oben und IN unten, Filter LF-100, Ruecklauf zur Pumpe.' },
        { type: 'intern', text: 'Warum eine eigene Zeichnung und keine von Jerico: die Diagramme sind nicht mehr zu bekommen. jericoperformance.com gehoert nicht mehr dem Hersteller - die Domain liefert fuer jede Diagrammseite dieselbe 8612 Byte grosse Platzhalterseite eines Wayback-Downloader-Dienstes. Das Webarchiv ist aus diesem Netz nicht erreichbar. Und A-01 enthaelt genau zwei Bilder, davon ein verwertbares: das Firmenlogo. Der Bildteil fehlt im erhaeltlichen PDF tatsaechlich. Die Skizze ist deshalb als eigene Darstellung gekennzeichnet, Quellenklasse D - Reihenfolge und Kuehlerlage stammen aus A-01 und A-02.' },
        { type: 'intern', text: 'Dabei gegengeprueft: A-03 ist unter seinem Originallink weiter abrufbar, und unsere gespiegelte Kopie ist bitgleich - derselbe SHA256 ueber 3.147.849 Byte. A-04 ist tatsaechlich tot, der Link leitet auf die Startseite um und liefert HTML.' },
        { type: 'fix', text: 'Kuehler, Luefter und die drei Leitungslaengen standen als feste Spec-Zeilen da, obwohl die Bestandsaufnahme sie als offen fuehrte - mit einem Absatz darunter, der erklaerte, dass sie doch nicht gelten. Sie sind jetzt Eingabefelder im Trockenaufbau und erscheinen in den Spezifikationen, sobald sie eingetragen sind. Dazu ein Feld fuer den Einbauort des Kuehlers.' },
        { type: 'fix', text: 'Der Satz "on a road course, a cooler is a must" stand zweimal - als Vorgabe mit Quelle und als Zitat im Montageschritt. Die Begruendung steht jetzt an einer Stelle, der Schritt verweist darauf.' },
        { type: 'neu', text: 'Aus A-01 Anhang 1 nachgetragen: die sechs Pumpenschrauben werden zunaechst auf etwa 35 lb./in angezogen, dann wird die Hauptwelle gedreht und die Pumpe ausgerichtet, erst danach schrittweise bis 90 lb./in. Die Zwischenstufe fehlte.' },
        { type: 'verbessert', text: 'Der Absatz, der erklaerte, was frueher in diesem Kapitel stand, ist weg - das gehoert in dieses Journal. Die Pumpen-Teileliste bleibt, der Verweis auf die Montage im Build Log auch.' }
      ]
    },
    {
      version: 'v19',
      date: '2026-10-04',
      time: '18:05',
      title: 'Querschnittliche Wertetabellen aufgeloest',
      changes: [
        { type: 'fix', text: 'Sechs Kapitel entfernt, die dieselben Werte ein zweites und drittes Mal fuehrten. In den Spezifikationen: Anzugsmomente, Schmierstoffe & Dichtmittel, Lager & Kleinteile. Auf der Startseite: Arbeitsreihenfolge, Kernwerte auf einen Blick, Werkzeug & Verbrauchsmaterial. So haelt es das Schwesterprojekt gt40-engine auch - dort gibt es keine querschnittlichen Wertetabellen, jeder Wert steht am Bauteil.' },
        { type: 'intern', text: 'Vorher nachgezaehlt, was wirklich nur in den Specs stand. Bei den Kleinteilen: nichts - alle 23 Teilenummern, Nadelzahlen und Verschleissgrenzen standen schon am Schritt. Bei den Drehmomenten: 10 von 11 Werten standen am Schritt, es fehlten nur die Schraubenbezeichnungen. Bei den Schmierstoffen: alle 9 Betriebsmittel kamen im Build Log vor. Eine frueher gemeldete Zahl - "6 von 12 Drehmomenten stehen nur in den Specs" - war falsch.' },
        { type: 'neu', text: 'Die Schraubenbezeichnungen sind jetzt am Schritt, mit Anzahl: vorderer Lagerflansch 4 x 5/16-18 x 1", Tail Housing 5 x 7/16-14 x 1 1/2", oberer Deckel 10 x 5/16-18 x 1" (bzw. x 3/4" beim Alublech), Oelpumpe 6 x 1/4-20 x 1". Wer dort steht, hat die Schraube in der Hand.' },
        { type: 'fix', text: 'Zwei Werkzeuge nannte die Gesamtliste, obwohl sie an keinem Schritt standen: der Drehmomentschluessel und das Loesungsmittelbad. Beide sind jetzt dort, wo sie gebraucht werden - die Liste behauptete es vorher nur.' },
        { type: 'neu', text: 'Die Nachschlagekarte ist die einzige Zusammenstellung und hat eine vierte Gruppe: Werkzeug & Verbrauchsmaterial. Damit sie eine zweite Ansicht bleibt und keine zweite Quelle wird, nennt jede Gruppe ein Feld belege - je Zeile eine Zeichenkette, die in build-log.html vorkommen muss. Der Test prueft beides: dass jeder Beleg dort steht, und dass belege und zeilen gleich lang sind. Ohne das Zweite koennten die Listen gegeneinander verrutschen und die erste Pruefung vergliche falsche Paare.' },
        { type: 'neu', text: 'Die Risikoliste "Die drei Fehler, die das Getriebe kosten" stand auf der Uebersicht. Sie steht jetzt am Anfang des Zusammenbaus, wo man sie vor dem ersten Griff liest, und verweist je Punkt auf den Schritt mit den Einzelheiten.' },
        { type: 'neu', text: 'Das eingefuellte Oel ist ein Eingabewert. Kapitel 5 trennt jetzt Vorgabe und Befund: Oelsorte, verbotenes Oel und das im Manual verwendete Produkt als Vorgabe - darunter eingefuelltes Oel, Menge, gemessener Fuellstand und Datum aus dem Befuellschritt. Dafuer ein neues Feld fuer den Fuellstand.' },
        { type: 'fix', text: 'Die Oelvorgabe berief sich auf A-02. Der Text der gespiegelten Kopie ist maschinell nicht lesbar - die Zuschreibung war also nicht gegengepruefbar. Belegt ist sie dagegen aus A-01, das den Begriff ausdruecklich definiert: "the word \'oil\' as used in this manual refers to the recommended lubricant of \'Mobil 1\' 75W90". Dazu die Einordnung: 75W-90 ist eine Getriebeoel-Viskositaetsklasse nach SAE J306, kein Motoroel traegt diese Bezeichnung; das Produkt ist heute Mobil 1 Synthetic Gear Lube LS 75W-90, API GL-5 und MT-1. Das "kein Straight 90W" steht jetzt als Klasse F, bis das Original gegengelesen ist.' },
        { type: 'fix', text: 'Der Gruppentest der Spezifikationen hing an Kapitelnummern und waere beim Umnummerieren rot geworden, ohne dass etwas falsch ist. Er prueft jetzt Kapitel-Kennungen - und zusaetzlich, dass keine Gruppe ohne Kapitel dasteht: beim Aufloesen blieb der Trenner "Montagedaten" als Ueberschrift ins Leere stehen.' },
        { type: 'intern', text: 'Das Notizfeld aus der Arbeitsreihenfolge ist mitgewandert, nicht mitgeloescht - sonst waere gespeicherter Text auf keiner Seite mehr sichtbar. Es steht beim gerechneten Fortschritt.' },
        { type: 'intern', text: 'Beim Entfernen der Kapitel ist ein erster Versuch an verschachtelten div-Tags gescheitert: ein Regex griff ueber das Kapitelende hinaus. Die Abbruchbedingung hat vor dem Schreiben gegriffen, die Datei blieb unveraendert. Zweiter Versuch mit Klammerzaehlung.' }
      ]
    },
    {
      version: 'v18',
      date: '2026-10-04',
      time: '15:25',
      title: 'Eingetragene Werte wirken',
      changes: [
        { type: 'fix', text: 'Der Kern dieses Release: in den Spezifikationen stand "26 Spline - Validierung ausstehend" als fester Text, waehrend im Build Log das Feld dafuer danebenlag. Wer abzaehlte und eintrug, sah dieselbe Vorbelegung und dieselbe Warnung. Die Eingabe hatte keine Wirkung. Dasselbe galt fuer Ausgangs-Yoke, Gehaeusematerial, Gesamtlaenge, Schalthebel-Position, Kardanwellenlaenge und die Seriennummer.' },
        { type: 'neu', text: 'befund.js bindet jede solche Anzeige an ihr Feld. Zwei Zustaende, beide ehrlich: eingetragen zeigt den Wert mit Quellenklasse B, leer nennt die Vorgabe und verlinkt den Schritt, in dem der Wert ermittelt wird. Der offene Zustand mahnt also nicht, sondern nennt den Weg nach vorn.' },
        { type: 'neu', text: 'Die Seriennummer warnt bei Abweichung. Steht am Gehaeuse eine andere Nummer als die dokumentierte RH02374, liegt ein anderes Getriebe auf der Werkbank als das, was diese Seiten beschreiben - das darf nicht still durchgehen. Gross-/Kleinschreibung und Leerzeichen zaehlen nicht als Abweichung.' },
        { type: 'neu', text: 'Baureihe, Gehaeusebauart und Ausfuehrung sind Auswahllisten statt eines festen Satzes. Die Baureihen sind die, die A-01 nennt: Top & Bottom Loader Road Race, Winston Cup, Clutch-assisted Drag Race, Endurance. Das ist nicht Papier - A-01 sagt, das Gehaeuse sei bei Road Race und Drag Race dasselbe, "however, crucial differences exist between each version and its intended use": am Hinterlager sitzt bei Drag Race ein Sicherungsring, bei Road Race und Endurance ein zweiteiliger Halteclip. Wer die Baureihe falsch annimmt, zerlegt nach der falschen Sequenz.' },
        { type: 'neu', text: 'Der Aufbauer ("Tex Racing Ent. Inc.") ist ein Eingabefeld.' },
        { type: 'neu', text: 'Phase 1, Schritt 6: "Ausruecklager bestimmen". Die Specs sagten nur "Typ und Retainer-Durchmesser noch zu klaeren". Jetzt steht da, was zu messen ist: Aussendurchmesser des Fuehrungsrohrs an drei Stellen, nutzbare Laenge, Bohrung des vorhandenen Lagers - einige Hundertstel Spiel sind richtig, Klemmen ist falsch, mehr als ein Zehntel laesst das Lager kippen. Fuer den hydraulischen Fall das Masspaar A und B der Hersteller: Mass A von der hinteren Bellhousing-Planflaeche zur Oberkante der Druckplattenfinger (unter 3 Zoll Bolt-On, darueber Slip-On), Mass B von der vorderen Getriebeplanflaeche zur Lagerstirnflaeche, und A minus B muss 0,100 bis 0,250 Zoll ergeben. Mit Messschieber, nicht mit dem Bandmass.' },
        { type: 'neu', text: 'Phase 1, Schritt 7: "Schaltgestaenge einpassen". Entscheidend ist nicht das Bohrmuster, sondern wo der Hebel durch den Tunnel kommt - der Jerico nimmt ihn zwischen 14,5 und 25 Zoll ab Bellhousing auf. Vorgehen: Tunnelloch von der Bellhousing-Planflaeche aus vermessen, Aufnahmepositionen von derselben Flaeche, Bohrmuster auf eine Schablone uebertragen statt das Getriebe mehrfach zu heben. Und der Punkt aus A-01, den man sonst zu spaet erfaehrt: der Schalthebel wird bei abgenommenem Top Cover eingestellt, nicht danach.' },
        { type: 'fix', text: 'Das Glossar trug noch die widerlegte Uebersetzung - "Am RH02374: 22 / 27 Zaehne = Faktor 0,815" - und zwar in allen vier Seiten. v16 hat Kapitel 2 korrigiert, v17 Startseite und Leistungsseite, das Glossar war die vierte Kopie.' },
        { type: 'verbessert', text: '"Visuell bestaetigt" entfernt. Die Formulierung behauptet Sorgfalt, ohne zu sagen, wer was geprueft hat - die Quellenklasse leistet das.' },
        { type: 'intern', text: 'Gegenprobe eines Tests hat ihn als wertlos entlarvt: die Pruefung, dass die Einheit nicht an die Vorgabe geraet, suchte ein geratenes Textmuster und traf die Stelle nicht. Sie vergleicht jetzt gegen die Attribute.' }
      ]
    },
    {
      version: 'v17',
      date: '2026-10-04',
      time: '11:40',
      title: 'Leistung rechnet mitsamt Vergleichssetup, Versionswaechter',
      changes: [
        { type: 'fix', text: 'Die Leistungsseite hatte die Uebersetzungen ein zweites Mal fest im Code - und zwar die in v16 widerlegten: 2.588 / 1.714 / 1.182. Dass Kapitel 2 inzwischen rechnete, half nichts, die Diagramme rechneten weiter mit dem alten Stand. Jede Uebersetzung kommt jetzt aus ratios.js.' },
        { type: 'fix', text: 'Abrollumfang und Achsuebersetzung waren seit v9 Eingabefelder ohne Wirkung. Die Diagramme rechneten mit festen 2.13 m und 3.50, egal was eingetragen war. Beide Felder wirken jetzt, dazu ein neues fuer die Schaltdrehzahl. Unplausible Werte fallen auf die Vorgabe zurueck.' },
        { type: 'fix', text: 'Die Startseite nannte im Steckbrief weiter "2.588 / 1.714 / 1.182 / 1.000 - Main Drive 22/27". Der Widerspruch stand damit eine Seite neben seiner Aufloesung. Die Zeile kommt jetzt aus derselben Rechnung.' },
        { type: 'neu', text: 'Zweites Setup zum Vergleichen. Setup A ist das verbaute Getriebe, Setup B ein Entwurf - ein anderer Zahnradsatz, den man gegen das Verbaute stellt, bevor man ihn kauft. Vorbelegt ist B wie A und abgeschaltet; erfunden wird fuer B nichts. Eingeschaltet erscheint es in der Ergebnistabelle und in jedem Diagramm der Leistungsseite.' },
        { type: 'neu', text: 'Abschnitt 6 der Leistungsseite ist eine gerechnete Tabelle statt Prosa. Dort standen eingetippte Zahlen - "faellt nur auf 5076/min", "Kurzer 1. Gang (78 km/h)" -, die aus den widerlegten Ratios stammten. Jetzt stehen dort Geschwindigkeit im 1. Gang, Drehzahl nach jeder Schaltung, der tiefste Punkt und die Spreizung je Auslegung, mit Markierung, wenn eine Schaltung unter den Drehmomentgipfel faellt.' },
        { type: 'fix', text: 'Die Achsenskalen der Diagramme waren fest (0-250 km/h, 3000-6000/min). Mit einer anderen Achse oder Schaltdrehzahl lief eine Linie aus dem Bild, ohne dass es auffiel. Sie folgen jetzt den Daten. Der Drehmomentgipfel wird aus der Kurve gelesen statt als 4000 eingetippt.' },
        { type: 'fix', text: 'Die Umschalter der Diagramme standen zweimal auf der Seite und benutzten dieselben Element-Kennungen. Ein Haken in Abschnitt 5 blieb damit gesetzt, obwohl das Getriebe ausgeblendet war.' },
        { type: 'neu', text: 'Versionswaechter aus dem Schwesterprojekt uebernommen: tests/release-guard.test.mjs vergleicht jeden Stand gegen seine Basis und wird rot, wenn eine ausgelieferte Datei geaendert wurde, ohne dass APP_VERSION und APP_BUILT mitgehen. Eigener CI-Job, laeuft ohne Browser.' },
        { type: 'fix', text: 'v13 ging zweimal raus - 06:45 und 06:57 am 23.09., beide mit derselben Cache-Version jerico-v13. Wer den ersten Stand geladen hatte, bekam die Nachschlagekarte erst mit v14. Die beiden Journal-Eintraege sind zu einem zusammengefuehrt; umnummerieren waere Fiktion, v14 war ein anderes Release. Ein neuer Test schlaegt bei doppelten Nummern und bei Luecken in der Folge an.' },
        { type: 'fix', text: 'formatBuilt() rechnete den Freigabezeitpunkt mit new Date() in die Zeitzone des Betrachters um. Derselbe Release stand damit in Berlin auf 05.01.2026, 07:09 und in Los Angeles auf 04.01.2026, 22:09 - einen Tag vorher. Die Zeichenkette wird jetzt zerlegt, nicht umgerechnet.' },
        { type: 'neu', text: 'Phase 6, Schritt 12: "Kardanwelle vermessen". Der Hinweis "messen, nicht rechnen" stand an sieben Stellen und nannte nie das Verfahren. Jetzt steht es da: Fahrzeug auf Fahrhoehe mit Last auf den Federn - eine haengende Achse liefert ein zu langes Mass -, Slip Yoke bis zum Anschlag einschieben und 3/4 bis 1 Zoll zurueckziehen, Mass von Kreuzgelenkmitte zu Kreuzgelenkmitte, dazu die Formblatt-Methode mancher Wellenbauer. Gegenproben durch Ein- und Ausfedern gegen Aufsetzen und zu wenig Spline-Eingriff. Mit sieben Messwertfeldern und Zweitmessung.' },
        { type: 'fix', text: 'Die Kardanwelle stand dreimal im selben Specs-Kapitel und dreimal in anderen, jedes Mal mit derselben Mahnung. Zusammengezogen auf einen Eintrag je Ort, der auf das Verfahren verweist.' },
        { type: 'verbessert', text: 'Rueckblicke aus dem Seitentext entfernt. Was in einer frueheren Version falsch war, gehoert in dieses Journal und in die Kommentare im Code, nicht in die Anleitung. Geblieben ist, was den heutigen Zustand beschreibt: der Main Drive ist abgezaehlt, die Gangradpaare sind es nicht.' },
        { type: 'verbessert', text: 'Drei Meta-Kaesten aus Kapitel 7 entfernt: Quellenspiegel, Schnittzeichnungen und der Notion-Hinweis. Die Rechteangabe zu den gespiegelten Jerico-PDFs steht unveraendert in docs/quellen/README.md, die Wayback-Links zu den Explosionszeichnungen in docs/jerico-diagrams.html - beide bleiben ueber die Verweiszeilen erreichbar.' },
        { type: 'verbessert', text: 'Vier Doppelungen von der Startseite entfernt: die Zeile "Ersetzt: Ford Toploader Close Ratio", die getippte Statuszeile "Zusammenbau ausstehend" - die konnte dem gerechneten Fortschrittsbalken daneben nur widersprechen -, der Hinweis zur Herkunft des Stands und die Warnung zum Main Drive, deren Aussage als Vorbehalt oben auf der Leistungsseite steht.' },
        { type: 'verbessert', text: 'Der Hinweis zur Chart-Formel nennt jetzt die Falle statt des Testergebnisses: der Main Drive wird Cluster/Input geschrieben, die Gangradpaare Hauptwelle/Cluster. Wer sie verwechselt, erhaelt den Kehrwert - genau der Fehler, der in der alten Tabelle steckte.' }
      ]
    },
    {
      version: 'v16',
      date: '2026-10-03',
      title: 'Uebersetzungen rechnen statt festschreiben',
      changes: [
        { type: 'fix', text: 'Die feste Uebersetzungstabelle in Kapitel 2 war in sich widerspruechlich. Eingetragen war Main Drive 22/27 (0.815) - damit laesst sich keine der drei dokumentierten Ratios erzeugen: 33/17 ergibt 1.582 statt 2.588, 27/21 ergibt 1.048 statt 1.714, 24/24 ergibt 0.815 statt 1.182. Und die Ratios widersprechen sich untereinander: 1. und 2. Gang verlangen einen Main Drive von 1.333 (28/21), der 3. Gang einen von 1.182 (26/22).' },
        { type: 'neu', text: 'An ihrer Stelle steht ein Rechner: Main Drive und die drei Gangradpaare werden ausgewaehlt, die Gesamtuebersetzungen folgen daraus. Alle Auswahlmoeglichkeiten stammen aus dem Gear Ratio Chart (A-03) - zwoelf Main Drive Sets, zehn Paare fuer den 1. Gang, sechs fuer den 2., acht fuer den 3. Die im Chart grau hinterlegten Paare sind als "Special Case Modification Required" gekennzeichnet und melden sich beim Auswaehlen.' },
        { type: 'neu', text: 'Die Auswahl wird wie jedes Messwertfeld gespeichert und synchronisiert. Verbaut ist nach Auszahlung 25/24 - das ist vorbelegt. Die Gangradpaare stammen noch aus der alten Tabelle und sind als am Teil nachzuzaehlen gekennzeichnet.' },
        { type: 'neu', text: 'Die Ausgabe stellt Ratio, Sprung zwischen den Gaengen und Gesamtspreizung direkt neben Toploader Close und Wide - ein neues Setup laesst sich damit vergleichen, ohne die Zahlen von Hand zu rechnen.' },
        { type: 'neu', text: 'Zwei Tests. Der erste prueft alle 36 Zahnradzahlen gegen die Chart-Spalte 24/24, wo der Main Drive 1.000 ist und die Spalte damit das reine Gangradverhaeltnis zeigt. Der zweite prueft, dass die Felder gespeichert werden und die Ratio sich bei anderer Auswahl neu rechnet - 29/20 mit 33/17 muss 2.815 ergeben, den Wert oben links im Chart. Gegenprobe: ein verfaelschtes Zahnradpaar und ein ausgebautes Neuzeichnen machen sie rot.' },
        { type: 'neu', text: 'Neuer Schritt 5 in Phase 3: "Uebersetzung bestimmen - Zaehne zaehlen". Erklaert, was der Main Drive ist (vorderstes Paar, Eingangswelle gegen vorderstes Vorgelegerad) und in welcher Reihenfolge das Chart ihn schreibt (Cluster/Input, andersherum als die Gangradpaare). Wichtigster Punkt: durch Drehen geht es nicht - im 4. Gang ist das Getriebe direkt, der Main Drive taucht im Verhaeltnis gar nicht auf, und in jedem anderen Gang misst man das Produkt. Zaehlen ist der einzige direkte Weg. Dazu Zahn markieren, langsam drehen, zweimal zaehlen in Gegenrichtung, und die Gegenprobe gegen das Chart. Mit Messwertfeldern und Fotodokumentation.' },
        { type: 'fix', text: 'Die Startseite kannte die neue Schrittzahl der Phase 3 nicht - der Fortschrittsbalken haette einen Schritt unterschlagen. Der Test gegen die Phasenzuordnung hat das gemeldet.' },
        { type: 'intern', text: 'Die Leistungsseite rechnet weiterhin mit den alten festen Ratios und zieht nicht automatisch nach. Das ist auf der Seite vermerkt.' }
      ]
    },
    {
      version: 'v15',
      date: '2026-09-28',
      title: 'Spezifikation und Montage getrennt',
      changes: [
        { type: 'fix', text: 'Kapitel 8 hiess "Oel, Befuellung & Einfahren" und war beides zugleich. Die Handgriffe - vorwaermen mit aufgebockter Hinterachse, Einfahr-Fahrweise im Fahrerlager, Bellhousing-Ausrichtung vor dem Einbau, flexibles Getriebelager - standen dort als kuerzere Zweitfassung, obwohl das Build Log sie in Schritt 11 und 12 ausfuehrlicher und zweisprachig fuehrt, mit Begruendung und Eingabefeldern. Sie sind aus den Spezifikationen raus; an ihrer Stelle steht ein Verweis auf die drei Schritte.' },
        { type: 'fix', text: 'Kapitel 8 heisst jetzt "Oel, Befuellung & Serviceintervalle" und nennt nur noch, was man nachschlaegt: Oelsorte, Produkt, Menge, Fuellstand - dazu die Intervalle, ergaenzt um den bisher fehlenden Dauerhinweis "Oel und Zahnraeder so haeufig pruefen wie den Motor".' },
        { type: 'fix', text: 'Die Kuehlerpflicht stand in Kapitel 7 und nochmal in Kapitel 8. Sie steht jetzt nur noch in Kapitel 7, wo das Kuehlsystem beschrieben ist.' },
        { type: 'fix', text: '"Offene Validierungen & Abhaengigkeiten" stand unter der Gruppe "Betrieb". Offene Punkte sind kein Betrieb, sondern Projektstand - sie haben jetzt eine eigene Gruppe.' },
        { type: 'fix', text: 'Restliche Altlast: die Typbezeichnung im Hinweis zur Kupplungsbenutzung sagte noch "Oval/Road-Race-Getriebe".' },
        { type: 'neu', text: 'Zwei Tests halten die Trennung fest. Der erste prueft die Anweisung, nicht das Stichwort - die Specs duerfen auf einen Schritt verweisen, nur die Handlung selbst gehoert nicht mehr dorthin. Der zweite prueft, dass Kapitel 9 allein in der Gruppe Projektstand steht. Gegenprobe: eine zurueckgelegte Handlungszeile und ein rueckgaengig gemachter Gruppenwechsel machen jeweils genau einen Test rot.' }
      ]
    },
    {
      version: 'v14',
      date: '2026-09-23',
      title: 'Menue aufgeraeumt',
      changes: [
        { type: 'verbessert', text: 'Manueller Cloud-Sync-Button aus dem Menue entfernt (Sync passiert automatisch). "Einstellungen" umbenannt in "Cloud-Sync".' }
      ]
    },
    {
      version: 'v13',
      date: '2026-09-23',
      time: '06:57',
      title: 'Nachschlagekarte, stilles Speichern, Auto-Reconnect',
      changes: [
        { type: 'intern', text: 'Dieser Eintrag fasst zwei Staende zusammen, die beide als v13 ausgeliefert wurden - 06:45 und 06:57, zwoelf Minuten auseinander, mit derselben Cache-Version jerico-v13. Ein Geraet, das den ersten geladen hatte, bekam den zweiten nicht; die Nachschlagekarte kam dort erst mit v14 an. Seit v17 prueft tests/release-guard.test.mjs jede Aenderung an einer ausgelieferten Datei auf den Versionssprung, und ein zweiter Test schlaegt bei doppelten Nummern und Luecken in der Folge an.' },
        { type: 'neu', text: 'Neue Karte hinter dem blauen Schraubenschluessel rechts, auf jeder Seite: Anzugsmomente, Schmierstoffe und Dichtmittel, Oel und Service - mit Suchfeld wie im Glossar. Sie ist ein Overlay, keine eigene Seite: wer an der Werkbank einen Wert nachschlaegt, verliert seinen Schritt im Build Log nicht. Bei geoeffneter Karte druckt Strg+P eine Werkstattfassung ohne Bedienelemente.' },
        { type: 'neu', text: 'Die Werte stehen in reference.js als Daten, die Karte wird daraus gebaut - nicht als vierte handgeschriebene Kopie. Das Glossar liegt als fertiges Markup in jeder Seite, viermal dieselben 25 KB; bei Werten, die auch in den Spezifikationen stehen, ist das die Falle, an der die zwei Kuehlsystem-Kapitel und das Quellenregister auseinandergelaufen sind. Ein Test vergleicht die Karte gegen specs.html und wird rot, sobald eine Zeile nur noch an einer Stelle steht.' },
        { type: 'neu', text: 'Das Overlay entsteht erst beim ersten Oeffnen, statt auf jeder Seite ungenutzt im DOM zu liegen.' },
        { type: 'verbessert', text: 'Speichern zeigt keinen Toast mehr bei Erfolg. Sync-Badge im Header (gruen/rot) reicht als Statusanzeige.' },
        { type: 'verbessert', text: 'Fehler-Toasts bleiben stehen, bis der Benutzer sie aktiv schliesst (x-Knopf). Roter Hintergrund zur Unterscheidung.' },
        { type: 'neu', text: 'Fehlerprotokoll: Sync-Fehler werden automatisch ins Gist geschrieben (eigene Datei *-errors.json). Damit sind sie spaeter auswertbar, auch wenn der Toast schon geschlossen wurde.' },
        { type: 'neu', text: 'Auto-Reconnect: Wenn das Geraet nach Offline-Betrieb wieder online geht, werden lokal gespeicherte Aenderungen automatisch in die Cloud geschoben.' }
      ]
    },
    {
      version: 'v12',
      date: '2026-09-23',
      title: 'Kuehlsystem entflochten',
      changes: [
        { type: 'fix', text: 'Die Spezifikationen hatten zweimal ein Kuehlsystem-Kapitel - Nummer 7 und Nummer 9, beide mit derselben Element-ID sec-cooling und derselben Galerie-ID. Doppelte IDs brechen Ankerlinks, und der Fotozaehler aktualisierte sich nur an einer der beiden Stellen. Zusammengefuehrt zu einem Kapitel 7.' },
        { type: 'fix', text: 'Dabei war dreierlei vermischt. Die Spezifikation (Oelkreislauf, Kuehlerposition, Anschluesse, Teileliste der Pumpe) bleibt in Kapitel 7. Die Montageschritte - die sechs Punkte "Oelpumpe zerlegen" aus Anhang 2 - stehen jetzt im Build Log bei Schritt 4, wo Tail Housing und Adapterplatte abgenommen werden. Der Ist-Stand mit den offenen Punkten (Kuehler, Luefter, Leitungen, Auswirkung auf die Gesamtlaenge, Messwertfelder) steht in Kapitel 9 "Offene Validierungen & Abhaengigkeiten", wo die anderen offenen Punkte schon stehen.' },
        { type: 'fix', text: 'Widerspruch aufgeloest: Kapitel 7 fuehrte einen Derale Oelkuehler und einen Derale Inline Fan Thermostat als gesetzte Spezifikation, waehrend die Bestandsaufnahme beide als "Produkt noch nachzureichen" auswies. Sie sind jetzt als Kandidat vermerkt und als offen gefuehrt, nicht als Vorgabe. Die Messwertfelder behalten ihre Feldnamen, eingetragene Werte bleiben erhalten.' },
        { type: 'neu', text: 'Leistungsseite: der Ventiltrieb ist praeziser benannt - Flachstoessel-Nockenwelle mit Rollenkipphebeln.' }
      ]
    },
    {
      version: 'v11',
      date: '2026-09-22',
      title: 'Galerie auf iPad, Aufraeumen',
      changes: [
        { type: 'fix', text: 'Galerie und Glossar oeffneten auf dem iPad mit dem Kopf oberhalb des Bildschirms - Titel und Schliessen-Knopf waren nicht zu sehen, erst Runterscrollen brachte sie herein. Ursache: body{overflow:hidden} sperrt die Seite auf iOS nicht, Safari scrollt per Touch weiter, und das Overlay bleibt dabei am Viewport. Jetzt wird der body selbst festgesetzt und der Scrollstand beim Schliessen wiederhergestellt. Betraf beide Projekte, weil beide dieselbe gallery.js benutzen.' },
        { type: 'neu', text: 'Die Versionsnummer im Kopf nennt jetzt auch den Freigabezeitpunkt. Die Nummer allein sagt nicht, ob ein Geraet den neuen Stand geladen hat.' },
        { type: 'fix', text: 'Specs: Kapitel "Quellenregister" entfernt. Es wiederholte die Quellen der Uebersichtsseite und war dabei der schlechtere Stand: alte Fremdlinks statt der lokalen Kopien, kein Hinweis auf den toten A-04-Link, das alte Klassenschema A/B/C statt A bis F - und der Satz "Alle Angaben auf dieser Seite stammen aus Klasse A", der in v3 als falsch erkannt und anderswo schon gestrichen war. Der Vorrang des englischen Originals stand nur dort und ist in die Quellenklassen-Legende oben gewandert.' },
        { type: 'fix', text: 'Zusammenbau: die Zeile "Offene Befunde" in der Kopfzeile ist weg. Die Befunde stehen ohnehin an jedem Kapitel.' },
        { type: 'neu', text: 'Der Test gegen pauschale Quellenaussagen greift jetzt auf das Muster statt auf einen einzelnen Wortlaut - die alte Fassung hat genau diesen Satz uebersehen. Dazu Tests fuer den Freigabezeitpunkt und die Scroll-Sperre.' }
      ]
    },
    {
      version: 'v10',
      date: '2026-09-22',
      title: 'Kuehlsystem, Schnittzeichnungen, Uebersicht umgebaut',
      changes: [
        { type: 'neu', text: 'Neue Sektion 9 (Kuehlsystem) auf der Spezifikationsseite: Oelpumpe Single-Stage, Alu-Adapter, Oelkuehler + Luefter, AN-Material. Messwertfelder fuer Laengenaenderung, Kuehler-Produkt, AN-Groesse.' },
        { type: 'neu', text: 'Abhaengigkeitsliste in Sektion 10 (Offene Validierungen): Input Shaft und Kardanwelle muessen nach Kuehlsystem-Einbau neu vermessen werden.' },
        { type: 'neu', text: 'Neue Referenzseite docs/jerico-diagrams.html: OEM-Schnittzeichnungen von Jerico (Explosionszeichnung Rev. 2, Gehaeuseteile, Single-Stage-Pumpe, Kuehlkreislauf, Seal Driver) mit Wayback-Machine-Links zum Download.' },
        { type: 'verbessert', text: 'Uebersicht Sektion 4 (Arbeitsreihenfolge): Kuehlsystem-Schritt und Input-Shaft-/Kardanwellen-Schritt ergaenzt. Verlinkt jetzt klar auf build-log.html.' },
        { type: 'verbessert', text: 'Uebersicht Sektion 5 (Kernwerte): Auf die wichtigsten Werte reduziert, verlinkt auf die Detailseiten in specs.html.' },
        { type: 'verbessert', text: 'Uebersicht Sektion 6 (Werkzeug): Hinweis auf Werkzeuglisten pro Arbeitsschritt im Build Log.' },
        { type: 'verbessert', text: 'Quellenregister: A-05 Schnittzeichnungen ergaenzt. Hinweis auf fehlende Zeichnungen durch Wayback-Referenz ersetzt.' }
      ]
    },
    {
      version: 'v9',
      date: '2026-09-22',
      title: 'Geraete-Tracking, field-sync.js erweitert',
      changes: [
        { type: 'neu', text: 'Jedes Geraet bekommt eine eindeutige ID und einen benennbaren Namen (z.B. "iPad Werkstatt", wird aus User-Agent erraten). Das Geraeteregister wird im Gist gespeichert.' },
        { type: 'neu', text: 'Bei jedem Speichern wird das aktuelle Geraet mit Zeitstempel im Datensatz vermerkt. Beim Merge werden die Register aller Geraete zusammengefuehrt.' },
        { type: 'neu', text: 'Geraetename-Feld im Einstellungsdialog aller vier Seiten.' }
      ]
    },
    {
      version: 'v8',
      date: '2026-09-22',
      title: 'Gist-ID entfaellt, automatische Erkennung',
      changes: [
        { type: 'neu', text: 'Beim Verbinden genuegt jetzt der GitHub-Token. Die App sucht automatisch nach einem bestehenden Gist (anhand des Dateinamens "jerico-build-log-data.json"). Wird keiner gefunden, wird einer angelegt. Auf einem zweiten Geraet denselben Token eingeben - die Daten werden automatisch abgeglichen.' },
        { type: 'fix', text: 'Das Gist-ID-Eingabefeld ist aus dem Einstellungsdialog entfernt. Kein manuelles Kopieren von IDs mehr noetig.' }
      ]
    },
    {
      version: 'v7',
      date: '2026-09-22',
      title: 'Interaktive Getriebediagramme',
      changes: [
        { type: 'neu', text: 'Neues perf-charts.js: Die statischen SVG-Tafeln und Vergleichstabellen in der Leistungsseite sind durch interaktive Canvas-Diagramme ersetzt. Alle drei Getriebe (Jerico RH02374, Toploader Close, Toploader Wide) sind per Checkbox einzeln ein- und ausblendbar.' },
        { type: 'neu', text: 'Geschwindigkeitsdiagramm: Drehzahl vs. km/h mit allen vier Gaengen als Linien, unterscheidbar durch Strichmuster. Jedes Getriebe in seiner Farbe, Jerico betont.' },
        { type: 'neu', text: 'Schaltpunkte-Diagramm: Balkendiagramm zeigt die Drehzahl nach dem Schalten bei 6000/min. Drehmomentgipfel als rote Referenzlinie. PS-Wert ueber jedem Balken.' },
        { type: 'neu', text: 'Drehzahlverlust-Diagramm: Zeigt wie viel Drehzahl bei jeder Schaltung verloren geht - macht den Nachteil des Jerico bei 1->2 und den Vorteil bei 3->4 auf einen Blick sichtbar.' },
        { type: 'intern', text: 'Alle Diagramme sind responsive und passen sich der Bildschirmbreite an. Retina/HiDPI-Unterstuetzung ueber devicePixelRatio.' }
      ]
    },
    {
      version: 'v6',
      date: '2026-09-22',
      title: 'Eingabevalidierung, klarere Sync-Meldungen',
      changes: [
        { type: 'neu', text: 'Neues validation.js: numerische Eingabefelder werden beim Verlassen geprueft. Buchstaben in Zahlfeldern werden rot markiert, Komma wird automatisch zu Punkt normalisiert. Gilt fuer Spline-/Yoke-Zaehlung, Laufschlag, Nadelzahlen und alle Messwertfelder im Build Log.' },
        { type: 'fix', text: 'Speicher-Meldungen vereinheitlicht: "Gespeichert" (online OK), "Offline gespeichert" (kein Netz), "Gespeichert, Sync-Fehler: ..." (mit konkretem Fehlergrund statt nur "Cloud-Fehler").' },
        { type: 'neu', text: 'Offline-Erkennung: navigator.onLine wird jetzt geprueft bevor ein Cloud-Save versucht wird.' }
      ]
    },
    {
      version: 'v5',
      date: '2026-09-22',
      title: 'Leistungsseite, Quellenspiegel, Materialbestimmung',
      changes: [
        { type: 'neu', text: 'Neue Seite "Leistung": Drehmoment- und Leistungskurve des 347 SBF, Geschwindigkeit je Gang, rechnerische Schaltpunkte und der Vergleich des Jerico gegen Ford Toploader Close Ratio (2.32/1.69/1.29/1.00) und Wide Ratio (2.78/1.93/1.36/1.00) - jeweils mit Drehzahl nach dem Schaltvorgang. Alle Annahmen sind offengelegt und ueberschreibbar, sobald Pruefstandswerte vorliegen.' },
        { type: 'neu', text: 'Quellenspiegel: A-01 Assembly Manual, A-02 Break-In Sheet und A-03 Gear Ratio Chart liegen jetzt als unveraenderte Kopie unter docs/quellen/ im Repository, mit Pruefsummen und Rechtehinweis. Die Herstellerlinks koennen verschwinden - A-04 Transmission Guide ist bereits tot und daher nur noch als toter Link vermerkt.' },
        { type: 'neu', text: 'Materialbestimmung Alu/Magnesium: Essigprobe, Dichtevergleich (1,74 gegen 2,70 g/cm3), Korrosionsbild und Klangprobe als Schrittfolge - dazu der Sicherheitshinweis, dass Magnesiumspaene als Metallbrand brennen und Wasser den Brand verschlimmert statt ihn zu loeschen. Auch als Glossareintrag.' },
        { type: 'fix', text: 'Typbezeichnung: Das Getriebe ist ein Road-Race-Getriebe. "Oval Road Race" ist Jericos Baureihenbezeichnung und stand hier als Einsatzzweck - das ist jetzt getrennt ausgewiesen.' },
        { type: 'fix', text: 'Klargestellt, dass keine Schnittzeichnungen vorliegen: der Bildteil des Assembly Manuals fehlt im erhaeltlichen PDF. Alle Zeichnungen auf diesen Seiten sind eigene Skizzen.' },
        { type: 'fix', text: 'Der Link zum Motor-Build (gt40-engine) ist entfernt.' }
      ]
    },
    {
      version: 'v4',
      date: '2026-09-22',
      title: 'Notion-Quellen nachgezogen',
      changes: [
        { type: 'fix', text: 'Die Notion-Seiten sind jetzt auf demselben Stand wie diese Anleitung: der Kupplungsschlupf-Satz ist im Quellenregister als Fehluebertragung markiert, das Break-In-Sheet hat den fehlenden Abschnitt "FOR CLUTCHLESS DRAG RACE TRANSMISSIONS ONLY" samt Begruendung, und in der deutschen Uebersetzung sind Schlagwerte, Einbautiefe der Vorgelegewelle und die verschobenen Gangnummern korrigiert.' },
        { type: 'fix', text: 'Der Hinweis im Build Log sagt jetzt, was gilt (dritter, zweiter, erster Gang), statt nur die Notion-Fassung zu ruegen - die ist korrigiert.' }
      ]
    },
    {
      version: 'v3',
      date: '2026-09-21',
      title: 'Gegen die Original-PDFs geprueft',
      changes: [
        { type: 'fix', text: 'Kupplungsschlupf: Der Satz "CLUTCH SLIPPAGE IS A MUST" steht im Break-In-Sheet ausschliesslich unter "FOR CLUTCHLESS DRAG RACE TRANSMISSIONS ONLY". Er stand hier als allgemeine Vorgabe fuer das Road-Race-Getriebe - das war eine Fehluebertragung und ist entfernt. An seiner Stelle steht, woher der Satz stammt und dass Schaltstrategie und Kupplungsbenutzung fuer dieses Getriebe noch zu klaeren sind.' },
        { type: 'fix', text: 'Hauptwellen-Schlag: 0,0015" ist im Original der Durchschnittswert einer brauchbaren Welle ("will average"), nicht der Grenzwert. Eine Grenze nennt Jerico nur fuer die gerichtete Welle: hoechstens 0,003" je Lagersitz.' },
        { type: 'fix', text: 'Vorgelegewelle: Das Original erlaubt buendig bis wenige Tausendstel Zoll unter der hinteren Gehaeuseflaeche. Die Anleitung sagte "niemals tiefer als buendig" - zu streng. Die Folge weiteren Eintreibens benennt das Manual praezise: der Waermeausdehnungsspielraum des hinteren Nadellager-Clusters geht verloren.' },
        { type: 'fix', text: 'Herstellerstatus: Die Behauptung "Jerico wahrscheinlich inaktiv" war unbelegt und ist raus. Stattdessen Kontaktdaten und der geprueste Stand.' },
        { type: 'fix', text: 'Kardanwelle: Die Laenge wird nach dem Einbau bei definierter Fahrhoehe gemessen, nicht aus der Differenz zweier nomineller Getriebelaengen abgeleitet.' },
        { type: 'neu', text: 'Quellenklassen: Jede Angabe traegt jetzt, wo es darauf ankommt, ihre Herkunft - OEM-Vorgabe, Ist-Befund, Messwert, Ableitung, Sekundaerquelle oder noch zu validieren. Die pauschale Aussage "alle Werte stammen aus der OEM-Primaerliteratur" war falsch.' },
        { type: 'neu', text: 'Oel: Herstellervorgabe (synthetisches 75W90) und das im Manual verwendete Produkt (Mobil 1) sind getrennt ausgewiesen.' },
        { type: 'neu', text: 'Glossareintrag zur Kupplungsfrage und Originalzitate bei Schlagwerten und Einbautiefe.' }
      ]
    },
    {
      version: 'v2',
      date: '2026-09-21',
      title: 'Offline-Betrieb auf der veroeffentlichten Seite',
      changes: [
        { type: 'fix', text: 'Der Service Worker liess sich auf GitHub Pages nicht installieren: die Dateiliste stand mit absolutem Pfad in Kleinschreibung, das Repository heisst aber "Jerico-...". GitHub Pages unterscheidet Gross- und Kleinschreibung, damit lief die Installation auf einen 404 und der Offline-Betrieb fiel ganz aus. Die Liste ist jetzt relativ.' },
        { type: 'fix', text: 'Dasselbe in manifest.json: start_url und scope zeigten auf einen Pfad, den es so nicht gibt. Beim Ablegen auf dem Startbildschirm waere die App im Nichts gelandet.' }
      ]
    },
    {
      version: 'v1',
      date: '2026-09-20',
      title: 'Erste Ausgabe - Jerico RH02374',
      changes: [
        { type: 'neu', text: 'Drei Seiten nach dem Vorbild des Motor-Build-Logs: Uebersicht, Spezifikationen und Build Log mit sechs Phasen vom Trockenaufbau bis zum Einfahren.' },
        { type: 'neu', text: 'Der Zusammenbau folgt dem Jerico Assembly/Disassembly Manual, Variante Top Loader Only / Road Race mit Oelpumpe - nur die fuer RH02374 gueltigen Schritte.' },
        { type: 'neu', text: 'Anzugsmomente, Schmierstoffe, Nadellager-Zaehlungen und Einfahrvorgaben als Nachschlagetafeln auf der Specs-Seite.' },
        { type: 'neu', text: 'Messwerte, Kapitelstatus und Befunde werden lokal gespeichert und lassen sich ueber einen Gist zwischen Geraeten abgleichen.' },
        { type: 'neu', text: 'Fotodokumentation je Arbeitsschritt: die Bilder liegen im Repository, der Gist traegt nur die Beschriftung.' },
        { type: 'intern', text: 'Gemeinsames Stylesheet und ein gemeinsames app.js statt dreifach kopiertem Inline-Script.' }
      ]
    }
  ];

  var TYPE_LABEL = { neu: 'Neu', fix: 'Behoben', intern: 'Intern', verbessert: 'Verbessert' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureChrome() {
    if (document.getElementById('changelogOverlay')) return;
    var ov = document.createElement('div');
    ov.className = 'changelog-overlay';
    ov.id = 'changelogOverlay';
    ov.innerHTML =
        '<div class="cl-panel" role="dialog" aria-label="Release-Dokumentation">'
      + '<div class="cl-head">'
      + '<h3>Release-Dokumentation</h3>'
      + '<button type="button" class="cl-close" onclick="closeChangelog()" aria-label="Schliessen">&times;</button>'
      + '</div><div class="cl-body" id="changelogBody"></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeChangelog(); });
    document.body.appendChild(ov);
  }

  function render() {
    var current = (typeof APP_VERSION === 'string') ? APP_VERSION : '';
    document.getElementById('changelogBody').innerHTML = RELEASES.map(function (r) {
      var istAktuell = r.version === current;
      return '<section class="cl-rel' + (istAktuell ? ' current' : '') + '">'
        + '<h4><span class="cl-ver">' + esc(r.version) + '</span>'
        + (istAktuell ? '<span class="cl-badge">aktuell</span>' : '')
        + '<span class="cl-date">' + esc(r.date) + '</span></h4>'
        + '<p class="cl-title">' + esc(r.title) + '</p>'
        + '<ul>' + r.changes.map(function (c) {
            return '<li><span class="cl-type ' + esc(c.type) + '">'
                 + esc(TYPE_LABEL[c.type] || c.type) + '</span>' + esc(c.text) + '</li>';
          }).join('') + '</ul></section>';
    }).join('');
  }

  function openChangelog() {
    ensureChrome();
    render();
    document.getElementById('changelogOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeChangelog() {
    var ov = document.getElementById('changelogOverlay');
    if (ov) ov.classList.remove('show');
    document.body.style.overflow = '';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ov = document.getElementById('changelogOverlay');
    if (ov && ov.classList.contains('show')) closeChangelog();
  });

  global.RELEASES = RELEASES;

  global.CHANGELOG_TYPE_LABEL = TYPE_LABEL;   // fuer tests/ui.test.mjs
  global.openChangelog = openChangelog;
  global.closeChangelog = closeChangelog;
})(typeof window !== 'undefined' ? window : globalThis);
