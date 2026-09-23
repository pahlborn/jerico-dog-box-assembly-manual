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
      version: 'v13',
      date: '2026-09-23',
      title: 'Stilles Speichern, Fehlerprotokoll, Auto-Reconnect',
      changes: [
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

  var TYPE_LABEL = { neu: 'Neu', fix: 'Behoben', intern: 'Intern' };

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
  global.openChangelog = openChangelog;
  global.closeChangelog = closeChangelog;
})(typeof window !== 'undefined' ? window : globalThis);
