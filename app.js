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
    // Sucht einen bestehenden Gist anhand des Dateinamens.
    async function findGistByFilename(token) {
        var page = 1;
        while (page <= 5) { // max 5 Seiten = 500 Gists
            var res = await fetch('https://api.github.com/gists?per_page=100&page=' + page,
                { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) return null;
            var gists = await res.json();
            if (gists.length === 0) break;
            for (var i = 0; i < gists.length; i++) {
                if (gists[i].files && gists[i].files[GIST_FILENAME]) return gists[i].id;
            }
            page++;
        }
        return null;
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
        if (!res.ok) return null;
        var gist = await res.json();
        return gist.id;
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
            showToast('Suche Gist...');
            var gid = await findGistByFilename(token);
            if (gid) {
                showToast('Gist gefunden...');
            } else {
                showToast('Lege neuen Gist an...');
                gid = await createGist(token);
                if (!gid) { showToast('Gist konnte nicht erstellt werden', { sticky: true, isError: true }); return; }
            }
            localStorage.setItem(GIST_ID_KEY, gid);
            window.FIXED_GIST_ID = gid;
            updateSyncBadge(); updateConnectionStatus(); closeSettings();
            // Erfolg: kein Toast, Badge wechselt auf gruen
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
        document.querySelectorAll('#appVersion, .app-version').forEach(function (el) {
            el.textContent = gebaut ? (v + ' \u00b7 ' + gebaut) : v;
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
            el.className = 'status-line disconnected';
            el.textContent = 'Token gesetzt, suche Datenspeicher...';
        } else {
            el.className = 'status-line disconnected';
            el.textContent = 'Nicht verbunden';
        }
    }

    async function syncFromCloud() {
        if (!isGistConfigured()) { openSettings(); return; }
        isLoading = true;
        try {
            var res = await fetch('https://api.github.com/gists/' + window.FIXED_GIST_ID,
                { headers: { 'Authorization': 'Bearer ' + getGistConfig().token } });
            if (!res.ok) {
                isLoading = false;
                showToast('Sync-Fehler: Status ' + res.status, { sticky: true, isError: true });
                return;
            }
            var gist = await res.json();
            var file = gist.files && gist.files[GIST_FILENAME];
            if (!file) { isLoading = false; return; }
            var cloudData = JSON.parse(file.content);
            var localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            var merged = FieldSync.mergeRecords(cloudData, localData);
            applyData(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            if (await Findings.pull(gist, getGistConfig().token)) renderAllFindings();
            isLoading = false; updateSaveStatus();
            // Erfolg: kein Toast
        } catch (err) {
            isLoading = false;
            showToast('Sync-Fehler: ' + err.message, { sticky: true, isError: true });
        }
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
    }

    function saveFieldsLocal() {
        var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        var merged = FieldSync.mergeIntoExisting(existing, collectData(), { recordClears: dataLoaded });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
    }

    async function saveData() {
        var merged = saveFieldsLocal();
        updateSaveStatus();
        // Kein Sync moeglich - still lokal speichern, kein Toast
        if (!isGistConfigured() || !navigator.onLine) return;
        try {
            var files = {};
            files[GIST_FILENAME] = { content: JSON.stringify(merged, null, 2) };
            var res = await fetch('https://api.github.com/gists/' + window.FIXED_GIST_ID, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + getGistConfig().token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: files })
            });
            if (!res.ok) {
                var errText = ''; try { errText = (await res.json()).message || ''; } catch(e) {}
                showToast('Sync-Fehler: ' + (errText || 'Status ' + res.status), { sticky: true, isError: true });
            }
            // Erfolg: kein Toast - der Sync-Badge zeigt den Status
        } catch (err) {
            showToast('Sync-Fehler: ' + err.message, { sticky: true, isError: true });
        }
    }

    function loadData() {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            applyData(data);
        } catch (e) { console.error('[Daten] Lesefehler:', e.message); }
        dataLoaded = true;
        updateSaveStatus();
    }

    function autoSave() {
        if (isLoading) return;
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function () {
            saveFieldsLocal();
            updateSaveStatus();
            updateProgress();
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
        // Fehler ins Gist-Protokoll schreiben
        if (opts.isError) logErrorToGist(msg);
    }

    /** Fehler ins Gist-Fehlerprotokoll schreiben. */
    async function logErrorToGist(msg) {
        try {
            if (!isGistConfigured() || !navigator.onLine) return;
            var cfg = getGistConfig();
            var logFile = GIST_FILENAME.replace('.json', '-errors.json');
            // Bestehenden Log lesen
            var res = await fetch('https://api.github.com/gists/' + window.FIXED_GIST_ID,
                { headers: { 'Authorization': 'Bearer ' + cfg.token } });
            if (!res.ok) return;
            var gist = await res.json();
            var existing = [];
            if (gist.files && gist.files[logFile]) {
                try { existing = JSON.parse(gist.files[logFile].content); } catch (e) {}
            }
            // Neuen Eintrag anhaengen (max 50 Eintraege behalten)
            var devId = typeof FieldSync !== 'undefined' ? FieldSync.getDeviceId() : 'unknown';
            var devName = typeof FieldSync !== 'undefined' ? FieldSync.getDeviceName() : '';
            existing.push({
                time: new Date().toISOString(),
                device: devId,
                deviceName: devName,
                page: location.pathname.split('/').pop() || 'unknown',
                version: typeof APP_VERSION === 'string' ? APP_VERSION : '',
                error: msg
            });
            if (existing.length > 50) existing = existing.slice(-50);
            // Zurueckschreiben
            var files = {};
            files[logFile] = { content: JSON.stringify(existing, null, 2) };
            await fetch('https://api.github.com/gists/' + window.FIXED_GIST_ID, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: files })
            });
        } catch (e) { console.error('[Fehlerprotokoll] Schreiben fehlgeschlagen:', e.message); }
    }

    function exportJSON() {
        var data = saveFieldsLocal();
        var payload = {
            meta: { projekt: 'Jerico RH02374', version: (typeof APP_VERSION === 'string' ? APP_VERSION : ''), exportiert: new Date().toISOString() },
            felder: data,
            befunde: Findings._raw()
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'jerico-rh02374-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Exportiert');
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
                updateSaveStatus();
                showToast('Importiert');
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
        'Einstellungen': 'Settings',
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
        // Automatisch syncen, wenn die Verbindung wiederkommt
        window.addEventListener('online', function () {
            if (isGistConfigured()) {
                saveData(); // pusht lokale Aenderungen still hoch
            }
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
