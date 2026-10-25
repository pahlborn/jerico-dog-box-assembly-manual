// Tests fuer das Grundgeruest: Version, Seitenaufbau, Kapitelstatus, Befunde,
// Messwerte und die Fortschrittsanzeige auf der Startseite.
//
// Lokal: npm test

import fs from 'node:fs';
import path from 'node:path';
import {
  startServer, stubGitHub, REPO_ROOT, browserStarten, neuerKontext,
  suite, test, assert, assertEqual, summary
} from './helpers.mjs';

const { server, base } = await startServer();
const browser = await browserStarten();
const PAGES = ['index.html', 'specs.html', 'build-log.html', 'performance.html'];

async function open(file) {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubGitHub(page);
  await page.goto(base + '/' + file);
  await page.waitForTimeout(900);
  return { ctx, page, errors, close: () => ctx.close() };
}

try {

// ---------------------------------------------------------------------------
suite('Version: eine Quelle, die nicht auseinanderlaufen kann');

await test('version.js und sw.js nennen dieselbe Version', async () => {
  // Ohne diese Pruefung liefert der Service Worker irgendwann einen anderen
  // Stand aus, als der Header anzeigt.
  const sw = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
  const vjs = fs.readFileSync(path.join(REPO_ROOT, 'version.js'), 'utf8');
  const cacheName = (sw.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  const appVersion = (vjs.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  assert(cacheName, 'CACHE_NAME nicht gefunden');
  assert(appVersion, 'APP_VERSION nicht gefunden');
  assertEqual(cacheName, 'jerico-' + appVersion,
    'sw.js (' + cacheName + ') passt nicht zu version.js (' + appVersion + ')');
});

await test('changelog.js kennt die aktuelle Version', async () => {
  const cl = fs.readFileSync(path.join(REPO_ROOT, 'changelog.js'), 'utf8');
  const vjs = fs.readFileSync(path.join(REPO_ROOT, 'version.js'), 'utf8');
  const appVersion = (vjs.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  assert(cl.includes("version: '" + appVersion + "'"),
    'Kein Changelog-Eintrag fuer ' + appVersion);
});

await test('version.js nennt einen Freigabezeitpunkt', async () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'version.js'), 'utf8');
  const iso = (src.match(/APP_BUILT\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  assert(iso, 'APP_BUILT fehlt in version.js');
  assert(!isNaN(new Date(iso).getTime()), 'APP_BUILT ist kein gueltiges Datum: ' + iso);
});

await test('jeder benutzte Aenderungstyp hat Beschriftung und Farbe', async () => {
  // Nicht gegen eine Liste erlaubter Typen pruefen, sondern gegen die
  // tatsaechlich benutzten: sonst faellt nicht auf, dass ein neuer Typ ohne
  // Badge dargestellt wird. Genau so war es bei "verbessert" - 14 Eintraege
  // ohne Beschriftung und ohne Farbe, weil TYPE_LABEL und gallery.css ihn
  // nicht kannten. Im Schwesterprojekt war derselbe Fehler bei v58/v59.
  const p = await open('specs.html');
  const r = await p.page.evaluate(() => {
    const labels = window.CHANGELOG_TYPE_LABEL || {};
    const benutzt = [...new Set(RELEASES.flatMap((rel) => rel.changes.map((c) => c.type)))];
    return { benutzt: benutzt, ohneLabel: benutzt.filter((t) => !labels[t]) };
  });
  await p.close();

  assert(r.benutzt.length > 0, 'Kein Aenderungstyp im Journal gefunden');
  assertEqual(r.ohneLabel, [],
    'Aenderungstyp ohne Beschriftung - wird als roher Schluessel dargestellt');

  // Und die Farbe: ohne eigene Regel faellt der Badge farblos aus.
  const css = fs.readFileSync(path.join(REPO_ROOT, 'gallery.css'), 'utf8');
  const ohneFarbe = r.benutzt.filter((t) => !css.includes('.cl-type.' + t + ' '));
  assertEqual(ohneFarbe, [], 'Aenderungstyp ohne eigene Farbe in gallery.css');
});

await test('die Versionsfolge hat keine Luecke und keine Nummer zweimal', async () => {
  // v13 ging zweimal raus, zwoelf Minuten auseinander, beide mit derselben
  // Cache-Version. Im Journal standen dafuer zwei Eintraege mit demselben
  // 'version: v13' - und kein Test hat danach gesucht. Die Pruefung darueber
  // sieht nur, ob die oberste Nummer zu APP_VERSION passt; das war die ganze
  // Zeit erfuellt.
  const cl = fs.readFileSync(path.join(REPO_ROOT, 'changelog.js'), 'utf8');
  const versionen = [...cl.matchAll(/version: '(v\d+)'/g)].map((m) => m[1]);
  assert(versionen.length > 5, 'Nur ' + versionen.length + ' Eintraege gefunden');

  const nummern = versionen.map((v) => Number(v.slice(1)));
  const doppelt = versionen.filter((v, i) => versionen.indexOf(v) !== i);
  assertEqual(doppelt, [], 'Nummer mehrfach im Journal: ' + doppelt.join(', '));

  const luecken = [];
  for (let i = 0; i < nummern.length - 1; i++) {
    for (let n = nummern[i] - 1; n > nummern[i + 1]; n--) luecken.push('v' + n);
  }
  assertEqual(luecken, [], 'Ohne Eintrag: ' + luecken.join(', '));
  assert(nummern.every((n, i) => i === 0 || n < nummern[i - 1]),
    'Die Eintraege stehen nicht absteigend: ' + nummern.join(', '));
});

await test('der Freigabezeitpunkt passt zum obersten Journal-Eintrag', async () => {
  // Es gibt keinen Build-Schritt, der APP_BUILT stempeln koennte. Ohne diese
  // Pruefung bleibt er beim naechsten Hochzaehlen stehen und behauptet ein
  // falsches Freigabedatum.
  const vjs = fs.readFileSync(path.join(REPO_ROOT, 'version.js'), 'utf8');
  const cl = fs.readFileSync(path.join(REPO_ROOT, 'changelog.js'), 'utf8');
  const built = (vjs.match(/APP_BUILT\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(built),
    'APP_BUILT ist kein ISO-8601 mit Zonenangabe: ' + built);

  const ersterBlock = cl.slice(cl.indexOf('var RELEASES'), cl.indexOf('var RELEASES') + 400);
  const datum = (ersterBlock.match(/date:\s*'([^']+)'/) || [])[1];
  const zeit = (ersterBlock.match(/time:\s*'([^']+)'/) || [])[1];
  assertEqual(built.slice(0, 10), datum, 'APP_BUILT und das Datum des obersten Eintrags');
  assert(zeit, 'Der oberste Journal-Eintrag hat keine Uhrzeit');
  assertEqual(built.slice(11, 16), zeit, 'Uhrzeit in version.js und changelog.js');
});

await test('der Freigabezeitpunkt sieht in jeder Zeitzone gleich aus', async () => {
  // formatBuilt() rechnete mit new Date() in die Zeitzone des Betrachters um.
  // Derselbe Release stand in Berlin auf 05.01.2026, 07:09 und in Los Angeles
  // auf 04.01.2026, 22:09 - einen Tag vorher. Der Zeitpunkt gehoert zum
  // Release, nicht zum Leser.
  const p = await open('index.html');
  const r = await p.page.evaluate(() => ({
    mitZeit: formatBuilt('2026-01-05T07:09:00+01:00'),
    ohneZeit: formatBuilt('2026-01-05'),
    muell: formatBuilt('keine Zeitangabe'),
    quelle: formatBuilt.toString()
  }));
  await p.close();
  assertEqual(r.mitZeit, '05.01.2026, 07:09', 'Formatierung mit Uhrzeit');
  assertEqual(r.ohneZeit, '05.01.2026', 'Datum ohne Uhrzeit');
  assertEqual(r.muell, '', 'Unlesbare Eingabe liefert keinen leeren String');
  // Und der Weg dahin: new Date() wuerde die Zonenverschiebung zurueckholen,
  // ohne dass die Werte oben sich aendern - der Test liefe auf einem Rechner
  // in Berlin gruen und in Los Angeles rot.
  assert(!/new Date/.test(r.quelle),
    'formatBuilt benutzt new Date() - der Zeitpunkt rutscht in die Zeitzone des Betrachters');
});

await test('Vollbild-Overlays sperren die Seite iOS-tauglich', async () => {
  // body{overflow:hidden} allein reicht auf iOS nicht - ohne festgesetzten
  // body wandert die Seite unter dem Overlay weg.
  const js = fs.readFileSync(path.join(REPO_ROOT, 'gallery.js'), 'utf8');
  assert(/function sperreSeite/.test(js), 'sperreSeite() fehlt');
  assert(/b\.style\.position = 'fixed'/.test(js), 'Sperre setzt den body nicht fest');
  const app = fs.readFileSync(path.join(REPO_ROOT, 'app.js'), 'utf8');
  assert(/sperreSeite/.test(app), 'Glossar benutzt die Sperre nicht');
});

await test('Zusammenbau zeigt keine Befunde-Zeile in der Kopfzeile', async () => {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  assert(!/findings-overview/.test(text), 'Befunde-Zeile steht noch in der Kopfzeile');
});

await test('keine doppelten Element-IDs auf einer Seite', async () => {
  // Zwei Kuehlsystem-Kapitel trugen beide id="sec-cooling" und beide die
  // Galerie-ID spec_cooling_photos. Doppelte IDs brechen Ankerlinks, und der
  // Fotozaehler aktualisierte sich nur an einer der beiden Stellen.
  for (const datei of PAGES) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    const ids = [...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const gesehen = new Set();
    const doppelt = [];
    for (const id of ids) {
      if (gesehen.has(id)) doppelt.push(id);
      gesehen.add(id);
    }
    assertEqual(doppelt, [], datei + ': doppelte IDs');
  }
});

await test('Montageschritte stehen im Build Log, nicht in den Specs', async () => {
  // Die Spezifikationen beschreiben, was das Getriebe ist. Was man tut,
  // gehoert an den Arbeitsschritt.
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  assert(bl.includes('Laufradwelle aus der Pumpe herausdr'),
    'Zerlegeschritte der Oelpumpe fehlen im Build Log');
  assert(!specs.includes('Laufradwelle aus der Pumpe herausdr'),
    'Zerlegeschritte stehen noch in den Spezifikationen');

  // Einfahren und Einbau sind Handgriffe, keine Werte. Sie standen als
  // kuerzere Zweitfassung in Kapitel 8, obwohl Schritt 11 und 12 sie
  // ausfuehrlicher und zweisprachig fuehren.
  //
  // Geprueft wird die Anweisung, nicht das Stichwort: die Specs duerfen auf
  // den Schritt verweisen ("siehe Schritt 11, Bellhousing-Ausrichtung"),
  // nur die Handlung selbst gehoert dort nicht mehr hin.
  for (const [nadel, was] of [
    ['Hinterachse aufbocken', 'Vorwaermen'],
    ['Fahrerlager', 'Einfahr-Fahrweise'],
    ['Pilotlagerbohrung', 'Bellhousing und Pilotbohrung'],
    ['flexibles Gummilager', 'Getriebelager']
  ]) {
    assert(bl.includes(nadel), was + ' fehlt im Build Log');
  }
  for (const [nadel, was] of [
    ['Hinterachse aufbocken', 'Vorwaermen'],
    ['Fahrerlager', 'Einfahr-Fahrweise'],
    ['vor Einbau verifizieren', 'Bellhousing-Anweisung'],
    ['nie starr', 'Getriebelager-Anweisung']
  ]) {
    assert(!specs.includes(nadel), was + ' steht wieder in den Spezifikationen');
  }

  // Die Werte dagegen gehoeren auf die Specs-Seite und an den Schritt.
  for (const wert of ['75W90', '2 Quarts']) {
    assert(specs.includes(wert), wert + ' fehlt in den Spezifikationen');
    assert(bl.includes(wert), wert + ' fehlt im Build Log');
  }
});

await test('Specs-Kapitel stehen in einer Gruppe, die zu ihnen passt', async () => {
  // "Offene Validierungen" stand unter "Betrieb". Offene Punkte sind kein
  // Betrieb, sondern Projektstand - und damit weder Spec noch Build.
  //
  // Geprueft werden Kapitel-Kennungen, nicht Nummern: beim Aufloesen der
  // Kapitel 4-6 verschoben sich alle Nummern, und ein Test, der an ihnen
  // haengt, wird dann rot, ohne dass etwas falsch ist.
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  const reihenfolge = [...specs.matchAll(/grp-(\w+)"|<div class="section" id="sec-([\w-]+)"/g)]
    .map((m) => m[1] ? 'GRUPPE:' + m[1] : 'kap:' + m[2])
    // Jeder Trenner steht zweimal im Markup (div und onclick) - Dopplungen weg.
    .filter((x, i, a) => x !== a[i - 1]);

  const nachStand = reihenfolge.slice(reihenfolge.indexOf('GRUPPE:stand') + 1);
  assertEqual(nachStand, ['kap:open'],
    'Gruppe Projektstand enthaelt nicht genau die offenen Punkte: ' + nachStand.join(','));
  const betrieb = reihenfolge.slice(reihenfolge.indexOf('GRUPPE:betrieb') + 1,
                                    reihenfolge.indexOf('GRUPPE:stand'));
  assertEqual(betrieb, ['kap:cooling', 'kap:oil'], 'Gruppe Betrieb: ' + betrieb.join(','));

  // Und keine Gruppe ohne Kapitel: beim Aufloesen von Kapitel 4-6 blieb der
  // Trenner "Montagedaten" als Ueberschrift ins Leere stehen.
  const leer = reihenfolge.filter((x, i) =>
    x.startsWith('GRUPPE:') && (i === reihenfolge.length - 1
                                || reihenfolge[i + 1].startsWith('GRUPPE:')));
  assertEqual(leer, [], 'Gruppe ohne Kapitel: ' + leer.join(','));
});

await test('Das Kuehlsystem zeigt eine Zeichnung, keine Pfeilkette', async () => {
  // Das Kapitel trug eine Zeile "Schnittzeichnung Kuehlkreislauf" und darunter
  // keine Zeichnung, sondern "Pump OUT -> Kuehler -> Filter -> Pump IN" als
  // Text. Die Jerico-Zeichnungen sind nicht mehr zu bekommen: die Domain
  // liefert eine fremde Platzhalterseite, das Webarchiv ist aus diesem Netz
  // nicht erreichbar, und A-01 enthaelt nur das Firmenlogo als Bild. Also
  // eine eigene Darstellung - als solche gekennzeichnet, Quellenklasse D.
  const p = await open('specs.html');
  const r = await p.page.evaluate(() => {
    const sec = document.getElementById('sec-cooling');
    const svg = sec.querySelector('svg');
    if (!svg) return null;
    return {
      titel: svg.querySelector('title') ? svg.querySelector('title').textContent : '',
      beschreibung: svg.querySelector('desc') ? svg.querySelector('desc').textContent : '',
      beschriftet: [...svg.querySelectorAll('text')].map((t) => t.textContent),
      bildrolle: svg.getAttribute('role'),
      benannt: svg.getAttribute('aria-labelledby'),
      unterschrift: sec.querySelector('figcaption').textContent.replace(/\s+/g, ' ')
    };
  });
  await p.close();
  assert(r, 'Keine Zeichnung im Kuehlsystem-Kapitel');

  // Die vier Stationen des Kreislaufs muessen beschriftet sein, sonst ist es
  // Dekoration statt Erklaerung.
  // Ohne Ruecksicht auf Gross-/Kleinschreibung: die Beschriftung heisst
  // "Oelkuehler", nicht "Kuehler".
  const beschriftung = r.beschriftet.join(' | ').toLowerCase();
  ['pumpe', 'kühler', 'filter'].forEach((station) =>
    assert(beschriftung.includes(station),
      'Station fehlt in der Zeichnung: ' + station + ' (vorhanden: ' + r.beschriftet.join(', ') + ')'));
  assert(r.beschriftet.some((t) => t.includes('OUT oben')) && r.beschriftet.some((t) => t.includes('IN unten')),
    'Die Kuehlerlage steht nicht in der Zeichnung');
  assert(r.beschriftet.some((t) => t.includes('LF-100')), 'Die Filternummer fehlt');

  // Zugaenglichkeit: eine Zeichnung ohne Titel und Beschreibung ist fuer
  // einen Screenreader eine leere Flaeche.
  assertEqual(r.bildrolle, 'img', 'SVG ohne role="img"');
  assert(r.benannt && r.titel.length > 10 && r.beschreibung.length > 60,
    'Zeichnung ohne Titel oder Beschreibung');

  // Und sie darf sich nicht als Jerico-Original ausgeben.
  assert(/kein Jerico-Original/.test(r.unterschrift),
    'Die Unterschrift sagt nicht, dass die Zeichnung eine eigene Darstellung ist: ' + r.unterschrift);
  // Die Klasse ist E, nicht mehr D: der Kreis stammt aus dem Befund am Geraet,
  // nicht aus einer Ableitung von A-01 und A-02. A-01 sagt zur Reihenfolge
  // nichts - "cooler", "filter" und "LF-100" kommen dort null Mal vor, A-02
  // ist wegen Subset-Font nicht lesbar. Die vorherige Angabe trug trotzdem
  // Klasse A; dieser Test hielt die Zeichnung bei D fest.
  assert(/\bE\b/.test(r.unterschrift), 'Quellenklasse E fehlt an der Zeichnung');
});

await test('Offene Kuehlsystem-Teile sind eintragbar, nicht festgeschrieben', async () => {
  // Kuehler, Luefter und Leitungslaengen standen als feste Spec-Zeilen da,
  // obwohl die Bestandsaufnahme sie als offen fuehrte - dazu ein Absatz, der
  // erklaerte, dass sie doch nicht gelten. Was Kandidat ist, gehoert in ein
  // Feld.
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  ['p1_cool_kuehler', 'p1_cool_luefter', 'p1_cool_ort', 'p1_hose_1', 'p1_hose_2', 'p1_hose_3']
    .forEach((f) => {
      assert(bl.includes('data-field="' + f + '"'), 'Feld fehlt im Build Log: ' + f);
      assert(specs.includes('data-befund="' + f + '"'), 'Specs zeigen das Feld nicht: ' + f);
    });

  // Der Kuehler-Hinweis stand doppelt - einmal als Vorgabe mit Quelle, einmal
  // als Zitat im Montageschritt. Die Begruendung gehoert an eine Stelle.
  const zitate = (specs + bl).split('cooler is a must').length - 1;
  assertEqual(zitate, 1, 'Das A-02-Zitat zum Kuehler steht ' + zitate + '-mal');
});

await test('Kuehlsystem-Messwerte behalten ihre Feldnamen', async () => {
  // Die Werte haengen am data-field, nicht an der Position. Ein umbenanntes
  // Feld verliert still, was jemand eingetragen hat.
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  for (const f of ['cool_length_base', 'cool_length_pump', 'cool_length_diff',
                   'cool_cooler_product', 'cool_an_size', 'comment_cooling']) {
    const n = (specs.match(new RegExp('data-field="' + f + '"', 'g')) || []).length;
    assertEqual(n, 1, 'Feld ' + f + ' kommt ' + n + ' mal vor, erwartet genau einmal');
  }
});

await test('Nachschlagekarte belegt jede Zeile im Build Log', async () => {
  // Der eigentliche Zweck der Datendatei: die Karte ist eine zweite ANSICHT
  // derselben Werte, keine zweite QUELLE. Bis v18 wurde dafuer gegen
  // specs.html verglichen; seit die Kapitel Anzugsmomente, Schmierstoffe und
  // Kleinteile aufgeloest sind, steht jeder Wert am Schritt im Build Log -
  // also wird dort geprueft.
  //
  // Jede Gruppe nennt neben ihren Zeilen ein Feld 'belege'. Geprueft wird
  // beides: dass jeder Beleg in build-log.html vorkommt, und dass belege und
  // zeilen gleich lang sind. Ohne das Zweite koennten die Listen
  // gegeneinander verrutschen und die erste Pruefung vergliche falsche Paare.
  const p = await open('specs.html');
  const gruppen = await p.page.evaluate(() => REFERENCE.gruppen.map((g) => ({
    id: g.id,
    zeilen: g.zeilen.length,
    belege: g.belege ? g.belege.slice() : null,
    erste: g.zeilen.map((z) => z[0])
  })));
  await p.close();

  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');

  const ohneBelege = gruppen.filter((g) => !g.belege).map((g) => g.id);
  assertEqual(ohneBelege, [], 'Gruppe ohne Belegliste');

  const verrutscht = gruppen.filter((g) => g.belege.length !== g.zeilen)
    .map((g) => g.id + ': ' + g.belege.length + ' Belege zu ' + g.zeilen + ' Zeilen');
  assertEqual(verrutscht, [], 'Belege und Zeilen sind nicht gleich lang');

  const fehlend = [];
  for (const g of gruppen) {
    g.belege.forEach((beleg, i) => {
      // null heisst "steht absichtlich nicht im Build Log" - der Bodendeckel
      // entfaellt bei Top Loader Only. Das ist eine Aussage, kein Versehen,
      // und sie muss im Kartentext auch so stehen.
      if (beleg === null) {
        if (!/entf&auml;llt|entfällt/.test(g.erste[i])) {
          fehlend.push(g.id + ' Zeile ' + (i + 1) + ': null ohne Begruendung in der Zeile');
        }
        return;
      }
      if (!bl.includes(beleg)) {
        fehlend.push(g.id + ' Zeile ' + (i + 1) + ' (' + g.erste[i] + '): "' + beleg + '"');
      }
    });
  }
  assertEqual(fehlend, [],
    'Karte nennt Werte, die im Build Log nicht am Schritt stehen');
});

await test('Anzugsmomente und Schmierstoffe stehen nicht mehr in den Specs', async () => {
  // Sie standen dort als querschnittliche Tabellen - eine zweite Fassung der
  // Werte, die im Build Log am Schritt stehen. gt40 hat solche Kapitel nicht:
  // dort liegt jeder Wert am Bauteil, die Karte ist die Zusammenstellung.
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  ['sec-torque', 'sec-lubes', 'sec-parts'].forEach((id) =>
    assert(!specs.includes('id="' + id + '"'), 'Kapitel steht wieder in den Specs: ' + id));
  // Und die Werte selbst auch nicht - eine Tabelle ohne Kapitel-Kennung waere
  // dieselbe Doublette.
  //
  // Das Glossar brauchte hier bis v21 eine Ausnahme: es ist ein Lexikon, kein
  // Spezifikationskapitel, lag aber als Inline-Markup in der Datei. Seit es in
  // glossar.js liegt, ist die Ausnahme ueberfluessig - specs.html enthaelt
  // keinen Glossartext mehr.
  ['28 lb./ft', '35 &rarr; 60 &rarr; 90', 'Mobil 1 Universal Grease'].forEach((wert) =>
    assert(!specs.includes(wert), 'Wert steht wieder in den Specs: ' + wert));
  // Die Startseite verwies auf die geloeschten Anker.
  const idx = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  ['#sec-torque', '#sec-lubes', '#sec-parts'].forEach((anker) =>
    assert(!idx.includes(anker), 'Startseite verweist auf geloeschten Anker: ' + anker));

  // Und die Startseite fuehrt keine eigenen Wertetabellen mehr: Kernwerte und
  // Werkzeugliste waren die dritte Fassung derselben Angaben, die
  // Arbeitsreihenfolge eine zweite Projektstandsliste neben dem gerechneten
  // Fortschritt. Das Notizfeld daraus musste bleiben - sonst waere der
  // gespeicherte Text auf keiner Seite mehr sichtbar.
  ['sec-todo', 'sec-kern', 'sec-werkzeug'].forEach((id) =>
    assert(!idx.includes('id="' + id + '"'), 'Kapitel steht wieder auf der Startseite: ' + id));
  assert(idx.includes('data-field="comment_todo"'),
    'Das Notizfeld ist mit dem Kapitel verschwunden - gespeicherter Text waere unsichtbar');

  // Das eingefuellte Oel ist ein Befund, keine Vorgabe: Kapitel 5 muss die
  // Felder aus dem Befuellschritt zeigen, nicht nur die Herstellerangabe.
  ['p6_fill_brand', 'p6_fill_amount', 'p6_fill_level', 'p6_fill_date'].forEach((f) =>
    assert(specs.includes('data-befund="' + f + '"'),
      'Kapitel 5 zeigt das eingefuellte Oel nicht: ' + f));
});

await test('Nachschlagekarte ist auf jeder Seite erreichbar', async () => {
  for (const datei of PAGES) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(text.includes('reference.js'), datei + ': reference.js nicht eingebunden');
    assert(text.includes('showReference()'), datei + ': kein Knopf fuer die Karte');
  }
  // Das Overlay entsteht erst beim Oeffnen - es soll nicht in jeder Seite
  // als totes Markup liegen, so wie das Glossar.
  const p = await open('build-log.html');
  const vorher = await p.page.evaluate(() => !!document.getElementById('guide-reference'));
  assertEqual(vorher, false, 'Karte liegt schon vor dem Oeffnen im DOM');
  const offen = await p.page.evaluate(() => {
    showReference();
    const el = document.getElementById('guide-reference');
    return { da: !!el, zeilen: document.querySelectorAll('#guide-reference tr.ref-row').length };
  });
  assert(offen.da, 'Karte wurde nicht gebaut');
  assert(offen.zeilen > 25, 'Karte hat nur ' + offen.zeilen + ' Zeilen');
  await p.close();
});

await test('Uebersetzungsrechner deckt sich mit dem Gear Ratio Chart (A-03)', async () => {
  // Gegen die Chart-Spalte 24/24 geprueft: dort ist der Main Drive 1.000,
  // die Spalte zeigt also das reine Gangradverhaeltnis. Weicht eine Zeile ab,
  // rechnet die Seite mit Zahnradzahlen, die es so nicht gibt.
  const p = await open('specs.html');
  const abweichungen = await p.page.evaluate(() => {
    const soll = {
      g1: [2.267, 2.200, 2.125, 1.941, 1.778, 1.722, 1.684, 1.632, 1.500, 1.429],
      g2: [1.450, 1.400, 1.381, 1.333, 1.286, 1.227],
      g3: [1.182, 1.130, 1.087, 1.042, 1.000, 0.960, 0.920, 0.885]
    };
    const sollMD = [1.450, 1.400, 1.381, 1.333, 1.286, 1.227,
                    1.182, 1.130, 1.087, 1.042, 1.000, 0.960];
    const raus = [];
    for (const [g, liste] of Object.entries(soll)) {
      RATIOS.GANGRAEDER[g].forEach((paar, i) => {
        if (Math.abs(paar[0] / paar[1] - liste[i]) > 0.0015) {
          raus.push(g + ' ' + paar[0] + '/' + paar[1]);
        }
      });
    }
    RATIOS.MAIN_DRIVES.forEach((paar, i) => {
      if (Math.abs(paar[0] / paar[1] - sollMD[i]) > 0.0015) {
        raus.push('MD ' + paar[0] + '/' + paar[1]);
      }
    });
    return raus;
  });
  assertEqual(abweichungen, [], 'Zahnradzahlen weichen von A-03 ab');
  await p.close();
});

await test('Uebersetzungen werden gerechnet und gespeichert, nicht fest hinterlegt', async () => {
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  // Die alte feste Tabelle trug einen Main Drive, der ihre eigenen Ratios
  // nicht erzeugen kann. Sie darf nicht zurueckkommen.
  assert(!/<td>Main Drive<\/td><td>22 \/ 27<\/td>/.test(specs),
    'Die widerspruechliche feste Uebersetzungstabelle steht wieder drin');

  const p = await open('specs.html');
  const vorher = await p.page.evaluate(() => {
    const felder = ['ratio_md', 'ratio_g1', 'ratio_g2', 'ratio_g3']
      .map((f) => document.getElementById(f));
    return {
      alleDa: felder.every((e) => e && e.tagName === 'SELECT' && e.dataset.field),
      md: felder[0].value,
      zeilen: document.querySelectorAll('#ratioErgebnis tbody tr').length,
      ersterGang: document.querySelector('#ratioErgebnis tbody tr td:nth-child(3)').textContent
    };
  });
  assert(vorher.alleDa, 'Nicht alle vier Auswahlfelder sind da');
  assertEqual(vorher.md, '25/24', 'Verbauter Main Drive nicht vorbelegt');
  assertEqual(vorher.zeilen, 4, 'Ergebnistabelle hat nicht vier Gaenge');

  // Eine andere Auswahl muss die Ratios neu rechnen.
  const nachher = await p.page.evaluate(() => {
    const el = document.getElementById('ratio_md');
    el.value = '29/20';
    ratiosGeaendert();
    return document.querySelector('#ratioErgebnis tbody tr td:nth-child(3)').textContent;
  });
  assert(nachher !== vorher.ersterGang,
    'Ratio aendert sich nicht bei anderem Main Drive: ' + nachher);
  // 29/20 x 33/17 = 2.815, der Chart-Wert oben links.
  assertEqual(nachher, '2.815', 'Gerechnete Ratio stimmt nicht mit A-03');
  await p.close();
});

for (const datei of PAGES) {
  await test(datei + ': eine Meldung ist wirklich im Bild', async () => {
    // Die Regel .toast.show fehlte in styles.css. .toast schiebt den Toast
    // 100 px unter den unteren Rand, erst das Zuruecksetzen des transform holt
    // ihn zurueck. Damit war JEDE Meldung unsichtbar - auch "Token
    // ungueltig!" und "Gist konnte nicht erstellt werden". Es sah aus, als
    // passiere beim Verbinden gar nichts.
    //
    // Darum wird hier die Lage gemessen und nicht die Klasse geprueft: ein
    // Test auf classList.contains('show') waere die ganze Zeit gruen gewesen.
    const p = await open(datei);
    const r = await p.page.evaluate(() => {
      showToast('Pruefmeldung');
      const t = document.getElementById('toast');
      const k = t.getBoundingClientRect();
      return {
        klasse: t.classList.contains('show'),
        oben: k.top, unten: k.bottom, hoehe: k.height,
        fensterHoehe: window.innerHeight,
        sichtbar: getComputedStyle(t).visibility,
        deckkraft: parseFloat(getComputedStyle(t).opacity)
      };
    });
    await p.close();

    assert(r.klasse, 'show wurde nicht gesetzt');
    assert(r.hoehe > 10, 'Toast hat keine Hoehe: ' + r.hoehe);
    assert(r.sichtbar !== 'hidden' && r.deckkraft > 0.5,
      'Toast ist unsichtbar: visibility=' + r.sichtbar + ' opacity=' + r.deckkraft);
    assert(r.unten <= r.fensterHoehe + 1,
      'Toast steht unter dem Fensterrand: unten=' + Math.round(r.unten)
      + ' bei Fensterhoehe ' + r.fensterHoehe);
    assert(r.oben >= 0, 'Toast steht ueber dem Fensterrand: oben=' + Math.round(r.oben));
  });
}

await test('jede Klasse, die der Code auf show setzt, hat eine CSS-Regel', async () => {
  // Der Toast flog auf, weil eine einzelne Regel fehlte. Geprueft wird darum
  // nicht nur er: jedes Element, dem der Code 'show' gibt, braucht eine Regel
  // dafuer - sonst passiert sichtbar nichts.
  const css = ['styles.css', 'gallery.css']
    .map((f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')).join('\n');

  const p = await open('index.html');
  const fehlt = await p.page.evaluate((cssText) => {
    // Die Elemente, die im Betrieb 'show' bekommen, mit ihrer tragenden Klasse.
    const traeger = ['toast', 'guide-overlay', 'changelog-overlay',
                     'gallery-overlay', 'photo-lightbox', 'lightbox', 'modal-overlay'];
    return traeger.filter((k) => !cssText.includes('.' + k + '.show'));
  }, css);
  await p.close();

  assertEqual(fehlt, [], 'Klassen ohne .show-Regel im CSS');
});

await test('Der Kuehlkreis steht an einer Stelle, nicht an vier', async () => {
  // Die Reihenfolge stand im Titel und in der Beschreibung der Zeichnung, in
  // deren Beschriftungen, in der Zeile "Reihenfolge" der Spezifikationen und
  // zweimal im Build Log. Vier Kopien - und die erste Fassung war ausserdem
  // falsch und trug trotzdem Klasse A.
  for (const datei of ['specs.html', 'build-log.html']) {
    const html = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(!/Pump OUT/.test(html), datei + ' fuehrt die alte Reihenfolge noch im Markup');
    assert(!/Filter \(LF-100\) &rarr; Pump IN/.test(html), datei + ' hat die alte Kette noch');
  }

  const p = await open('specs.html');
  const r = await p.page.evaluate(() => {
    const reihen = [...document.querySelectorAll('[data-kuehlkreis="reihenfolge"]')]
      .map((e) => e.textContent.trim());
    const bild = document.getElementById('kuehlkreisBild');
    const svg = bild ? bild.querySelector('svg') : null;
    return {
      reihen: reihen,
      ausDaten: KUEHLKREIS.alsText(),
      anschluesse: KUEHLKREIS.anschluesse(),
      svgDa: !!svg,
      desc: svg ? svg.querySelector('desc').textContent : '',
      // Jede Station muss in der Zeichnung auch beschriftet sein.
      fehlend: KUEHLKREIS.STATIONEN
        .filter((st) => !(svg && svg.textContent.includes(st.name)))
        .map((st) => st.name)
    };
  });
  await p.close();

  assert(r.svgDa, 'Die Zeichnung wird nicht erzeugt');
  assert(r.reihen.length >= 1, 'Keine Reihenfolge-Stelle auf der Seite');
  r.reihen.forEach((t) => assertEqual(t, r.ausDaten,
    'Angezeigte Reihenfolge weicht von den Daten ab'));
  assertEqual(r.fehlend, [], 'Stationen ohne Beschriftung in der Zeichnung');
  assert(r.desc.includes(r.anschluesse),
    'Die Bildbeschreibung nennt eine andere Anschlussfolge als die Daten: ' + r.desc);
});

await test('Der Kuehlkreis folgt dem Befund am Geraet, mit richtiger Quellenklasse', async () => {
  // A-01 sagt zur Reihenfolge nichts: "cooler", "filter" und "LF-100" kommen
  // im maschinell ausgelesenen Text null Mal vor, A-02 ist nicht lesbar. Die
  // alte Angabe trug trotzdem Klasse A - eine erfundene Zuschreibung.
  const p = await open('specs.html');
  const r = await p.page.evaluate(() => {
    const kette = KUEHLKREIS.anschluesse();
    const zeile = document.querySelector('[data-kuehlkreis="reihenfolge"]');
    const wert = zeile ? zeile.closest('.spec-value') : null;
    return {
      kette: kette,
      klasse: wert ? (wert.querySelector('.src') || {}).className || '' : '',
      luefter: (document.querySelector('[data-kuehlkreis="luefter"]') || {}).textContent || ''
    };
  });
  await p.close();

  // Die Reihenfolge des Befunds: Ablass, Filter, Pumpe, Thermostat, Kuehler.
  const erwartet = ['Ölablass', 'zur Pumpe', 'Pumpe OUT', 'Kühler IN (unten)', 'Kühler OUT (oben)'];
  erwartet.forEach((t) => assert(r.kette.includes(t), 'Fehlt in der Kette: ' + t));
  const posFilter = r.kette.indexOf('zur Pumpe');
  const posOut = r.kette.indexOf('Pumpe OUT');
  assert(posFilter < posOut, 'Der Filter liegt nicht vor der Pumpe - alte Reihenfolge');
  assert(/src-e/.test(r.klasse),
    'Die Reihenfolge traegt nicht Klasse E, sondern: ' + r.klasse);
  assert(/Ventilator/.test(r.luefter), 'Das zweite Thermostat wird nicht genannt: ' + r.luefter);
});

await test('PS werden mit dem PS-Teiler gerechnet, nicht mit dem fuer hp', async () => {
  // Der Code teilte durch 7121. Das ist der Teiler fuer hp; beschriftet wird
  // aber PS. Die Kurve ist fuer PS gebaut - sie erreicht damit 349,8 PS und
  // passt zu den 350 PS (257 kW) der Seite; mit 7121 kamen 345,0 heraus, also
  // 1,4 % zu wenig.
  const pc = fs.readFileSync(path.join(REPO_ROOT, 'perf-charts.js'), 'utf8');
  const code = pc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert(!/\/\s*7121/.test(code), 'Der hp-Teiler 7121 steht wieder im Code');

  const p = await open('performance.html');
  const r = await p.page.evaluate(() => {
    // Gegen die Definition rechnen, nicht gegen eine zweite Konstante im Test:
    // 1 PS = 75 kgf*m/s = 75 * 9,80665 W, P = M * 2*pi*n/60.
    const soll = (nm, rpm) => nm * rpm * 2 * Math.PI / 60 / 735.49875;
    const zeile = document.getElementById('perfAnnahmeLeistung').textContent;
    return { zeile: zeile, soll520: soll(520, 4000) };
  });
  await p.close();

  const ps = parseInt(r.zeile.match(/(\d+)\s*PS/)[1], 10);
  const erwartet = Math.round(r.soll520);
  assert(Math.abs(ps - 350) <= 1,
    'Nennleistung weicht von den 350 PS der Seite ab: ' + ps + ' (' + r.zeile + ')');
  assert(ps > erwartet, 'Spitzenleistung liegt nicht ueber der Leistung am Drehmomentgipfel');
});

await test('die Annahme-Zeilen kommen aus der Kurve, nicht aus dem Markup', async () => {
  // Sie standen als Zahlen im Markup - dieselbe Angabe an zwei Orten. Und
  // schon auseinandergelaufen: die Seite nannte ~5200/min, die Kurve erreicht
  // ihre Spitze bei 5250.
  const html = fs.readFileSync(path.join(REPO_ROOT, 'performance.html'), 'utf8');
  const kopf = html.slice(0, html.indexOf('id="sec-setups"'));
  ['350 PS', '520 Nm', '384 lb-ft', '5200/min'].forEach((z) => {
    assert(!kopf.includes(z), 'Feste Zahl im Markup: ' + z);
  });

  const p = await open('performance.html');
  const r = await p.page.evaluate(() => ({
    leistung: document.getElementById('perfAnnahmeLeistung').textContent.trim(),
    drehmoment: document.getElementById('perfAnnahmeDrehmoment').textContent.trim()
  }));
  await p.close();

  assert(/\d+ PS/.test(r.leistung) && /\d+\/min/.test(r.leistung),
    'Nennleistung nicht gerendert: ' + r.leistung);
  assert(/520 Nm/.test(r.drehmoment) && /4000\/min/.test(r.drehmoment),
    'Drehmoment nicht aus der Kurve: ' + r.drehmoment);
});

await test('die Leistungsseite rechnet mit der Auswahl, nicht mit festen Werten', async () => {
  // Die widerlegten Ratios standen ein zweites Mal fest in perf-charts.js.
  // Dass Kapitel 2 rechnete, half nichts - die Diagramme taten es nicht.
  const pc = fs.readFileSync(path.join(REPO_ROOT, 'perf-charts.js'), 'utf8');
  const code = pc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ['2.588', '1.714', '1.182'].forEach((z) => {
    assert(!code.includes(z), 'Die widerlegte Ratio ' + z + ' steht wieder im Code');
  });

  const p = await open('performance.html');
  const r = await p.page.evaluate(() => {
    const zahl = (s) => parseFloat(String(s).replace(/[^0-9.]/g, ''));
    const zeilen = () => [...document.querySelectorAll('#perfVergleich tbody tr')]
      .map((tr) => [...tr.cells].map((td) => td.textContent.trim()));

    const vorher = zeilen();
    // Andere Achse: alle Geschwindigkeiten muessen sich aendern, die
    // Drehzahlen nach dem Schalten nicht - die haengen nur an den Ratios.
    const achse = document.querySelector('[data-field="perf_achse"]');
    achse.value = '4.11';
    achse.dispatchEvent(new Event('input'));
    const nachAchse = zeilen();

    achse.value = '3.50';
    achse.dispatchEvent(new Event('input'));
    // Setup B einschalten und laenger machen.
    document.getElementById('ratio_b_aktiv').checked = true;
    document.getElementById('ratio_b_md').value = '29/20';
    document.getElementById('ratio_b_g1').value = '34/15';
    ratiosGeaendert();
    const mitB = zeilen();

    return {
      vorherZeilen: vorher.length,
      tempoVorher: zahl(vorher[0][1]),
      tempoAchse: zahl(nachAchse[0][1]),
      drehzahlVorher: zahl(vorher[0][2]),
      drehzahlAchse: zahl(nachAchse[0][2]),
      mitBZeilen: mitB.length,
      namen: mitB.map((z) => z[0]),
      tempoB: zahl(mitB[1][1]),
      schalterTexte: [...document.querySelectorAll('.gearbox-toggles')]
        .map((e) => e.querySelectorAll('input[type=checkbox]').length)
    };
  });
  await p.close();

  assertEqual(r.vorherZeilen, 3, 'Ohne Setup B gehoeren drei Zeilen in die Tabelle');
  // 25/24 x 33/17 = 2.022; bei 6000/min, 2.13 m, Achse 3.50 sind das 108 km/h.
  assertEqual(r.tempoVorher, 108, 'Geschwindigkeit im 1. Gang mit Achse 3.50');
  // Mit 4.11 statt 3.50: 108 x 3.50/4.11 = 92.
  assertEqual(r.tempoAchse, 92, 'Die Achsuebersetzung wirkt nicht auf die Geschwindigkeit');
  assertEqual(r.drehzahlVorher, r.drehzahlAchse,
    'Die Achse darf die Drehzahl nach dem Schalten nicht veraendern');

  assertEqual(r.mitBZeilen, 4, 'Mit Setup B gehoeren vier Zeilen in die Tabelle');
  assert(r.namen[1].indexOf('Vergleich') !== -1,
    'Setup B steht nicht als zweite Zeile: ' + r.namen.join(' | '));
  // 29/20 x 34/15 = 3.287 -> 6000/min ergibt 67 km/h.
  assertEqual(r.tempoB, 67, 'Setup B rechnet nicht mit der eigenen Auswahl');
  assert(r.schalterTexte.every((n) => n === 4),
    'Nicht jeder Diagrammblock hat vier Umschalter: ' + r.schalterTexte.join(','));
});

await test('die Startseite nennt die gerechneten Uebersetzungen', async () => {
  // Der Steckbrief trug "2.588 / 1.714 / 1.182 / 1.000 - Main Drive 22/27"
  // fest im Markup: der Widerspruch stand eine Seite neben seiner Aufloesung.
  const idx = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  assert(!idx.includes('2.588'), 'Die widerlegten Ratios stehen wieder im Markup');
  const p = await open('index.html');
  const txt = await p.page.evaluate(() => {
    const el = document.getElementById('ratioKurz');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  await p.close();
  assert(txt, 'Kein #ratioKurz im Steckbrief');
  assert(txt.indexOf('2.022 / 1.339 / 1.042 / 1.000') === 0,
    'Steckbrief zeigt: ' + txt);
  assert(txt.includes('25/24'), 'Der Main Drive fehlt: ' + txt);
});

await test('Kardanwelle: ein Verfahren, nicht sieben Mahnungen', async () => {
  // Der Hinweis "messen, nicht rechnen" stand an sieben Stellen und nannte
  // nirgends das Verfahren. Geprueft wird die Anweisung, nicht das Stichwort:
  // ein Verweis auf den Schritt darf bleiben, die Handgriffe gehoeren dorthin.
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');

  assert(/id="p6_driveshaft_card"/.test(bl), 'Der Messschritt fehlt');
  // Die drei Angaben, ohne die die Messung falsch wird.
  assert(bl.includes('h&auml;ngende Achse'),
    'Der wichtigste Fehler - haengende Achse - ist nicht benannt');
  assert(/3\/4&quot; bis 1&quot;/.test(bl), 'Die Einschubreserve des Slip Yoke fehlt');
  assert(bl.includes('Mitte Kreuzgelenk vorn bis Mitte Kreuzgelenk hinten'),
    'Die Messstrecke ist nicht benannt');
  // Und die beiden Gegenproben.
  assert(bl.includes('Gegenprobe durch Einfedern') && bl.includes('Gegenprobe durch Ausfedern'),
    'Die Gegenproben gegen Aufsetzen und zu wenig Spline-Eingriff fehlen');
  ['p6_ds_length', 'p6_ds_length2', 'p6_ds_yoke_out', 'p6_ds_spline', 'p6_ds_pinion']
    .forEach((f) => assert(bl.includes('data-field="' + f + '"'), 'Messfeld fehlt: ' + f));

  // In den Specs steht die Mahnung nur noch einmal je Ort, mit Verweis.
  const mahnungen = (specs.match(/messen, nicht rechnen/g) || []).length;
  assertEqual(mahnungen, 0, 'Die Mahnung steht noch in den Specs statt des Verweises');
  assert(specs.includes('build-log.html#p6_driveshaft_card'),
    'Die Specs verweisen nicht auf das Verfahren');

  const p = await open('build-log.html');
  const nummern = await p.page.evaluate(() => {
    const phase = document.getElementById('phase6body');
    return [...phase.querySelectorAll('.step-title')].map((e) => parseInt(e.textContent, 10));
  });
  await p.close();
  assertEqual(nummern, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    'Phase 6 ist nicht lueckenlos durchnummeriert: ' + nummern.join(','));
});

await test('Spezifikationswerte folgen der Eingabe im Build Log', async () => {
  // In den Specs stand "26 Spline - Validierung ausstehend" als fester Text,
  // waehrend im Build Log das Feld p1_spline_count danebenlag. Wer abzaehlte
  // und eintrug, sah dieselbe Vorbelegung und dieselbe Warnung: die Eingabe
  // hatte keine Wirkung. Geprueft wird beides - der offene Zustand nennt den
  // Weg nach vorn, der ermittelte zeigt den eingetragenen Wert.
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  assert(!/26 Spline &ndash; &#9888; Validierung ausstehend/.test(specs),
    'Der feste Spline-Text steht wieder in den Specs');

  const p = await open('specs.html');

  const offen = await p.page.evaluate(() => {
    const el = document.querySelector('[data-befund="p1_spline_count"]');
    return el ? { text: el.textContent.replace(/\s+/g, ' ').trim(), zustand: el.dataset.zustand } : null;
  });
  assert(offen, 'Keine gebundene Anzeige fuer p1_spline_count');
  assertEqual(offen.zustand, 'offen', 'Ohne Eingabe muesste der Zustand offen sein');
  assert(offen.text.includes('Vorgabe 26'), 'Die Vorgabe fehlt: ' + offen.text);
  assert(offen.text.includes('im Build Log eintragen'),
    'Der offene Zustand nennt keinen Weg nach vorn: ' + offen.text);
  // Die Einheit gehoert an den Messwert, nicht an die Vorgabe - sonst stand
  // dort "22" / 56 cm (Sekundaerquelle) mm". Geprueft wird gegen die
  // Attribute, nicht gegen ein geratenes Textmuster: die erste Fassung dieses
  // Tests suchte /cm\)? mm/ und traf die Stelle nicht, weil vor dem " mm" ein
  // ")" stand. Sie war damit wertlos - die Gegenprobe hat es gezeigt.
  const laenge = await p.page.evaluate(() => {
    const el = document.querySelector('[data-befund="p1_len_total"]');
    if (!el) return null;
    return {
      text: el.textContent.replace(/\s+/g, ' ').trim(),
      vorgabe: el.dataset.vorgabe,
      einheit: el.dataset.einheit
    };
  });
  assert(laenge && laenge.einheit, 'Kein Laengenfeld mit Einheit zum Pruefen');
  // Die Vorgabe muss unmittelbar vor dem Weg nach vorn enden. Steht die
  // Einheit dazwischen, ist sie an die falsche Stelle geraten.
  const nachVorgabe = laenge.text.split('Vorgabe ' + laenge.vorgabe.replace('&quot;', '"'))[1] || '';
  assert(!nachVorgabe.trim().startsWith(laenge.einheit),
    'Einheit haengt an der Vorgabe: ' + laenge.text);

  // Jetzt eintragen - und zwar einen anderen Wert als die Vorbelegung, sonst
  // laesst sich nicht unterscheiden, ob die Anzeige rechnet oder raet.
  const ermittelt = await p.page.evaluate(() => {
    renderBefunde({ p1_spline_count: '24', p1_yoke_count: '31' });
    const lies = (f) => {
      const el = document.querySelector('[data-befund="' + f + '"]');
      return { text: el.textContent.replace(/\s+/g, ' ').trim(), zustand: el.dataset.zustand };
    };
    return { spline: lies('p1_spline_count'), yoke: lies('p1_yoke_count') };
  });
  await p.close();

  assertEqual(ermittelt.spline.zustand, 'ermittelt', 'Eingetragener Wert bleibt offen');
  assert(ermittelt.spline.text.indexOf('24 Spline') === 0,
    'Specs zeigen nicht den eingetragenen Wert: ' + ermittelt.spline.text);
  assert(!ermittelt.spline.text.includes('Vorgabe'),
    'Die Vorgabe steht noch daneben: ' + ermittelt.spline.text);
  assert(!ermittelt.spline.text.includes('offen'),
    'Die Warnung bleibt trotz Eingabe stehen: ' + ermittelt.spline.text);
  assert(/\bB$/.test(ermittelt.spline.text),
    'Quellenklasse wechselt nicht auf B (Ist-Befund): ' + ermittelt.spline.text);
  assert(ermittelt.yoke.text.indexOf('31 Tooth') === 0,
    'Yoke zeigt nicht 31, sondern: ' + ermittelt.yoke.text);
});

await test('Baureihe, Bauart und Aufbau sind waehlbar, nicht festgeschrieben', async () => {
  // In den Specs stand "Road Race, Revision 2 (Dog Ring Low) - Jerico-
  // Baureihenbezeichnung Oval/Road Race" als Satz, und "Tex Racing Ent. Inc."
  // ebenso. Beides laesst sich am Getriebe ablesen, also wird es ausgewaehlt
  // und eingetragen - A-01 nennt die Baureihen, und die Zerlegesequenz haengt
  // daran.
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  assert(!/Jerico-Baureihenbezeichnung/.test(specs),
    'Der feste Typ-Satz steht wieder in den Specs');
  assert(!/>Tex Racing Ent. Inc. \(Aufkleber/.test(specs),
    'Der Aufbauer steht wieder als fester Text');

  const p = await open('build-log.html');
  const felder = await p.page.evaluate(() => {
    const sel = (f) => {
      const el = document.querySelector('select[data-field="' + f + '"]');
      return el ? [...el.options].map((o) => o.value || o.text).filter(Boolean) : null;
    };
    return {
      familie: sel('p1_typ_familie'),
      gehaeuse: sel('p1_typ_gehaeuse'),
      rev: sel('p1_typ_rev'),
      aufbau: !!document.querySelector('input[data-field="p1_aufbau"]')
    };
  });
  await p.close();

  assert(felder.familie, 'Keine Auswahl fuer die Baureihe');
  // Die vier Baureihen, die A-01 nennt - nicht erfundene.
  ['Top & Bottom Loader Road Race', 'Winston Cup', 'Clutch-assisted Drag Race', 'Endurance']
    .forEach((b) => assert(felder.familie.some((x) => x.indexOf(b.split(' ')[0]) === 0 || x === b),
      'Baureihe fehlt in der Auswahl: ' + b + ' (vorhanden: ' + felder.familie.join(' | ') + ')'));
  assert(felder.gehaeuse && felder.gehaeuse.length >= 3, 'Keine Auswahl fuer die Gehaeusebauart');
  assert(felder.rev && felder.rev.length >= 2, 'Keine Auswahl fuer die Ausfuehrung');
  assert(felder.aufbau, 'Kein Eingabefeld fuer den Aufbauer');

  // Und die Specs zeigen, was gewaehlt wurde.
  const sp = await open('specs.html');
  const gezeigt = await sp.page.evaluate(() => {
    renderBefunde({ p1_typ_familie: 'Winston Cup', p1_aufbau: 'Jerico Performance' });
    const lies = (f) => document.querySelector('[data-befund="' + f + '"]').textContent
      .replace(/\s+/g, ' ').trim();
    return { familie: lies('p1_typ_familie'), aufbau: lies('p1_aufbau') };
  });
  await sp.close();
  assert(gezeigt.familie.indexOf('Winston Cup') === 0,
    'Specs zeigen nicht die gewaehlte Baureihe: ' + gezeigt.familie);
  assert(gezeigt.aufbau.indexOf('Jerico Performance') === 0,
    'Specs zeigen nicht den eingetragenen Aufbauer: ' + gezeigt.aufbau);
});

await test('eine abweichende Seriennummer wird gemeldet', async () => {
  // Steht am Gehaeuse eine andere Nummer als die dokumentierte, liegt ein
  // anderes Getriebe auf der Werkbank als das, was diese Seiten beschreiben.
  // Das darf nicht still durchgehen - dafuer ist data-abweichung="warnen" da.
  const p = await open('specs.html');
  const r = await p.page.evaluate(() => {
    const lies = () => {
      const el = document.querySelector('[data-befund="p1_case_number"]');
      return { text: el.textContent.replace(/\s+/g, ' ').trim(), zustand: el.dataset.zustand };
    };
    renderBefunde({ p1_case_number: 'RH02374' });
    const gleich = lies();
    renderBefunde({ p1_case_number: 'RH09999' });
    const anders = lies();
    renderBefunde({ p1_case_number: ' rh02374 ' });
    const schreibweise = lies();
    return { gleich: gleich, anders: anders, schreibweise: schreibweise };
  });
  await p.close();

  assertEqual(r.gleich.zustand, 'ermittelt', 'Die dokumentierte Nummer darf nicht warnen');
  assert(!r.gleich.text.includes('weicht'), 'Warnung bei passender Nummer: ' + r.gleich.text);
  assertEqual(r.anders.zustand, 'abweichend', 'Abweichende Nummer wird nicht gemeldet');
  assert(r.anders.text.includes('weicht von der dokumentierten RH02374 ab'),
    'Die Meldung nennt die dokumentierte Nummer nicht: ' + r.anders.text);
  // Gross-/Kleinschreibung und Leerzeichen sind keine Abweichung.
  assertEqual(r.schreibweise.zustand, 'ermittelt',
    'Andere Schreibweise wird als Abweichung gemeldet: ' + r.schreibweise.text);
});

await test('Ausruecklager und Schaltgestaenge nennen ein Verfahren', async () => {
  // Beide standen in den Specs nur als Mahnung - "Typ und Retainer-Durchmesser
  // noch zu klaeren", "Bohrmuster Jerico != Toploader, Anpassung noetig" - und
  // nirgends, wie man es ermittelt.
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');

  assert(/id="p1_clutch_card"/.test(bl), 'Schritt zum Ausruecklager fehlt');
  assert(/id="p1_shifter_card"/.test(bl), 'Schritt zum Schaltgestaenge fehlt');

  // Ausruecklager: die zwei Messungen, die die Entscheidung tragen, und das
  // Toleranzfenster des hydraulischen Falls.
  assert(bl.includes('F&uuml;hrungsrohr'), 'Das Fuehrungsrohr ist nicht benannt');
  assert(/0,100&quot; bis 0,250&quot;/.test(bl),
    'Das Fenster fuer Mass A minus B fehlt');
  assert(bl.includes('Oberkante der Druckplattenfinger'),
    'Der Messpunkt fuer Mass A fehlt');
  ['p1_tob_retainer_od', 'p1_tob_bore', 'p1_tob_dim_a', 'p1_tob_dim_b']
    .forEach((f) => assert(bl.includes('data-field="' + f + '"'), 'Messfeld fehlt: ' + f));

  // Schaltgestaenge: die Primaerquelle sagt, dass vor dem Deckel eingestellt
  // wird. Das ist die Anweisung, die man sonst zu spaet erfaehrt.
  assert(bl.includes('Einstellen geh&ouml;rt vor den Deckel'),
    'Der Hinweis aus A-01 zum Einstellen vor dem Top Cover fehlt');
  assert(bl.includes('14,5&quot; und 25&quot;'), 'Der Bereich der Aufnahmepositionen fehlt');
  ['p1_sh_tunnel', 'p1_sh_position', 'p1_sh_muster', 'p1_sh_freigang']
    .forEach((f) => assert(bl.includes('data-field="' + f + '"'), 'Messfeld fehlt: ' + f));

  // Und die Specs mahnen nicht mehr, sondern binden an die Felder.
  assert(!/noch zu kl&auml;ren/.test(specs), 'Die Mahnung zum Ausruecklager steht noch');
  assert(!/Anpassung n&ouml;tig/.test(specs), 'Die Mahnung zum Schaltgestaenge steht noch');

  const p = await open('build-log.html');
  const nummern = await p.page.evaluate(() => {
    const phase = document.getElementById('phase1body');
    return [...phase.querySelectorAll('.step-title')].map((e) => parseInt(e.textContent, 10));
  });
  await p.close();
  assertEqual(nummern, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'Phase 1 ist nicht lueckenlos durchnummeriert: ' + nummern.join(','));
});

await test('Gezaehlte Zaehne und gewaehltes Paar werden abgeglichen', async () => {
  // Es gab zwei Eingaben fuer dieselbe Sache: die gezaehlte Zahl im Build Log
  // und das gewaehlte Paar in den Spezifikationen. Sie sprachen nicht
  // miteinander - wer 33/17 zaehlte und 34/16 anklickte, bekam keinen Hinweis.
  // Jetzt steht die Auswahl im Zaehlschritt selbst, und die zweite Eingabe ist
  // eine Gegenprobe statt Doppelarbeit.
  const p = await open('build-log.html');
  const r = await p.page.evaluate(() => {
    const lies = () => document.getElementById('ratioAbgleich').textContent.replace(/\s+/g, ' ').trim();
    const setze = (f, v) => {
      const el = document.querySelector('[data-field="' + f + '"]');
      el.value = v;
      // bubbles: true, weil der Abgleich am Dokument lauscht - so wie eine
      // echte Tastatureingabe. Ohne das sieht er das Ereignis nie, und der
      // Test pruefte nichts.
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const waehle = (f, v) => { document.getElementById(f).value = v; ratiosGeaendert(); };

    const auswahlDa = [...document.querySelectorAll('#ratioWahl select')]
      .map((s) => s.dataset.field);

    setze('p3_md_cluster', '25'); setze('p3_md_input', '24');
    const stimmig = lies();

    setze('p3_g1_zaehne', '33/17'); waehle('ratio_g1', '34/16');
    const abweichend = lies();

    setze('p3_g2_zaehne', '99/11');
    const nichtImChart = lies();

    waehle('ratio_g1', '33/17'); setze('p3_g2_zaehne', '27/21');
    const wiederStimmig = lies();

    return { auswahlDa, stimmig, abweichend, nichtImChart, wiederStimmig };
  });
  await p.close();

  // Die Auswahl steht im Zaehlschritt, nicht nur in den Spezifikationen.
  assertEqual(r.auswahlDa, ['ratio_md', 'ratio_g1', 'ratio_g2', 'ratio_g3'],
    'Die Auswahl fehlt im Zaehlschritt');
  assertEqual(r.stimmig, '', 'Bei uebereinstimmender Zaehlung darf nichts gemeldet werden');
  assert(/1\. Gang: gez&auml;hlt 33\/17, ausgew&auml;hlt 34\/16/.test(r.abweichend)
      || /1\. Gang: gezählt 33\/17, ausgewählt 34\/16/.test(r.abweichend),
    'Die Abweichung wird nicht gemeldet: ' + r.abweichend);
  assert(/99\/11 steht nicht im Chart/.test(r.nichtImChart),
    'Eine Paarung ausserhalb des Charts wird nicht gemeldet: ' + r.nichtImChart);
  assertEqual(r.wiederStimmig, '', 'Die Meldung bleibt stehen, nachdem es wieder stimmt');
});

await test('kein Wert hat zwei Eingabefelder', async () => {
  // Es gab drei Paare: spec_spline_count neben p1_spline_count,
  // spec_yoke_count neben p1_yoke_count, spec_case_material neben
  // p1_case_material - und p6_tob_type neben p1_tob_type. Wer in das falsche
  // tippte, sah keine Wirkung. Genau der Befund, der diese Pruefung ausgeloest
  // hat.
  const paare = [
    ['spec_spline_count', 'p1_spline_count'],
    ['spec_yoke_count', 'p1_yoke_count'],
    ['spec_case_material', 'p1_case_material'],
    ['p6_tob_type', 'p1_tob_type']
  ];
  const roh = PAGES.map((d) => fs.readFileSync(path.join(REPO_ROOT, d), 'utf8')).join('\n');
  paare.forEach(([alt, neu]) => {
    assert(!roh.includes('data-field="' + alt + '"'),
      'Das abgeloeste Feld hat wieder ein Eingabefeld: ' + alt);
    assert(roh.includes('data-field="' + neu + '"'),
      'Das verbleibende Feld fehlt: ' + neu);
    // Der alte Name muss als Rueckfall erhalten bleiben, sonst waere ein
    // bereits eingetragener Wert unsichtbar.
    assert(roh.includes('data-alt="' + alt + '"'),
      'Kein Rueckfall auf den frueheren Feldnamen: ' + alt);
  });

  // Und allgemein: kein data-field steht zweimal als Eingabe auf derselben
  // Seite - das waere dieselbe Falle innerhalb einer Seite.
  for (const datei of PAGES) {
    const s = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    const felder = [...s.matchAll(/<(?:input|select|textarea)[^>]*data-field="([^"]+)"/g)]
      .map((m) => m[1]);
    const doppelt = felder.filter((f, i) => felder.indexOf(f) !== i);
    assertEqual([...new Set(doppelt)], [], datei + ': Feld zweimal als Eingabe');
  }
});

await test('Zaehne zaehlen steht als Schritt im Build Log', async () => {
  // Der Main Drive laesst sich nicht durch Drehen messen - im 4. Gang ist das
  // Getriebe direkt. Dass das dasteht, ist der Kern der Anleitung.
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  const specs = fs.readFileSync(path.join(REPO_ROOT, 'specs.html'), 'utf8');
  assert(/id="p3_ratios_card"/.test(bl), 'Schritt zum Zaehlen fehlt');
  assert(bl.includes('Durch Drehen geht es nicht'),
    'Der Hinweis, dass Drehen den Main Drive nicht liefert, fehlt');
  assert(bl.includes('Zweimal z&auml;hlen'), 'Die Zweitzaehlung fehlt');
  // Beide Seiten verweisen aufeinander: Werte hier, Handgriff dort.
  assert(bl.includes('specs.html#sec-ratios'), 'Build Log verweist nicht auf den Rechner');
  assert(specs.includes('build-log.html#p3_ratios_card'),
    'Specs verweisen nicht auf die Zaehlanleitung');

  const p = await open('build-log.html');
  const nummern = await p.page.evaluate(() => {
    const phase = document.getElementById('phase3body');
    return [...phase.querySelectorAll('.step-title')]
      .map((e) => parseInt(e.textContent, 10));
  });
  await p.close();
  assertEqual(nummern, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'Phase 3 ist nicht lueckenlos durchnummeriert: ' + nummern.join(','));
});

await test('sw.js listet nur Dateien, die es gibt', async () => {
  const sw = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
  const urls = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  assert(urls.length > 5, 'Dateiliste im Service Worker sieht leer aus');
  for (const rel of urls) {
    if (!rel) continue;   // der Ordner selbst
    assert(fs.existsSync(path.join(REPO_ROOT, rel)), 'fehlt im Repo: ' + rel);
  }
});

await test('sw.js cacht jede Seite', async () => {
  // Die Gegenrichtung zum Test darueber: eine neue Seite, die nicht in der
  // Liste steht, ist offline nicht erreichbar - und das faellt erst in der
  // Werkstatt ohne Empfang auf.
  const sw = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
  for (const seite of PAGES) {
    assert(sw.includes("'./" + seite + "'"), seite + ' fehlt in urlsToCache');
  }
});

await test('search.js sucht nur in Seiten, die es gibt', async () => {
  // Die Liste stammte aus dem Motor-Projekt und zeigte auf dessen docs/-Seiten.
  // Jede Suche loeste sechs 404 aus, still in der Konsole.
  const js = fs.readFileSync(path.join(REPO_ROOT, 'search.js'), 'utf8');
  const urls = [...js.matchAll(/\{\s*url:\s*'([^']+)'/g)].map((m) => m[1]);
  assert(urls.length > 1, 'Seitenliste in search.js sieht leer aus');
  for (const rel of urls) {
    assert(fs.existsSync(path.join(REPO_ROOT, rel)), 'search.js verweist auf fehlende Datei: ' + rel);
  }
  assertEqual(urls.slice().sort(), PAGES.slice().sort());
});

await test('Jede Quelle laesst sich speichern, nicht nur oeffnen', async () => {
  // In der installierten PWA gibt es bei Links im eigenen Scope keinen
  // Zurueck-Knopf, nur die Wischgeste vom Bildschirmrand. Wer eine Quelle
  // oeffnet, verliert die Seite samt eingetragener Messwerte aus dem Blick.
  // Eine PDF im Rahmen anzuzeigen hilft nicht - Safari auf iOS zeigt dort
  // nur die erste Seite. Der Weg, der traegt, ist ein zweites Fenster:
  // speichern, dann per Split View daneben legen.
  const idx = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const quellen = ['A-01-jerico-assembly-manual.pdf', 'A-02-jerico-breakin-sheet.pdf',
                   'A-03-jerico-4speed-chart.pdf'];
  quellen.forEach((datei) => {
    assert(idx.includes('href="docs/quellen/' + datei + '" download'),
      'Quelle ohne Speichern-Link: ' + datei);
    // Und die Datei muss es geben - ein Speichern-Link ins Leere ist schlimmer
    // als keiner.
    assert(fs.existsSync(path.join(REPO_ROOT, 'docs/quellen', datei)),
      'Verlinkte Quelle fehlt im Repository: ' + datei);
  });
  assert(/Split View/.test(idx),
    'Der Hinweis, wozu das Speichern dient, fehlt');

  // Eine eigene HTML-Seite ausserhalb der vier Hauptseiten braucht einen
  // Rueckweg im Dokument selbst - dort greift kein Browserknopf.
  const diagramme = fs.readFileSync(path.join(REPO_ROOT, 'docs/jerico-diagrams.html'), 'utf8');
  assert(/Zur(ue|&uuml;)ck/.test(diagramme) && /href="\.\.\/index\.html"|href="\.\.\/"/.test(diagramme),
    'Die Diagrammseite hat keinen Weg zurueck in die App');
});

await test('Service Worker und Manifest kommen ohne absolute Pfade aus', async () => {
  // GitHub Pages unterscheidet Gross- und Kleinschreibung im Pfad. Ein
  // absoluter Pfad mit dem Repo-Namen ist damit eine Fehlerquelle, die erst
  // auf der veroeffentlichten Seite auffaellt - und dort den Offline-Betrieb
  // komplett aushebelt.
  for (const datei of ['sw.js', 'manifest.json']) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    const treffer = text.match(/["']\/[A-Za-z0-9._-]+\//g) || [];
    assertEqual(treffer, [], datei + ' enthaelt absolute Pfade');
  }
});

// ---------------------------------------------------------------------------
suite('Seitengeruest');

for (const file of PAGES) {
  await test(file + ': laedt ohne Javascript-Fehler', async () => {
    const p = await open(file);
    assertEqual(p.errors, [], 'Fehler auf ' + file);
    await p.close();
  });

  await test(file + ': Version und Freigabezeitpunkt stehen im Titelblock', async () => {
    // Beide getrennt: die Nummer sagt, welcher Stand das ist, der Zeitstempel,
    // ob ein Geraet ihn schon geladen hat. In einem Element liesse sich das
    // nicht unterschiedlich gewichten.
    const p = await open(file);
    const shown = await p.page.evaluate(() => {
      const v = document.getElementById('appVersion');
      const b = document.querySelector('.header-title .ht-built');
      const m = document.querySelector('.menu-version .app-built');
      if (!v) return null;
      return {
        version: v.textContent.trim(),
        gebaut: b ? b.textContent.trim() : null,
        tip: b ? b.title : '',
        menue: m ? m.textContent.trim() : null,
        imTitel: !!v.closest('.header-title')
      };
    });
    assert(shown, 'Kein #appVersion auf ' + file);
    assert(/^v\d+$/.test(shown.version), 'Version sieht falsch aus: ' + shown.version);
    assert(shown.imTitel, 'Version steht nicht im Titelblock');
    assert(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(shown.gebaut),
      'Freigabezeitpunkt fehlt oder sieht falsch aus: ' + shown.gebaut);
    assertEqual(shown.menue, shown.gebaut, 'Menue und Kopfzeile zeigen Verschiedenes');
    assert(/^Freigegeben \d{4}-/.test(shown.tip),
      'Der Tooltip nennt nicht den vollen Zeitstempel: ' + shown.tip);
    await p.close();
  });

  await test(file + ': der Titel bleibt auch auf dem Telefon stehen', async () => {
    // Bis v20 wich der Titel unter 520px komplett - damit verschwanden auf
    // dem Telefon auch Version und Freigabezeitpunkt, und die Kopfzeile
    // bestand nur noch aus vier Symbolen. Eine namenlose Seite sagt nicht,
    // welcher Stand geladen ist.
    const p = await open(file);
    await p.page.setViewportSize({ width: 390, height: 844 });
    await p.page.waitForTimeout(150);
    const r = await p.page.evaluate(() => {
      const sichtbar = (el) => !!el && el.offsetWidth > 0 && el.offsetHeight > 0;
      const titel = document.querySelector('.header-title');
      return {
        titel: sichtbar(titel),
        name: sichtbar(document.querySelector('.ht-name')),
        version: sichtbar(document.getElementById('appVersion')),
        gebaut: sichtbar(document.querySelector('.ht-built')),
        // Der Kopf darf dabei nicht breiter werden als der Bildschirm.
        ueberlauf: document.querySelector('.header-row').scrollWidth > window.innerWidth + 1
      };
    });
    await p.close();
    assert(r.titel && r.name, 'Der Titel ist auf 390px Breite verschwunden');
    assert(r.version, 'Die Version ist auf 390px Breite verschwunden');
    assert(r.gebaut, 'Der Freigabezeitpunkt ist auf 390px Breite verschwunden');
    assert(!r.ueberlauf, 'Die Kopfzeile laeuft auf 390px Breite ueber');
  });

  await test(file + ': Navigation zeigt alle vier Seiten', async () => {
    const p = await open(file);
    const hrefs = await p.page.$$eval('.nav-item', (els) => els.map((e) => e.getAttribute('href')));
    assertEqual(hrefs.sort(), ['build-log.html', 'index.html', 'performance.html', 'specs.html']);
    const aktiv = await p.page.$$eval('.nav-item.active', (els) => els.length);
    assertEqual(aktiv, 1, 'Genau eine Seite muss aktiv sein');
    await p.close();
  });

  await test(file + ': ohne Token meldet die Kopfzeile "Lokal"', async () => {
    const p = await open(file);
    const txt = await p.page.textContent('#syncBadge');
    assert(txt.includes('Lokal'), 'Sync-Abzeichen zeigt: ' + txt);
    await p.close();
  });
}

// ---------------------------------------------------------------------------
suite('Build Log: Kapitel, Status und Fortschritt');

await test('sechs Phasen mit je eigenem Fortschrittsbalken', async () => {
  const p = await open('build-log.html');
  const phasen = await p.page.$$eval('.phase-banner', (els) => els.length);
  assertEqual(phasen, 6);
  for (let i = 1; i <= 6; i++) {
    assert(await p.page.$('#prog' + i), 'Balken fuer Phase ' + i + ' fehlt');
  }
  await p.close();
});

await test('jedes Kapitel hat Status, Befunde und Anleitung', async () => {
  const p = await open('build-log.html');
  const zahlen = await p.page.evaluate(() => ({
    karten: document.querySelectorAll('.step-card').length,
    status: document.querySelectorAll('.step-status[data-field]').length,
    befunde: document.querySelectorAll('.findings[data-findings]').length,
    anleitung: document.querySelectorAll('.step-guide').length
  }));
  assert(zahlen.karten > 40, 'Zu wenige Kapitel: ' + zahlen.karten);
  assertEqual(zahlen.status, zahlen.karten, 'Nicht jedes Kapitel hat einen Status');
  assertEqual(zahlen.befunde, zahlen.karten, 'Nicht jedes Kapitel hat eine Befundliste');
  assertEqual(zahlen.anleitung, zahlen.karten, 'Nicht jedes Kapitel hat eine Anleitung');
  await p.close();
});

await test('Kapitel-Kennungen sind eindeutig', async () => {
  const p = await open('build-log.html');
  const ids = await p.page.$$eval('.step-status[data-field]', (els) => els.map((e) => e.dataset.field));
  const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i);
  assertEqual(doppelt, [], 'Doppelte Kapitel-Kennungen');
  await p.close();
});

await test('Status durchlaeuft offen, in Arbeit, erledigt', async () => {
  const p = await open('build-log.html');
  const werte = await p.page.evaluate(() => {
    const btn = document.querySelector('.step-status[data-field]');
    const out = [btn.value];
    for (let i = 0; i < 3; i++) { btn.click(); out.push(btn.value); }
    return out;
  });
  // Seit v36 ist "offen" nach einem Tipp ein eigener Wert ('offen'), kein
  // leerer: ein Leer schlaegt beim Abgleich keinen Wert (v35), und der
  // Schritt liess sich sonst nicht mehr zuruecksetzen. Unberuehrt bleibt er ''.
  assertEqual(werte, ['', 'wip', 'done', 'offen'], 'Statusfolge stimmt nicht');
  await p.close();
});

await test('"in Arbeit" zaehlt halb im Fortschritt', async () => {
  // Sonst steht der Balken tagelang still, obwohl gearbeitet wird.
  const p = await open('build-log.html');
  const breite = await p.page.evaluate(() => {
    const phase = document.getElementById('phase1');
    const btns = phase.querySelectorAll('.step-status[data-field]');
    btns[0].click();                        // -> wip
    updateProgress();
    const wip = document.getElementById('prog1').style.width;
    btns[0].click();                        // -> done
    updateProgress();
    return { wip: wip, done: document.getElementById('prog1').style.width, n: btns.length };
  });
  const halb = (0.5 / breite.n * 100);
  assert(Math.abs(parseFloat(breite.wip) - halb) < 0.01, 'wip zaehlt nicht halb: ' + breite.wip);
  assert(parseFloat(breite.done) > parseFloat(breite.wip), 'erledigt zaehlt nicht mehr als in Arbeit');
  await p.close();
});

await test('Befund anlegen, umschalten und entfernen', async () => {
  const p = await open('build-log.html');
  p.page.on('dialog', (d) => d.accept());
  const ergebnis = await p.page.evaluate(() => {
    const kapitel = document.querySelector('.findings[data-findings]').dataset.findings;
    addFinding(kapitel);
    const nachAnlegen = Findings.forChapter(kapitel).length;
    const id = Findings.forChapter(kapitel)[0].id;
    Findings.update(id, { text: 'Zahn am 3. Gang ausgebrochen' });
    cycleFinding(kapitel, id);
    const status = Findings.forChapter(kapitel)[0].status;
    Findings.remove(id);
    return { nachAnlegen, status, nachLoeschen: Findings.forChapter(kapitel).length };
  });
  assertEqual(ergebnis.nachAnlegen, 1, 'Befund wurde nicht angelegt');
  assertEqual(ergebnis.status, 'wip', 'Status wurde nicht weitergeschaltet');
  assertEqual(ergebnis.nachLoeschen, 0, 'Befund wurde nicht entfernt');
  await p.close();
});

// ---------------------------------------------------------------------------
suite('Messwerte');

await test('Messwert wird lokal gespeichert und wieder angezeigt', async () => {
  const p = await open('build-log.html');
  await p.page.evaluate(() => {
    const el = document.querySelector('[data-field="p3_runout_rear"]');
    el.value = '.0012';
    autoSave();
  });
  await p.page.waitForTimeout(800);
  const gespeichert = await p.page.evaluate(
    () => JSON.parse(localStorage.getItem('jericoBuildLog') || '{}').p3_runout_rear);
  assertEqual(gespeichert, '.0012', 'Messwert nicht im Speicher');

  await p.page.reload();
  await p.page.waitForTimeout(900);
  const wieder = await p.page.inputValue('[data-field="p3_runout_rear"]');
  assertEqual(wieder, '.0012', 'Messwert nach dem Neuladen weg');
  await p.close();
});

await test('geleertes Feld bleibt geleert', async () => {
  // Frueher hat ein leeres Feld beim naechsten Laden den alten Wert zurueckbekommen.
  const p = await open('build-log.html');
  await p.page.evaluate(() => {
    const el = document.querySelector('[data-field="p3_runout_front"]');
    el.value = '.002'; autoSave();
  });
  await p.page.waitForTimeout(800);
  await p.page.evaluate(() => {
    const el = document.querySelector('[data-field="p3_runout_front"]');
    // Wie der Nutzer: mit dem Eingabe-Ereignis des Browsers (seit v41 zaehlt
    // ein Leeren nur bei einem beruehrten Feld).
    el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); autoSave();
  });
  await p.page.waitForTimeout(800);
  await p.page.reload();
  await p.page.waitForTimeout(900);
  const wieder = await p.page.inputValue('[data-field="p3_runout_front"]');
  assertEqual(wieder, '', 'Geleertes Feld kam zurueck');
  await p.close();
});

await test('Speicher liegt unter eigener Kennung, nicht beim Motor-Build', async () => {
  // Beide Seiten liegen auf derselben Origin - gleiche Schluessel wuerden sich
  // gegenseitig ueberschreiben.
  const quellen = ['app.js', 'findings.js', 'gallery.js'];
  for (const datei of quellen) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    for (const schluessel of ['engineBuildLog', 'engineFindings', 'engineGalleryMeta', 'engineBuildLang']) {
      assert(!text.includes("'" + schluessel + "'"), datei + ' benutzt noch ' + schluessel);
    }
  }
});

// ---------------------------------------------------------------------------
suite('Startseite: Fortschritt aus dem Build Log');

await test('Phasenuebersicht zeigt den gespeicherten Stand', async () => {
  const p = await open('build-log.html');
  const ersteId = await p.page.evaluate(() => {
    const btn = document.querySelector('#phase1 .step-status[data-field]');
    btn.click(); btn.click();          // -> done
    autoSave();
    return btn.dataset.field;
  });
  await p.page.waitForTimeout(800);
  await p.page.goto(base + '/index.html');
  await p.page.waitForTimeout(900);
  const zeile = await p.page.textContent('#dashCount1');
  assert(zeile.startsWith('1 / '), 'Startseite zeigt ' + zeile + ' fuer ' + ersteId);
  await p.close();
});

await test('Phasenzuordnung der Startseite passt zum Build Log', async () => {
  const idx = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const bl = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  const map = JSON.parse((idx.match(/var PHASEN = (\{.*?\});/s) || [])[1]);
  const imLog = [...bl.matchAll(/class="step-status" data-field="([^"]+)"/g)].map((m) => m[1]);
  const inMap = Object.values(map).flat();
  assertEqual(inMap.length, imLog.length, 'Startseite kennt eine andere Anzahl Kapitel');
  for (const id of inMap) assert(imLog.includes(id), 'Unbekanntes Kapitel auf der Startseite: ' + id);
});

// ---------------------------------------------------------------------------
suite('Inhaltliche Korrekturen gegen die Primaerquellen');

// Diese Pruefungen halten Korrekturen fest, die aus einem Abgleich mit den
// Original-PDFs von Jerico stammen. Sie verhindern, dass eine der Aussagen
// beim naechsten Ueberarbeiten unbemerkt zurueckkommt.

await test('keine Seite behauptet Kupplungsschlupf als Vorgabe fuer dieses Getriebe', async () => {
  // "CLUTCH SLIPPAGE IS A MUST" steht im Break-In-Sheet ausschliesslich unter
  // "FOR CLUTCHLESS DRAG RACE TRANSMISSIONS ONLY".
  for (const datei of PAGES) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(!/Kein Schlupf = Getriebeschaden/.test(text), datei + ': alte Kupplungs-Aussage');
    assert(!/muss die Kupplung kurz schlupfen/.test(text), datei + ': alte Kupplungs-Aussage');
  }
});

await test('0,0015" steht nicht als Grenzwert', async () => {
  // Original: "Normal shaft runout will average 0.0015" per any one journal."
  for (const datei of PAGES) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(!/max\.? 0,0015/.test(text), datei + ': 0,0015" als Maximum');
    assert(!/Normal max\. 0,0015/.test(text), datei + ': 0,0015" als Maximum');
  }
});

await test('Vorgelegewelle: buendig bis wenige Tausendstel, nicht "niemals tiefer"', async () => {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'build-log.html'), 'utf8');
  assert(!/niemals tiefer/.test(text), 'zu strenge Vorgabe steht wieder drin');
  assert(/wenige Tausendstel/.test(text), 'die zulaessige Toleranz fehlt');
});

await test('kein unbelegter Herstellerstatus, keine pauschale Quellenaussage', async () => {
  for (const datei of PAGES) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(!/wahrscheinlich inaktiv/.test(text), datei + ': unbelegte Aussage zum Hersteller');
    // Auf das Muster pruefen, nicht auf einen Wortlaut: die enge Fassung hat
    // "Alle Angaben auf dieser Seite stammen aus Klasse A" in specs.html
    // acht Versionen lang uebersehen.
    assert(!/Alle (Werte|Angaben)[^<.]{0,60}stammen aus/.test(text),
      datei + ': pauschale Quellenaussage');
    assert(!/B = verifizierte Sekund/.test(text),
      datei + ': veraltetes Quellenklassen-Schema A/B/C statt A bis F');
  }
});

await test('Specs erklaeren die Quellenklassen und benutzen sie', async () => {
  const p = await open('specs.html');
  const zahlen = await p.page.evaluate(() => ({
    legende: !!document.querySelector('.src-a'),
    benutzt: document.querySelectorAll('.spec-value .src, .spec-item .src').length
  }));
  assert(zahlen.legende, 'Legende der Quellenklassen fehlt');
  assert(zahlen.benutzt >= 5, 'Quellenklassen werden kaum benutzt: ' + zahlen.benutzt);
  await p.close();
});

// ---------------------------------------------------------------------------
suite('Sprache und Glossar');

await test('der erste Schritt steht ohne langes Scrollen da', async () => {
  // Vor Phase 1 standen vier Textkaesten - Arbeitsgrundlage, Quellenklassen,
  // Risikoliste und Reihenfolge. Auf dem Telefon hiess das rund 1200 Pixel
  // Prosa, bevor man ueberhaupt etwas tun konnte. Das Schwesterprojekt geht
  // vom Fortschrittsbalken direkt in die erste Phase.
  //
  // Die Risikoliste bleibt sichtbar - sie verhindert Schaden. Der Rest ist
  // einklappbar. Geprueft wird die Folge davon, nicht die Bauart: wie weit
  // oben der erste Phasenkopf steht.
  const p = await open('build-log.html');
  await p.page.setViewportSize({ width: 390, height: 844 });
  await p.page.waitForTimeout(200);
  const r = await p.page.evaluate(() => {
    const banner = document.querySelector('.phase-banner');
    const risiko = document.querySelector('.warning-box');
    const faltbar = document.querySelector('.comp-box .comp-body');
    return {
      oben: banner ? Math.round(banner.getBoundingClientRect().top + window.scrollY) : -1,
      risikoSichtbar: !!risiko && risiko.offsetHeight > 0,
      // Der eingeklappte Block darf nicht offen sein, sonst ist nichts gewonnen.
      faltbarOffen: !!faltbar && faltbar.offsetHeight > 0
    };
  });
  await p.close();
  assert(r.oben > 0, 'Kein Phasenkopf gefunden');
  // Gemessen auf 390px Breite: eingeklappt steht der Phasenkopf bei 463px,
  // mit ausgeklappter Einleitung bei 877px. Die Grenze liegt dazwischen -
  // die erste Fassung dieses Tests nahm 900px und haette nie angeschlagen.
  assert(r.oben < 600,
    'Der erste Phasenkopf steht erst bei ' + r.oben + 'px - davor steht zu viel Text');
  assert(r.risikoSichtbar, 'Die Risikoliste ist nicht mehr sichtbar');
  assert(!r.faltbarOffen, 'Der Einleitungsblock ist nicht eingeklappt');
});

await test('jeder deutsche Textblock hat eine englische Entsprechung', async () => {
  // Die Seiten sind zweisprachig: beim Umschalten wird der deutsche Span
  // aus- und der englische eingeblendet. Fehlt die Uebersetzung, bleibt an
  // der Stelle nichts stehen - und zwar genau dann, wenn man sie braucht.
  // Auffallen kann das sonst niemandem: in der deutschen Ansicht sieht die
  // Seite vollstaendig aus. Gefunden wurde so eine Luecke im Schritt zum
  // Ausruecklager, eingebaut in v18.
  for (const datei of PAGES) {
    const roh = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    const de = [...roh.matchAll(/<span class="de">/g)].map((m) => m.index);
    const en = [...roh.matchAll(/<span class="en">/g)].map((m) => m.index);
    if (!de.length) continue;

    // Paarweise in Dokumentreihenfolge: zwischen zwei deutschen Spans muss
    // ein englischer liegen. Ein blosser Zahlenvergleich wuerde zwei Fehler
    // gegeneinander aufheben - ein fehlendes en und ein ueberzaehliges.
    const ohne = [];
    de.forEach((pos, i) => {
      const bis = i + 1 < de.length ? de[i + 1] : roh.length;
      if (!en.some((e) => e > pos && e < bis)) ohne.push(pos);
    });
    const meldung = ohne.map((pos) => {
      const zeile = roh.slice(0, pos).split('\n').length;
      const text = roh.slice(pos, pos + 90).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      return datei + ':' + zeile + ' "' + text.slice(0, 60) + '"';
    });
    assertEqual(meldung, [], 'Deutscher Block ohne englische Entsprechung');
    assertEqual(de.length, en.length,
      datei + ': ' + de.length + ' deutsche, aber ' + en.length + ' englische Bloecke');
  }
});

await test('Umschalten auf Englisch blendet die deutschen Spans aus', async () => {
  const p = await open('build-log.html');
  const sichtbar = await p.page.evaluate(() => {
    setLang('en');
    const de = document.querySelector('.step-title span.de');
    const en = document.querySelector('.step-title span.en');
    return { de: getComputedStyle(de).display, en: getComputedStyle(en).display };
  });
  assertEqual(sichtbar.de, 'none', 'Deutscher Text bleibt sichtbar');
  assert(sichtbar.en !== 'none', 'Englischer Text bleibt versteckt');
  await p.close();
});

await test('Das Glossar steht einmal in glossar.js, nicht viermal im Markup', async () => {
  // 24 KB, viermal identisch in den Seiten - 96 KB fuer denselben Inhalt.
  // Und sie waren bereits auseinandergelaufen: der Eintrag "Main Drive" trug
  // noch die in v16 widerlegte Uebersetzung 22/27, weil v16 und v17 nur die
  // Kapitel korrigiert haben. Die vierte Kopie blieb stehen.
  const inline = [];
  for (const datei of PAGES) {
    const roh = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(roh.includes('src="glossar.js"'), datei + ' laedt glossar.js nicht');
    // Der Behaelter bleibt, sein Inhalt kommt aus der Datei.
    assert(/id="glossaryBody"><\/div>/.test(roh),
      datei + ': #glossaryBody ist nicht leer - das Glossar steht wieder im Markup');
    const treffer = (roh.match(/glossary-entry/g) || []).length;
    if (treffer) inline.push(datei + ': ' + treffer + ' Eintraege');
  }
  assertEqual(inline, [], 'Glossareintraege stehen wieder im Seiten-Markup');

  // Und es muss ankommen: eine leere Huelle waere schlimmer als vier Kopien.
  const p = await open('index.html');
  const r = await p.page.evaluate(() => ({
    eintraege: document.querySelectorAll('#glossaryBody .glossary-entry').length,
    kategorien: document.querySelectorAll('#glossaryBody .glossary-category').length,
    // Auf den Begriff selbst, nicht auf jede Erwaehnung: "Eingangswelle"
    // nennt Main Drive unter "Verwandt" und stand sonst hier.
    mainDrive: (() => {
      const t = [...document.querySelectorAll('#glossaryBody .glossary-entry')]
        .find((e) => {
          const begriff = e.querySelector('.glossary-term');
          return begriff && /^Main Drive/.test(begriff.textContent.trim());
        });
      return t ? t.textContent.replace(/\s+/g, ' ') : '';
    })()
  }));
  await p.close();
  assert(r.eintraege >= 25, 'Nur ' + r.eintraege + ' Glossareintraege eingesetzt');
  assert(r.kategorien >= 5, 'Nur ' + r.kategorien + ' Kategorien eingesetzt');
  // Die Stelle, die vier Versionen lang falsch stand.
  assert(!/22 \/ 27/.test(r.mainDrive),
    'Der Glossareintrag traegt wieder die widerlegte Uebersetzung: ' + r.mainDrive);
  assert(/25 \/ 24/.test(r.mainDrive),
    'Der Glossareintrag nennt nicht den abgezaehlten Main Drive: ' + r.mainDrive);
});

await test('Glossar oeffnet und filtert', async () => {
  const p = await open('build-log.html');
  const treffer = await p.page.evaluate(() => {
    showGuide('guide-glossary');
    document.getElementById('glossarySearch').value = 'spirolox';
    filterGlossary();
    const sichtbare = [...document.querySelectorAll('.glossary-entry:not(.hidden)')];
    return {
      sichtbar: sichtbare.length,
      gesamt: document.querySelectorAll('.glossary-entry').length,
      // Gesucht wird im ganzen Eintrag, also auch in den Verweisen - der
      // Eintrag "Spirolox" selbst muss aber dabei sein.
      mitBegriff: sichtbare.some((e) => e.querySelector('.glossary-term').textContent.includes('Spirolox'))
    };
  });
  assert(treffer.gesamt > 15, 'Glossar ist zu duenn: ' + treffer.gesamt);
  assert(treffer.sichtbar > 0 && treffer.sichtbar < treffer.gesamt,
    'Suche filtert nicht: ' + treffer.sichtbar + ' von ' + treffer.gesamt);
  assert(treffer.mitBegriff, 'Der Eintrag "Spirolox" fehlt in den Treffern');
  await p.close();
});

} finally {
  await browser.close();
  server.close();
}

process.exit(summary() ? 1 : 0);
