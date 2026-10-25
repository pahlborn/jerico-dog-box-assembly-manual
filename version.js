/**
 * version.js - eine einzige Quelle fuer die App-Version.
 *
 * Muss zur Cache-Version in sw.js passen ('jerico-v<N>'). tests/ui.test.mjs
 * prueft das, damit beide nicht auseinanderlaufen.
 *
 * Bei jeder Aenderung an den ausgelieferten Dateien hochzaehlen - sonst holen
 * sich die Geraete den neuen Stand nicht.
 */
(function (global) {
  'use strict';
  global.APP_VERSION = 'v42';

  // Freigabezeitpunkt. Es gibt keinen Build-Schritt, der ihn setzen koennte -
  // also wird er bei jedem Versionssprung von Hand mitgezogen. Die Nummer
  // allein sagt nicht, ob ein Geraet den neuen Stand geladen hat.
  // tests/release-guard.test.mjs prueft, dass er beim Hochzaehlen mitgeht.
  global.APP_BUILT = '2026-10-25T00:05:00+01:00';

  // "DD.MM.YYYY, hh:mm" - ohne Sekunden, die interessieren niemanden.
  //
  // Bewusst ohne new Date(): das verschiebt den Zeitpunkt in die Zeitzone des
  // Betrachters. Derselbe Release stand damit auf dem iPad in Berlin auf
  // 05.01.2026, 07:09 und auf einem Rechner in Los Angeles auf 04.01.2026,
  // 22:09 - einen Tag vorher. Der Freigabezeitpunkt ist eine Eigenschaft des
  // Release, nicht des Lesers, also wird die Zeichenkette zerlegt statt
  // umgerechnet. Aus dem Schwesterprojekt gt40-engine uebernommen.
  var ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/;
  global.formatBuilt = function (iso) {
    var m = ISO.exec(iso || global.APP_BUILT || '');
    if (!m) return '';
    var d = m[3] + '.' + m[2] + '.' + m[1];
    return m[4] ? d + ', ' + m[4] + ':' + m[5] : d;
  };
})(typeof window !== 'undefined' ? window : globalThis);
