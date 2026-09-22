/**
 * perf-charts.js - Interaktive Getriebe-Diagramme fuer performance.html.
 *
 * Ersetzt die statischen SVG-Tafeln durch dynamische Canvas-Charts mit
 * Checkboxen zum Ein-/Ausblenden der drei Getriebe.
 *
 * Keine externen Abhaengigkeiten (kein Chart.js, kein D3).
 */
(function () {
  'use strict';

  // ---- Daten ----
  var TIRE_CIRC = 2.13;    // Abrollumfang [m]
  var AXLE = 3.50;          // Hinterachsuebersetzung
  var SHIFT_RPM = 6000;     // Schaltdrehzahl

  var GEARBOXES = [
    {
      id: 'jerico', name: 'Jerico RH02374', color: '#2a78d6',
      ratios: [2.588, 1.714, 1.182, 1.000]
    },
    {
      id: 'close', name: 'Toploader Close', color: '#eb6834',
      ratios: [2.320, 1.690, 1.290, 1.000]
    },
    {
      id: 'wide', name: 'Toploader Wide', color: '#1baf7a',
      ratios: [2.780, 1.930, 1.360, 1.000]
    }
  ];

  // Angenommene Motorkurve (Nm bei Drehzahl)
  var TORQUE_CURVE = [
    [2000,430],[2250,450],[2500,470],[2750,484],[3000,497],
    [3250,505],[3500,513],[3750,516],[4000,520],[4250,515],
    [4500,510],[4750,498],[5000,485],[5250,468],[5500,445],
    [5750,424],[6000,400]
  ];

  function torqueAt(rpm) {
    for (var i = 0; i < TORQUE_CURVE.length - 1; i++) {
      if (rpm <= TORQUE_CURVE[i + 1][0]) {
        var a = TORQUE_CURVE[i], b = TORQUE_CURVE[i + 1];
        var t = (rpm - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return TORQUE_CURVE[TORQUE_CURVE.length - 1][1];
  }

  function hpAt(rpm) { return torqueAt(rpm) * rpm / 7121; }

  function speedKmh(rpm, gearRatio) {
    return (rpm * TIRE_CIRC * 60) / (gearRatio * AXLE * 1000);
  }

  // ---- Visibility State ----
  var visible = { jerico: true, close: true, wide: true };

  // ---- Canvas Helpers ----
  var DPR = window.devicePixelRatio || 1;

  function setupCanvas(canvas, w, h) {
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    return ctx;
  }

  function drawGrid(ctx, W, H, pad, xMin, xMax, yMin, yMax, xLabel, yLabel, xStep, yStep) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    var plotW = W - pad.l - pad.r;
    var plotH = H - pad.t - pad.b;

    // Y grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#718096';
    ctx.textAlign = 'right';
    for (var y = yMin; y <= yMax; y += yStep) {
      var py = pad.t + plotH - (y - yMin) / (yMax - yMin) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(W - pad.r, py); ctx.stroke();
      ctx.fillText(Math.round(y), pad.l - 6, py + 4);
    }
    // X grid
    ctx.textAlign = 'center';
    for (var x = xMin; x <= xMax; x += xStep) {
      var px = pad.l + (x - xMin) / (xMax - xMin) * plotW;
      ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + plotH); ctx.stroke();
      ctx.fillText(Math.round(x), px, H - pad.b + 16);
    }
    // Axes
    ctx.strokeStyle = '#a0aec0';
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + plotH); ctx.lineTo(W - pad.r, pad.t + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + plotH); ctx.stroke();
    // Labels
    ctx.fillStyle = '#718096';
    ctx.textAlign = 'end';
    ctx.fillText(xLabel, W - pad.r, H - pad.b + 30);
    ctx.textAlign = 'start';
    ctx.fillText(yLabel, pad.l - 4, pad.t - 6);
    return { plotW: plotW, plotH: plotH };
  }

  function mapX(v, xMin, xMax, pad, plotW) { return pad.l + (v - xMin) / (xMax - xMin) * plotW; }
  function mapY(v, yMin, yMax, pad, plotH) { return pad.t + plotH - (v - yMin) / (yMax - yMin) * plotH; }

  // ---- Speed Chart ----
  function drawSpeedChart() {
    var canvas = document.getElementById('speedChart');
    if (!canvas) return;
    var W = canvas.parentElement.offsetWidth;
    var H = Math.min(W * 0.5, 380);
    var pad = { l: 56, r: 20, t: 30, b: 40 };
    var ctx = setupCanvas(canvas, W, H);
    var g = drawGrid(ctx, W, H, pad, 1000, 6500, 0, 250, 'Drehzahl [1/min]', 'km/h', 1000, 40);

    var gangLabels = ['1.', '2.', '3.', '4.'];
    var dash = [[12, 4], [8, 4], [4, 4], []];

    GEARBOXES.forEach(function (gb) {
      if (!visible[gb.id]) return;
      gb.ratios.forEach(function (ratio, gi) {
        var x1 = mapX(1000, 1000, 6500, pad, g.plotW);
        var y1 = mapY(speedKmh(1000, ratio), 0, 250, pad, g.plotH);
        var x2 = mapX(SHIFT_RPM, 1000, 6500, pad, g.plotW);
        var y2 = mapY(speedKmh(SHIFT_RPM, ratio), 0, 250, pad, g.plotH);
        ctx.strokeStyle = gb.color;
        ctx.lineWidth = gb.id === 'jerico' ? 2.5 : 1.8;
        ctx.globalAlpha = gb.id === 'jerico' ? 1.0 : 0.7;
        ctx.setLineDash(dash[gi] || []);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        // Endpoint label
        var spd = Math.round(speedKmh(SHIFT_RPM, ratio));
        ctx.fillStyle = gb.color;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'end';
        ctx.fillText(spd + ' km/h', x2 - 4, y2 - 4);
        ctx.globalAlpha = 1.0;
      });
    });

    // Gang-Linien-Legende (Strichstaerken)
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#718096';
    ctx.textAlign = 'start';
    for (var di = 0; di < 4; di++) {
      var lx = pad.l + 10 + di * 70;
      ctx.strokeStyle = '#718096';
      ctx.lineWidth = 1.5;
      ctx.setLineDash(dash[di] || []);
      ctx.beginPath(); ctx.moveTo(lx, pad.t + 8); ctx.lineTo(lx + 20, pad.t + 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(gangLabels[di] + ' Gang', lx + 24, pad.t + 12);
    }

    // Schaltdrehzahl-Linie
    var sx = mapX(SHIFT_RPM, 1000, 6500, pad, g.plotW);
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(sx, pad.t); ctx.lineTo(sx, pad.t + g.plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e53e3e';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'end';
    ctx.fillText('Schaltdrehzahl', sx - 4, pad.t + g.plotH - 4);
  }

  // ---- Shift Points Chart ----
  function drawShiftChart() {
    var canvas = document.getElementById('shiftChart');
    if (!canvas) return;
    var W = canvas.parentElement.offsetWidth;
    var H = Math.min(W * 0.45, 340);
    var pad = { l: 56, r: 20, t: 40, b: 50 };
    var ctx = setupCanvas(canvas, W, H);
    var g = drawGrid(ctx, W, H, pad, 0, 3, 3000, 6000, '', '1/min', 1, 500);

    // X-Axis labels
    var shiftLabels = ['1 \u2192 2', '2 \u2192 3', '3 \u2192 4'];
    ctx.fillStyle = '#718096';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    for (var si = 0; si < 3; si++) {
      var slx = mapX(si + 0.5, 0, 3, pad, g.plotW);
      ctx.fillText(shiftLabels[si], slx, H - pad.b + 34);
    }

    // Drehmomentgipfel-Linie
    var tpY = mapY(4000, 3000, 6000, pad, g.plotH);
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, tpY); ctx.lineTo(W - pad.r, tpY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e53e3e';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText('Drehmomentgipfel 4000/min', pad.l + 4, tpY - 4);

    var visibleGBs = GEARBOXES.filter(function (gb) { return visible[gb.id]; });
    var totalBars = visibleGBs.length;
    if (totalBars === 0) return;

    var groupW = g.plotW / 3;
    var barW = Math.min(groupW / (totalBars + 1), 46);
    var gap = (groupW - barW * totalBars) / (totalBars + 1);

    visibleGBs.forEach(function (gb, bi) {
      gb.ratios.forEach(function (ratio, gi) {
        if (gi >= 3) return; // nur 3 Schaltungen
        var nextRatio = gb.ratios[gi + 1];
        var rpmAfter = SHIFT_RPM * nextRatio / ratio;
        var hpAfter = Math.round(hpAt(rpmAfter));

        var cx = pad.l + gi * groupW + gap * (bi + 1) + barW * bi + barW / 2;
        var barTop = mapY(rpmAfter, 3000, 6000, pad, g.plotH);
        var barBot = mapY(3000, 3000, 6000, pad, g.plotH);

        ctx.fillStyle = gb.color;
        ctx.globalAlpha = 0.85;
        var r = Math.min(4, barW / 4);
        roundRect(ctx, cx - barW / 2, barTop, barW, barBot - barTop, r);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Label above bar
        ctx.fillStyle = '#2d3748';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(rpmAfter), cx, barTop - 12);
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#718096';
        ctx.fillText(hpAfter + ' PS', cx, barTop - 1);
      });
    });

    // Legend
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    GEARBOXES.forEach(function (gb, i) {
      if (!visible[gb.id]) return;
      var lx = pad.l + i * 160;
      ctx.fillStyle = gb.color;
      roundRect(ctx, lx, 6, 12, 12, 2);
      ctx.fill();
      ctx.fillStyle = '#4a5568';
      ctx.textAlign = 'start';
      ctx.fillText(gb.name, lx + 16, 16);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ---- RPM Drop Chart (Wasserfall) ----
  function drawRpmDropChart() {
    var canvas = document.getElementById('rpmDropChart');
    if (!canvas) return;
    var W = canvas.parentElement.offsetWidth;
    var H = Math.min(W * 0.4, 300);
    var pad = { l: 56, r: 20, t: 30, b: 40 };
    var ctx = setupCanvas(canvas, W, H);

    var visibleGBs = GEARBOXES.filter(function (gb) { return visible[gb.id]; });
    if (visibleGBs.length === 0) { ctx.clearRect(0, 0, W, H); return; }

    // Y: RPM drop (0 to max drop)
    var maxDrop = 0;
    visibleGBs.forEach(function (gb) {
      gb.ratios.forEach(function (r, i) {
        if (i < 3) {
          var drop = SHIFT_RPM - SHIFT_RPM * gb.ratios[i + 1] / r;
          if (drop > maxDrop) maxDrop = drop;
        }
      });
    });
    maxDrop = Math.ceil(maxDrop / 500) * 500;
    var g = drawGrid(ctx, W, H, pad, 0, 3, 0, maxDrop, '', 'Drehzahlverlust [1/min]', 1, 500);

    var shiftLabels = ['1 \u2192 2', '2 \u2192 3', '3 \u2192 4'];
    ctx.fillStyle = '#718096';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    for (var si = 0; si < 3; si++) {
      ctx.fillText(shiftLabels[si], mapX(si + 0.5, 0, 3, pad, g.plotW), H - pad.b + 34);
    }

    var groupW = g.plotW / 3;
    var barW = Math.min(groupW / (visibleGBs.length + 1), 46);
    var gap = (groupW - barW * visibleGBs.length) / (visibleGBs.length + 1);

    visibleGBs.forEach(function (gb, bi) {
      gb.ratios.forEach(function (ratio, gi) {
        if (gi >= 3) return;
        var nextRatio = gb.ratios[gi + 1];
        var drop = SHIFT_RPM - SHIFT_RPM * nextRatio / ratio;

        var cx = pad.l + gi * groupW + gap * (bi + 1) + barW * bi + barW / 2;
        var barTop = mapY(drop, 0, maxDrop, pad, g.plotH);
        var barBot = mapY(0, 0, maxDrop, pad, g.plotH);

        ctx.fillStyle = gb.color;
        ctx.globalAlpha = 0.85;
        roundRect(ctx, cx - barW / 2, barTop, barW, barBot - barTop, Math.min(4, barW / 4));
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#2d3748';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(drop), cx, barTop - 4);
      });
    });
  }

  // ---- Rebuild all charts ----
  function redrawAll() {
    drawSpeedChart();
    drawShiftChart();
    drawRpmDropChart();
  }

  // ---- Toggle Handler ----
  window.toggleGearbox = function (id) {
    visible[id] = !visible[id];
    redrawAll();
    // Update checkbox visuals
    var cb = document.getElementById('cb-' + id);
    if (cb) cb.checked = visible[id];
  };

  // ---- Init ----
  function init() {
    // Build toggle controls
    var ctrls = document.querySelectorAll('.gearbox-toggles');
    ctrls.forEach(function (el) {
      el.innerHTML = '';
      GEARBOXES.forEach(function (gb) {
        var label = document.createElement('label');
        label.className = 'gb-toggle';
        label.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-right:12px;cursor:pointer;font-size:0.82rem;user-select:none;';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'cb-' + gb.id;
        cb.checked = visible[gb.id];
        cb.onchange = function () { toggleGearbox(gb.id); };
        var dot = document.createElement('span');
        dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:2px;background:' + gb.color + ';';
        label.appendChild(cb);
        label.appendChild(dot);
        label.appendChild(document.createTextNode(' ' + gb.name));
        el.appendChild(label);
      });
    });
    redrawAll();
  }

  // Responsive
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawAll, 150);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
