// Test-Infrastruktur: statischer Server, Browser-Setup, API-Stubs, Mini-Assertions.
//
// Die Tests laufen bewusst hermetisch: api.github.com und raw.githubusercontent.com
// werden abgefangen. Sonst waeren sie vom Rate-Limit abhaengig und wuerden jedes Mal
// brechen, wenn ein neues Foto ins Repo kommt.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

/**
 * Browser starten. CHROMIUM_PATH erlaubt einen vorinstallierten Browser
 * (z.B. in Containern), sonst nimmt Playwright den selbst heruntergeladenen.
 *
 * Steht hier und nicht in den Testdateien: der Handgriff stand zuerst nur in
 * ui.test.mjs, und die naechste Testdatei startete ohne ihn - sie lief
 * ueberall dort nicht, wo kein Browser heruntergeladen ist.
 */
export function browserStarten(opts = {}) {
  const pfad = process.env.CHROMIUM_PATH;
  return chromium.launch(pfad ? { executablePath: pfad, ...opts } : opts);
}

/**
 * Kontext fuer einen Test. Der Service Worker bleibt aus.
 *
 * app.js registriert sw.js. Sobald der aktiv ist, laufen die Requests der
 * Seite durch ihn - und an page.route() vorbei. Die Stubs greifen dann nicht
 * mehr, der Aufruf scheitert als "Failed to fetch", und der Test prueft einen
 * Fehler, den er selbst erzeugt hat. Sichtbar wurde das erst daran, dass
 * dieselbe Pruefung mit einer Wartezeit davor fehlschlug und ohne sie nicht.
 */
export function neuerKontext(browser, opts = {}) {
  return browser.newContext({ serviceWorkers: 'block', ...opts });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf'
};

/** Statischer Server fuer das Repo-Verzeichnis, auf einem freien Port. */
export function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(REPO_ROOT, rel);
    // Kein Ausbruch aus dem Repo-Verzeichnis
    if (!file.startsWith(REPO_ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: 'http://127.0.0.1:' + server.address().port });
    });
  });
}

export const TREE_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(HERE, 'fixtures', 'tree.json'), 'utf8')
);

// Aus der Fixture abgeleitet, damit Erwartungswerte nicht doppelt gepflegt werden.
export function fixtureCounts() {
  const out = {};
  for (const e of TREE_FIXTURE.tree) {
    if (e.type !== 'blob' || !e.path.startsWith('img/user/')) continue;
    const rest = e.path.slice('img/user/'.length);
    const parts = rest.split('/');
    if (parts.length !== 2 || !parts[1]) continue;   // Unterordner zaehlen nicht
    out[parts[0]] = (out[parts[0]] || 0) + 1;
  }
  return out;
}

// 1x1 JPEG, damit Thumbnails nicht wirklich aus dem Netz geladen werden.
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

/**
 * Faengt alle externen Requests ab.
 * @param {object} page
 * @param {object} opts
 *   opts.tree      - Tree-Antwort (Default: Fixture); null => Netzwerkfehler (offline)
 *   opts.gistFiles - { "<dateiname>": "<inhalt>" } fuer GET /gists/<id>
 *   opts.onGistWrite - Callback fuer PATCH /gists/<id>, bekommt das files-Objekt
 *   opts.gistPatchFehler - { status, body } laesst PATCH /gists/<id> scheitern
 *   opts.gistListe       - Antwort auf GET /gists (Default: leere Liste)
 *   opts.gistListeFehler - { status, body } laesst GET /gists scheitern
 *   opts.userLogin       - Kontoname fuer GET /user (Default: pruefkonto)
 *   opts.userFehler      - { status, body } laesst GET /user scheitern
 */
export async function stubGitHub(page, opts = {}) {
  const state = { treeRequests: 0, gistWrites: [] };

  // Alles andere Externe blocken, damit kein Test versehentlich ins Netz geht.
  await page.route('**://**', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1')) return route.continue();
    return route.abort('failed');
  });

  await page.route('**raw.githubusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG }));

  await page.route('**api.github.com/repos/**/git/trees/**', (route) => {
    state.treeRequests++;
    const tree = opts.tree === undefined ? TREE_FIXTURE : opts.tree;
    if (tree === null) return route.abort('failed');       // offline
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'ETag': 'W/"fixture"', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(tree)
    });
  });

  // Die Tree-Route setzt Access-Control-Allow-Origin, die Gist-Route tat es
  // nicht. Ein PATCH mit Authorization-Header ist kein einfacher Request:
  // der Browser schickt vorher ein OPTIONS, und eine Antwort darauf ohne
  // diese Kopfzeile laesst den Aufruf als "Failed to fetch" scheitern - der
  // Statuscode, um den es geht, kommt im Code nie an.
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type'
  };

  // Die Gist-LISTE (GET /gists?per_page=...). Sie war nicht gestubbt: das
  // Muster '/gists/**' verlangt einen Schraegstrich nach gists, die Liste hat
  // keinen. Der Aufruf lief damit in die Catch-All-Route und brach ab - der
  // Weg, auf dem sich die App mit einem Token verbindet, war nie geprueft.
  // GET /user - die erste Pruefung beim Verbinden. War ebenfalls nicht
  // gestubbt, also lief schon der erste Schritt in die Catch-All-Route.
  await page.route('**api.github.com/user', (route) => {
    if (opts.userFehler) {
      return route.fulfill({
        status: opts.userFehler.status, contentType: 'application/json',
        headers: CORS, body: opts.userFehler.body
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ login: opts.userLogin || 'pruefkonto' })
    });
  });

  await page.route('**api.github.com/gists?*', (route) => {
    if (opts.gistListeFehler) {
      return route.fulfill({
        status: opts.gistListeFehler.status, contentType: 'application/json',
        headers: CORS, body: opts.gistListeFehler.body
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify(opts.gistListe || [])
    });
  });

  await page.route('**api.github.com/gists/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    }
    if (req.method() === 'PATCH') {
      const files = JSON.parse(req.postData() || '{}').files || {};
      state.gistWrites.push(files);
      if (opts.onGistWrite) opts.onGistWrite(files);
      // Den Schreibversuch gezielt scheitern lassen. Das gehoert hierher und
      // nicht in eine zweite, spaeter angemeldete Route: die Catch-All-Route
      // oben bricht alles Externe ab, und ein Preflight haette sie getroffen -
      // der Aufruf wuerde dann als "Failed to fetch" scheitern statt mit dem
      // Statuscode, um den es geht.
      if (opts.gistPatchFehler) {
        return route.fulfill({
          status: opts.gistPatchFehler.status,
          contentType: 'application/json',
          headers: CORS,
          body: opts.gistPatchFehler.body
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' });
    }
    const files = {};
    for (const [name, content] of Object.entries(opts.gistFiles || {})) {
      files[name] = { filename: name, content, truncated: false };
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ id: 'stub', files })
    });
  });

  return state;
}

/** Wartet, bis die Galerie einmal aufgebaut wurde. */
export async function waitForGallery(page, { expectTree = true } = {}) {
  if (expectTree) {
    await page.waitForFunction(
      () => typeof _treeFetchedAt !== 'undefined' && _treeFetchedAt > 0,
      null, { timeout: 30000 });
  }
  await page.waitForFunction(
    () => typeof photoData !== 'undefined' && photoData !== null,
    null, { timeout: 30000 });
  await page.waitForTimeout(150);
}

export function totalPhotos(page) {
  return page.evaluate(() => {
    let n = 0;
    for (const g in photoData) n += photoData[g].length;
    return n;
  });
}

// ==== Mini-Test-Runner ====
const results = [];
let currentSuite = '';

export function suite(name) { currentSuite = name; console.log('\n' + name); }

export async function test(name, fn) {
  try {
    await fn();
    results.push({ name, suite: currentSuite, ok: true });
    console.log('  PASS  ' + name);
  } catch (err) {
    results.push({ name, suite: currentSuite, ok: false, err });
    console.log('  FAIL  ' + name);
    console.log('        ' + String(err && err.message || err).split('\n')[0]);
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion fehlgeschlagen');
}

export function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'erwartet ' + e + ', war ' + a);
}

export function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '-'.repeat(52));
  console.log(results.length - failed.length + '/' + results.length + ' Tests bestanden');
  if (failed.length) {
    console.log('\nFehlgeschlagen:');
    for (const f of failed) console.log('  - ' + f.name + '\n    ' + String(f.err && f.err.stack || f.err));
  }
  return failed.length;
}
