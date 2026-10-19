/**
 * kuehlkreis.js - der Oelkreis als eine Quelle, aus der Text und Zeichnung
 * entstehen.
 *
 * Vorher stand die Reihenfolge an vier Stellen: im Titel und in der
 * Beschreibung der Zeichnung, in den Beschriftungen der Zeichnung selbst, in
 * der Zeile "Reihenfolge" der Spezifikationen und noch zweimal im Build Log.
 * Vier Kopien, die auseinanderlaufen koennen - und die erste Fassung war
 * ausserdem falsch.
 *
 * Sie lautete "Pump OUT -> Kuehler -> Filter -> Pump IN" und trug Klasse A,
 * also Herstellervorgabe. A-01 sagt dazu aber nichts: "cooler", "filter" und
 * "LF-100" kommen im maschinell ausgelesenen Text null Mal vor, A-02 ist
 * wegen Subset-Font nicht lesbar. Die Zuschreibung war also unbelegt.
 *
 * Die hier abgebildete Reihenfolge stammt aus dem Befund am Geraet: Oel aus
 * dem Oelablass ueber einen Filter in die Pumpe, von der Pumpe an das
 * Thermostat, von dort in den Kuehler (IN unten, OUT oben) und zurueck in den
 * Jerico-Deckel. Ein zweites Thermostat schaltet den Ventilator. Das ist eine
 * Nutzerangabe, keine Herstellerangabe - Klasse E, bis Jerico sie bestaetigt.
 *
 * Oeffentlich:
 *   KUEHLKREIS.STATIONEN   die Stationen in Reihenfolge
 *   KUEHLKREIS.alsText()   "Getriebe -> Filter -> ..." fuer Textstellen
 *   KUEHLKREIS.anschluesse()  die Anschlussfolge, feiner
 *   KUEHLKREIS.svg()       die Zeichnung, aus denselben Daten
 *   kuehlkreisEinsetzen()  alles auf der Seite fuellen
 */
(function (global) {
  'use strict';

  // Reihenfolge des Kreises. 'aus' beschriftet die Leitung, die diese Station
  // verlaesst; 'kasten' traegt die Lage in der Zeichnung.
  var STATIONEN = [
    { id: 'getriebe', name: 'Getriebe', zusatz: 'Sumpf, ca. 2 Quarts',
      aus: 'Ölablass', kasten: { x: 30, y: 160, w: 170, h: 100 } },
    { id: 'filter', name: 'Filter LF-100', zusatz: 'Saugseite',
      aus: 'zur Pumpe', kasten: { x: 30, y: 330, w: 170, h: 60 } },
    { id: 'pumpe', name: 'Jerico Ölpumpe', zusatz: 'Single Stage, im Tail Housing',
      aus: 'Pumpe OUT', kasten: { x: 265, y: 330, w: 170, h: 60 } },
    { id: 'thermostat', name: 'Derale Thermostat', zusatz: 'in der Leitung',
      aus: 'Kühler IN (unten)', kasten: { x: 500, y: 330, w: 170, h: 60 } },
    { id: 'kuehler', name: 'Ölkühler', zusatz: 'IN unten, OUT oben',
      aus: 'Kühler OUT (oben)', kasten: { x: 500, y: 130, w: 170, h: 130 } },
    { id: 'deckel', name: 'Jerico Deckel', zusatz: 'Rücklauf',
      aus: 'ins Getriebe', kasten: { x: 265, y: 30, w: 170, h: 60 } }
  ];

  // Der Ventilator haengt nicht im Oelweg, er wird nur geschaltet.
  var LUEFTER = {
    name: 'Derale Thermostat',
    zweck: 'schaltet den Ventilator am Kühler',
    kasten: { x: 250, y: 165, w: 180, h: 56 }
  };

  /** Die Stationen in Reihenfolge, als Kette - zurueck zum Anfang. */
  function alsText() {
    return STATIONEN.map(function (s) { return s.name; }).join(' → ')
      + ' → ' + STATIONEN[0].name;
  }

  /** Die Anschlussfolge, feiner als die Stationskette. */
  function anschluesse() {
    return STATIONEN.map(function (s) { return s.aus; }).join(' → ');
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function station(id) {
    for (var i = 0; i < STATIONEN.length; i++) if (STATIONEN[i].id === id) return STATIONEN[i];
    return null;
  }

  // Leitungen als rechtwinklige Zuege. Die Punkte sind von Hand gesetzt, die
  // Beschriftung kommt aus den Daten - eine falsche Reihenfolge im Text kann
  // damit nicht mehr neben einer anderen in der Zeichnung stehen.
  var LEITUNGEN = [
    { von: 'getriebe', pfad: 'M115 260 V330', tx: 124, ty: 300, anker: 'start' },
    { von: 'filter', pfad: 'M200 360 H265', tx: 232, ty: 352, anker: 'middle' },
    { von: 'pumpe', pfad: 'M435 360 H500', tx: 467, ty: 352, anker: 'middle' },
    { von: 'thermostat', pfad: 'M540 330 V260', tx: 548, ty: 300, anker: 'start' },
    { von: 'kuehler', pfad: 'M585 130 V60 H435', tx: 585, ty: 50, anker: 'middle' },
    { von: 'deckel', pfad: 'M265 60 H115 V160', tx: 108, ty: 112, anker: 'end' }
  ];

  function kasten(s, farbe) {
    var k = s.kasten;
    var t = [];
    t.push('<rect x="' + k.x + '" y="' + k.y + '" width="' + k.w + '" height="' + k.h
      + '" rx="8" fill="#f7fafc" stroke="' + farbe + '" stroke-width="2"/>');
    var mx = k.x + k.w / 2;
    t.push('<text x="' + mx + '" y="' + (k.y + 26) + '" text-anchor="middle" font-size="13"'
      + ' font-weight="700" fill="#2d3748">' + esc(s.name) + '</text>');
    if (s.zusatz) {
      t.push('<text x="' + mx + '" y="' + (k.y + 44) + '" text-anchor="middle" font-size="10"'
        + ' fill="#718096">' + esc(s.zusatz) + '</text>');
    }
    return t.join('');
  }

  /** Die Zeichnung. Beschriftungen und Reihenfolge kommen aus STATIONEN. */
  function svg() {
    var t = [];
    t.push('<svg viewBox="0 0 700 410" role="img" aria-labelledby="kreisTitel kreisDesc"'
      + ' style="width:100%;height:auto;">');
    t.push('<title id="kreisTitel">Ölkreis des Jerico mit integrierter Ölpumpe</title>');
    t.push('<desc id="kreisDesc">' + esc(anschluesse())
      + '. Ein zweites Thermostat schaltet den Ventilator am Kühler.</desc>');
    t.push('<defs><marker id="kkPfeil" viewBox="0 0 10 10" refX="9" refY="5"'
      + ' markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
      + '<path d="M0,0 L10,5 L0,10 z" fill="#2a78d6"/></marker></defs>');

    // Kuehlerlamellen, damit der Kasten als Kuehler zu erkennen ist.
    var k = station('kuehler').kasten;
    t.push('<g stroke="#cbd5e0" stroke-width="2">');
    for (var y = k.y + 58; y < k.y + k.h - 8; y += 16) {
      t.push('<path d="M' + (k.x + 12) + ' ' + y + ' H' + (k.x + k.w - 12) + '"/>');
    }
    t.push('</g>');

    STATIONEN.forEach(function (s) { t.push(kasten(s, '#4a5568')); });

    // Ventilator-Thermostat: gestrichelt, weil es nicht im Oelweg liegt.
    var l = LUEFTER.kasten;
    t.push('<rect x="' + l.x + '" y="' + l.y + '" width="' + l.w + '" height="' + l.h
      + '" rx="8" fill="#fffff0" stroke="#975a16" stroke-width="2" stroke-dasharray="5 4"/>');
    t.push('<text x="' + (l.x + l.w / 2) + '" y="' + (l.y + 23)
      + '" text-anchor="middle" font-size="12" font-weight="700" fill="#975a16">'
      + esc(LUEFTER.name) + '</text>');
    t.push('<text x="' + (l.x + l.w / 2) + '" y="' + (l.y + 40)
      + '" text-anchor="middle" font-size="9" fill="#975a16">' + esc(LUEFTER.zweck) + '</text>');
    t.push('<path d="M' + (l.x + l.w) + ' ' + (l.y + l.h / 2) + ' H' + k.x
      + '" fill="none" stroke="#975a16" stroke-width="2" stroke-dasharray="5 4"/>');

    LEITUNGEN.forEach(function (ltg) {
      var s = station(ltg.von);
      if (!s) return;
      t.push('<path d="' + ltg.pfad + '" fill="none" stroke="#2a78d6" stroke-width="3"'
        + ' marker-end="url(#kkPfeil)"/>');
      t.push('<text x="' + ltg.tx + '" y="' + ltg.ty + '" text-anchor="' + ltg.anker
        + '" font-size="10" font-weight="600" fill="#2a78d6">' + esc(s.aus) + '</text>');
    });

    t.push('</svg>');
    return t.join('');
  }

  /** Zeichnung und Textstellen auf der Seite fuellen. */
  function kuehlkreisEinsetzen() {
    if (typeof document === 'undefined') return;
    var bild = document.getElementById('kuehlkreisBild');
    if (bild) bild.innerHTML = svg();
    document.querySelectorAll('[data-kuehlkreis]').forEach(function (el) {
      var was = el.dataset.kuehlkreis;
      if (was === 'reihenfolge') el.textContent = alsText();
      else if (was === 'anschluesse') el.textContent = anschluesse();
      else if (was === 'luefter') el.textContent = LUEFTER.name + ' – ' + LUEFTER.zweck;
    });
  }

  global.KUEHLKREIS = {
    STATIONEN: STATIONEN, LUEFTER: LUEFTER,
    alsText: alsText, anschluesse: anschluesse, svg: svg
  };
  global.kuehlkreisEinsetzen = kuehlkreisEinsetzen;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', kuehlkreisEinsetzen);
    } else { kuehlkreisEinsetzen(); }
  }
})(typeof window !== 'undefined' ? window : globalThis);
