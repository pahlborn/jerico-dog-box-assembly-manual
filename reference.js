/**
 * reference.js - Betriebsmittel, Anzugswerte und Service als Nachschlagekarte.
 *
 * Erreichbar auf jeder Seite ueber den Knopf rechts. Aufgebaut wie das
 * Glossar - ein Overlay, keine eigene Seite: wer an der Werkbank einen
 * Drehmomentwert sucht, soll seinen Schritt im Build Log nicht verlieren.
 *
 * Warum Daten und nicht HTML: Das Glossar liegt als fertiges Markup in jeder
 * Seite, viermal dieselben 25 KB. Bei Werten, die auch anderswo stehen, ist
 * das eine Falle - zwei Kuehlsystem-Kapitel und das Quellenregister sind
 * genau daran auseinandergelaufen. Hier steht jeder Wert einmal, die Karte
 * wird daraus gebaut, und tests/ui.test.mjs vergleicht sie gegen specs.html.
 * Weicht etwas ab, wird der Test rot statt die Anleitung still falsch.
 *
 * Neuer Wert: hier eintragen und in specs.html - der Test nennt die
 * Abweichung, falls eine Seite vergessen wird.
 */
(function (global) {
  'use strict';

  var REFERENCE = {
    titel: 'Betriebsmittel &amp; Anzugswerte',
    untertitel: 'Jerico RH02374 &ndash; alle Werte aus der Prim&auml;rliteratur (A-01, A-02)',
    gruppen: [
      {
        id: 'ref-torque',
        titel: '&#128295; Anzugsmomente',
        hinweis: 'Die Pumpenschrauben stehen in <strong>lb./in</strong>, nicht lb./ft &ndash; '
               + '90 lb./in sind 10,2 Nm, nicht 122 Nm. Nach jeder Stufe die Hauptwelle drehen '
               + 'und auf Klemmen pr&uuml;fen.',
        spalten: ['Schraube / Position', 'lb./ft', 'Nm'],
        breiten: ['auto', '90px', '90px'],
        zeilen: [
          ['R&uuml;ckw&auml;rtsgang-Schaltgabel-Klemmschraube (5/16-24 &times; 1&quot;)', '28', '38'],
          ['3-4 Schaltgabel-Klemmschraube (5/16-24 &times; 1&frac14;&quot;, Loctite)', '28', '38'],
          ['1-2 Schaltgabel-Klemmschraube (5/16-24 &times; &frac34;&quot;, Loctite)', '28', '38'],
          ['Zweiteiliger Hinterlager-Halteclip (1/4-28 &times; &#8542;&quot;)', '22', '30'],
          ['Seitliche Detentschraube (3/8-16 &times; &frac12;&quot; mit AN-Scheibe)', '22', '30'],
          ['Vorderer Lagerflansch (5/16-18 &times; 1&quot; mit AN-Scheiben)', '22', '30'],
          ['Tail Housing (7/16-14 &times; 1&frac12;&quot;)', '25 &rarr; 35', '34 &rarr; 47'],
          ['&Ouml;lpumpen-Adapterplatte (7/16-14 &times; 1&frac12;&quot;)', '25 &rarr; 35', '34 &rarr; 47'],
          ['Oberer Deckel (5/16-18 &times; 1&quot;)', '22', '30'],
          ['Bodendeckel (5/16-18 &times; 1&quot;) &ndash; entf&auml;llt bei Top Loader Only', '22', '30'],
          ['&Ouml;lpumpe an Tail Housing (1/4-20 &times; 1&quot;)',
           '35 &rarr; 60 &rarr; 90 lb./in', '4 &rarr; 6,8 &rarr; 10,2']
        ]
      },
      {
        id: 'ref-lubes',
        titel: '&#128167; Schmierstoffe &amp; Dichtmittel',
        hinweis: 'Die Herstellervorgabe ist die <strong>Spezifikation</strong>, nicht die Marke. '
               + 'Mobil 1 ist das im Assembly Manual verwendete Produkt, kein Zwang.',
        spalten: ['Anwendung', 'Betriebsmittel'],
        breiten: ['auto', '45%'],
        zeilen: [
          ['Alle Zahnrad-Lagerfl&auml;chen, Nadellager', 'Synthetisches 75W90 &ndash; im Manual: Mobil 1 75W90'],
          ['Schaltfingerdichtungen, Anlauffl&auml;chen, Lagerbohrungen', 'Universalfett &ndash; im Manual: Mobil 1 Universal Grease'],
          ['Schaltfingerwellen, Schaltschienen', 'Synthetisches 75W90 &ndash; im Manual: Mobil 1 75W90'],
          ['Viton O-Ring beim Einbau', 'd&uuml;nner &Ouml;lfilm'],
          ['Andere O-Ringe', 'trocken einbauen'],
          ['Vorderer Lagerflansch / Tail Housing Dichtfl&auml;chen', 'Hylomar Gasket Maker'],
          ['Adapterplatte &Ouml;lpumpe', 'Hylomar oder Loctite Ultra Black'],
          ['Hinterdichtung im Geh&auml;use', 'd&uuml;nne Silikonschicht'],
          ['Schaltgabel-Klemmschrauben 1-2 und 3-4', 'Loctite']
        ]
      },
      {
        id: 'ref-service',
        titel: '&#128738; &Ouml;l, Bef&uuml;llung &amp; Service',
        hinweis: 'Die Intervalle sind ereignisbezogen, nicht nach Kilometern &ndash; '
               + 'so steht es im Break-In-Sheet (A-02).',
        spalten: ['Punkt', 'Vorgabe'],
        breiten: ['38%', 'auto'],
        zeilen: [
          ['&Ouml;lsorte (Herstellervorgabe A-02)', 'Synthetic Multi-Viscosity Gear Oil SAE 75W90 &ndash; <strong>kein Straight 90W</strong>'],
          ['Im Assembly Manual verwendetes Produkt', 'Mobil 1 75W90'],
          ['Menge', 'ca. 2 Quarts (~1,9 l)'],
          ['F&uuml;llstand', '3/4&quot; unter der seitlichen Einf&uuml;ll&ouml;ffnung &ndash; nicht &uuml;berf&uuml;llen'],
          ['K&uuml;hler', 'Pflicht auf dem Road Course'],
          ['Vorw&auml;rmung', 'Hinterachse aufbocken, h&ouml;chster Gang, warm laufen lassen'],
          ['Einfahren', 'langsam im Fahrerlager, alle G&auml;nge be- und entlasten'],
          ['&Ouml;lwechsel nach Einfahren', 'vor dem ersten Renneinsatz'],
          ['&Ouml;lwechsel nach erstem Renntag', 'Pflicht'],
          ['Bellhousing-Ausrichtung', 'vor Einbau verifizieren'],
          ['Getriebelager', 'nur flexibles Gummilager, nie starr']
        ]
      }
    ]
  };

  global.REFERENCE = REFERENCE;

  /* ---- Overlay bauen. Erst beim ersten Oeffnen, nicht beim Laden: die
     Karte liegt sonst auf jeder Seite im DOM, ohne je gebraucht zu werden. */
  function baueOverlay() {
    if (document.getElementById('guide-reference')) return;

    var teile = [];
    teile.push('<div class="guide-overlay" id="guide-reference">');
    teile.push('<div class="glossary-search">');
    teile.push('  <div class="glossary-search-row">');
    teile.push('    <button class="guide-back" onclick="hideGuide(\'guide-reference\')">&larr;</button>');
    teile.push('    <input type="search" id="referenceSearch" placeholder="Wert oder Bauteil suchen..." oninput="filterReference()">');
    teile.push('    <span class="glossary-count" id="referenceCount"></span>');
    teile.push('  </div>');
    teile.push('</div>');
    teile.push('<div class="guide-content" id="referenceBody">');
    teile.push('  <div class="info-box" style="margin-bottom:0.8rem;"><strong>' + REFERENCE.titel
             + '.</strong> ' + REFERENCE.untertitel
             + '. Zum Ausdrucken bei ge&ouml;ffneter Karte <strong>Strg+P</strong>.</div>');

    REFERENCE.gruppen.forEach(function (g) {
      teile.push('<div class="ref-group" id="' + g.id + '">');
      teile.push('  <h3 class="ref-group-titel">' + g.titel + '</h3>');
      teile.push('  <div class="table-wrapper"><table class="data-table"><thead><tr>');
      g.spalten.forEach(function (sp, k) {
        var w = (g.breiten && g.breiten[k] && g.breiten[k] !== 'auto')
              ? ' style="width:' + g.breiten[k] + ';"' : '';
        teile.push('<th' + w + '>' + sp + '</th>');
      });
      teile.push('  </tr></thead><tbody>');
      g.zeilen.forEach(function (z) {
        teile.push('<tr class="ref-row">' + z.map(function (c, k) {
          // Letzte Spalte einer dreispaltigen Tafel ist der Nm-Wert - hervorheben.
          var stark = (z.length === 3 && k === 2) ? ' style="font-weight:700;"' : '';
          return '<td' + stark + '>' + c + '</td>';
        }).join('') + '</tr>');
      });
      teile.push('  </tbody></table></div>');
      if (g.hinweis) teile.push('  <div class="info-box">' + g.hinweis + '</div>');
      teile.push('</div>');
    });

    teile.push('  <div class="ref-leer" id="referenceLeer" style="display:none;">Kein Treffer.</div>');
    teile.push('</div>');
    teile.push('</div>');

    var huelle = document.createElement('div');
    huelle.innerHTML = teile.join('\n');
    document.body.appendChild(huelle.firstChild);
  }

  function showReference() {
    baueOverlay();
    showGuide('guide-reference');
    var feld = document.getElementById('referenceSearch');
    if (feld) { feld.value = ''; filterReference(); }
  }

  /* ---- Filter ueber alle Zeilen, wie im Glossar. Eine Gruppe ohne Treffer
     verschwindet mit, sonst bleiben leere Ueberschriften stehen. */
  function filterReference() {
    var feld = document.getElementById('referenceSearch');
    var q = (feld ? feld.value : '').trim().toLowerCase();
    var treffer = 0;

    REFERENCE.gruppen.forEach(function (g) {
      var block = document.getElementById(g.id);
      if (!block) return;
      var sichtbar = 0;
      block.querySelectorAll('tr.ref-row').forEach(function (tr) {
        var passt = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
        tr.style.display = passt ? '' : 'none';
        if (passt) sichtbar++;
      });
      block.style.display = sichtbar ? '' : 'none';
      treffer += sichtbar;
    });

    var zaehler = document.getElementById('referenceCount');
    if (zaehler) zaehler.textContent = q ? (treffer + ' Treffer') : '';
    var leer = document.getElementById('referenceLeer');
    if (leer) leer.style.display = (q && !treffer) ? '' : 'none';
  }

  global.showReference = showReference;
  global.filterReference = filterReference;
})(typeof window !== 'undefined' ? window : globalThis);
