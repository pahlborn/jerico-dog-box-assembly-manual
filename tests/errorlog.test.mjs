// Tests fuer errorlog.js - das Fehlerprotokoll.
//
// Der Vorgaenger logErrorToGist() schrieb den Eintrag in denselben Gist, der
// gerade nicht beschreibbar war. Beim Sync-Fehler - dem haeufigsten Fall -
// protokollierte er also nichts. Dazu verwarf er Statuscode und Antworttext
// und behielt nur den Satz aus dem Toast.
//
// Der wichtigste Test hier ist deshalb der, bei dem der Gist mit 422
// antwortet: Das Protokoll muss trotzdem einen Eintrag haben, und zwar mit
// Status und Rohantwort. Alles andere ist Beiwerk.
//
// Lokal: node tests/errorlog.test.mjs

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, startServer, stubGitHub, browserStarten, neuerKontext,
  suite, test, assert, assertEqual, summary
} from './helpers.mjs';

const { server, base } = await startServer();
const browser = await browserStarten();
const SEITEN = ['index.html', 'specs.html', 'build-log.html', 'performance.html'];

async function oeffne(datei, { gistPatch } = {}) {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubGitHub(page, gistPatch ? { gistPatchFehler: gistPatch } : {});
  await page.goto(base + '/' + datei);
  await page.waitForFunction(() => typeof ErrorLog !== 'undefined', null, { timeout: 30000 });
  await page.evaluate(() => ErrorLog.leeren());
  await page.waitForTimeout(250);
  return { ctx, page, errors, close: () => ctx.close() };
}

try {

// ---------------------------------------------------------------------------
suite('Das Protokoll liegt auf dem Geraet, nicht in der Cloud');

await test('Ein abgelehnter Gist-Schreibvorgang landet trotzdem im Protokoll', async () => {
  // Der Fall, an dem der Vorgaenger gescheitert ist.
  const p = await oeffne('build-log.html', {
    gistPatch: { status: 422, body: JSON.stringify({ message: 'Gist cannot be updated.' }) }
  });
  // dataLoaded ist in Jerico nicht global - app.js kapselt es. Der Export
  // von saveData ist das, was dieser Test wirklich braucht.
  await p.page.waitForFunction(() => typeof saveData === 'function', null, { timeout: 30000 });
  const r = await p.page.evaluate(async () => {
    // Jerico braucht beides: Token und Gist-Id. Ohne Id haelt
    // isGistConfigured() saveData auf, es wird gar nicht geschrieben - und
    // dann prueft dieser Test nichts. window.FIXED_GIST_ID wird beim Laden
    // aus dem Speicher gesetzt, hier also direkt nachziehen.
    localStorage.setItem('gh_token', 'testtoken');
    localStorage.setItem('jerico_gist_id', 'testgist');
    window.FIXED_GIST_ID = 'testgist';
    ErrorLog.leeren();
    await saveData();
    await new Promise((r) => setTimeout(r, 400));
    return ErrorLog.alle();
  });
  assert(r.length >= 1, 'Kein Eintrag trotz fehlgeschlagenem Schreibvorgang');
  const e = r[r.length - 1];
  assert(/Gist cannot be updated/.test(e.nachricht), 'Meldung fehlt: ' + e.nachricht);
  assertEqual(e.status, 422, 'Statuscode nicht erfasst');
  assert(/Gist cannot be updated/.test(e.antwort || ''), 'Rohantwort nicht erfasst');
  assertEqual(e.quelle, 'saveData', 'Quelle nicht erfasst');
  await p.close();
});

await test('Der Eintrag ueberlebt das Neuladen der Seite', async () => {
  const p = await oeffne('build-log.html');
  await p.page.evaluate(() => ErrorLog.add('Testfehler nach Neuladen'));
  await p.page.reload();
  await p.page.waitForFunction(() => typeof ErrorLog !== 'undefined', null, { timeout: 30000 });
  const n = await p.page.evaluate(() => ErrorLog.alle().filter((e) => /nach Neuladen/.test(e.nachricht)).length);
  assertEqual(n, 1, 'Eintrag war nach dem Neuladen weg');
  await p.close();
});

await test('Jeder Eintrag nennt Zeit, Seite, Version und Geraet', async () => {
  // Ohne diese vier laesst sich spaeter nicht sagen, wo der Fehler herkam.
  const p = await oeffne('specs.html');
  const e = await p.page.evaluate(() => { ErrorLog.add('Mit Kontext'); return ErrorLog.alle().pop(); });
  assert(/^\d{4}-\d{2}-\d{2}T/.test(e.zeit), 'Zeit fehlt: ' + e.zeit);
  assertEqual(e.seite, 'specs.html', 'Seite falsch: ' + e.seite);
  assert(/^v\d+$/.test(e.version), 'Version fehlt: ' + e.version);
  assert(e.geraet && e.geraet !== 'unbekannt', 'Geraete-Kennung fehlt: ' + e.geraet);
  await p.close();
});

// ---------------------------------------------------------------------------
suite('Was sonst niemand sieht');

await test('Ein unbehandelter Fehler wird aufgezeichnet', async () => {
  // Auf einem Telefon sieht niemand in die Konsole.
  const p = await oeffne('build-log.html');
  await p.page.evaluate(() => { setTimeout(() => { throw new Error('Platzt im Timer'); }, 0); });
  await p.page.waitForTimeout(300);
  const treffer = await p.page.evaluate(() =>
    ErrorLog.alle().filter((e) => /Platzt im Timer/.test(e.nachricht)));
  assertEqual(treffer.length, 1, 'Unbehandelter Fehler nicht protokolliert');
  assertEqual(treffer[0].quelle, 'window.onerror', 'Quelle nicht vermerkt');
  await p.close();
});

await test('Ein abgewiesenes Promise wird aufgezeichnet', async () => {
  const p = await oeffne('build-log.html');
  await p.page.evaluate(() => { Promise.reject(new Error('Niemand faengt mich')); });
  await p.page.waitForTimeout(300);
  const treffer = await p.page.evaluate(() =>
    ErrorLog.alle().filter((e) => /Niemand faengt mich/.test(e.nachricht)));
  assertEqual(treffer.length, 1, 'Abgewiesenes Promise nicht protokolliert');
  assertEqual(treffer[0].quelle, 'unhandledrejection', 'Quelle nicht vermerkt');
  await p.close();
});

// ---------------------------------------------------------------------------
suite('Grenzen und Robustheit');

await test('Der Ringpuffer laeuft nicht ueber', async () => {
  const p = await oeffne('build-log.html');
  const r = await p.page.evaluate(() => {
    ErrorLog.leeren();
    for (var i = 0; i < ErrorLog.MAX + 25; i++) ErrorLog.add('Eintrag ' + i);
    var a = ErrorLog.alle();
    return { anzahl: a.length, erster: a[0].nachricht, letzter: a[a.length - 1].nachricht };
  });
  assertEqual(r.anzahl, 100, 'Puffergroesse');
  assert(/Eintrag 25$/.test(r.erster), 'Aelteste nicht verdraengt: ' + r.erster);
  assert(/Eintrag 124$/.test(r.letzter), 'Juengster fehlt: ' + r.letzter);
  await p.close();
});

await test('Ein gesperrter Speicher legt die Seite nicht lahm', async () => {
  // In einem privaten Fenster wirft setItem. Das Protokoll darf daran nicht
  // die Seite mitreissen.
  const p = await oeffne('build-log.html');
  const r = await p.page.evaluate(() => {
    const echt = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
    let geworfen = false;
    try { ErrorLog.add('Bei gesperrtem Speicher'); } catch (e) { geworfen = true; }
    localStorage.setItem = echt;
    return geworfen;
  });
  assertEqual(r, false, 'ErrorLog.add hat geworfen');
  assertEqual(p.errors.length, 0, 'Page-Errors: ' + p.errors.join(' | '));
  await p.close();
});

await test('Lange Antworttexte werden gekuerzt, nicht verworfen', async () => {
  const p = await oeffne('build-log.html');
  const e = await p.page.evaluate(() => {
    ErrorLog.add('Lange Antwort', { antwort: 'x'.repeat(9000) });
    return ErrorLog.alle().pop();
  });
  assert(e.antwort.length < 9000, 'Nicht gekuerzt: ' + e.antwort.length);
  assert(e.antwort.length > 1000, 'Zu stark gekuerzt: ' + e.antwort.length);
  assert(/gekuerzt/.test(e.antwort), 'Kuerzung nicht kenntlich gemacht');
  await p.close();
});

// ---------------------------------------------------------------------------
suite('Ansicht und Erreichbarkeit');

for (const datei of SEITEN) {
  await test(datei + ': Modul geladen und im Werkzeugmenue erreichbar', async () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(html.includes('src="errorlog.js"'), 'errorlog.js wird nicht geladen');
    assert(/onclick="showErrorLog\(\)/.test(html), 'Kein Menueeintrag');
    const p = await oeffne(datei);
    assertEqual(p.errors.length, 0, 'Page-Errors: ' + p.errors.join(' | '));
    await p.close();
  });
}

await test('Die Ansicht zeigt Eintraege, juengste zuerst', async () => {
  const p = await oeffne('build-log.html');
  const r = await p.page.evaluate(() => {
    ErrorLog.leeren();
    ErrorLog.add('Aeltester');
    ErrorLog.add('Juengster', { status: 422, antwort: '{"message":"Gist cannot be updated."}' });
    showErrorLog();
    const ov = document.getElementById('guide-errorlog');
    const z = ov.querySelectorAll('.el-eintrag');
    return { da: !!ov, anzahl: z.length, ersterText: z[0].textContent,
             zeigtStatus: /422/.test(ov.textContent),
             zeigtAntwort: /Gist cannot be updated/.test(ov.textContent) };
  });
  assert(r.da, 'Overlay fehlt');
  assertEqual(r.anzahl, 2, 'Eintraege in der Ansicht');
  assert(/Juengster/.test(r.ersterText), 'Reihenfolge falsch, oben steht: ' + r.ersterText);
  assert(r.zeigtStatus, 'Statuscode wird nicht angezeigt');
  assert(r.zeigtAntwort, 'Rohantwort wird nicht angezeigt');
  await p.close();
});

await test('Eine leere Ansicht sagt das auch', async () => {
  const p = await oeffne('build-log.html');
  const t = await p.page.evaluate(() => {
    ErrorLog.leeren(); showErrorLog();
    return document.getElementById('errorlogBody').textContent;
  });
  assert(/Keine Fehler aufgezeichnet/.test(t), 'Leermeldung fehlt: ' + t.slice(0, 80));
  await p.close();
});

await test('Text in einem Eintrag wird escaped', async () => {
  const p = await oeffne('build-log.html');
  const ok = await p.page.evaluate(() => {
    ErrorLog.leeren();
    ErrorLog.add('<img src=x onerror=alert(1)>');
    showErrorLog();
    const ov = document.getElementById('guide-errorlog');
    return ov.querySelectorAll('img').length === 0 && /<img/.test(ov.textContent);
  });
  assert(ok, 'Eintrag wurde als HTML interpretiert');
  await p.close();
});

await test('Der Text zum Kopieren traegt Status und Antwort', async () => {
  // Das ist die Fassung, die in einer Nachricht landet.
  const p = await oeffne('build-log.html');
  const t = await p.page.evaluate(() => {
    ErrorLog.leeren();
    ErrorLog.add('Sync-Fehler: Gist cannot be updated.',
      { quelle: 'saveData', status: 422, statusText: 'Unprocessable Entity',
        antwort: '{"message":"Gist cannot be updated."}' });
    return ErrorLog.alsText();
  });
  assert(/Status:\s+422/.test(t), 'Status fehlt im Text');
  assert(/Quelle:\s+saveData/.test(t), 'Quelle fehlt im Text');
  assert(/Antwort:.*Gist cannot be updated/.test(t), 'Antwort fehlt im Text');
  await p.close();
});

// ---------------------------------------------------------------------------
suite('Verbinden sagt, was schiefgeht');

// Der Fall aus der Benutzung: Fotos erschienen auf jedem Geraet, Inhalte nie.
// Fotos liegen im Repository und brauchen keinen Gist; die Inhalte liegen im
// Gist. Kam der Token nicht an die Gists heran, gab findGistByFilename
// stillschweigend null zurueck - nicht unterscheidbar von "kein Gist
// gefunden". Die App legte dann einen an, scheiterte auch daran und meldete
// nur "Gist konnte nicht erstellt werden", ohne Grund und ohne Statuscode.

async function verbinde(p, token) {
  return p.page.evaluate(async (t) => {
    document.getElementById('ghToken').value = t;
    await saveSettings();
    await new Promise((r) => setTimeout(r, 300));
    const toast = document.getElementById('toast');
    return {
      meldung: toast ? toast.textContent : '',
      protokoll: ErrorLog.alle(),
      gistId: localStorage.getItem('jerico_gist_id') || ''
    };
  }, token);
}

await test('Ein verweigerter Zugriff auf die Gist-Liste wird benannt', async () => {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  await stubGitHub(page, {
    gistListeFehler: { status: 403, body: JSON.stringify({ message: 'Resource not accessible by personal access token' }) }
  });
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => typeof saveSettings === 'function', null, { timeout: 30000 });
  const r = await verbinde({ page: page }, 'testtoken');
  await ctx.close();

  assert(/403/.test(r.meldung), 'Statuscode fehlt in der Meldung: ' + r.meldung);
  assert(/not accessible/.test(r.meldung), 'GitHubs Antwort fehlt: ' + r.meldung);
  assert(/Gist/.test(r.meldung), 'Kein Hinweis auf die Gist-Berechtigung: ' + r.meldung);
  assert(/Fotos/.test(r.meldung),
    'Der Unterschied zu den Fotos wird nicht erklaert: ' + r.meldung);
  assertEqual(r.gistId, '', 'Trotz Fehlschlag wurde eine Gist-Id gespeichert');

  const e = r.protokoll[r.protokoll.length - 1];
  assert(e, 'Nichts protokolliert');
  assertEqual(e.status, 403, 'Statuscode nicht protokolliert');
  assertEqual(e.quelle, 'findGistByFilename', 'Quelle nicht protokolliert: ' + e.quelle);
  assert(/not accessible/.test(e.antwort || ''), 'Rohantwort nicht protokolliert');
});

await test('Ein verweigertes Anlegen wird benannt, nicht als "nicht erstellt" abgetan', async () => {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  // Liste gelingt und ist leer -> die App will anlegen; das scheitert.
  await stubGitHub(page, {
    gistListe: [],
    gistPatchFehler: null
  });
  await page.route('**api.github.com/gists', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 403, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Resource not accessible by personal access token' })
    });
  });
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => typeof saveSettings === 'function', null, { timeout: 30000 });
  const r = await verbinde({ page: page }, 'testtoken');
  await ctx.close();

  assert(/403/.test(r.meldung), 'Statuscode fehlt: ' + r.meldung);
  assert(/Gist/.test(r.meldung), 'Kein Hinweis auf die Gist-Berechtigung: ' + r.meldung);
  assertEqual(r.gistId, '', 'Trotz Fehlschlag wurde eine Gist-Id gespeichert');
  const e = r.protokoll[r.protokoll.length - 1];
  assertEqual(e.quelle, 'createGist', 'Quelle nicht protokolliert: ' + e.quelle);
});

await test('Ein gefundener Datenspeicher wird uebernommen und gemeldet', async () => {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  await stubGitHub(page, {
    gistListe: [{ id: 'gefundene-id', files: { 'jerico-build-log-data.json': { filename: 'jerico-build-log-data.json' } } }]
  });
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => typeof saveSettings === 'function', null, { timeout: 30000 });
  const r = await verbinde({ page: page }, 'testtoken');
  await ctx.close();

  assertEqual(r.gistId, 'gefundene-id', 'Gist-Id nicht uebernommen');
  assert(/Verbunden/.test(r.meldung), 'Erfolg wird nicht gemeldet: ' + r.meldung);
});

await test('Die Statuszeile behauptet keine Suche, die nicht laeuft', async () => {
  // Stand "Token gesetzt, suche Datenspeicher..." - es suchte aber nichts.
  const p = await oeffne('index.html');
  const t = await p.page.evaluate(() => {
    localStorage.setItem('gh_token', 'testtoken');
    localStorage.removeItem('jerico_gist_id');
    window.FIXED_GIST_ID = '';
    openSettings();
    return document.getElementById('connectionStatus').textContent;
  });
  await p.close();
  assert(!/suche/i.test(t), 'Behauptet weiter eine laufende Suche: ' + t);
  assert(/Ger[a-z]t/i.test(t) || /Datenspeicher/.test(t), 'Sagt nicht, was gilt: ' + t);
});

// ---------------------------------------------------------------------------
suite('Die Sicherung ist vollstaendig');

await test('Der Export enthaelt Felder, Befunde UND Foto-Beschriftungen', async () => {
  // Die Beschriftungen der Fotos gehen sonst nur ueber den Gist. Ohne
  // eingerichteten Abgleich standen sie in keiner Sicherung - die Bilddateien
  // liegen im Repository, ihre Beschriftungen nur auf dem Geraet. Genau dann
  // wird eine Sicherung gebraucht.
  const p = await oeffne('build-log.html');
  await p.page.waitForFunction(() => typeof exportJSON === 'function', null, { timeout: 30000 });

  const r = await p.page.evaluate(async () => {
    // Eine Foto-Beschriftung setzen, wie sie beim Benutzen entsteht.
    _galleryMeta.meta['getriebe/foto1.jpg'] = { caption: 'Zahnflanke Gang 2', time: '2026-10-18', order: 0, m: Date.now() };
    saveGalleryMeta();

    // Und einen Messwert.
    const feld = document.querySelector('[data-field]');
    feld.value = 'Pruefwert-Sicherung';
    await saveData();   // ohne Gist bleibt es beim lokalen Speichern

    // Export abfangen, statt eine Datei herunterzuladen.
    let inhalt = null;
    const echt = URL.createObjectURL;
    URL.createObjectURL = (blob) => { inhalt = blob; return 'blob:test'; };
    const klick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    exportJSON();
    HTMLAnchorElement.prototype.click = klick;
    URL.createObjectURL = echt;

    const text = await inhalt.text();
    return { text: text, feldname: feld.dataset.field };
  });
  await p.close();

  const sicherung = JSON.parse(r.text);
  assert(sicherung.felder, 'Keine Felder in der Sicherung');
  assertEqual(sicherung.felder[r.feldname], 'Pruefwert-Sicherung', 'Messwert fehlt');
  assert(sicherung.befunde !== undefined, 'Befunde fehlen in der Sicherung');
  assert(sicherung.galerie, 'Galerie-Metadaten fehlen in der Sicherung');
  assertEqual(sicherung.galerie.meta['getriebe/foto1.jpg'].caption, 'Zahnflanke Gang 2',
    'Foto-Beschriftung fehlt in der Sicherung');
});

await test('Der Export geht ueber das Teilen-Menue, wenn es das gibt', async () => {
  // Auf dem iPad der verlaessliche Weg: ein programmatischer Download ist in
  // einer vom Home-Bildschirm gestarteten Web-App nicht verlaesslich, und
  // ausgerechnet dort wird dokumentiert.
  const p = await oeffne('build-log.html');
  await p.page.waitForFunction(() => typeof exportJSON === 'function', null, { timeout: 30000 });
  const r = await p.page.evaluate(async () => {
    const feld = document.querySelector('textarea[data-field], input[type="text"][data-field]');
    feld.value = 'Geteilter Wert';
    await saveData();

    let geteilt = null;
    navigator.canShare = () => true;
    navigator.share = (d) => { geteilt = d; return Promise.resolve(); };
    let heruntergeladen = false;
    const klick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { heruntergeladen = true; };

    await exportJSON();
    HTMLAnchorElement.prototype.click = klick;

    const text = geteilt && geteilt.files ? await geteilt.files[0].text() : '';
    return { name: geteilt && geteilt.files ? geteilt.files[0].name : '',
             text: text, heruntergeladen: heruntergeladen,
             meldung: (document.getElementById('toast') || {}).textContent || '',
             feldname: feld.dataset.field };
  });
  await p.close();

  assert(/\.json$/.test(r.name), 'Keine Datei geteilt: ' + r.name);
  const sicherung = JSON.parse(r.text);
  assertEqual(sicherung.felder[r.feldname], 'Geteilter Wert', 'Wert fehlt in der geteilten Datei');
  assertEqual(r.heruntergeladen, false, 'Trotz Teilen zusaetzlich heruntergeladen');
  assert(/Werte/.test(r.meldung), 'Der Umfang wird nicht gemeldet: ' + r.meldung);
});

await test('Ohne Teilen-Menue wird heruntergeladen', async () => {
  const p = await oeffne('build-log.html');
  await p.page.waitForFunction(() => typeof exportJSON === 'function', null, { timeout: 30000 });
  const r = await p.page.evaluate(async () => {
    const feld = document.querySelector('textarea[data-field], input[type="text"][data-field]');
    feld.value = 'Heruntergeladener Wert';
    await saveData();
    delete navigator.share; delete navigator.canShare;
    let name = '';
    const klick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { name = this.download; };
    await exportJSON();
    HTMLAnchorElement.prototype.click = klick;
    return { name: name, meldung: (document.getElementById('toast') || {}).textContent || '' };
  });
  await p.close();
  assert(/^jerico-rh02374-\d{4}-\d{2}-\d{2}\.json$/.test(r.name), 'Dateiname falsch: ' + r.name);
  assert(/Werte/.test(r.meldung), 'Der Umfang wird nicht gemeldet: ' + r.meldung);
});

await test('Die Sicherung als Text zeigt den vollen Datensatz', async () => {
  // Der Weg, der nicht scheitern kann - eigener Menuepunkt.
  const p = await oeffne('build-log.html');
  await p.page.waitForFunction(() => typeof sicherungAlsText === 'function', null, { timeout: 30000 });
  const r = await p.page.evaluate(async () => {
    const feld = document.querySelector('textarea[data-field], input[type="text"][data-field]');
    feld.value = 'Wert fuer den Textweg';
    await saveData();
    _galleryMeta.meta['getriebe/t.jpg'] = { caption: 'Beschriftung fuer den Textweg', m: Date.now() };
    saveGalleryMeta();
    sicherungAlsText();
    const box = document.getElementById('sicherungFallback');
    const k = box ? box.getBoundingClientRect() : null;
    return {
      da: !!box,
      text: box ? box.querySelector('textarea').value : '',
      imBild: k ? (k.top >= 0 && k.bottom <= window.innerHeight + 1 && k.height > 50) : false,
      feldname: feld.dataset.field
    };
  });
  await p.close();

  assert(r.da, 'Kein Textfenster');
  assert(r.imBild, 'Textfenster steht nicht im Bild');
  const sicherung = JSON.parse(r.text);
  assertEqual(sicherung.felder[r.feldname], 'Wert fuer den Textweg', 'Wert fehlt im Text');
  assertEqual(sicherung.galerie.meta['getriebe/t.jpg'].caption, 'Beschriftung fuer den Textweg',
    'Foto-Beschriftung fehlt im Text');
});

await test('Ein leerer Speicher wird nicht als gelungene Sicherung ausgegeben', async () => {
  // Der gefaehrlichste Fall: auf iOS hat eine vom Home-Bildschirm gestartete
  // App einen eigenen Speicher. Wer dort exportiert, wo er nicht eingetragen
  // hat, bekaeme sonst eine leere Datei und hielte sie fuer eine Sicherung.
  const p = await oeffne('index.html');
  await p.page.waitForFunction(() => typeof exportJSON === 'function', null, { timeout: 30000 });
  const r = await p.page.evaluate(async () => {
    localStorage.removeItem('jericoBuildLog');
    localStorage.removeItem('jericoGalleryMeta');
    if (typeof _galleryMeta !== 'undefined') { _galleryMeta = { version: 2, meta: {}, videos: {}, hero: {} }; }
    if (typeof Findings !== 'undefined' && Findings._set) { Findings._set({ items: [] }); Findings.save(); }
    document.querySelectorAll('[data-field]').forEach((el) => {
      if (el.type === 'checkbox') el.checked = false; else el.value = '';
    });

    let geteilt = false, geladen = false;
    navigator.canShare = () => true;
    navigator.share = () => { geteilt = true; return Promise.resolve(); };
    const klick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { geladen = true; };
    const ergebnis = await exportJSON();
    HTMLAnchorElement.prototype.click = klick;

    const t = document.getElementById('toast');
    return { ergebnis: ergebnis, geteilt: geteilt, geladen: geladen,
             meldung: t ? t.textContent : '', fehlerfarbe: t ? t.classList.contains('toast-error') : false };
  });
  await p.close();

  assertEqual(r.ergebnis, false, 'Leerer Export meldet Erfolg');
  assertEqual(r.geteilt, false, 'Leere Sicherung wurde geteilt');
  assertEqual(r.geladen, false, 'Leere Sicherung wurde heruntergeladen');
  assert(r.fehlerfarbe, 'Die Meldung ist nicht als Fehler gekennzeichnet');
  assert(/leer/i.test(r.meldung), 'Sagt nicht, dass nichts zu sichern ist: ' + r.meldung);
  assert(/Home-Bildschirm/.test(r.meldung),
    'Nennt nicht den wahrscheinlichen Grund (eigener Speicher): ' + r.meldung);
});

await test('Ein Import spielt die Foto-Beschriftungen zurueck', async () => {
  // Eine Sicherung, die sich nicht zurueckspielen laesst, ist keine.
  const p = await oeffne('build-log.html');
  await p.page.waitForFunction(() => typeof importJSON === 'function', null, { timeout: 30000 });

  const r = await p.page.evaluate(async () => {
    _galleryMeta = { version: 2, meta: {}, videos: {}, hero: {} };
    saveGalleryMeta();

    const sicherung = {
      meta: { projekt: 'Jerico RH02374' },
      felder: { p1_s1_notiz: 'Aus der Sicherung' },
      befunde: { items: [] },
      galerie: { version: 2, meta: { 'getriebe/foto9.jpg': { caption: 'Aus der Sicherung', time: '', order: 0, m: Date.now() } }, videos: {}, hero: {} }
    };
    const datei = new File([JSON.stringify(sicherung)], 's.json', { type: 'application/json' });
    const dt = new DataTransfer(); dt.items.add(datei);
    const eingabe = document.getElementById('importFile');
    eingabe.files = dt.files;
    importJSON({ target: eingabe });
    await new Promise((r) => setTimeout(r, 400));

    return {
      caption: (_galleryMeta.meta['getriebe/foto9.jpg'] || {}).caption || '',
      gespeichert: JSON.parse(localStorage.getItem('jericoGalleryMeta') || '{}')
    };
  });
  await p.close();

  assertEqual(r.caption, 'Aus der Sicherung', 'Beschriftung nicht uebernommen');
  assertEqual((r.gespeichert.meta['getriebe/foto9.jpg'] || {}).caption, 'Aus der Sicherung',
    'Beschriftung nicht dauerhaft gespeichert');
});

await test('Ein Versionswechsel laesst die erfassten Daten unberuehrt', async () => {
  // Die Frage, die man sich vor jedem Update stellt. Der Service Worker
  // loescht beim Aktivieren alte Caches - das ist die Cache-API und damit ein
  // anderer Speicher als localStorage, in dem die Eingaben liegen. Hier wird
  // genau das nachgestellt: Daten schreiben, alle Caches wegwerfen, neu laden.
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  await stubGitHub(page);
  await page.goto(base + '/build-log.html');
  await page.waitForFunction(() => typeof saveData === 'function', null, { timeout: 30000 });

  const feldname = await page.evaluate(async () => {
    // Ausdruecklich ein Textfeld: das erste [data-field] auf der Seite ist ein
    // Status-Knopf, und der normalisiert seinen Wert beim Laden auf einen
    // gueltigen Status. Ein freier Text ist keiner - daran scheiterte die
    // erste Fassung dieses Tests, nicht an verlorenen Daten.
    const feld = document.querySelector('textarea[data-field], input[type="text"][data-field]');
    feld.value = 'Vor dem Update erfasst';
    await saveData();
    _galleryMeta.meta['getriebe/vorher.jpg'] = { caption: 'Vor dem Update beschriftet', m: Date.now() };
    saveGalleryMeta();
    return feld.dataset.field;
  });

  // Was der Service Worker beim Versionswechsel tut: alte Caches verwerfen.
  await page.evaluate(async () => {
    if (!window.caches) return;
    const namen = await caches.keys();
    await Promise.all(namen.map((n) => caches.delete(n)));
  });
  await page.reload();
  // Nicht nur warten, bis die Funktionen da sind: applyData() fuellt die
  // Felder erst danach. Lief die Pruefung zu frueh, war das Feld noch leer -
  // die gespeicherten Daten waren da, nur noch nicht angezeigt. Schlaegt das
  // Fuellen ganz aus, laeuft dieses Warten in die Zeitgrenze und der Test
  // wird rot; die Pruefung bleibt also scharf.
  await page.waitForFunction(
    (fn) => {
      const el = document.querySelector('[data-field="' + fn + '"]');
      return !!el && el.value !== '';
    }, feldname, { timeout: 30000 });

  const r = await page.evaluate((fn) => ({
    feld: (JSON.parse(localStorage.getItem('jericoBuildLog') || '{}'))[fn],
    caption: ((JSON.parse(localStorage.getItem('jericoGalleryMeta') || '{}').meta || {})['getriebe/vorher.jpg'] || {}).caption,
    imFeld: (document.querySelector('[data-field="' + fn + '"]') || {}).value
  }), feldname);
  await ctx.close();

  assertEqual(r.feld, 'Vor dem Update erfasst', 'Messwert nach dem Versionswechsel verloren');
  assertEqual(r.caption, 'Vor dem Update beschriftet', 'Foto-Beschriftung verloren');
  assertEqual(r.imFeld, 'Vor dem Update erfasst', 'Wert steht nicht wieder im Feld');
});

await test('Kein Code entfernt die erfassten Daten', async () => {
  // Statisch geprueft, weil es keinen Fall geben darf, in dem es passiert.
  // Erlaubt sind genau drei Schluessel: Token und Gist-Id beim Trennen, und
  // das Fehlerprotokoll beim Leeren.
  const erlaubt = ['gh_token', 'GIST_ID_KEY', 'SCHLUESSEL'];
  const dateien = fs.readdirSync(REPO_ROOT).filter((f) => f.endsWith('.js'));
  const verstoesse = [];
  for (const d of dateien) {
    const text = fs.readFileSync(path.join(REPO_ROOT, d), 'utf8');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/localStorage\s*\.\s*clear\s*\(/.test(code)) verstoesse.push(d + ': localStorage.clear()');
    const treffer = code.match(/removeItem\(\s*([^)]*?)\s*\)/g) || [];
    for (const t of treffer) {
      const ziel = t.replace(/removeItem\(\s*/, '').replace(/\s*\)$/, '').replace(/['"]/g, '');
      if (!erlaubt.includes(ziel)) verstoesse.push(d + ': removeItem(' + ziel + ')');
    }
  }
  assertEqual(verstoesse, [], 'Code entfernt Daten, die niemand verlieren darf');
});

await test('Verbindung trennen loescht keine Daten', async () => {
  // Wer in der Klemme sitzt, drueckt irgendwann auf "Trennen".
  const p = await oeffne('build-log.html');
  const r = await p.page.evaluate(async () => {
    const feld = document.querySelector('[data-field]');
    feld.value = 'Darf-nicht-weg';
    await saveData();   // ohne Gist bleibt es beim lokalen Speichern
    _galleryMeta.meta['g/f.jpg'] = { caption: 'Darf auch nicht weg', m: Date.now() };
    saveGalleryMeta();
    localStorage.setItem('gh_token', 'testtoken');
    localStorage.setItem('jerico_gist_id', 'testgist');

    disconnectGist();

    return {
      felder: JSON.parse(localStorage.getItem('jericoBuildLog') || '{}'),
      galerie: JSON.parse(localStorage.getItem('jericoGalleryMeta') || '{}'),
      token: localStorage.getItem('gh_token'),
      gist: localStorage.getItem('jerico_gist_id'),
      feldname: feld.dataset.field
    };
  });
  await p.close();

  assertEqual(r.felder[r.feldname], 'Darf-nicht-weg', 'Messwert beim Trennen verloren');
  assertEqual(r.galerie.meta['g/f.jpg'].caption, 'Darf auch nicht weg',
    'Foto-Beschriftung beim Trennen verloren');
  assertEqual(r.token, null, 'Token nicht entfernt');
  assertEqual(r.gist, null, 'Gist-Id nicht entfernt');
});

// ---------------------------------------------------------------------------
suite('Auslieferung');

await test('errorlog.js liegt im Service-Worker-Cache', async () => {
  const sw = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');
  assert(sw.includes('./errorlog.js'), 'fehlt in urlsToCache');
});

await test('Die alte Gist-eigene Protokollfunktion ist weg', async () => {
  // In Jerico stand sie in app.js, nicht im Seiten-Markup. Der Kommentar in
  // app.js darf sie beim Namen nennen - geprueft wird die Funktion selbst
  // und ihr Aufruf. (Dieser Test war zuerst zu grob und schlug am eigenen
  // Kommentar fehl.)
  const dateien = ['app.js'].concat(SEITEN);
  for (const datei of dateien) {
    const text = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
    assert(!/function\s+logErrorToGist/.test(text), datei + ' hat die Funktion noch');
    assert(!/logErrorToGist\s*\(/.test(text), datei + ' ruft sie noch auf');
  }
});

await test('Der Sync-Fehler reicht Statuscode und Rohantwort weiter', async () => {
  // Ohne diese Weitergabe steht im Protokoll nur der Toast-Satz - genau das
  // Manko des Vorgaengers. Geprueft am Code, weil der Weg sonst still
  // verlorengehen kann, ohne dass ein Lauf rot wird.
  const app = fs.readFileSync(path.join(REPO_ROOT, 'app.js'), 'utf8');
  assert(/detail:\s*\{[^}]*quelle:\s*'saveData'/.test(app), 'saveData nennt keine Quelle');
  assert(/antwort:\s*roh/.test(app), 'Rohantwort wird nicht weitergereicht');
  assert(/status:\s*res\.status/.test(app), 'Statuscode wird nicht weitergereicht');
});

} finally {
  await browser.close();
  server.close();
  process.exit(summary());
}
