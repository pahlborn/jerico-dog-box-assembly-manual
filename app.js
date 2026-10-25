/**
 * app.js - gemeinsames Verhalten aller drei Seiten.
 *
 * index.html (Uebersicht), specs.html (Spezifikationen) und build-log.html
 * (Zusammenbau) laden dieselbe Datei. Im Vorbild (pahlborn/gt40-engine) steht
 * dieser Teil dreimal als Inline-Script in den Seiten; hier liegt er einmal,
 * damit eine Korrektur nicht an drei Stellen nachgezogen werden muss.
 *
 * Erwartet im <head> geladen: version.js, changelog.js, findings.js,
 * gallery.js, field-sync.js. search.js wird am Seitenende geladen.
 *
 * Bereitgestellt fuer gallery.js und findings.js:
 *   showToast(text), getGistConfig(), FIXED_GIST_ID, updateSaveStatus()
 *
 * Speicher (alles unter eigener Kennung - die Seiten des Motor-Builds liegen
 * auf derselben Origin und wuerden sich sonst gegenseitig ueberschreiben):
 *   jericoBuildLog        Messwerte und Eingabefelder
 *   jericoFindings        Befunde je Kapitel (findings.js)
 *   jericoGalleryMeta     Bildbeschriftungen (gallery.js)
 *   jericoLang            zuletzt gewaehlte Sprache
 *   jerico_gist_id        Gist fuer den Geraeteabgleich
 *   gh_token             GitHub-Token (mit dem Motor-Build geteilt)
 */
(function () {
    'use strict';

    // ==== KONFIGURATION ====
    var GIST_FILENAME = 'jerico-build-log-data.json';
    var STORAGE_KEY = 'jericoBuildLog';
    var LANG_KEY = 'jericoLang';
    var GIST_ID_KEY = 'jerico_gist_id';
    var PAGE = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    var COLLAPSE_KEY = 'jerico_collapse_' + PAGE;
    var SCROLL_KEY = 'jerico_scroll_' + PAGE;

    // Anders als im Vorbild ist die Gist-ID nicht fest verdrahtet: dieses
    // Projekt bekommt seinen eigenen Gist, und welcher das ist, weiss erst der
    // Nutzer. Bis dahin laeuft alles lokal.
    window.FIXED_GIST_ID = localStorage.getItem(GIST_ID_KEY) || '';

    var isLoading = false;
    // Erst wenn die Daten im DOM stehen, darf ein leeres Feld als "bewusst
    // geleert" gewertet werden. Vorher sind alle Felder leer, weil noch nichts
    // geladen ist - ein Save in dem Moment wuerde alles ausradieren.
    var dataLoaded = false;
    var autoSaveTimer = null;

    function getGistConfig() { return { token: localStorage.getItem('gh_token') || '' }; }
    function isGistConfigured() { return getGistConfig().token.length > 0 && !!window.FIXED_GIST_ID; }

    // ==== WERKZEUGMENUE ====
    function toggleToolMenu() {
        var m = document.getElementById('toolMenu');
        if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
    }
    function closeToolMenu() {
        var m = document.getElementById('toolMenu');
        if (m) m.style.display = 'none';
    }
    document.addEventListener('click', function (e) {
        var menu = document.getElementById('toolMenu');
        var btn = document.getElementById('toolMenuBtn');
        if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && e.target !== btn) closeToolMenu();
    });

    // ==== EINSTELLUNGEN ====
    function openSettings() {
        var tok = document.getElementById('ghToken');
        if (tok) tok.value = getGistConfig().token;
        var dn = document.getElementById('deviceName');
        if (dn && typeof FieldSync !== 'undefined') dn.value = FieldSync.getDeviceName();
        updateConnectionStatus();
        var sm = document.getElementById('settingsModal');
        if (sm) sm.style.display = 'flex';
    }
    function closeSettings() {
        var sm = document.getElementById('settingsModal');
        if (sm) sm.style.display = 'none';
    }
    /**
     * Antwort von GitHub auf einen Fehlschlag einlesen.
     *
     * Beide Gist-Aufrufe gaben vorher bei jedem Fehler null zurueck. Damit war
     * "kein Gist gefunden" nicht von "darf nicht an Gists heran" zu
     * unterscheiden - und genau dieser Unterschied ist der, auf den es
     * ankommt: ein Token, der Fotos ins Repository schreiben darf, aber nicht
     * an Gists kommt, laesst die Fotos erscheinen und die Inhalte liegen.
     */
    async function fehlerAus(res) {
        var roh = ''; try { roh = await res.text(); } catch (e) {}
        var meldung = ''; try { meldung = (JSON.parse(roh).message) || ''; } catch (e) {}
        return { status: res.status, statusText: res.statusText, antwort: roh, meldung: meldung, url: res.url };
    }

    /** Sagt bei 401/403 auf einem Gist-Aufruf, was das bedeutet. */
    function gistZugriffHinweis(f) {
        if (f.status !== 401 && f.status !== 403 && f.status !== 404) return '';
        return ' Der Token kommt an GitHub durch, aber nicht an die Gists heran.'
            + ' Fotos liegen im Repository und brauchen das nicht - die Inhalte'
            + ' dieser App liegen im Gist. Pruefe die Gist-Berechtigung des Tokens;'
            + ' die genaue Antwort steht im Fehlerprotokoll.';
    }

    // Sucht einen bestehenden Gist anhand des Dateinamens.
    // Gibt { id } oder { fehler } zurueck - nie stillschweigend nichts.
    async function findGistByFilename(token) {
        var page = 1;
        while (page <= 5) { // max 5 Seiten = 500 Gists
            var res = await fetch('https://api.github.com/gists?per_page=100&page=' + page,
                { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) return { fehler: await fehlerAus(res) };
            var gists = await res.json();
            if (gists.length === 0) break;
            for (var i = 0; i < gists.length; i++) {
                if (gists[i].files && gists[i].files[GIST_FILENAME]) return { id: gists[i].id };
            }
            page++;
        }
        return {};   // durchgesucht, nichts gefunden - kein Fehler
    }
    // Erstellt einen neuen Gist fuer dieses Projekt.
    async function createGist(token) {
        var files = {};
        var localData = localStorage.getItem(STORAGE_KEY);
        files[GIST_FILENAME] = { content: localData || '{}' };
        var res = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Jerico RH02374 - Geraeteabgleich', public: false, files: files })
        });
        if (!res.ok) return { fehler: await fehlerAus(res) };
        var gist = await res.json();
        return { id: gist.id };
    }
    async function saveSettings() {
        var tokEl = document.getElementById('ghToken');
        var token = tokEl ? tokEl.value.trim() : '';
        if (!token) { showToast('Bitte Token eingeben!', { sticky: true, isError: true }); return; }
        try {
            showToast('Verbinde...');
            var res = await fetch('https://api.github.com/user', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) { showToast('Token ungueltig!', { sticky: true, isError: true }); return; }
            var user = await res.json();
            localStorage.setItem('gh_token', token);
            showToast('Suche Datenspeicher...');
            var gefunden = await findGistByFilename(token);
            if (gefunden.fehler) {
                var f = gefunden.fehler;
                showToast('Gist-Liste nicht lesbar (' + f.status + (f.meldung ? ': ' + f.meldung : '') + ').'
                    + gistZugriffHinweis(f), { sticky: true, isError: true,
                    detail: { quelle: 'findGistByFilename', status: f.status, statusText: f.statusText,
                              antwort: f.antwort, url: f.url } });
                return;
            }
            var gid = gefunden.id;
            if (!gid) {
                showToast('Lege Datenspeicher an...');
                var erzeugt = await createGist(token);
                if (erzeugt.fehler) {
                    var g = erzeugt.fehler;
                    showToast('Datenspeicher konnte nicht angelegt werden (' + g.status
                        + (g.meldung ? ': ' + g.meldung : '') + ').' + gistZugriffHinweis(g),
                        { sticky: true, isError: true,
                          detail: { quelle: 'createGist', status: g.status, statusText: g.statusText,
                                    antwort: g.antwort, url: g.url } });
                    return;
                }
                gid = erzeugt.id;
            }
            localStorage.setItem(GIST_ID_KEY, gid);
            window.FIXED_GIST_ID = gid;
            updateSyncBadge(); updateConnectionStatus(); closeSettings();
            // Der Erfolg war bisher stumm - nur das Abzeichen wechselte die
            // Farbe. Wer gerade einen Token eingetragen hat, will aber lesen,
            // dass es geklappt hat, und unter welchem Konto.
            showToast('Verbunden als ' + (user && user.login ? user.login : 'GitHub')
                + ' - Abgleich aktiv.');
        } catch (err) { showToast('Verbindungsfehler: ' + err.message, { sticky: true, isError: true }); }
    }
    function disconnectGist() {
        localStorage.removeItem('gh_token');
        localStorage.removeItem(GIST_ID_KEY);
        window.FIXED_GIST_ID = '';
        var tokEl = document.getElementById('ghToken');
        if (tokEl) tokEl.value = '';
        updateSyncBadge(); updateConnectionStatus();
        showToast('Verbindung getrennt.'); closeSettings();
    }

    // ==== VERSION ====
    function renderAppVersion() {
        var v = (typeof APP_VERSION === 'string') ? APP_VERSION : '';
        var gebaut = (typeof formatBuilt === 'function') ? formatBuilt() : '';
        // Nummer und Freigabezeitpunkt stehen getrennt, damit sie
        // unterschiedlich gewichtet werden koennen: die Nummer sagt, welcher
        // Stand das ist, der Zeitstempel, ob ein Geraet ihn schon geladen hat.
        // Zusammengesetzt in einem Element liesse sich das nicht abstufen.
        document.querySelectorAll('#appVersion, .app-version').forEach(function (el) {
            el.textContent = v;
        });
        document.querySelectorAll('.ht-built, .app-built').forEach(function (el) {
            el.textContent = gebaut;
            el.title = gebaut ? ('Freigegeben ' + APP_BUILT) : '';
        });
    }

    function updateSyncBadge() {
        var b = document.getElementById('syncBadge');
        if (!b) return;
        var sb = document.getElementById('syncBtn');
        if (isGistConfigured()) {
            b.innerHTML = '<span class="sync-badge online"><span class="sync-dot online"></span>Cloud Sync</span>';
            if (sb) sb.disabled = false;
        } else {
            b.innerHTML = '<span class="sync-badge offline"><span class="sync-dot offline"></span>Lokal</span>';
            if (sb) sb.disabled = true;
        }
    }
    function updateConnectionStatus() {
        var el = document.getElementById('connectionStatus');
        if (!el) return;
        if (isGistConfigured()) {
            el.className = 'status-line connected';
            var devId = typeof FieldSync !== 'undefined' ? FieldSync.getDeviceId() : '';
            el.innerHTML = 'Verbunden &mdash; Ger&auml;t: <code>' + (devId ? devId.substring(0, 12) : '?') + '</code>';
        } else if (getGistConfig().token) {
            // Stand hier "suche Datenspeicher..." - es suchte aber nichts. Das
            // ist ein Ruhezustand, nicht ein Vorgang: Token liegt vor, ein
            // Datenspeicher nicht. Fotos gehen trotzdem ins Repository, die
            // Inhalte bleiben auf diesem Geraet.
            el.className = 'status-line disconnected';
            el.innerHTML = 'Token gesetzt, aber <strong>kein Datenspeicher</strong> &mdash; '
                + 'Inhalte bleiben auf diesem Ger&auml;t. Auf &bdquo;Verbinden&ldquo; tippen.';
        } else {
            el.className = 'status-line disconnected';
            el.textContent = 'Nicht verbunden';
        }
    }

    /**
     * Alles abgleichen, was ein anderes Geraet geaendert haben kann:
     * Messwerte, Befunde und die Beschriftungen der Galerie - aus einem Abruf.
     *
     * Bis v32 war diese Funktion an nichts angeschlossen. Hereingeholt wurde
     * nur nach einer eigenen Eingabe; ein Geraet zeigte den alten Stand, bis
     * man dort etwas eintrug, und Befunde und Bildtexte des anderen Geraets
     * kamen nie von selbst an.
     *
     * opts.still: Aufruf im Hintergrund (Oeffnen, Zurueckholen, online) -
     * Fehler ins Protokoll statt als Meldung, sonst meldete jedes Funkloch.
     */
    var _letzterAbgleich = 0;
    async function syncFromCloud(opts) {
        opts = opts || {};
        var manuell = !opts.still;
        if (!isGistConfigured()) { if (manuell) openSettings(); return false; }
        if (!navigator.onLine) {
            if (manuell) showToast('Offline - abgeglichen wird, sobald wieder Verbindung besteht.');
            return false;
        }
        _letzterAbgleich = Date.now();
        if (dataLoaded) saveFieldsLocal();      // offene Eingaben zuerst sichern
        var token = getGistConfig().token;
        var r = await FieldSync.cloudAbgleichen({ token: token, gistId: window.FIXED_GIST_ID,
            datei: GIST_FILENAME, speicherKey: STORAGE_KEY });
        if (!r.ok) {
            var detail = Object.assign({}, r.detail || {}, { quelle: 'syncFromCloud' });
            if (manuell) showToast('Sync-Fehler: ' + r.fehler, { sticky: true, isError: true, detail: detail });
            else if (typeof ErrorLog !== 'undefined') ErrorLog.add('Abgleich: ' + r.fehler, detail);
            return false;
        }
        if (r.lokalGeaendert) { var war = isLoading; isLoading = true; applyData(r.gemischt); isLoading = war; }
        try {
            if (await Findings.pull(r.gist, token)) renderAllFindings();
        } catch (e) {
            if (typeof ErrorLog !== 'undefined') ErrorLog.add('Befunde nicht abgleichbar: ' + e.message, { quelle: 'syncFromCloud', stack: e.stack });
        }
        try {
            if (typeof pullGalleryMeta === 'function' && await pullGalleryMeta(r.gist, token)
                && typeof refreshGallery === 'function') refreshGallery(false);
        } catch (e) {
            if (typeof ErrorLog !== 'undefined') ErrorLog.add('Galerie-Texte nicht abgleichbar: ' + e.message, { quelle: 'syncFromCloud', stack: e.stack });
        }
        updateSaveStatus();
        return true;
    }

    /** Im Hintergrund abgleichen, hoechstens alle 30 Sekunden. */
    function abgleichenWennFaellig() {
        if (document.hidden) return;
        if (Date.now() - _letzterAbgleich < 30000) return;
        syncFromCloud({ still: true });
    }

    // ==== AUF- UND ZUKLAPPEN ====
    function saveCollapseState() {
        var state = {};
        document.querySelectorAll('.phase-body').forEach(function (b) {
            if (b.classList.contains('collapsed')) state['pb_' + b.id] = 1;
        });
        document.querySelectorAll('.step-guide').forEach(function (g, i) {
            if (g.classList.contains('open')) state['sg_' + i] = 1;
        });
        document.querySelectorAll('.section-body').forEach(function (b, i) {
            if (b.classList.contains('collapsed')) state['sb_' + i] = 1;
        });
        document.querySelectorAll('.comp-body').forEach(function (b, i) {
            if (b.classList.contains('open')) state['cb_' + i] = 1;
        });
        try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch (e) {}
    }
    function restoreCollapseState() {
        var raw = localStorage.getItem(COLLAPSE_KEY);
        if (!raw) return;
        try {
            var state = JSON.parse(raw);
            document.querySelectorAll('.phase-body').forEach(function (b) {
                var toggle = document.getElementById('toggle_' + b.id);
                var zu = !!state['pb_' + b.id];
                b.classList.toggle('collapsed', zu);
                if (toggle) toggle.classList.toggle('collapsed', zu);
            });
            document.querySelectorAll('.step-guide').forEach(function (g, i) {
                if (!state['sg_' + i]) return;
                g.classList.add('open');
                var card = g.closest('.step-card');
                var btn = card && card.querySelector('.guide-toggle');
                if (btn) btn.classList.add('open');
            });
            document.querySelectorAll('.section-body').forEach(function (b, i) {
                var zu = !!state['sb_' + i];
                b.classList.toggle('collapsed', zu);
                var head = b.previousElementSibling;
                if (head && head.classList.contains('section-header')) head.classList.toggle('collapsed', zu);
            });
            document.querySelectorAll('.comp-body').forEach(function (b, i) {
                var auf = !!state['cb_' + i];
                b.classList.toggle('open', auf);
                var t = b.previousElementSibling;
                if (t && t.classList.contains('comp-toggle')) t.classList.toggle('open', auf);
            });
        } catch (e) {}
    }

    function togglePhase(bodyId) {
        var body = document.getElementById(bodyId);
        var toggle = document.getElementById('toggle_' + bodyId);
        if (!body) return;
        var zu = body.classList.toggle('collapsed');
        if (toggle) toggle.classList.toggle('collapsed', zu);
        saveCollapseState();
    }
    function toggleGuide(btn) {
        var card = btn.closest('.step-card');
        var guide = card && card.querySelector('.step-guide');
        if (guide) btn.classList.toggle('open', guide.classList.toggle('open'));
        saveCollapseState();
    }
    function toggleSection(header) {
        header.classList.toggle('collapsed');
        var body = header.nextElementSibling;
        if (body) body.classList.toggle('collapsed');
        saveCollapseState();
    }
    function toggleComp(el) {
        el.classList.toggle('open');
        var body = el.nextElementSibling;
        if (body) body.classList.toggle('open');
        saveCollapseState();
    }
    function toggleGroup(btn, groupId) {
        // Alle Abschnitte bis zum naechsten Trenner auf- oder zuklappen.
        var start = document.getElementById(groupId);
        if (!start) return;
        var zuklappen = btn.textContent.indexOf('einklappen') >= 0;
        var el = start.nextElementSibling;
        while (el && !el.classList.contains('group-divider')) {
            if (el.classList.contains('section')) {
                var head = el.querySelector('.section-header');
                var body = el.querySelector('.section-body');
                if (head) head.classList.toggle('collapsed', zuklappen);
                if (body) body.classList.toggle('collapsed', zuklappen);
            }
            el = el.nextElementSibling;
        }
        btn.textContent = zuklappen ? 'Alles aufklappen' : 'Alles einklappen';
        saveCollapseState();
    }

    // ==== FORTSCHRITT ====
    // Die Phasen kommen aus dem Markup, nicht aus einer Liste im Code - eine
    // neue Phase im Build Log soll nicht auch noch hier eingetragen werden
    // muessen.
    function updateProgress() {
        var totalAll = 0, doneAll = 0;
        document.querySelectorAll('[id^="phase"]:not([id$="body"])').forEach(function (phase) {
            var checks = phase.querySelectorAll('.step-status[data-field]');
            if (!checks.length) return;
            // Der Kapitelstatus hat drei Stufen. "in Arbeit" zaehlt halb, sonst
            // steht der Balken tagelang still, obwohl gearbeitet wird.
            var arr = Array.prototype.map.call(checks, function (c) { return Findings.normalizeStatus(c.value); });
            var done = arr.filter(function (s) { return s === 'done'; }).length;
            var wip = arr.filter(function (s) { return s === 'wip'; }).length;
            var total = checks.length;
            totalAll += total; doneAll += done;
            var num = phase.id.replace('phase', '');
            var bar = document.getElementById('prog' + num);
            var txt = document.getElementById('progText' + num);
            if (bar) bar.style.width = (total > 0 ? ((done + wip * 0.5) / total * 100) : 0) + '%';
            if (txt) txt.textContent = done + ' / ' + total + ' erledigt' + (wip ? ' (' + wip + ' in Arbeit)' : '');
        });
        var overallFill = document.getElementById('overallFill');
        var overallText = document.getElementById('overallText');
        if (overallFill) overallFill.style.width = (totalAll > 0 ? (doneAll / totalAll * 100) : 0) + '%';
        if (overallText) overallText.textContent = doneAll + ' / ' + totalAll + ' erledigt';
    }

    // ==== DATEN ====
    function collectData() { return FieldSync.collectFields(document); }

    function applyData(data) {
        isLoading = true;
        document.querySelectorAll('[data-field]').forEach(function (el) {
            var v = data[el.dataset.field];
            if (v === undefined) return;
            if (el.type === 'checkbox') el.checked = !!v;
            else el.value = v;
        });
        isLoading = false;
        renderAllStepStatus();
        updateProgress();
        // applyData setzt el.value direkt, ohne change-Ereignis - der
        // Uebersetzungsrechner muesste sonst bis zur naechsten Auswahl
        // die Vorgabewerte anzeigen statt der gespeicherten.
        if (typeof renderRatios === 'function') renderRatios();
        // Dasselbe fuer die Diagramme der Leistungsseite: sie haengen an
        // Abrollumfang, Achse und Schaltdrehzahl, und die kommen ebenfalls
        // ohne Ereignis herein. renderRatios() zieht sie ueber seine Hoerer
        // schon mit - der zweite Aufruf deckt den Fall ab, dass ratios.js
        // auf einer Seite gar nicht geladen ist.
        if (typeof perfRedraw === 'function') perfRedraw();
    }

    function saveFieldsLocal() {
        var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        var merged = FieldSync.mergeIntoExisting(existing, collectData(), { recordClears: dataLoaded });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
    }

    /**
     * Felder in den Gist schreiben - vorher den Cloud-Stand lesen und
     * zusammenfuehren.
     *
     * Hier wurde der lokale Datensatz ohne Rueckfrage hochgeschrieben. Das ist
     * ein verlorener Schreibvorgang: ein Geraet, das den Stand des anderen
     * noch nicht kennt, ersetzt die Gist-Datei komplett - mit einem Datensatz,
     * in dem die Felder des anderen Geraets gar nicht vorkommen. Sie waren
     * damit aus der Cloud weg, obwohl niemand sie geloescht hat.
     *
     * Galerie-Metadaten (gallery.js) und Befunde (findings.js) machen es seit
     * immer richtig: lesen, mergen, schreiben. Nur der Kanal mit den
     * Messwerten, Bemerkungen und dem Schrittstatus - also der mit dem meisten
     * Inhalt - tat es nicht. Dieselbe Vorgehensweise an drei Orten, und an
     * einem davon fehlte sie.
     *
     * mergeRecords entscheidet je Feld nach Zeitstempel, ein Leeren zaehlt
     * dabei als Aenderung. Zwei Geraete, die dasselbe Feld aendern: der
     * spaetere Eintrag gewinnt. Verschiedene Felder stoeren sich nicht.
     */
    async function saveData() {
        saveFieldsLocal();
        updateSaveStatus();
        // Kein Sync moeglich - still lokal speichern, kein Toast
        if (!isGistConfigured() || !navigator.onLine) return;
        // Lesen - mischen - schreiben steht in field-sync.js, wortgleich mit
        // gt40-engine. Anders als bis v32 wird nicht mehr geschrieben, wenn der
        // Cloud-Stand nicht lesbar ist: dann ging der rein lokale Stand hoch,
        // und Felder, die nur das andere Geraet kannte, waren aus der Cloud weg.
        var r = await FieldSync.cloudAbgleichen({ token: getGistConfig().token,
            gistId: window.FIXED_GIST_ID, datei: GIST_FILENAME, speicherKey: STORAGE_KEY });
        if (!r.ok) {
            showToast('Sync-Fehler: ' + r.fehler, {
                sticky: true, isError: true,
                detail: Object.assign({}, r.detail || {}, { quelle: 'saveData' })
            });
            return false;
        }
        // Was aus der Cloud dazukam, soll auch zu sehen sein.
        if (r.lokalGeaendert) { var war = isLoading; isLoading = true; applyData(r.gemischt); isLoading = war; }
        _letzterAbgleich = Date.now();
        updateSaveStatus();
        return true;
        // Erfolg: kein Toast - der Sync-Badge zeigt den Status
    }

    function loadData() {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            applyData(data);
        } catch (e) { console.error('[Daten] Lesefehler:', e.message); }
        dataLoaded = true;
        updateSaveStatus();
    }

    /**
     * Nach einer Eingabe lokal sichern und danach hochschieben.
     *
     * Hochgeschoben wurde bisher nur beim ausdruecklichen "Speichern". Wer das
     * nie drueckt - und warum sollte man, wenn der Kopf "gespeichert" meldet -
     * hatte alles ausschliesslich auf seinem Geraet. Galerie und Befunde
     * schieben seit immer selbst nach, je 800 ms nach der letzten Aenderung.
     * Hier etwas traeger, weil Tippen laufend Aenderungen erzeugt und jeder
     * Vorgang zwei Aufrufe kostet (lesen und schreiben).
     */
    var pushTimer = null;
    function autoSave() {
        if (isLoading) return;
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function () {
            saveFieldsLocal();
            updateSaveStatus();
            updateProgress();

            if (!isGistConfigured() || !navigator.onLine) return;
            clearTimeout(pushTimer);
            pushTimer = setTimeout(function () { saveData(); }, 4000);
        }, 600);
    }

    function updateSaveStatus() {
        var el = document.getElementById('saveStatus');
        if (!el) return;
        var badge = document.getElementById('syncBadge');
        var stamps = [];
        try {
            var d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (d._savedAt) stamps.push(new Date(d._savedAt).getTime());
        } catch (e) {}
        try {
            var g = JSON.parse(localStorage.getItem('jericoGalleryMeta') || '{}');
            if (g.savedAt) stamps.push(g.savedAt);
        } catch (e) {}
        var txt = '';
        if (stamps.length) {
            var d2 = new Date(Math.max.apply(null, stamps));
            txt = 'Zuletzt gespeichert: ' + d2.toLocaleString('de-DE');
        }
        el.innerHTML = (txt ? '<span>' + txt + '</span> ' : '') + (badge ? badge.outerHTML : '');
    }

    /**
     * Toast-System.
     *
     * Konzept:
     *   - Erfolgs-Toasts werden NICHT mehr angezeigt. Der Sync-Badge im
     *     Header reicht (gruen = laeuft).
     *   - Fehler-Toasts bleiben stehen, bis der Benutzer sie aktiv schliesst.
     *   - Fehler werden zusaetzlich ins Gist-Fehlerprotokoll geschrieben,
     *     damit sie spaeter auswertbar sind.
     *
     * @param {string} msg  - Meldungstext
     * @param {Object} [opts]
     * @param {boolean} [opts.sticky] - bleibt stehen bis manuell geschlossen
     * @param {boolean} [opts.isError] - wird ins Fehlerprotokoll geschrieben
     */
    function showToast(msg, opts) {
        opts = opts || {};
        var t = document.getElementById('toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toast';
            t.className = 'toast';
            document.body.appendChild(t);
        }
        // Schliessen-Knopf fuer sticky Toasts
        if (opts.sticky || opts.isError) {
            t.innerHTML = '<span>' + msg + '</span><button onclick="this.parentElement.classList.remove(\'show\')" style="background:none;border:none;color:inherit;font-size:1.1rem;cursor:pointer;margin-left:0.5rem;padding:0 0.3rem;line-height:1;">&times;</button>';
        } else {
            t.textContent = msg;
        }
        if (opts.isError) t.classList.add('toast-error');
        else t.classList.remove('toast-error');
        t.classList.add('show');
        clearTimeout(t._timer);
        if (!opts.sticky && !opts.isError) {
            t._timer = setTimeout(function () { t.classList.remove('show'); }, 2500);
        }
        // Fehler protokollieren. errorlog.js schreibt zuerst lokal; der
        // Gist ist nur der Spiegel. opts.detail darf Statuscode und
        // Antworttext der API tragen - genau das, was zur Analyse fehlt.
        if (opts.isError && typeof ErrorLog !== 'undefined') ErrorLog.add(msg, opts.detail);
    }

    /**
     * Optionaler Gist-Spiegel des Fehlerprotokolls.
     *
     * Der Vorgaenger schrieb den Eintrag ausschliesslich in den Gist - und
     * las ihn vorher von dort. Beim Sync-Fehler, dem haeufigsten Fall,
     * schlug beides fehl und es wurde nichts protokolliert. Ausserdem
     * behielt er nur den Satz aus dem Toast und verwarf Statuscode und
     * Antworttext der API. Jetzt liegt der Puffer lokal in errorlog.js;
     * schlaegt der Spiegel fehl, bleibt der Eintrag trotzdem erhalten.
     */
    function spiegleProtokollInGist(eintraege) {
        if (!isGistConfigured() || !navigator.onLine) return;
        var cfg = getGistConfig();
        var logFile = GIST_FILENAME.replace('.json', '-errors.json');
        var files = {};
        files[logFile] = { content: JSON.stringify(eintraege, null, 2) };
        return fetch('https://api.github.com/gists/' + window.FIXED_GIST_ID, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: files })
        }).catch(function () { /* lokal ist der Eintrag bereits sicher */ });
    }
    if (typeof ErrorLog !== 'undefined') ErrorLog.spiegelSetzen(spiegleProtokollInGist);

    /** Zaehlt, was in der Sicherung steckt - damit man es sieht, nicht glaubt. */
    function sicherungUmfang(payload) {
        var felder = 0;
        var f = payload.felder || {};
        for (var k in f) {
            if (!Object.prototype.hasOwnProperty.call(f, k)) continue;
            if (k.charAt(0) === '_') continue;
            var v = f[k];
            if (v !== '' && v !== null && v !== undefined && v !== false) felder++;
        }
        var befunde = (payload.befunde && payload.befunde.items) ? payload.befunde.items.length : 0;
        var bilder = 0;
        if (payload.galerie && payload.galerie.meta) {
            for (var b in payload.galerie.meta) {
                if (Object.prototype.hasOwnProperty.call(payload.galerie.meta, b)) bilder++;
            }
        }
        return { felder: felder, befunde: befunde, bilder: bilder };
    }

    /**
     * Letzter Ausweg: den Datensatz sichtbar und markierbar hinlegen.
     *
     * Ein Weg, der scheitern kann, ist keine Sicherung. Der Download ueber
     * einen Blob-Link ist in einer vom Home-Bildschirm gestarteten Web-App auf
     * iOS nicht verlaesslich - und genau dort wird dokumentiert. Dieser
     * Rueckfall braucht nichts als Markieren und Kopieren.
     */
    function sicherungAnzeigen(text, grund) {
        var alt = document.getElementById('sicherungFallback');
        if (alt) alt.remove();
        var box = document.createElement('div');
        box.id = 'sicherungFallback';
        box.className = 'modal-overlay show';
        box.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;'
            + 'background:rgba(0,0,0,0.6);z-index:11000;align-items:center;justify-content:center;';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:white;border-radius:12px;padding:1rem;'
            + 'max-width:640px;width:calc(100vw - 24px);max-height:85vh;display:flex;'
            + 'flex-direction:column;gap:0.5rem;';
        var kopf = document.createElement('div');
        kopf.style.cssText = 'font-size:0.78rem;color:#4a5568;';
        kopf.textContent = grund + ' Markiere den Text und kopiere ihn in Notizen oder '
            + 'eine Mail an dich selbst. Das ist eine vollwertige Sicherung: ueber '
            + 'Import laesst sie sich wieder einlesen.';
        var feld = document.createElement('textarea');
        feld.readOnly = true;
        feld.value = text;
        feld.style.cssText = 'width:100%;flex:1;min-height:40vh;font-size:0.68rem;'
            + 'font-family:ui-monospace,monospace;border:1px solid #cbd5e0;border-radius:6px;padding:0.4rem;';
        var reihe = document.createElement('div');
        reihe.style.cssText = 'display:flex;gap:0.4rem;justify-content:flex-end;';
        var kopieren = document.createElement('button');
        kopieren.type = 'button';
        kopieren.textContent = 'Alles kopieren';
        kopieren.style.cssText = 'padding:0.4rem 0.8rem;border:none;background:var(--primary-light);'
            + 'color:white;border-radius:6px;cursor:pointer;font-size:0.78rem;';
        kopieren.onclick = function () {
            feld.focus(); feld.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) {}
            if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { showToast('Sicherung kopiert'); },
                    function () { showToast('Kopieren ging nicht - bitte von Hand markieren', { sticky: true, isError: true }); });
            } else if (ok) { showToast('Sicherung kopiert'); }
        };
        var zu = document.createElement('button');
        zu.type = 'button';
        zu.textContent = 'Schliessen';
        zu.style.cssText = 'padding:0.4rem 0.8rem;border:1px solid var(--border);background:white;'
            + 'border-radius:6px;cursor:pointer;font-size:0.78rem;';
        zu.onclick = function () { box.remove(); };
        reihe.appendChild(kopieren); reihe.appendChild(zu);
        inner.appendChild(kopf); inner.appendChild(feld); inner.appendChild(reihe);
        box.appendChild(inner);
        document.body.appendChild(box);
        feld.focus(); feld.select();
    }

    /**
     * Sicherung herausgeben. Drei Wege, in dieser Reihenfolge:
     *
     *   1. Teilen-Menue des Geraets (navigator.share mit Datei). Auf dem iPad
     *      der verlaessliche Weg - darueber fuehrt "In Dateien speichern".
     *   2. Download ueber einen Blob-Link. Am Rechner der normale Weg.
     *   3. Text zum Markieren. Kann nicht scheitern.
     *
     * Dass es mehrere Wege braucht, liegt nicht an der App: in einer vom
     * Home-Bildschirm gestarteten Web-App auf iOS ist ein programmatischer
     * Download nicht verlaesslich, und ausgerechnet dort wird dokumentiert.
     */
    async function exportJSON() {
        var data = saveFieldsLocal();
        // Die Galerie-Metadaten muessen mit. Darin stehen die Beschriftungen
        // der Fotos, die Aufnahmezeit, die Reihenfolge und das Hauptbild - und
        // sie gehen sonst ausschliesslich ueber den Gist. Wer ohne
        // eingerichteten Abgleich arbeitet, hatte sie damit in keiner
        // Sicherung: die Bilddateien liegen im Repository, ihre Beschriftungen
        // nur auf dem Geraet. Genau das ist der Fall, in dem eine Sicherung
        // gebraucht wird.
        var galerie = null;
        try { galerie = JSON.parse(localStorage.getItem('jericoGalleryMeta') || 'null'); } catch (e) {}
        var payload = {
            meta: { projekt: 'Jerico RH02374', version: (typeof APP_VERSION === 'string' ? APP_VERSION : ''), exportiert: new Date().toISOString() },
            felder: data,
            befunde: Findings._raw(),
            galerie: galerie
        };
        var text = JSON.stringify(payload, null, 2);
        var umfang = sicherungUmfang(payload);
        var bilanz = umfang.felder + ' Werte, ' + umfang.befunde + ' Befunde, '
            + umfang.bilder + ' Foto-Beschriftungen';
        var name = 'jerico-rh02374-' + new Date().toISOString().slice(0, 10) + '.json';

        // Eine leere Sicherung darf nicht wie eine gelungene aussehen.
        if (!umfang.felder && !umfang.befunde && !umfang.bilder) {
            showToast('Es ist nichts zu sichern: dieser Speicher ist leer (' + bilanz + ').'
                + ' Auf iOS hat eine vom Home-Bildschirm gestartete App einen eigenen'
                + ' Speicher - exportiere dort, wo du eingetragen hast.',
                { sticky: true, isError: true, detail: { quelle: 'exportJSON' } });
            return false;
        }

        // 1. Teilen-Menue
        try {
            if (typeof File === 'function' && navigator.share && navigator.canShare) {
                var datei = new File([text], name, { type: 'application/json' });
                if (navigator.canShare({ files: [datei] })) {
                    await navigator.share({ files: [datei], title: 'Jerico-Sicherung' });
                    showToast('Sicherung geteilt - ' + bilanz);
                    return true;
                }
            }
        } catch (err) {
            // Abgebrochen ist eine Entscheidung, kein Fehler.
            if (err && err.name === 'AbortError') { return false; }
        }

        // 2. Download
        try {
            var blob = new Blob([text], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
            showToast('Sicherung gespeichert: ' + name + ' (' + bilanz + '). Kommt keine Datei an,'
                + ' nochmal exportieren - dann erscheint der Text zum Kopieren.',
                { sticky: true });
            // Der Download laesst sich nicht nachpruefen. Beim naechsten Aufruf
            // in derselben Sitzung kommt darum der Weg, der nicht scheitern
            // kann - wer ein zweites Mal exportiert, hat beim ersten Mal keine
            // Datei bekommen.
            if (window.__exportSchonVersucht) {
                sicherungAnzeigen(text, 'Der Download hat offenbar nicht geklappt.');
            }
            window.__exportSchonVersucht = true;
            return true;
        } catch (err2) {
            // 3. Text
            sicherungAnzeigen(text, 'Speichern als Datei ging nicht (' + err2.message + ').');
            return true;
        }
    }

    /**
     * Sicherung direkt als Text zeigen. Eigener Menuepunkt, damit niemand
     * zweimal exportieren muss, um an den Weg zu kommen, der nicht scheitert.
     */
    function sicherungAlsText() {
        var data = saveFieldsLocal();
        var galerie = null;
        try { galerie = JSON.parse(localStorage.getItem('jericoGalleryMeta') || 'null'); } catch (e) {}
        var payload = {
            meta: { projekt: 'Jerico RH02374', version: (typeof APP_VERSION === 'string' ? APP_VERSION : ''), exportiert: new Date().toISOString() },
            felder: data, befunde: Findings._raw(), galerie: galerie
        };
        var u = sicherungUmfang(payload);
        sicherungAnzeigen(JSON.stringify(payload, null, 2),
            'Sicherung mit ' + u.felder + ' Werten, ' + u.befunde + ' Befunden und '
            + u.bilder + ' Foto-Beschriftungen.');
    }

    function importJSON(event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var parsed = JSON.parse(e.target.result);
                var felder = parsed.felder || parsed;
                var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                var merged = FieldSync.mergeRecords(felder, existing);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                applyData(merged);
                if (parsed.befunde && parsed.befunde.items) {
                    Findings._set(Findings.merge(parsed.befunde, Findings._raw()));
                    Findings.save();
                    renderAllFindings();
                }
                // Galerie-Metadaten zusammenfuehren, nicht ersetzen: auf dem
                // Zielgeraet koennen eigene Beschriftungen stehen. _mergeMeta
                // entscheidet je Eintrag nach Zeitstempel.
                var galerieUebernommen = 0;
                if (parsed.galerie && typeof _mergeMeta === 'function') {
                    try {
                        var vorher = JSON.stringify(_galleryMeta);
                        _galleryMeta = _mergeMeta(_normalizeMeta(parsed.galerie), _galleryMeta);
                        saveGalleryMeta();
                        if (JSON.stringify(_galleryMeta) !== vorher) galerieUebernommen = 1;
                        if (typeof rebuildPhotoData === 'function') rebuildPhotoData();
                    } catch (e2) {
                        showToast('Galerie-Metadaten nicht uebernommen: ' + e2.message,
                            { sticky: true, isError: true, detail: { quelle: 'importJSON' } });
                    }
                }
                updateSaveStatus();
                showToast('Importiert' + (galerieUebernommen ? ' - samt Foto-Beschriftungen' : ''));
            } catch (err) { showToast('Import fehlgeschlagen: ' + err.message, { sticky: true, isError: true }); }
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    // ==== KAPITELSTATUS ====
    function cycleStepStatus(btn) {
        btn.value = Findings.nextStatus(btn.value);
        paintStepStatus(btn);
        autoSave();
        updateProgress();
    }
    function paintStepStatus(btn) {
        var s = Findings.normalizeStatus(btn.value);
        btn.value = s;
        btn.classList.remove('wip', 'done');
        if (s) btn.classList.add(s);
        btn.textContent = s === 'done' ? '✓' : (s === 'wip' ? '…' : '');
        btn.title = 'Status: ' + Findings.statusLabel(s, currentLang);
    }
    function renderAllStepStatus() {
        document.querySelectorAll('.step-status[data-field]').forEach(paintStepStatus);
    }

    // ==== BEFUNDE ====
    var FINDINGS_OPEN_KEY = 'jericoFindingsOpen';
    function findingsOpenSet() {
        try { return JSON.parse(localStorage.getItem(FINDINGS_OPEN_KEY) || '{}'); } catch (e) { return {}; }
    }
    function toggleFindings(chapter) {
        var box = document.querySelector('.findings[data-findings="' + chapter + '"]');
        if (!box) return;
        var open = box.classList.toggle('open');
        var set = findingsOpenSet();
        if (open) set[chapter] = 1; else delete set[chapter];
        try { localStorage.setItem(FINDINGS_OPEN_KEY, JSON.stringify(set)); } catch (e) {}
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function renderFindings(chapter) {
        var box = document.querySelector('.findings[data-findings="' + chapter + '"]');
        if (!box) return;
        var items = Findings.forChapter(chapter);
        var c = Findings.counts(chapter);
        var offen = c.open + c.wip;
        var badge = items.length
            ? '<span class="findings-badge' + (offen ? '' : ' none') + '">' + items.length + (offen ? ' / ' + offen + ' offen' : '') + '</span>'
            : '<span class="findings-badge none">keine</span>';
        var rows = items.map(function (it) {
            var s = Findings.normalizeStatus(it.status);
            return '<div class="fx-row">'
                + '<button type="button" class="fx-status fx-pill ' + (s || 'open') + '" onclick="cycleFinding(\'' + esc(chapter) + '\',\'' + it.id + '\')">'
                + esc(Findings.statusLabel(s, currentLang)) + '</button>'
                + '<input class="fx-text" type="text" value="' + esc(it.text) + '" oninput="editFinding(\'' + it.id + '\', this.value)" placeholder="Befund...">'
                + '<button type="button" class="fx-del" onclick="deleteFinding(\'' + esc(chapter) + '\',\'' + it.id + '\')" title="Entfernen">&times;</button>'
                + '</div>';
        }).join('');
        box.innerHTML = '<div class="findings-head" onclick="toggleFindings(\'' + esc(chapter) + '\')">'
            + '<span class="fx-caret">&#9656;</span><span>Befunde</span>' + badge + '</div>'
            + '<div class="findings-body">' + rows
            + '<button type="button" class="fx-add" onclick="addFinding(\'' + esc(chapter) + '\')">+ Befund</button></div>';
        if (findingsOpenSet()[chapter]) box.classList.add('open');
    }
    function renderAllFindings() {
        document.querySelectorAll('.findings[data-findings]').forEach(function (b) {
            renderFindings(b.dataset.findings);
        });
        renderFindingsOverview();
    }
    function addFinding(chapter) {
        Findings.add(chapter, '');
        var set = findingsOpenSet(); set[chapter] = 1;
        try { localStorage.setItem(FINDINGS_OPEN_KEY, JSON.stringify(set)); } catch (e) {}
        renderFindings(chapter);
        renderFindingsOverview();
        var box = document.querySelector('.findings[data-findings="' + chapter + '"]');
        var inputs = box ? box.querySelectorAll('.fx-text') : [];
        if (inputs.length) inputs[inputs.length - 1].focus();
    }
    var _findingEditTimer = null;
    function editFinding(id, text) {
        clearTimeout(_findingEditTimer);
        _findingEditTimer = setTimeout(function () {
            Findings.update(id, { text: text });
            renderFindingsOverview();
        }, 400);
    }
    function cycleFinding(chapter, id) {
        var items = Findings.forChapter(chapter);
        for (var i = 0; i < items.length; i++) {
            if (items[i].id !== id) continue;
            Findings.update(id, { status: Findings.nextStatus(items[i].status) });
            break;
        }
        renderFindings(chapter);
        renderFindingsOverview();
    }
    function deleteFinding(chapter, id) {
        if (!confirm('Befund entfernen?')) return;
        Findings.remove(id);
        renderFindings(chapter);
        renderFindingsOverview();
    }
    function renderFindingsOverview() {
        var box = document.getElementById('findingsOverview');
        if (!box) return;
        var items = Findings.all(['', 'wip']);
        var cnt = box.querySelector('.fo-count');
        if (cnt) cnt.textContent = items.length ? '(' + items.length + ')' : '(0)';
        var body = box.querySelector('.fo-body');
        if (!body) return;
        if (!items.length) { body.innerHTML = '<div class="fo-empty">Keine offenen Befunde.</div>'; return; }
        body.innerHTML = items.map(function (it) {
            var s = Findings.normalizeStatus(it.status);
            var titel = chapterTitle(it.ch);
            return '<div class="fo-item">'
                + '<span class="fx-pill ' + (s || 'open') + '">' + esc(Findings.statusLabel(s, currentLang)) + '</span>'
                + '<span class="fo-text">' + esc(it.text || '(ohne Text)') + '</span>'
                + '<a href="#" onclick="jumpToChapter(\'' + esc(it.ch) + '\');return false;">' + esc(titel) + '</a>'
                + '</div>';
        }).join('');
    }
    function chapterTitle(chapter) {
        var btn = document.querySelector('.step-status[data-field="' + chapter + '"]');
        var card = btn && btn.closest('.step-card');
        var t = card && card.querySelector('.step-title');
        return t ? t.textContent.trim() : chapter;
    }
    function jumpToChapter(chapter) {
        var btn = document.querySelector('.step-status[data-field="' + chapter + '"]');
        var card = btn && btn.closest('.step-card');
        if (!card) {
            // Kapitel liegt auf der anderen Seite - dorthin springen.
            location.href = 'build-log.html#' + chapter;
            return;
        }
        var phaseBody = card.closest('.phase-body');
        if (phaseBody && phaseBody.classList.contains('collapsed')) togglePhase(phaseBody.id);
        var ov = document.getElementById('findingsOverview');
        if (ov) ov.removeAttribute('open');
        setTimeout(function () {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.transition = 'box-shadow 0.3s';
            card.style.boxShadow = '0 0 0 3px rgba(237,137,54,0.6)';
            setTimeout(function () { card.style.boxShadow = ''; }, 1800);
        }, 120);
    }

    // ==== SPRUNG AUF ANKER ====
    function scrollToHash() {
        var h = location.hash.slice(1);
        if (!h) return;
        var el = document.getElementById(h) || document.querySelector('[data-field="' + h + '"]');
        if (!el) return;
        var card = el.closest ? el.closest('.step-card') : null;
        var phaseBody = (card || el).closest ? (card || el).closest('.phase-body') : null;
        if (phaseBody && phaseBody.classList.contains('collapsed')) togglePhase(phaseBody.id);
        var section = (card || el).closest ? (card || el).closest('.section') : null;
        if (section) {
            var head = section.querySelector('.section-header');
            var body = section.querySelector('.section-body');
            if (body && body.classList.contains('collapsed')) {
                body.classList.remove('collapsed');
                if (head) head.classList.remove('collapsed');
            }
        }
        setTimeout(function () { (card || el).scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
    }

    // ==== SPRACHE ====
    // Zweisprachige Stellen stehen als <span class="de">/<span class="en"> im
    // Markup; das Woerterbuch deckt nur Ueberschriften und wiederkehrende
    // Begriffe ab, die nicht doppelt ausgezeichnet sind.
    var currentLang = localStorage.getItem(LANG_KEY) || 'de';
    var i18nDict = {
        'Übersicht': 'Overview',
        'Spezifikationen': 'Specifications',
        'Zusammenbau': 'Assembly',
        'Alles einklappen': 'Collapse all',
        'Alles aufklappen': 'Expand all',
        'Cloud-Sync': 'Cloud Sync',
        'Verbinden': 'Connect',
        'Trennen': 'Disconnect',
        'Abbrechen': 'Cancel',
        'Speichern': 'Save',
        'Drucken': 'Print',
        'Befunde': 'Findings',
        'Offene Befunde': 'Open findings',
        'Gesamtfortschritt': 'Overall progress',
        'erledigt': 'completed',
        'in Arbeit': 'in progress',
        'offen': 'open',
        'Projektdaten': 'Project data',
        'Identifikation': 'Identification',
        'Getriebe-Identifikation': 'Transmission identification',
        'Übersetzungen': 'Gear ratios',
        'Abmessungen': 'Dimensions',
        'Anzugsmomente': 'Torque specifications',
        'Schmierstoffe': 'Lubricants',
        'Kühlsystem': 'Cooling system',
        'Ölpumpe': 'Oil pump',
        'Einfahren': 'Break-in',
        'Offene Punkte': 'Open items',
        'Quellen': 'Sources',
        'Werkzeuge': 'Tools',
        'Vorbereitung': 'Preparation',
        'Voraussetzungen': 'Prerequisites',
        'Vorgehensweise': 'Procedure',
        'Sollwerte': 'Target values',
        'Messwerte': 'Measurements',
        'Praxis-Tipps': 'Practical tips',
        'Fotodokumentation': 'Photo documentation',
        'Zeitbedarf': 'Time estimate',
        'Warnung': 'Warning',
        'Allgemeine Notizen': 'General notes'
    };
    var i18nReverse = {};
    Object.keys(i18nDict).forEach(function (k) { if (i18nDict[k] !== k) i18nReverse[i18nDict[k]] = k; });
    var i18nKeysSorted = Object.keys(i18nDict).sort(function (a, b) { return b.length - a.length; });
    var i18nRevKeysSorted = Object.keys(i18nReverse).sort(function (a, b) { return b.length - a.length; });
    var _origTexts = new WeakMap();
    var _origPlaceholders = new WeakMap();

    function setLang(lang) {
        currentLang = lang;
        try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
        document.documentElement.lang = lang === 'de' ? 'de' : 'en';
        var btn = document.getElementById('langToggle');
        if (btn) btn.textContent = lang === 'de' ? '🇩🇪' : '🇺🇸';
        // Zweisprachige Spans: genau eine Seite anzeigen.
        document.querySelectorAll('span.de').forEach(function (el) { el.style.display = lang === 'de' ? '' : 'none'; });
        document.querySelectorAll('span.en').forEach(function (el) { el.style.display = lang === 'en' ? '' : 'none'; });

        var keys = lang === 'en' ? i18nKeysSorted : i18nRevKeysSorted;
        var dict = lang === 'en' ? i18nDict : i18nReverse;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) {
            var node = walker.currentNode;
            var p = node.parentElement;
            if (!p) continue;
            if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'TEXTAREA' || p.tagName === 'INPUT') continue;
            if (p.classList.contains('de') || p.classList.contains('en')) continue;   // uebersetzt sich selbst
            if (!_origTexts.has(node)) _origTexts.set(node, node.textContent);
            if (lang === 'de') { node.textContent = _origTexts.get(node); continue; }
            var text = _origTexts.get(node);
            var changed = false;
            keys.forEach(function (k) {
                if (text.indexOf(k) >= 0) { text = text.split(k).join(dict[k]); changed = true; }
            });
            if (changed) node.textContent = text;
        }
        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(function (el) {
            if (!_origPlaceholders.has(el)) _origPlaceholders.set(el, el.placeholder);
            if (lang === 'de') { el.placeholder = _origPlaceholders.get(el); return; }
            var ph = _origPlaceholders.get(el);
            keys.forEach(function (k) { if (ph.indexOf(k) >= 0) ph = ph.split(k).join(dict[k]); });
            el.placeholder = ph;
        });
        renderAllStepStatus();
    }
    function toggleLang() { setLang(currentLang === 'de' ? 'en' : 'de'); }

    // ==== GLOSSAR / OVERLAYS ====
    function showGuide(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.add('show');
        // Dieselbe Sperre wie bei der Galerie - das Glossar ist genauso ein
        // Vollbild-Overlay und lief auf iOS in denselben Fehler.
        if (typeof sperreSeite === 'function') sperreSeite();
        else document.body.style.overflow = 'hidden';
        // Die runden Knoepfe liegen ueber dem Overlay (z-index 900 gegen 500)
        // und standen sonst mitten in der Tabelle.
        document.body.classList.add('overlay-offen');
        if (id === 'guide-glossary') updateGlossaryCount();
    }
    function hideGuide(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('show');
        if (typeof gibSeiteFrei === 'function') gibSeiteFrei();
        else document.body.style.overflow = '';
        document.body.classList.remove('overlay-offen');
    }
    function filterGlossary() {
        var q = (document.getElementById('glossarySearch') || {}).value || '';
        q = q.trim().toLowerCase();
        document.querySelectorAll('.glossary-entry').forEach(function (e) {
            var treffer = !q || e.textContent.toLowerCase().indexOf(q) >= 0;
            e.classList.toggle('hidden', !treffer);
        });
        updateGlossaryCount();
    }
    function filterCategory(btn, cat) {
        document.querySelectorAll('.glossary-cat-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.glossary-category').forEach(function (c) {
            c.style.display = (cat === 'all' || c.dataset.cat === cat) ? '' : 'none';
        });
        updateGlossaryCount();
    }
    function updateGlossaryCount() {
        var el = document.querySelector('.glossary-count');
        if (!el) return;
        var sichtbar = 0;
        document.querySelectorAll('.glossary-entry').forEach(function (e) {
            var cat = e.closest('.glossary-category');
            if (!e.classList.contains('hidden') && (!cat || cat.style.display !== 'none')) sichtbar++;
        });
        el.textContent = sichtbar + ' Begriffe';
    }
    function openGlossary(term) {
        showGuide('guide-glossary');
        var search = document.getElementById('glossarySearch');
        if (search && term) { search.value = term; filterGlossary(); }
    }

    // ==== LEBENSZYKLUS ====
    var _scrollTimer = null;
    var _scrollReady = false;
    window.addEventListener('scroll', function () {
        if (!_scrollReady) return;
        clearTimeout(_scrollTimer);
        _scrollTimer = setTimeout(function () {
            try { localStorage.setItem(SCROLL_KEY, window.scrollY); } catch (e) {}
        }, 200);
    }, { passive: true });

    function persist() {
        saveFieldsLocal();
        try { localStorage.setItem(SCROLL_KEY, window.scrollY); } catch (e) {}
        saveCollapseState();
    }
    window.addEventListener('beforeunload', persist);
    window.addEventListener('pagehide', persist);

    window.addEventListener('load', function () {
        if (location.hash && location.hash.length > 1) { _scrollReady = true; scrollToHash(); return; }
        var pos = localStorage.getItem(SCROLL_KEY);
        if (pos) {
            setTimeout(function () { window.scrollTo(0, parseInt(pos, 10)); }, 200);
            setTimeout(function () { window.scrollTo(0, parseInt(pos, 10)); _scrollReady = true; }, 400);
        } else { _scrollReady = true; }
    });
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        abgleichenWennFaellig();
        restoreCollapseState();
        if (location.hash && location.hash.length > 1) { scrollToHash(); return; }
        var pos = localStorage.getItem(SCROLL_KEY);
        if (pos) window.scrollTo(0, parseInt(pos, 10));
    });
    window.addEventListener('hashchange', scrollToHash);

    document.addEventListener('DOMContentLoaded', function () {
        var sm = document.getElementById('settingsModal');
        if (sm) sm.addEventListener('click', function (e) { if (e.target === this) closeSettings(); });
        renderAppVersion();
        updateSyncBadge();
        Findings.load();
        loadData();
        restoreCollapseState();
        renderAllStepStatus();
        renderAllFindings();
        updateProgress();
        if (typeof initCompPhotos === 'function') initCompPhotos();
        if (typeof Validation !== 'undefined') Validation.init();
        if (typeof initUnifiedSearch === 'function') initUnifiedSearch();
        scrollToHash();
        if (currentLang === 'en') setTimeout(function () { setLang('en'); }, 100);
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(function () { /* offline ist optional */ });
        }
        // Beim Oeffnen holen, was andere Geraete eingetragen haben - einen
        // Takt spaeter, damit die Seite fertig aufgebaut ist.
        setTimeout(function () { syncFromCloud({ still: true }); }, 0);
        document.addEventListener('visibilitychange', abgleichenWennFaellig);
        // Verbindung wieder da: alles nachschieben, nicht nur die Messwerte.
        // Befunde und Galerie-Texte gingen bis v32 verloren, wenn sie offline
        // geaendert wurden - bis zur naechsten eigenen Aenderung dort.
        window.addEventListener('online', function () {
            if (!isGistConfigured()) return;
            saveData();
            Findings.push();
            if (typeof pushGalleryMeta === 'function') pushGalleryMeta();
        });
    });

    // ==== NACH AUSSEN ====
    // Die Seiten rufen diese Funktionen per onclick/oninput auf, gallery.js und
    // findings.js erwarten showToast, getGistConfig und updateSaveStatus.
    var api = {
        getGistConfig: getGistConfig, isGistConfigured: isGistConfigured,
        toggleToolMenu: toggleToolMenu, closeToolMenu: closeToolMenu,
        openSettings: openSettings, closeSettings: closeSettings,
        saveSettings: saveSettings, disconnectGist: disconnectGist,
        syncFromCloud: syncFromCloud, saveData: saveData, autoSave: autoSave,
        exportJSON: exportJSON, importJSON: importJSON,
        sicherungAlsText: sicherungAlsText,
        updateSaveStatus: updateSaveStatus, updateSyncBadge: updateSyncBadge,
        showToast: showToast, updateProgress: updateProgress,
        togglePhase: togglePhase, toggleGuide: toggleGuide, toggleSection: toggleSection,
        toggleComp: toggleComp, toggleGroup: toggleGroup,
        cycleStepStatus: cycleStepStatus, renderAllStepStatus: renderAllStepStatus,
        toggleFindings: toggleFindings, addFinding: addFinding, editFinding: editFinding,
        cycleFinding: cycleFinding, deleteFinding: deleteFinding,
        renderAllFindings: renderAllFindings, jumpToChapter: jumpToChapter,
        setLang: setLang, toggleLang: toggleLang,
        showGuide: showGuide, hideGuide: hideGuide, openGlossary: openGlossary,
        filterGlossary: filterGlossary, filterCategory: filterCategory,
        updateGlossaryCount: updateGlossaryCount,
        scrollToHash: scrollToHash
    };
    Object.keys(api).forEach(function (k) { window[k] = api[k]; });
    Object.defineProperty(window, 'currentLang', { get: function () { return currentLang; } });
})();
