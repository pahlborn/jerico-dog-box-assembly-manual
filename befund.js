/**
 * befund.js - Spezifikationswerte aus den eingetragenen Messwerten anzeigen.
 *
 * Das Problem, das hier geloest wird
 * ----------------------------------
 * In den Spezifikationen stand "26 Spline - Validierung ausstehend F" als
 * fester Text. Im Build Log gibt es dafuer das Feld p1_spline_count. Wer den
 * Wert abzaehlte und eintrug, sah die Spezifikation unveraendert: dieselbe
 * Vorbelegung, dieselbe Warnung. Die Eingabe hatte keine Wirkung.
 *
 * Das ist dieselbe Falle wie die feste Uebersetzungstabelle und die zwei
 * Kuehlsystem-Kapitel: ein Wert an zwei Orten, von Hand gepflegt. Hier wird
 * sie fuer alle Einzelwerte aufgeloest - die Anzeige kommt aus dem Feld.
 *
 * Verwendung
 * ----------
 *   <span class="spec-value"
 *         data-befund="p1_spline_count"     Feldname im Build Log
 *         data-vorgabe="26"                 was ohne Eingabe gilt
 *         data-einheit="Spline"             optional, hinter dem Wert
 *         data-klasse="b"                   Quellenklasse bei Eingabe, Vorgabe b
 *         data-alt="spec_spline_count"      frueherer Feldname, Rueckfall
 *         data-quelle="build-log.html#p1_splines_card"></span>
 *
 * Zwei Zustaende, beide ehrlich:
 *
 *   eingetragen  ->  26 Spline  B        (Ist-Zustand, keine Warnung)
 *   leer         ->  offen - Vorgabe 26 Spline, im Build Log eintragen  F
 *
 * Der leere Zustand nennt den Weg nach vorn, statt nur zu mahnen. Das war
 * der zweite Einwand: ein Hinweis ohne Handlungsanweisung hilft nicht.
 *
 * Feldnamen werden hier NICHT neu erfunden - sie sind die bereits
 * gespeicherten. Ein umbenanntes Feld verliert den eingetragenen Wert.
 */
(function (global) {
  'use strict';

  function leer(v) { return v === undefined || v === null || String(v).trim() === ''; }

  function marke(klasse, titel) {
    return ' <span class="src src-' + klasse + '" title="' + titel + '">'
         + klasse.toUpperCase() + '</span>';
  }

  /** Eine Anzeige aus dem Datensatz fuellen. */
  function einer(el, daten) {
    var feld = el.dataset.befund;
    if (!feld) return;
    var wert = daten ? daten[feld] : undefined;
    // data-alt nennt einen frueheren Feldnamen. Als es zu einem Wert zwei
    // Eingabefelder gab - eines in den Spezifikationen, eines im Build Log -
    // konnte der eingetragene Wert im falschen stehen. Umbenennen allein
    // haette ihn unsichtbar gemacht, also wird das alte Feld weiter gelesen.
    var altfeld = el.dataset.alt;
    if (leer(wert) && altfeld && daten && !leer(daten[altfeld])) {
      wert = daten[altfeld];
    }
    var einheit = el.dataset.einheit ? ' ' + el.dataset.einheit : '';
    var vorgabe = el.dataset.vorgabe || '';
    var klasse = (el.dataset.klasse || 'b').toLowerCase();
    var quelle = el.dataset.quelle || '';

    if (!leer(wert)) {
      var w = String(wert).trim();
      // Mit data-abweichung="warnen" ist die Vorgabe kein Platzhalter, sondern
      // ein Sollwert. Die Seriennummer ist der Fall: weicht die am Gehaeuse
      // abgelesene von der dokumentierten ab, liegt ein anderes Getriebe auf
      // der Werkbank als das, was diese Seiten beschreiben. Das muss auffallen.
      var abweichung = el.dataset.abweichung === 'warnen' && vorgabe
                    && w.toLowerCase() !== String(vorgabe).trim().toLowerCase();
      el.innerHTML = '<strong>' + w + '</strong>' + einheit
                   + marke(klasse, 'am Teil ermittelt und im Build Log eingetragen')
                   + (abweichung
                       ? ' <span class="status-warn">&#9888; weicht von der'
                         + ' dokumentierten ' + vorgabe + ' ab</span>'
                       : '');
      el.dataset.zustand = abweichung ? 'abweichend' : 'ermittelt';
      return;
    }

    var weg = quelle
      ? ' &ndash; <a href="' + quelle + '">im Build Log eintragen</a>'
      : '';
    // Die Einheit gehoert an den gemessenen Wert, nicht an die Vorgabe: die
    // bringt ihre eigene mit ("22\" / 56 cm") und laese sonst "56 cm mm".
    el.innerHTML = '<span class="status-warn">&#9888; offen</span>'
                 + (vorgabe ? ' &ndash; Vorgabe ' + vorgabe : '')
                 + weg + marke('f', 'noch nicht ermittelt');
    el.dataset.zustand = 'offen';
  }

  /**
   * Alle Anzeigen der Seite fuellen.
   *
   * @param {object} daten gespeicherter Datensatz; fehlt er, wird er gelesen.
   */
  function renderBefunde(daten) {
    if (!daten) {
      try { daten = JSON.parse(localStorage.getItem('jericoBuildLog') || '{}'); }
      catch (e) { daten = {}; }
    }
    document.querySelectorAll('[data-befund]').forEach(function (el) {
      einer(el, daten);
    });
    return daten;
  }

  global.renderBefunde = renderBefunde;

  if (typeof document !== 'undefined') {
    // Auf der Build-Log-Seite stehen Feld und Anzeige auf derselben Seite.
    // Dort soll die Anzeige sofort folgen, nicht erst beim naechsten Laden.
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.dataset && el.dataset.field
          && document.querySelector('[data-befund="' + el.dataset.field + '"]')) {
        var daten = {};
        document.querySelectorAll('[data-field]').forEach(function (f) {
          daten[f.dataset.field] = f.type === 'checkbox' ? f.checked : f.value;
        });
        renderBefunde(daten);
      }
    });
    document.addEventListener('DOMContentLoaded', function () { renderBefunde(); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
