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
suite('Zwei Geraete loeschen sich nichts');

// Der Befund: saveData() schrieb den lokalen Datensatz ohne Rueckfrage in den
// Gist. Ein Geraet, das den Stand des anderen noch nicht kennt, ersetzte die
// Datei komplett - die Felder des anderen Geraets kamen darin gar nicht vor
// und waren aus der Cloud weg, obwohl niemand sie geloescht hat.
//
// Galerie und Befunde machen es seit immer richtig: lesen, mergen, schreiben.

async function geraet(datei, gistInhalt, aufGeschrieben) {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  await stubGitHub(page, {
    gistFiles: { 'jerico-build-log-data.json': JSON.stringify(gistInhalt) },
    onGistWrite: (files) => {
      const f = files['jerico-build-log-data.json'];
      if (f) aufGeschrieben.push(JSON.parse(f.content));
    }
  });
  await page.goto(base + '/' + datei);
  await page.waitForFunction(() => typeof saveData === 'function', null, { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('gh_token', 'testtoken');
    localStorage.setItem('jerico_gist_id', 'testgist');
    window.FIXED_GIST_ID = 'testgist';
  });
  return { page: page, close: () => ctx.close() };
}

await test('Ein Geraet ohne den fremden Stand loescht ihn nicht aus der Cloud', async () => {
  const geschrieben = [];
  // In der Cloud liegt ein Feld, das dieses Geraet noch nie gesehen hat.
  const cloud = {
    p1_case_number: 'RH02374',
    _fieldTimes: { p1_case_number: Date.now() },
    _savedAt: new Date().toISOString()
  };
  const g = await geraet('build-log.html', cloud, geschrieben);

  const r = await g.page.evaluate(async () => {
    // Dieses Geraet kennt p1_case_number nicht und traegt in ein ANDERES Feld
    // ein. (Die erste Fassung schrieb in genau das Feld, das sie prueft.)
    localStorage.setItem('jericoBuildLog', JSON.stringify({}));
    const feld = [...document.querySelectorAll('textarea[data-field], input[type="text"][data-field]')]
      .find((e) => e.dataset.field !== 'p1_case_number');
    feld.value = 'Von Geraet B';
    const ok = await saveData();
    return { ok: ok, feldname: feld.dataset.field };
  });
  await g.close();

  assert(geschrieben.length >= 1, 'Es wurde nichts in den Gist geschrieben');
  const hoch = geschrieben[geschrieben.length - 1];
  assertEqual(hoch.p1_case_number, 'RH02374',
    'Der fremde Wert fehlt im hochgeschriebenen Datensatz - verlorener Schreibvorgang');
  assertEqual(hoch[r.feldname], 'Von Geraet B', 'Der eigene Wert fehlt');
});

await test('Beim Speichern kommt der fremde Stand auch in die Anzeige', async () => {
  // Sonst sieht man auf diesem Geraet weiter einen Stand, den es nicht mehr gibt.
  const geschrieben = [];
  const cloud = {
    p1_case_number: 'RH02374',
    _fieldTimes: { p1_case_number: Date.now() },
    _savedAt: new Date().toISOString()
  };
  const g = await geraet('build-log.html', cloud, geschrieben);
  const r = await g.page.evaluate(async () => {
    localStorage.setItem('jericoBuildLog', JSON.stringify({}));
    await saveData();
    const el = document.querySelector('[data-field="p1_case_number"]');
    return { imFeld: el ? el.value : null,
             imSpeicher: JSON.parse(localStorage.getItem('jericoBuildLog')).p1_case_number };
  });
  await g.close();
  assertEqual(r.imSpeicher, 'RH02374', 'Fremder Wert nicht lokal uebernommen');
  if (r.imFeld !== null) assertEqual(r.imFeld, 'RH02374', 'Fremder Wert nicht in der Anzeige');
});

await test('Beim selben Feld gewinnt der spaetere Eintrag', async () => {
  const geschrieben = [];
  const alt = Date.now() - 60000;
  const cloud = {
    p1_len_total: '800',
    _fieldTimes: { p1_len_total: alt },
    _savedAt: new Date(alt).toISOString()
  };
  const g = await geraet('build-log.html', cloud, geschrieben);
  const r = await g.page.evaluate(async () => {
    // Lokal neuer: derselbe Schluessel, spaeterer Zeitstempel.
    const jetzt = Date.now();
    localStorage.setItem('jericoBuildLog', JSON.stringify({
      p1_len_total: '810', _fieldTimes: { p1_len_total: jetzt },
      _savedAt: new Date(jetzt).toISOString()
    }));
    // Der Wert muss auch im Feld stehen: saveData() sammelt zuerst das DOM
    // ein, und ein leeres Feld ueber einem gespeicherten Wert ist ein Leeren.
    const el = document.querySelector('[data-field="p1_len_total"]');
    if (el) el.value = '810';
    await saveData();
    return JSON.parse(localStorage.getItem('jericoBuildLog')).p1_len_total;
  });
  await g.close();
  assertEqual(r, '810', 'Der aeltere Cloud-Wert hat den neueren lokalen ueberschrieben');
  const hoch = geschrieben[geschrieben.length - 1];
  assertEqual(hoch.p1_len_total, '810', 'Der aeltere Wert wurde hochgeschrieben');
});

await test('Ein Leer-Stempel von vor dem Stichtag schlaegt keinen vorhandenen Wert - auch mit neuerem Datum', async () => {
  // Der Fall, der wirklich eingetreten ist. v30 hat das Stempeln leerer
  // Felder abgestellt, aber die bis dahin gestempelten blieben liegen und
  // wirkten weiter: im Cloud-Stand trugen 171 leere Felder einen neueren
  // Zeitstempel als die Eintragungen des anderen Geraets. Beim
  // Zusammenfuehren gewann die Leere - 69 Felder Dokumentation wurden durch
  // Leerstrings ersetzt.
  //
  // Seit v33 zaehlt ein Leer erst ab dem Stichtag (FieldSync.LEER_STICHTAG).
  // Die Zeiten hier liegen darum ausdruecklich DAVOR - mit Date.now() wuerde
  // dieser Test ab dem Stichtag rot, ohne dass sich am Code etwas aendert.
  const p = await oeffne('index.html');
  const r = await p.page.evaluate(() => {
    const alt = FieldSync.LEER_STICHTAG - 2 * 86400000;   // der echte Wert
    const neu = FieldSync.LEER_STICHTAG - 86400000;       // die Leere, einen Tag juenger
    const wolke = { p1_case_number: '', p2_topcover: '',
      _fieldTimes: { p1_case_number: neu, p2_topcover: neu },
      _savedAt: new Date(neu).toISOString() };
    const hier = { p1_case_number: 'RH02374', p2_topcover: 'done',
      _fieldTimes: { p1_case_number: alt, p2_topcover: alt },
      _savedAt: new Date(alt).toISOString() };
    const m = FieldSync.mergeRecords(wolke, hier);
    // Und die Gegenrichtung: der echte Wert in der Wolke, die Leere hier.
    const m2 = FieldSync.mergeRecords(hier, { p1_case_number: '',
      _fieldTimes: { p1_case_number: neu }, _savedAt: new Date(neu).toISOString() });
    return { a: m.p1_case_number, b: m.p2_topcover, c: m2.p1_case_number };
  });
  await p.close();

  assertEqual(r.a, 'RH02374', 'Die neuere Leere aus der Wolke hat den Wert ueberschrieben');
  assertEqual(r.b, 'done', 'Die neuere Leere aus der Wolke hat den Status ueberschrieben');
  assertEqual(r.c, 'RH02374', 'Die neuere Leere vom Geraet hat den Wolkenwert ueberschrieben');
});

await test('Bei zwei vorhandenen Werten gewinnt weiterhin der spaetere', async () => {
  // Die Regel gilt nur gegen Leere. Zwei echte Werte entscheiden wie bisher
  // nach Zeitstempel - sonst waere der Abgleich wertlos.
  const p = await oeffne('index.html');
  const r = await p.page.evaluate(() => {
    const alt = Date.now() - 86400000, neu = Date.now();
    const m = FieldSync.mergeRecords(
      { p1_len_total: '810', _fieldTimes: { p1_len_total: neu } },
      { p1_len_total: '800', _fieldTimes: { p1_len_total: alt } });
    const m2 = FieldSync.mergeRecords(
      { p1_len_total: '800', _fieldTimes: { p1_len_total: alt } },
      { p1_len_total: '810', _fieldTimes: { p1_len_total: neu } });
    return { a: m.p1_len_total, b: m2.p1_len_total };
  });
  await p.close();
  assertEqual(r.a, '810', 'Der spaetere Cloud-Wert hat nicht gewonnen');
  assertEqual(r.b, '810', 'Der spaetere lokale Wert hat nicht gewonnen');
});

await test('Ein leeres Feld bekommt keinen Zeitstempel, nur weil die Seite es zeigt', async () => {
  // Der eigentliche Befund. Vorher stempelte jedes angezeigte leere Feld mit
  // "jetzt" - und schlug damit beim Abgleich jeden echten Wert, den ein
  // anderes Geraet vorher eingetragen hatte. Ein Geraet musste eine Seite nur
  // oeffnen, um die Eintraege des anderen zu loeschen.
  const p = await oeffne('build-log.html');
  await p.page.waitForFunction(() => typeof saveData === 'function', null, { timeout: 30000 });
  const r = await p.page.evaluate(async () => {
    localStorage.setItem('jericoBuildLog', JSON.stringify({}));
    await saveData();                      // ohne Gist: nur lokal
    const d = JSON.parse(localStorage.getItem('jericoBuildLog'));
    const t = d._fieldTimes || {};
    const angezeigt = [...document.querySelectorAll('[data-field]')].length;
    const leerGestempelt = Object.keys(t).filter((k) => {
      const v = d[k];
      return v === '' || v === false || v === undefined;
    });
    return { angezeigt: angezeigt, gestempelt: Object.keys(t).length,
             leerGestempelt: leerGestempelt.length };
  });
  await p.close();

  assert(r.angezeigt > 20, 'Zu wenige Felder auf der Seite: ' + r.angezeigt);
  assertEqual(r.leerGestempelt, 0,
    r.leerGestempelt + ' leere Felder tragen einen Zeitstempel, obwohl sie nie etwas enthielten');
});

await test('Eine Eingabe wird auch ohne "Speichern" hochgeschoben', async () => {
  // Wer nie auf Speichern drueckt, hatte alles nur auf seinem Geraet.
  const geschrieben = [];
  const g = await geraet('build-log.html', {}, geschrieben);
  await g.page.evaluate(() => {
    const feld = document.querySelector('textarea[data-field], input[type="text"][data-field]');
    feld.value = 'Ohne Speichern getippt';
    autoSave();
  });
  // 600 ms lokal + 4000 ms bis zum Hochschieben, plus Luft.
  await g.page.waitForTimeout(6000);
  const feldname = await g.page.evaluate(() =>
    document.querySelector('textarea[data-field], input[type="text"][data-field]').dataset.field);
  await g.close();

  assert(geschrieben.length >= 1, 'Nach einer Eingabe wurde nichts hochgeschoben');
  assertEqual(geschrieben[geschrieben.length - 1][feldname], 'Ohne Speichern getippt',
    'Der getippte Wert kam nicht in der Cloud an');
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

// ---------------------------------------------------------------------------
suite('v33: Abgleich beim Oeffnen, nichts ohne Lesen, Stichtag');

const DATEN = 'jerico-build-log-data.json';
const BEFUNDE = 'jerico-build-findings.json';
const FOTOS = 'jerico-build-photos.json';

/** Ein Geraet mit verbundenem, nachgebautem Gist, der sich Geschriebenes merkt. */
async function geraetMitGist(datei, opts = {}, uhr = null) {
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (uhr) await page.clock.setFixedTime(new Date(uhr));
  const gist = opts.gistFiles || (opts.gistFiles = {});
  const stub = await stubGitHub(page, Object.assign({
    onGistWrite: (files) => { for (const [n, f] of Object.entries(files)) gist[n] = f.content; }
  }, opts));
  await ctx.addInitScript(() => {
    localStorage.setItem('gh_token', 'test-token');
    localStorage.setItem('jerico_gist_id', 'stub');
  });
  await page.goto(base + '/' + datei);
  await page.waitForFunction(() => typeof syncFromCloud === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(800);   // der Abgleich beim Oeffnen
  return { ctx, page, errors, stub, gist, close: () => ctx.close() };
}

/** Name des ersten Messfelds der Seite - aus der Seite, nicht abgeschrieben. */
async function erstesFeld(datei) {
  const d = await geraetMitGist(datei);
  const n = await d.page.evaluate(() =>
    document.querySelector('input[data-field]:not([readonly]):not([type=checkbox])').dataset.field);
  await d.close();
  return n;
}

const FELD = await erstesFeld('build-log.html');

await test('Beim Oeffnen kommt der Messwert des anderen Geraets an', async () => {
  // Bis v32 war syncFromCloud an nichts angeschlossen: hereingeholt wurde nur
  // nach einer eigenen Eingabe.
  const d = await geraetMitGist('build-log.html', { gistFiles: {
    [DATEN]: JSON.stringify({ [FELD]: 'vom iPad', _fieldTimes: { [FELD]: Date.now() - 60000 } })
  } });
  const wert = await d.page.evaluate((f) => document.querySelector('[data-field="' + f + '"]').value, FELD);
  const fehler = d.errors.slice();
  await d.close();
  assertEqual(fehler, [], 'Fehler auf der Seite');
  assertEqual(wert, 'vom iPad', 'Wert im Feld nach dem Oeffnen');
});

await test('Beim Oeffnen kommen Befunde und Galerie-Texte des anderen Geraets an', async () => {
  // Bis v32 kamen beide nur, wenn man selbst etwas daran aenderte.
  const foto = 'p1_ident_photos/1700000000000_0.jpg';
  const d = await geraetMitGist('build-log.html', { gistFiles: {
    [BEFUNDE]: JSON.stringify({ items: { b_ipad: { ch: 'p1', text: 'vom iPad', status: '', created: 1, m: 1 } } }),
    [FOTOS]: JSON.stringify({ version: 2, meta: { [foto]: { caption: 'Beschriftung vom iPad', m: 1 } }, videos: {}, hero: {} })
  } });
  const r = await d.page.evaluate((k) => ({
    befund: ((JSON.parse(localStorage.getItem('jericoFindings') || '{}').items || {}).b_ipad || {}).text,
    text: (_galleryMeta.meta[k] || {}).caption
  }), foto);
  await d.close();
  assertEqual(r.befund, 'vom iPad', 'Befund nach dem Oeffnen');
  assertEqual(r.text, 'Beschriftung vom iPad', 'Galerie-Text nach dem Oeffnen');
});

await test('Scheitert das Lesen, wird nichts geschrieben - Messwerte, Befunde, Galerie', async () => {
  // Bis v32 ging in dem Fall in allen drei Kanaelen der rein lokale Stand
  // hoch. Was nur das andere Geraet kannte, war danach aus der Cloud weg.
  const d = await geraetMitGist('build-log.html',
    { gistGetFehler: { status: 500, body: JSON.stringify({ message: 'Server Error' }) } });
  const r = await d.page.evaluate(async (f) => {
    ErrorLog.leeren();
    document.querySelector('[data-field="' + f + '"]').value = 'lokal';
    await saveData();
    await Findings.push();
    await pushGalleryMeta();
    return ErrorLog.alle().map((e) => e.nachricht || '');
  }, FELD);
  const schreibvorgaenge = d.stub.gistWrites.filter((w) => DATEN in w || BEFUNDE in w || FOTOS in w).length;
  await d.close();
  assertEqual(schreibvorgaenge, 0, 'Schreibzugriffe trotz Lesefehler');
  assert(r.some((m) => /Befunde/.test(m)) && r.some((m) => /Galerie/.test(m)),
    'Fehler von Befunden/Galerie stehen nicht im Protokoll: ' + r.join(' | '));
});

await test('Ein bewusst geleertes Feld bleibt leer und wandert mit (nach dem Stichtag)', async () => {
  // v32 hat "ein Wert schlaegt immer ein Leer" eingefuehrt. Ein bewusst
  // geleertes Feld liess sich damit nicht leeren: beim naechsten Speichern
  // holte das Mischen den alten Cloud-Wert zurueck. Seit v33 zaehlt ein Leer,
  // das nach dem Stichtag gestempelt wurde. Die Uhr steht dafuer auf November.
  const d = await geraetMitGist('build-log.html', { gistFiles: {
    [DATEN]: JSON.stringify({ [FELD]: 'alter Wert', _fieldTimes: { [FELD]: Date.parse('2026-10-20T08:00:00Z') } })
  } }, '2026-11-01T10:00:00Z');
  const r = await d.page.evaluate(async (f) => {
    const el = document.querySelector('[data-field="' + f + '"]');
    const vorher = el.value;
    el.value = '';
    await saveData();
    return { vorher, nachher: el.value };
  }, FELD);
  const cloud = JSON.parse(d.gist[DATEN]);
  await d.close();
  assertEqual(r.vorher, 'alter Wert', 'Ausgangswert aus der Cloud');
  assertEqual(r.nachher, '', 'Das Feld hat den alten Wert zurueckbekommen');
  assertEqual(cloud[FELD], '', 'Das Leeren ist nicht in der Cloud angekommen');
});

await test('Ein Leer-Stempel vor dem Stichtag schlaegt keinen Wert - in beiden Richtungen', async () => {
  // Im Gist liegen 196 leere Felder mit Stempel vom 19.10., je ein
  // Seitenaufruf. Der Wert ist absichtlich AELTER als das Leer: genau dann
  // waere der Fehler sichtbar.
  const d = await geraetMitGist('build-log.html');
  const r = await d.page.evaluate(() => {
    const vor = FieldSync.LEER_STICHTAG - 60000;
    const wert = { x: '0.18', _fieldTimes: { x: vor - 1000 } };
    const leer = { x: '', _fieldTimes: { x: vor } };
    const ohneStempel = FieldSync.mergeRecords(
      { x: '0.18', _fieldTimes: { x: FieldSync.LEER_STICHTAG + 10 } },
      { x: '', y: '1', _fieldTimes: { y: FieldSync.LEER_STICHTAG + 99 }, _savedAt: '2030-01-01T00:00:00Z' });
    return [FieldSync.mergeRecords(leer, wert).x, FieldSync.mergeRecords(wert, leer).x, ohneStempel.x];
  });
  await d.close();
  assertEqual(r, ['0.18', '0.18', '0.18'], 'Cloud leer / lokal leer / Leer ohne eigenen Stempel');
});

await test('Ein gekuerztes Bild-Listing raeumt keine Beschriftungen weg', async () => {
  // Das Aufraeumen haelt Beschriftungen ohne Bild im Repo fuer verwaist. Ein
  // gekuerztes Listing kennt aber nicht alle Bilder.
  const tree = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'tree.json'), 'utf8'));
  tree.truncated = true;
  const key = 'p1_ident_photos/1600000000000_9.jpg';     // nicht im (gekuerzten) Listing
  const d = await geraetMitGist('build-log.html', { tree });
  await d.page.waitForFunction(() => typeof _treeFetchedAt !== 'undefined' && _treeFetchedAt > 0,
    null, { timeout: 30000 });
  await d.page.evaluate(async (k) => {
    _galleryMeta.meta[k] = { caption: 'Bild jenseits des Listings', m: 1 };
    saveGalleryMeta();
    await pushGalleryMeta();
  }, key);
  const meta = JSON.parse(d.gist[FOTOS] || '{}').meta || {};
  await d.close();
  assert(meta[key], 'Die Beschriftung wurde bei gekuerztem Listing weggeraeumt');
});

await test('Der Sync-Fehler reicht Statuscode und Rohantwort weiter', async () => {
  // Ohne diese Weitergabe steht im Protokoll nur der Toast-Satz - genau das
  // Manko des Vorgaengers. Geprueft am Code, weil der Weg sonst still
  // verlorengehen kann, ohne dass ein Lauf rot wird.
  //
  // Seit v33 liest und schreibt field-sync.js (cloudAbgleichen, wortgleich mit
  // gt40-engine); app.js reicht dessen detail weiter und setzt die Quelle.
  const app = fs.readFileSync(path.join(REPO_ROOT, 'app.js'), 'utf8');
  const fs_ = fs.readFileSync(path.join(REPO_ROOT, 'field-sync.js'), 'utf8');
  assert(/r\.detail[\s\S]{0,40}quelle:\s*'saveData'/.test(app), 'saveData nennt keine Quelle');
  assert(/antwort:\s*roh/.test(fs_), 'Rohantwort wird nicht weitergereicht');
  assert(/status:\s*wr\.status/.test(fs_), 'Statuscode wird nicht weitergereicht');
});

} finally {
  await browser.close();
  server.close();
  process.exit(summary());
}
