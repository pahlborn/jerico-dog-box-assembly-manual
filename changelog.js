/**
 * changelog.js - Release-Dokumentation.
 *
 * Erreichbar ueber die Versionsnummer im Werkzeugmenue und im Header.
 * Wird von index.html, specs.html und build-log.html geladen.
 *
 * Neuer Eintrag: oben einfuegen und version.js plus die Cache-Version in
 * sw.js hochzaehlen. tests/ui.test.mjs prueft, dass alle drei zusammenpassen.
 */
(function (global) {
  'use strict';

  // Neueste Version zuerst.
  var RELEASES = [
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
