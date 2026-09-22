// Tests fuer das Grundgeruest: Version, Seitenaufbau, Kapitelstatus, Befunde,
// Messwerte und die Fortschrittsanzeige auf der Startseite.
//
// Lokal: npm test

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  startServer, stubGitHub, REPO_ROOT,
  suite, test, assert, assertEqual, summary
} from './helpers.mjs';

const { server, base } = await startServer();
// CHROMIUM_PATH erlaubt einen vorinstallierten Browser (z.B. in Containern),
// sonst nimmt Playwright den selbst heruntergeladenen.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const PAGES = ['index.html', 'specs.html', 'build-log.html', 'performance.html'];

async function open(file) {
  const ctx = await browser.newContext();
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

  await test(file + ': Version steht im Titelblock', async () => {
    const p = await open(file);
    const shown = await p.page.evaluate(() => {
      const el = document.getElementById('appVersion');
      if (!el) return null;
      return { text: el.textContent.trim(), imTitel: !!el.closest('.header-title') };
    });
    assert(shown, 'Kein #appVersion auf ' + file);
    assert(/^v\d+$/.test(shown.text), 'Version sieht falsch aus: ' + shown.text);
    assert(shown.imTitel, 'Version steht nicht im Titelblock');
    await p.close();
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
  assertEqual(werte, ['', 'wip', 'done', ''], 'Statusfolge stimmt nicht');
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
    el.value = ''; autoSave();
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
    assert(!/Alle Werte stammen aus der OEM/.test(text), datei + ': pauschale Quellenaussage');
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
