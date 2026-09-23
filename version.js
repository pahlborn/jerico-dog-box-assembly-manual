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
  global.APP_VERSION = 'v13';

  // Freigabezeitpunkt. Es gibt keinen Build-Schritt, der ihn setzen koennte -
  // also wird er bei jedem Versionssprung von Hand mitgezogen. Die Nummer
  // allein sagt nicht, ob ein Geraet den neuen Stand geladen hat.
  global.APP_BUILT = '2026-09-23T07:00:00+02:00';

  // "DD.MM.YYYY, hh:mm" - ohne Sekunden, die interessieren niemanden.
  global.formatBuilt = function (iso) {
    var d = new Date(iso || global.APP_BUILT);
    if (isNaN(d.getTime())) return '';
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear()
         + ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  };
})(typeof window !== 'undefined' ? window : globalThis);
