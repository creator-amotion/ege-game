/* Геометрия и отрисовка объектов доски урока (lesson.html). Без состояния: только функции.
   Объект — операция журнала после сборки модели: ln (линия пера), sh (фигура), tx (текст) и т. д.
   m — накопленная матрица выделения [a, b, c, d, e, f] (как у canvas: x' = a·x + c·y + e, y' = b·x + d·y + f). */
(function () {
  'use strict';
  var B = {};

  // ───────── матрицы ─────────
  B.I = [1, 0, 0, 1, 0, 0];
  B.mul = function (m2, m1) {            // сначала m1, потом m2
    return [m2[0] * m1[0] + m2[2] * m1[1], m2[1] * m1[0] + m2[3] * m1[1], m2[0] * m1[2] + m2[2] * m1[3], m2[1] * m1[2] + m2[3] * m1[3],
      m2[0] * m1[4] + m2[2] * m1[5] + m2[4], m2[1] * m1[4] + m2[3] * m1[5] + m2[5]];
  };
  B.inv = function (m) {
    var det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  };
  B.ap = function (m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
  B.scaleOf = function (m) { return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; };
  B.translate = function (dx, dy) { return [1, 0, 0, 1, dx, dy]; };
  B.about = function (cx, cy, m) { return B.mul(B.translate(cx, cy), B.mul(m, B.translate(-cx, -cy))); };   // m вокруг точки
  B.rotate = function (a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
  B.scale = function (sx, sy) { return [sx, 0, 0, sy == null ? sx : sy, 0, 0]; };

  // ───────── вершины фигур ─────────
  function ellPts(cx, cy, rx, ry, n) { var out = []; for (var i = 0; i < n; i++) { var t = i / n * Math.PI * 2; out.push(cx + rx * Math.cos(t), cy + ry * Math.sin(t)); } return out; }
  B.verts = function (o) {               // плоский список вершин замкнутой фигуры (без матрицы); null — линия/стрелка
    var a = o.a, x1 = Math.min(a[0], a[2]), x2 = Math.max(a[0], a[2]), y1 = Math.min(a[1], a[3]), y2 = Math.max(a[1], a[3]), cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = (x2 - x1) / 2, ry = (y2 - y1) / 2;
    switch (o.k) {
      case 'rect': return [x1, y1, x2, y1, x2, y2, x1, y2];
      case 'circle': var r = Math.hypot(a[2] - a[0], a[3] - a[1]); return ellPts(a[0], a[1], r, r, 48);
      case 'ell': return ellPts(cx, cy, rx, ry, 48);
      case 'tri': return [cx, y1, x2, y2, x1, y2];
      case 'rhomb': return [cx, y1, x2, cy, cx, y2, x1, cy];
      case 'star': var s = []; for (var i = 0; i < 10; i++) { var t = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? 0.42 : 1; s.push(cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)); } return s;
      case 'ngon': var n = o.n || 6, g = []; for (var j = 0; j < n; j++) { var u = -Math.PI / 2 + j * 2 * Math.PI / n; g.push(cx + rx * Math.cos(u), cy + ry * Math.sin(u)); } return g;
      case 'poly': return o.pp.slice();
    }
    return null;
  };

  // ───────── нажим, карандаш, перо ─────────
  B.prW = function (pr) { return 0.35 + 1.3 * pr / 255; };   // нажим 0…255 → множитель толщины (128 ≈ 1)
  var grain = {};
  function pencilPattern(c, color) {     // зернистая текстура карандаша, своя на каждый цвет
    if (grain[color]) return c.createPattern(grain[color], 'repeat');
    var cv = document.createElement('canvas'); cv.width = cv.height = 48;
    var g = cv.getContext('2d'), d = g.createImageData(48, 48), rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    var seed = 7; var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var i = 0; i < d.data.length; i += 4) { d.data[i] = rgb[0]; d.data[i + 1] = rgb[1]; d.data[i + 2] = rgb[2]; d.data[i + 3] = rnd() < 0.62 ? 150 + rnd() * 105 : rnd() * 60; }
    g.putImageData(d, 0, 0); grain[color] = cv;
    return c.createPattern(cv, 'repeat');
  }
  function dash(c, o, w) { if (o.d === 1) c.setLineDash([w * 2.2, w * 1.7]); else if (o.d === 2) { c.setLineDash([0.01, w * 2.1]); c.lineCap = 'round'; } }
  function smoothPath(c, p) {
    c.moveTo(p[0], p[1]);
    if (p.length === 2) { c.lineTo(p[0] + 0.1, p[1]); return; }
    for (var i = 2; i < p.length - 2; i += 2) c.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
    c.lineTo(p[p.length - 2], p[p.length - 1]);
  }
  B.smoothPath = smoothPath;
  function drawLine(c, o) {
    var p = o.p, w = o.w, n = p.length / 2;
    if (o.tool === 'cg') {               // каллиграфия: перо — отрезок под углом; толщина зависит от направления штриха
      c.beginPath();
      for (var i = 0; i < n - 1 || (n === 1 && i === 0); i++) {
        var j = Math.min(i + 1, n - 1), a1 = ((o.ta && o.ta[i] != null) ? o.ta[i] : (o.na != null ? o.na : 30)) * Math.PI / 180,
          a2 = ((o.ta && o.ta[j] != null) ? o.ta[j] : (o.na != null ? o.na : 30)) * Math.PI / 180,
          h1 = w / 2 * (o.pr ? B.prW(o.pr[i]) : 1), h2 = w / 2 * (o.pr ? B.prW(o.pr[j]) : 1),
          nx1 = Math.cos(a1) * h1, ny1 = Math.sin(a1) * h1, nx2 = Math.cos(a2) * h2, ny2 = Math.sin(a2) * h2;
        c.moveTo(p[2 * i] + nx1, p[2 * i + 1] + ny1); c.lineTo(p[2 * j] + nx2, p[2 * j + 1] + ny2);
        c.lineTo(p[2 * j] - nx2, p[2 * j + 1] - ny2); c.lineTo(p[2 * i] - nx1, p[2 * i + 1] - ny1); c.closePath();
        if (n === 1) break;
      }
      c.fill(); c.lineWidth = Math.max(1, w * 0.08); c.stroke();
      return;
    }
    if (o.tool === 'hl') { c.globalAlpha = 0.35; c.lineCap = 'butt'; w = w * 2.4; }
    if (o.tool === 'pc') {                 // карандаш полупрозрачный: одним путём (отрезки дали бы пятна на стыках);
      var avg = function (a, d) { return a && a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : d; };   // нажим — темнее, наклон — шире
      var pr = avg(o.pr, 140), alt = avg(o.ta, 90);
      c.strokeStyle = pencilPattern(c, o.c); c.globalAlpha = Math.min(0.95, 0.45 + 0.5 * pr / 255);
      c.lineWidth = w * (0.7 + 0.5 * pr / 255) * (1 + Math.max(0, 60 - alt) / 40); dash(c, o, w); c.beginPath(); smoothPath(c, p); c.stroke(); return;
    }
    if (!o.pr || o.d || o.tool === 'hl') {  // ровная линия, пунктир или маркер (полупрозрачный) — одним путём
      c.lineWidth = w; dash(c, o, w); c.beginPath(); smoothPath(c, p); c.stroke(); return;
    }
    // нажим: отрезками разной толщины (чернила непрозрачные — стыки не видны)
    for (var k = 0; k < n - 1 || (n === 1 && k === 0); k++) {
      var m = Math.min(k + 1, n - 1), f = (B.prW(o.pr[k]) + B.prW(o.pr[m])) / 2;
      c.lineWidth = Math.max(0.6, w * f);
      c.beginPath(); c.moveTo(p[2 * k], p[2 * k + 1]); c.lineTo(n === 1 ? p[0] + 0.1 : p[2 * m], n === 1 ? p[1] : p[2 * m + 1]); c.stroke();
    }
  }
  var HEADS = { 1: 'arrow', 2: 'tri', 3: 'dot', 4: 'diamond' };
  function head(c, kind, x, y, ang, w) {  // наконечник линии в точке (x, y), направление ang — от линии наружу
    var L = Math.max(18, w * 3.2);
    c.save(); c.setLineDash([]); c.beginPath();
    if (kind === 'arrow') { c.moveTo(x - L * Math.cos(ang - 0.45), y - L * Math.sin(ang - 0.45)); c.lineTo(x, y); c.lineTo(x - L * Math.cos(ang + 0.45), y - L * Math.sin(ang + 0.45)); c.stroke(); }
    else if (kind === 'tri') { c.moveTo(x, y); c.lineTo(x - L * Math.cos(ang - 0.45), y - L * Math.sin(ang - 0.45)); c.lineTo(x - L * Math.cos(ang + 0.45), y - L * Math.sin(ang + 0.45)); c.closePath(); c.fill(); }
    else if (kind === 'dot') { c.arc(x, y, Math.max(5, w * 1.3), 0, Math.PI * 2); c.fill(); }
    else if (kind === 'diamond') { var h = L * 0.55; c.moveTo(x, y); c.lineTo(x - h * Math.cos(ang - 0.6), y - h * Math.sin(ang - 0.6)); c.lineTo(x - 2 * h * Math.cos(ang) * 0.8, y - 2 * h * Math.sin(ang) * 0.8); c.lineTo(x - h * Math.cos(ang + 0.6), y - h * Math.sin(ang + 0.6)); c.closePath(); c.fill(); }
    c.restore();
  }
  B.head = head;
  function drawShape(c, o) {
    var a = o.a; c.lineWidth = o.w; dash(c, o, o.w);
    if (o.k === 'line' || o.k === 'arrow') {
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); c.stroke();
      var ang = Math.atan2(a[3] - a[1], a[2] - a[0]), e2 = o.k === 'arrow' ? 2 : o.e2, e1 = o.e1;
      if (e2) head(c, HEADS[e2] || 'tri', a[2], a[3], ang, o.w);
      if (e1) head(c, HEADS[e1] || 'tri', a[0], a[1], ang + Math.PI, o.w);
      return;
    }
    c.beginPath();
    if (o.k === 'ell') c.ellipse((a[0] + a[2]) / 2, (a[1] + a[3]) / 2, Math.abs(a[2] - a[0]) / 2, Math.abs(a[3] - a[1]) / 2, 0, 0, Math.PI * 2);
    else if (o.k === 'circle') c.arc(a[0], a[1], Math.hypot(a[2] - a[0], a[3] - a[1]), 0, Math.PI * 2);
    else { var v = B.verts(o); c.moveTo(v[0], v[1]); for (var i = 2; i < v.length; i += 2) c.lineTo(v[i], v[i + 1]); c.closePath(); }
    if (o.f) { c.save(); c.globalAlpha = 0.35; c.fillStyle = o.f; c.fill(); c.restore(); }
    c.stroke();
    if (o.k === 'circle' && o.mark) { c.beginPath(); c.arc(a[0], a[1], 4, 0, Math.PI * 2); c.fill(); }
  }
  B.font = function (o) { return (o.fw ? '800 ' : '600 ') + o.z + 'px "Golos Text", sans-serif'; };
  B.textBox = function (c, o) {          // размер текста на доске (без матрицы): [ширина, высота]
    c.save(); c.font = B.font(o);
    var lines = String(o.s).split('\n'), wd = Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; }));
    c.restore();
    return [wd, lines.length * o.z * 1.25];
  };
  function drawText(c, o) {
    var lines = String(o.s).split('\n');
    if (o.b) { var tb = B.textBox(c, o), pad = o.z * 0.35; c.save(); c.fillStyle = o.b; c.fillRect(o.x - pad, o.y - pad, tb[0] + 2 * pad, tb[1] + 2 * pad); c.lineWidth = Math.max(2, o.z / 14); c.strokeStyle = '#111111'; c.strokeRect(o.x - pad, o.y - pad, tb[0] + 2 * pad, tb[1] + 2 * pad); c.restore(); }
    c.font = B.font(o); c.textBaseline = 'top';
    lines.forEach(function (line, i) { c.fillText(line, o.x, o.y + i * o.z * 1.25); });
  }
  B.draw = function (c, o) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = o.c || '#111111';
    if (o.m) c.transform(o.m[0], o.m[1], o.m[2], o.m[3], o.m[4], o.m[5]);
    if (o.t === 'ln') drawLine(c, o);
    else if (o.t === 'sh') drawShape(c, o);
    else if (o.t === 'tx') drawText(c, o);
    else if (B.extra[o.t]) B.extra[o.t](c, o);
    c.restore();
  };
  B.extra = {};                           // отрисовка объектов урока (лента, наклейки, график…) добавляется ниже/отдельно

  // ───────── рамка и попадание ─────────
  B.localBox = function (c, o) {          // [x1, y1, x2, y2] без матрицы
    if (o.t === 'ln') { var p = o.p, x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; for (var i = 0; i < p.length; i += 2) { x1 = Math.min(x1, p[i]); x2 = Math.max(x2, p[i]); y1 = Math.min(y1, p[i + 1]); y2 = Math.max(y2, p[i + 1]); } var h = o.w * (o.tool === 'hl' ? 1.2 : 0.5); return [x1 - h, y1 - h, x2 + h, y2 + h]; }
    if (o.t === 'sh') {
      var v = B.verts(o);
      if (!v) { var a = o.a, L = Math.max(18, o.w * 3.2); return [Math.min(a[0], a[2]) - L, Math.min(a[1], a[3]) - L, Math.max(a[0], a[2]) + L, Math.max(a[1], a[3]) + L]; }
      var b = [Infinity, Infinity, -Infinity, -Infinity]; for (var j = 0; j < v.length; j += 2) { b[0] = Math.min(b[0], v[j]); b[2] = Math.max(b[2], v[j]); b[1] = Math.min(b[1], v[j + 1]); b[3] = Math.max(b[3], v[j + 1]); }
      return [b[0] - o.w / 2, b[1] - o.w / 2, b[2] + o.w / 2, b[3] + o.w / 2];
    }
    if (o.t === 'tx') { var tb = B.textBox(c, o), pad = o.b ? o.z * 0.35 : 0; return [o.x - pad, o.y - pad, o.x + tb[0] + pad, o.y + tb[1] + pad]; }
    if (B.extraBox[o.t]) return B.extraBox[o.t](c, o);
    return null;
  };
  B.extraBox = {};
  B.box = function (c, o) {               // рамка на доске (с матрицей)
    var b = B.localBox(c, o); if (!b || !o.m) return b;
    var pts = [B.ap(o.m, b[0], b[1]), B.ap(o.m, b[2], b[1]), B.ap(o.m, b[2], b[3]), B.ap(o.m, b[0], b[3])];
    return [Math.min.apply(null, pts.map(function (p) { return p[0]; })), Math.min.apply(null, pts.map(function (p) { return p[1]; })),
      Math.max.apply(null, pts.map(function (p) { return p[0]; })), Math.max.apply(null, pts.map(function (p) { return p[1]; }))];
  };
  function distSeg(px, py, ax, ay, bx, by) { var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  B.distSeg = distSeg;
  function inPoly(x, y, v) { var ins = false; for (var i = 0, j = v.length - 2; i < v.length; j = i, i += 2) { if ((v[i + 1] > y) !== (v[j + 1] > y) && x < (v[j] - v[i]) * (y - v[i + 1]) / (v[j + 1] - v[i + 1]) + v[i]) ins = !ins; } return ins; }
  B.inPoly = inPoly;
  B.hit = function (c, o, x, y, r) {      // касание точки (x, y) радиусом r — в координатах доски
    if (o.m) { var q = B.ap(B.inv(o.m), x, y); x = q[0]; y = q[1]; r = r / B.scaleOf(o.m); }
    if (o.t === 'ln') {
      var p = o.p, half = o.w / 2 * (o.tool === 'hl' ? 2.4 : o.tool === 'cg' ? 1 : 1.3);
      if (p.length === 2) return Math.hypot(p[0] - x, p[1] - y) < r + half;
      for (var i = 0; i < p.length - 2; i += 2) if (distSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) < r + half) return true;
      return false;
    }
    if (o.t === 'sh') {
      var v = B.verts(o);
      if (!v) return distSeg(x, y, o.a[0], o.a[1], o.a[2], o.a[3]) < r + o.w;
      if (o.f && inPoly(x, y, v)) return true;
      for (var j = 0; j < v.length; j += 2) { var k = (j + 2) % v.length; if (distSeg(x, y, v[j], v[j + 1], v[k], v[k + 1]) < r + o.w) return true; }
      return false;
    }
    if (B.extraHit[o.t]) return B.extraHit[o.t](o, x, y, r);
    var b = B.localBox(c, o);
    return !!b && x > b[0] - r && x < b[2] + r && y > b[1] - r && y < b[3] + r;
  };
  B.samples = function (c, o) {           // точки объекта на доске — для лассо
    var pts = [];
    if (o.t === 'ln') { for (var i = 0; i < o.p.length; i += 2) pts.push([o.p[i], o.p[i + 1]]); }
    else if (o.t === 'sh') { var v = B.verts(o) || o.a; for (var j = 0; j < v.length; j += 2) pts.push([v[j], v[j + 1]]); }
    else { var b = B.localBox(c, o); if (b) pts = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]]; }
    return o.m ? pts.map(function (p) { return B.ap(o.m, p[0], p[1]); }) : pts;
  };

  // ───────── упрощение, распознавание фигур ─────────
  B.rdp = function (pts, eps) {           // pts — [[x, y], …]
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
    var st = [[0, pts.length - 1]];
    while (st.length) {
      var s = st.pop(), a = s[0], b = s[1], best = 0, idx = -1;
      for (var i = a + 1; i < b; i++) { var d = distSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]); if (d > best) { best = d; idx = i; } }
      if (best > eps && idx > 0) { keep[idx] = true; st.push([a, idx], [idx, b]); }
    }
    return pts.filter(function (_, i) { return keep[i]; });
  };
  function plen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  /* Удержание пера в конце штриха → идеальная фигура (как в Notability). flat — [x0, y0, x1, y1, …].
     Возвращает {k, a, q?} для операции sh или null, если фигуры не видно. */
  B.recognize = function (flat) {
    var pts = []; for (var i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    if (pts.length < 3) return null;
    var L = plen(pts), x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach(function (p) { x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]); y1 = Math.min(y1, p[1]); y2 = Math.max(y2, p[1]); });
    var D = Math.hypot(x2 - x1, y2 - y1); if (D < 12) return null;
    var s = pts[0], e = pts[pts.length - 1], closed = Math.hypot(e[0] - s[0], e[1] - s[1]) < Math.max(0.18 * L, 14);
    if (!closed) {
      var straight = Math.hypot(e[0] - s[0], e[1] - s[1]);
      if (straight > 0.9 * L) return { k: 'line', a: [s[0], s[1], e[0], e[1]] };
      var c3 = B.rdp(pts, 0.08 * D);                         // стрелка: длинное древко и короткая «галочка» на конце
      if (c3.length >= 4 && Math.hypot(c3[1][0] - c3[0][0], c3[1][1] - c3[0][1]) > 0.55 * L) return { k: 'arrow', a: [c3[0][0], c3[0][1], c3[1][0], c3[1][1]] };
      return null;
    }
    var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
    var rs = pts.map(function (p) { return Math.hypot(p[0] - cx, p[1] - cy); }), mr = rs.reduce(function (a, b) { return a + b; }, 0) / rs.length;
    var sd = Math.sqrt(rs.reduce(function (a, r) { return a + (r - mr) * (r - mr); }, 0) / rs.length) / (mr || 1);
    var ring = pts.slice(0, -1).concat([pts[0]]), cs = B.rdp(ring, 0.07 * D);
    cs = cs.slice(0, -1);                                    // последняя точка = первая
    // угол у начала: если первая точка лежит на стороне, а не в вершине — убираем её
    if (cs.length > 3) { var p0 = cs[cs.length - 1], p1 = cs[0], p2 = cs[1]; if (distSeg(p1[0], p1[1], p0[0], p0[1], p2[0], p2[1]) < 0.07 * D) cs = cs.slice(1); }
    var aspect = (x2 - x1) / Math.max(1, y2 - y1);
    if (sd < 0.11 && cs.length >= 5 || cs.length > 8) {
      if (aspect > 0.82 && aspect < 1.22) { var r = (x2 - x1 + y2 - y1) / 4; return { k: 'circle', a: [(x1 + x2) / 2, (y1 + y2) / 2, (x1 + x2) / 2 + r, (y1 + y2) / 2] }; }
      return { k: 'ell', a: [x1, y1, x2, y2] };
    }
    if (cs.length === 3) return { k: 'poly', a: [x1, y1, x2, y2], pp: [].concat.apply([], cs) };
    if (cs.length === 4) {
      var axis = cs.every(function (p, i) { var q = cs[(i + 1) % 4], ang = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0])) % (Math.PI / 2); return ang < 0.2 || ang > Math.PI / 2 - 0.2; });
      if (axis) return { k: 'rect', a: [x1, y1, x2, y2] };
      return { k: 'poly', a: [x1, y1, x2, y2], pp: [].concat.apply([], cs) };
    }
    if (cs.length >= 5 && cs.length <= 8) return { k: 'poly', a: [x1, y1, x2, y2], pp: [].concat.apply([], cs) };
    return null;
  };
  B.snapPts = function (sh, step) {       // привязка вершин к сетке доски
    var r = function (v) { return Math.round(v / step) * step; };
    sh.a = sh.a.map(r); if (sh.pp) sh.pp = sh.pp.map(r);
    if (sh.k === 'circle') { sh.a[2] = sh.a[0] + Math.max(step, Math.abs(sh.a[2] - sh.a[0])); sh.a[3] = sh.a[1]; }
    return sh;
  };

  // ───────── частичный ластик: разрезать штрих ─────────
  /* Штрих (с матрицей, если есть) переводится в координаты доски, уплотняется до шага step и режется по кругу ластика.
     Возвращает куски [{p, pr?, ta?}], у каждого не меньше 2 точек; null — ластик не задел штрих. */
  B.cut = function (o, x, y, r) {
    var m = o.m, sc = m ? B.scaleOf(m) : 1, p = o.p, n = p.length / 2, step = Math.max(2, r / 2), dense = [];
    for (var i = 0; i < n; i++) {
      var a = m ? B.ap(m, p[2 * i], p[2 * i + 1]) : [p[2 * i], p[2 * i + 1]];
      if (i > 0) {
        var prev = dense[dense.length - 1], d = Math.hypot(a[0] - prev.x, a[1] - prev.y), k = Math.floor(d / step);
        for (var j = 1; j < k; j++) { var t = j / k; dense.push({ x: prev.x + (a[0] - prev.x) * t, y: prev.y + (a[1] - prev.y) * t, pr: o.pr ? Math.round(prev.pr + (o.pr[i] - prev.pr) * t) : null, ta: o.ta ? prev.ta : null }); }
      }
      dense.push({ x: a[0], y: a[1], pr: o.pr ? o.pr[i] : null, ta: o.ta ? o.ta[i] : null });
    }
    var rr = r + o.w * sc / 2, gone = dense.map(function (q) { return Math.hypot(q.x - x, q.y - y) < rr; });
    if (!gone.some(Boolean)) return null;
    var pieces = [], cur = [];
    dense.forEach(function (q, i) { if (gone[i]) { if (cur.length >= 2) pieces.push(cur); cur = []; } else cur.push(q); });
    if (cur.length >= 2) pieces.push(cur);
    return pieces.map(function (pc) {
      var out = { p: [] }; if (o.pr) out.pr = []; if (o.ta) out.ta = [];
      pc.forEach(function (q) { out.p.push(Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10); if (o.pr) out.pr.push(q.pr); if (o.ta) out.ta.push(q.ta); });
      return out;
    });
  };

  // ───────── «запечь» объект с матрицей в новую операцию (копия, смена стиля) ─────────
  B.bake = function (o) {                 // → операция без матрицы (без id), координаты доски
    var m = o.m || B.I, sc = B.scaleOf(m), out;
    if (o.t === 'ln') {
      out = { t: 'ln', tool: o.tool, c: o.c, w: Math.max(1, Math.round(o.w * sc)), p: [] };
      for (var i = 0; i < o.p.length; i += 2) { var q = B.ap(m, o.p[i], o.p[i + 1]); out.p.push(Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10); }
      ['pr', 'ta', 'na', 'd'].forEach(function (k) { if (o[k] != null) out[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; });
      return out;
    }
    if (o.t === 'sh') {
      out = { t: 'sh', k: o.k, c: o.c, w: Math.max(1, Math.round(o.w * sc)) };
      ['d', 'f', 'e1', 'e2', 'n'].forEach(function (k) { if (o[k] != null) out[k] = o[k]; });
      var rot = Math.abs(m[1]) > 1e-3 || Math.abs(m[2]) > 1e-3 || m[0] < 0 || m[3] < 0;
      if (o.k === 'line' || o.k === 'arrow' || (o.k === 'circle' && Math.abs(Math.abs(m[0]) - Math.abs(m[3])) < 1e-3)) {
        var a = B.ap(m, o.a[0], o.a[1]), b = B.ap(m, o.a[2], o.a[3]);
        if (o.k === 'circle') { var rad = Math.hypot(o.a[2] - o.a[0], o.a[3] - o.a[1]) * sc; b = [a[0] + rad, a[1]]; }
        out.a = [a[0], a[1], b[0], b[1]].map(Math.round); return out;
      }
      if (!rot && o.k !== 'poly') { var c1 = B.ap(m, o.a[0], o.a[1]), c2 = B.ap(m, o.a[2], o.a[3]); out.a = [c1[0], c1[1], c2[0], c2[1]].map(Math.round); return out; }
      var v = B.verts(o), q2 = [];                       // повёрнутая фигура → многоугольник
      if (v.length > 64) { var step = Math.ceil(v.length / 64) * 2; v = v.filter(function (_, i) { return Math.floor(i / 2) % (step / 2) === 0; }); }
      for (var j = 0; j < v.length && q2.length < 64; j += 2) { var pt = B.ap(m, v[j], v[j + 1]); q2.push(Math.round(pt[0]), Math.round(pt[1])); }
      var xs = q2.filter(function (_, i) { return i % 2 === 0; }), ys = q2.filter(function (_, i) { return i % 2 === 1; });
      out.k = 'poly'; delete out.n; out.pp = q2; out.a = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
      return out;
    }
    if (o.t === 'tx') { var t = B.ap(m, o.x, o.y); out = { t: 'tx', x: Math.round(t[0]), y: Math.round(t[1]), s: o.s, c: o.c, z: Math.max(10, Math.min(400, Math.round(o.z * sc))) }; if (o.b) out.b = o.b; if (o.fw) out.fw = 1; return out; }
    if (B.extraBake[o.t]) return B.extraBake[o.t](o, m, sc);
    return null;
  };
  B.extraBake = {};

  // ═════════ объекты урока: лента, наклейки, стикеры, формулы, графики, комментарии, коннекторы ═════════
  B.viewZ = 1;                            // масштаб экрана: пин комментария одного размера при любом масштабе
  B.revealed = {};                        // открытые ленты-шторки — у каждого участника свои
  B.extraHit = {};
  var INK = '#111111', FONT = '"Golos Text", sans-serif', DISP = '"Inter Tight", sans-serif';
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function light(hex) { var n = parseInt(String(hex).slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; }
  B.light = light;
  function wrapLines(c, text, maxW) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var line = '';
      para.split(' ').forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
      out.push(line);
    });
    return out;
  }
  B.wrapLines = wrapLines;
  function rectBox(c, o) { return [o.x, o.y, o.x + o.w, o.y + o.h]; }

  // лента-шторка: закрывает ответ; касание открывает (только у себя)
  B.extra.tp = function (c, o) {
    var lw = Math.max(2, Math.min(o.w, o.h) / 40);
    if (B.revealed[o.id]) { c.globalAlpha = 0.55; c.lineWidth = lw; c.setLineDash([lw * 4, lw * 3]); c.strokeStyle = o.c; c.strokeRect(o.x, o.y, o.w, o.h); return; }
    c.fillStyle = o.c; c.fillRect(o.x, o.y, o.w, o.h);
    c.save(); c.beginPath(); c.rect(o.x, o.y, o.w, o.h); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = Math.max(6, Math.min(o.h, o.w) / 6);
    for (var x = o.x - o.h, st = c.lineWidth * 2.4; x < o.x + o.w; x += st) { c.beginPath(); c.moveTo(x, o.y + o.h); c.lineTo(x + o.h, o.y); c.stroke(); }
    c.restore();
    c.lineWidth = lw; c.strokeStyle = INK; c.strokeRect(o.x, o.y, o.w, o.h);
    var fs = Math.min(o.h * 0.4, 36); if (fs < 9) return;
    c.font = '700 ' + fs + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = light(o.c) ? INK : '#fff';
    var t = ['нажми, чтобы открыть', 'открыть'].filter(function (s) { return c.measureText(s).width < o.w * 0.9; })[0];
    if (t) c.fillText(t, o.x + o.w / 2, o.y + o.h / 2);
  };
  B.extraBox.tp = rectBox;

  // наклейки-печати: свои, векторные (не эмодзи) — в стиле сайта: плоский цвет и чёрный контур
  B.STAMPS = [['ok', 'верно'], ['no', 'неверно'], ['star', 'звезда'], ['q', 'вопрос'], ['ex', 'важно'], ['heart', 'молодец'], ['fire', 'огонь'], ['idea', 'идея'],
    ['top', 'лучший'], ['think', 'подумай'], ['eye', 'смотри'], ['clock', 'время']];
  B.extra.st = function (c, o) {
    var z = o.z, cx = o.x + z / 2, cy = o.y + z / 2, r = z / 2, lw = Math.max(1.5, z * 0.06);
    c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round';
    var disc = function (fill) { c.beginPath(); c.arc(cx, cy, r - lw / 2, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.stroke(); };
    var glyph = function (t, col) { c.fillStyle = col; c.font = '800 ' + (z * 0.62) + 'px ' + DISP; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, cx, cy + z * 0.04); };
    var fillStroke = function (fill) { c.fillStyle = fill; c.fill(); c.stroke(); };
    switch (o.k) {
      case 'ok': disc('#1F8A4C'); c.strokeStyle = '#fff'; c.lineWidth = z * 0.11; c.beginPath(); c.moveTo(cx - r * 0.45, cy + r * 0.02); c.lineTo(cx - r * 0.1, cy + r * 0.36); c.lineTo(cx + r * 0.5, cy - r * 0.34); c.stroke(); break;
      case 'no': disc('#E5332A'); c.strokeStyle = '#fff'; c.lineWidth = z * 0.11; var d = r * 0.36; c.beginPath(); c.moveTo(cx - d, cy - d); c.lineTo(cx + d, cy + d); c.moveTo(cx + d, cy - d); c.lineTo(cx - d, cy + d); c.stroke(); break;
      case 'star': c.beginPath(); for (var i = 0; i < 10; i++) { var t = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? 0.45 : 1, px = cx + (r - lw) * k * Math.cos(t), py = cy + 0.06 * z + (r - lw) * k * Math.sin(t); if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); fillStroke('#F6CE2E'); break;
      case 'q': disc('#2E55C9'); glyph('?', '#fff'); break;
      case 'ex': disc('#F28C28'); glyph('!', INK); break;
      case 'heart': c.beginPath(); c.moveTo(cx, cy + r * 0.82); c.bezierCurveTo(cx - r * 1.25, cy + r * 0.05, cx - r * 0.8, cy - r * 1.05, cx, cy - r * 0.42); c.bezierCurveTo(cx + r * 0.8, cy - r * 1.05, cx + r * 1.25, cy + r * 0.05, cx, cy + r * 0.82); c.closePath(); fillStroke('#E5332A'); break;
      case 'fire':
        c.beginPath(); c.moveTo(cx, cy - r * 0.95); c.bezierCurveTo(cx + r * 0.3, cy - r * 0.45, cx + r * 0.85, cy - r * 0.2, cx + r * 0.7, cy + r * 0.35);
        c.bezierCurveTo(cx + r * 0.6, cy + r * 0.9, cx - r * 0.6, cy + r * 0.9, cx - r * 0.7, cy + r * 0.35); c.bezierCurveTo(cx - r * 0.8, cy - r * 0.05, cx - r * 0.45, cy - r * 0.2, cx - r * 0.3, cy - r * 0.55);
        c.bezierCurveTo(cx - r * 0.1, cy - r * 0.3, cx - r * 0.05, cy - r * 0.6, cx, cy - r * 0.95); c.closePath(); fillStroke('#F28C28');
        c.beginPath(); c.moveTo(cx, cy - r * 0.15); c.bezierCurveTo(cx + r * 0.42, cy + r * 0.2, cx + r * 0.35, cy + r * 0.72, cx, cy + r * 0.72); c.bezierCurveTo(cx - r * 0.35, cy + r * 0.72, cx - r * 0.42, cy + r * 0.2, cx, cy - r * 0.15); c.closePath(); c.lineWidth = lw * 0.7; fillStroke('#F6CE2E'); break;
      case 'idea':
        c.beginPath(); for (var a = 0; a < 5; a++) { var an = -Math.PI * (0.1 + 0.2 * a); c.moveTo(cx + Math.cos(an) * r * 0.72, cy - r * 0.2 + Math.sin(an) * r * 0.72); c.lineTo(cx + Math.cos(an) * r * 0.95, cy - r * 0.2 + Math.sin(an) * r * 0.95); } c.stroke();
        c.beginPath(); c.arc(cx, cy - r * 0.2, r * 0.5, 0, Math.PI * 2); fillStroke('#F6CE2E');
        c.beginPath(); c.rect(cx - r * 0.24, cy + r * 0.32, r * 0.48, r * 0.42); fillStroke('#fff'); break;
      case 'top': disc('#F6CE2E'); c.beginPath(); c.moveTo(cx - r * 0.55, cy + r * 0.35); c.lineTo(cx - r * 0.55, cy - r * 0.3); c.lineTo(cx - r * 0.25, cy); c.lineTo(cx, cy - r * 0.48);
        c.lineTo(cx + r * 0.25, cy); c.lineTo(cx + r * 0.55, cy - r * 0.3); c.lineTo(cx + r * 0.55, cy + r * 0.35); c.closePath(); fillStroke('#fff'); break;
      case 'think': disc('#fff'); c.fillStyle = INK; [-0.42, 0, 0.42].forEach(function (k) { c.beginPath(); c.arc(cx + k * r, cy, r * 0.12, 0, Math.PI * 2); c.fill(); }); break;
      case 'eye': disc('#fff'); c.beginPath(); c.moveTo(cx - r * 0.72, cy); c.quadraticCurveTo(cx, cy - r * 0.8, cx + r * 0.72, cy); c.quadraticCurveTo(cx, cy + r * 0.8, cx - r * 0.72, cy); c.closePath(); c.stroke();
        c.beginPath(); c.arc(cx, cy, r * 0.26, 0, Math.PI * 2); fillStroke('#2E55C9'); c.beginPath(); c.arc(cx, cy, r * 0.1, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); break;
      case 'clock': disc('#fff'); c.beginPath(); for (var h = 0; h < 4; h++) { var ha = h * Math.PI / 2; c.moveTo(cx + Math.cos(ha) * r * 0.62, cy + Math.sin(ha) * r * 0.62); c.lineTo(cx + Math.cos(ha) * r * 0.75, cy + Math.sin(ha) * r * 0.75); }
        c.moveTo(cx, cy); c.lineTo(cx, cy - r * 0.5); c.moveTo(cx, cy); c.lineTo(cx + r * 0.38, cy); c.stroke(); break;
      default: disc('#D8D1C1');
    }
  };
  B.extraBox.st = function (c, o) { return [o.x, o.y, o.x + o.z, o.y + o.z]; };

  // стикер-заметка
  B.NOTE_COLORS = [['#FFE88A', 'жёлтый'], ['#F9C4D8', 'розовый'], ['#BFD7FF', 'голубой'], ['#C6EFC9', 'зелёный'], ['#FFD1A6', 'оранжевый']];
  B.noteFont = function (o) { return Math.max(14, Math.min(64, o.w / 11)); };
  B.extra.nt = function (c, o) {
    var lw = Math.max(2, o.w / 110), sh = Math.max(4, o.w / 40);
    c.fillStyle = 'rgba(17,17,17,.16)'; c.fillRect(o.x + sh, o.y + sh, o.w, o.h);
    c.fillStyle = o.c; c.fillRect(o.x, o.y, o.w, o.h); c.lineWidth = lw; c.strokeStyle = INK; c.strokeRect(o.x, o.y, o.w, o.h);
    var fs = B.noteFont(o), pad = fs * 0.7;
    c.font = '600 ' + fs + 'px ' + FONT; c.fillStyle = light(o.c) ? INK : '#fff'; c.textBaseline = 'top';
    c.save(); c.beginPath(); c.rect(o.x, o.y, o.w, o.h); c.clip();
    wrapLines(c, o.s || '', o.w - 2 * pad).forEach(function (l, i) { c.fillText(l, o.x + pad, o.y + pad + i * fs * 1.3); });
    c.restore();
  };
  B.extraBox.nt = rectBox;

  // график: безопасный разбор формулы (без eval) — числа, x, π, e, + − × ÷ ^, скобки, |x|, функции; 2x и 3(x+1) — умножение
  var FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan, cot: function (v) { return 1 / Math.tan(v); }, ctg: function (v) { return 1 / Math.tan(v); },
    sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, lg: Math.log10, exp: Math.exp, arcsin: Math.asin, arccos: Math.acos, arctg: Math.atan, arctan: Math.atan };
  var NAMES = Object.keys(FN).concat(['pi', 'x', 'e']).sort(function (a, b) { return b.length - a.length; });
  B.compile = function (src) {
    var s = String(src).toLowerCase().replace(/^\s*y\s*=/, '').replace(/\s+/g, '').replace(/,/g, '.').replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/[×·]/g, '*').replace(/[−–]/g, '-').replace(/÷/g, '/');
    var toks = [], i = 0, m;
    while (i < s.length) {
      if ((m = /^(\d+(\.\d+)?|\.\d+)/.exec(s.slice(i)))) { toks.push({ n: +m[0] }); i += m[0].length; continue; }
      if (/[a-z]/.test(s[i])) { var nm = NAMES.filter(function (n) { return s.substr(i, n.length) === n; })[0]; if (!nm) return null; toks.push({ id: nm }); i += nm.length; continue; }
      if ('+-*/^()|'.indexOf(s[i]) >= 0) { toks.push({ op: s[i] }); i++; continue; }
      return null;
    }
    if (!toks.length) return null;
    var p = 0, depth = 0;
    function is(t, o) { return t && t.op === o; }
    function bin(o, a, b) { return o === '+' ? function (x) { return a(x) + b(x); } : o === '-' ? function (x) { return a(x) - b(x); } : o === '*' ? function (x) { return a(x) * b(x); } : function (x) { return a(x) / b(x); }; }
    function expr() { var a = term(); while (is(toks[p], '+') || is(toks[p], '-')) { var o = toks[p++].op; a = bin(o, a, term()); } return a; }
    function starts(t) { return t && (t.n != null || t.id || is(t, '(') || (is(t, '|') && !depth)); }
    function term() { var a = unary(); for (;;) { var t = toks[p]; if (is(t, '*') || is(t, '/')) { p++; a = bin(t.op, a, unary()); } else if (starts(t)) a = bin('*', a, power()); else return a; } }
    function unary() { if (is(toks[p], '-')) { p++; var a = unary(); return function (x) { return -a(x); }; } if (is(toks[p], '+')) { p++; return unary(); } return power(); }
    function power() { var a = atom(); if (is(toks[p], '^')) { p++; var b = unary(); return function (x) { return Math.pow(a(x), b(x)); }; } return a; }
    function atom() {
      var t = toks[p++]; if (!t) throw 0;
      if (t.n != null) { var v = t.n; return function () { return v; }; }
      if (t.id === 'x') return function (x) { return x; };
      if (t.id === 'pi') return function () { return Math.PI; };
      if (t.id === 'e') return function () { return Math.E; };
      if (t.id) { var f = FN[t.id], a = is(toks[p], '(') ? atom() : power(); return function (x) { return f(a(x)); }; }
      if (t.op === '(') { var e = expr(); if (!is(toks[p++], ')')) throw 0; return e; }
      if (t.op === '|') { depth++; var e2 = expr(); depth--; if (!is(toks[p++], '|')) throw 0; return function (x) { return Math.abs(e2(x)); }; }
      throw 0;
    }
    try { var f = expr(); return p === toks.length ? f : null; } catch (e) { return null; }
  };
  function niceStep(span, px) { var raw = span / Math.max(2, px / 90), p10 = Math.pow(10, Math.floor(Math.log10(raw))), k = raw / p10; return (k < 1.5 ? 1 : k < 3.5 ? 2 : k < 7.5 ? 5 : 10) * p10; }
  function fmt(v) { return String(Math.abs(v) < 1e-9 ? 0 : +v.toPrecision(6)).replace('.', ',').replace('-', '−'); }
  B.GR_COLORS = ['#2E55C9', '#E5332A'];
  B.extra.gr = function (c, o) {
    var X = o.x, Y = o.y, W = o.w, H = o.h, x0 = o.xr[0], x1 = o.xr[1], y0 = o.yr[0], y1 = o.yr[1], u = Math.max(1, W / 500), v;
    var sx = function (q) { return X + (q - x0) / (x1 - x0) * W; }, sy = function (q) { return Y + H - (q - y0) / (y1 - y0) * H; };
    c.fillStyle = '#fff'; c.fillRect(X, Y, W, H);
    c.save(); c.beginPath(); c.rect(X, Y, W, H); c.clip();
    var stx = niceStep(x1 - x0, W / u), sty = niceStep(y1 - y0, H / u);
    c.strokeStyle = '#E4DED0'; c.lineWidth = u; c.beginPath();
    for (v = Math.ceil(x0 / stx) * stx; v <= x1; v += stx) { c.moveTo(sx(v), Y); c.lineTo(sx(v), Y + H); }
    for (v = Math.ceil(y0 / sty) * sty; v <= y1; v += sty) { c.moveTo(X, sy(v)); c.lineTo(X + W, sy(v)); }
    c.stroke();
    var ax = Math.min(Math.max(sx(0), X), X + W), ay = Math.min(Math.max(sy(0), Y), Y + H);
    c.strokeStyle = INK; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(X, ay); c.lineTo(X + W, ay); c.moveTo(ax, Y); c.lineTo(ax, Y + H); c.stroke();
    var fs = 13 * u; c.font = '600 ' + fs + 'px ' + FONT; c.fillStyle = '#555'; c.textAlign = 'center'; c.textBaseline = 'top';
    for (v = Math.ceil(x0 / stx) * stx; v <= x1; v += stx) if (Math.abs(v) > stx / 2) c.fillText(fmt(v), sx(v), Math.min(ay + 4 * u, Y + H - fs - 2));
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (v = Math.ceil(y0 / sty) * sty; v <= y1; v += sty) if (Math.abs(v) > sty / 2) c.fillText(fmt(v), Math.max(ax - 5 * u, X + c.measureText(fmt(v)).width + 4 * u), sy(v));
    (o.f || []).forEach(function (src, k) {
      var f = B.compile(src); if (!f) return;
      var n = Math.min(1500, Math.round(W / u)), pen = false, prev = null, span = y1 - y0;
      c.strokeStyle = B.GR_COLORS[k % 2]; c.lineWidth = 3.5 * u; c.beginPath();
      for (var i = 0; i <= n; i++) {
        var xv = x0 + (x1 - x0) * i / n, yv = f(xv);
        if (!isFinite(yv) || (prev != null && Math.abs(yv - prev) > span)) { pen = false; prev = isFinite(yv) ? yv : null; continue; }
        var py = sy(Math.max(y0 - span, Math.min(y1 + span, yv)));
        if (pen) c.lineTo(sx(xv), py); else { c.moveTo(sx(xv), py); pen = true; }
        prev = yv;
      }
      c.stroke();
    });
    c.restore();
    c.lineWidth = 2.5 * u; c.strokeStyle = INK; c.strokeRect(X, Y, W, H);
    c.font = '700 ' + (16 * u) + 'px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'top';
    (o.f || []).forEach(function (src, k) {
      var t = 'y = ' + src, tw = c.measureText(t).width, ly = Y + 8 * u + k * 26 * u;
      c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(X + 8 * u, ly, tw + 12 * u, 24 * u); c.fillStyle = B.GR_COLORS[k % 2]; c.fillText(t, X + 14 * u, ly + 4 * u);
    });
  };
  B.extraBox.gr = rectBox;

  // комментарий-пин: жёлтый «пузырь» с числом сообщений; размер на экране постоянный
  B.extra.cm = function (c, o) {
    var S = 30 / B.viewZ, x = o.x, by = o.y - 1.1 * S, bw = 1.2 * S, bh = 0.85 * S;
    c.lineWidth = 2 / B.viewZ; c.strokeStyle = INK; c.fillStyle = '#F6CE2E';
    c.beginPath(); c.moveTo(x + 0.12 * S, by + bh - 1); c.lineTo(x, o.y); c.lineTo(x + 0.5 * S, by + bh - 1); c.closePath(); c.fill(); c.stroke();
    rrect(c, x, by, bw, bh, 0.15 * S); c.fill(); c.stroke();
    c.fillStyle = INK; c.font = '800 ' + (0.5 * S) + 'px ' + DISP; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(o._n || 1), x + bw / 2, by + bh / 2 + 0.03 * S);
  };
  B.extraBox.cm = function (c, o) { var S = 30 / B.viewZ; return [o.x, o.y - 1.1 * S, o.x + 1.2 * S, o.y]; };

  // коннектор: концы считает доска (o._p) по рамкам двух объектов — линия следует за ними
  B.cnEnds = function (a, b, k) {
    var ca = [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2], cb = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], g = 6;
    if (k === 's') {
      var edge = function (bx, c0, c1) { var dx = c1[0] - c0[0], dy = c1[1] - c0[1], t = Math.min(dx ? ((bx[2] - bx[0]) / 2 + g) / Math.abs(dx) : Infinity, dy ? ((bx[3] - bx[1]) / 2 + g) / Math.abs(dy) : Infinity, 1); return [c0[0] + dx * t, c0[1] + dy * t]; };
      var pa = edge(a, ca, cb), pb = edge(b, cb, ca); return { p: [pa[0], pa[1], pb[0], pb[1]], v: false };
    }
    if (Math.abs(cb[0] - ca[0]) >= Math.abs(cb[1] - ca[1])) { var rt = cb[0] > ca[0]; return { p: [rt ? a[2] + g : a[0] - g, ca[1], rt ? b[0] - g : b[2] + g, cb[1]], v: false }; }
    var dn = cb[1] > ca[1]; return { p: [ca[0], dn ? a[3] + g : a[1] - g, cb[0], dn ? b[1] - g : b[3] + g], v: true };
  };
  B.cnPath = function (o) {
    var p = o._p, x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3];
    if (o.k === 'e') { if (o._v) { var my = (y1 + y2) / 2; return [x1, y1, x1, my, x2, my, x2, y2]; } var mx = (x1 + x2) / 2; return [x1, y1, mx, y1, mx, y2, x2, y2]; }
    if (o.k === 'c') {
      var out = [], c1 = o._v ? [x1, (y1 + y2) / 2] : [(x1 + x2) / 2, y1], c2 = o._v ? [x2, (y1 + y2) / 2] : [(x1 + x2) / 2, y2];
      for (var i = 0; i <= 24; i++) { var t = i / 24, u = 1 - t; out.push(u * u * u * x1 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x2, u * u * u * y1 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y2); }
      return out;
    }
    return [x1, y1, x2, y2];
  };
  function midOf(q) {
    var L = 0, i; for (i = 2; i < q.length; i += 2) L += Math.hypot(q[i] - q[i - 2], q[i + 1] - q[i - 1]);
    var h = L / 2; for (i = 2; i < q.length; i += 2) { var d = Math.hypot(q[i] - q[i - 2], q[i + 1] - q[i - 1]); if (h <= d) { var t = d ? h / d : 0; return [q[i - 2] + (q[i] - q[i - 2]) * t, q[i - 1] + (q[i + 1] - q[i - 1]) * t]; } h -= d; }
    return [q[0], q[1]];
  }
  B.extra.cn = function (c, o) {
    if (!o._p) return;
    var q = B.cnPath(o), n = q.length;
    c.lineWidth = o.w; dash(c, o, o.w); c.beginPath(); c.moveTo(q[0], q[1]); for (var i = 2; i < n; i += 2) c.lineTo(q[i], q[i + 1]); c.stroke(); c.setLineDash([]);
    if (o.e2) head(c, HEADS[o.e2], q[n - 2], q[n - 1], Math.atan2(q[n - 1] - q[n - 3], q[n - 2] - q[n - 4]), o.w);
    if (o.e1) head(c, HEADS[o.e1], q[0], q[1], Math.atan2(q[1] - q[3], q[0] - q[2]), o.w);
    if (o.l) {
      var m = midOf(q), fs = 18 + o.w * 1.5; c.font = '700 ' + fs + 'px ' + FONT; var tw = c.measureText(o.l).width;
      c.fillStyle = '#fff'; c.fillRect(m[0] - tw / 2 - 8, m[1] - fs * 0.7, tw + 16, fs * 1.4); c.lineWidth = 2; c.strokeRect(m[0] - tw / 2 - 8, m[1] - fs * 0.7, tw + 16, fs * 1.4);
      c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.l, m[0], m[1] + 1);
    }
  };
  B.extraBox.cn = function (c, o) {
    if (!o._p) return null;
    var q = B.cnPath(o), b = [Infinity, Infinity, -Infinity, -Infinity], pad = Math.max(18, o.w * 3.2);
    for (var i = 0; i < q.length; i += 2) { b[0] = Math.min(b[0], q[i]); b[2] = Math.max(b[2], q[i]); b[1] = Math.min(b[1], q[i + 1]); b[3] = Math.max(b[3], q[i + 1]); }
    return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
  };
  B.extraHit.cn = function (o, x, y, r) {
    if (!o._p) return false;
    var q = B.cnPath(o); for (var i = 2; i < q.length; i += 2) if (distSeg(x, y, q[i - 2], q[i - 1], q[i], q[i + 1]) < r + o.w) return true;
    return false;
  };

  // формула LaTeX: на экране её рисует KaTeX (слой доски, lesson.html); в PNG/PDF — читаемый текст
  B.texPlain = function (s) {
    var t = String(s), prev;
    do { prev = t; t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)'); } while (t !== prev);
    var map = { cdot: '·', times: '×', div: '÷', pi: 'π', alpha: 'α', beta: 'β', gamma: 'γ', varphi: 'φ', phi: 'φ', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈',
      infty: '∞', pm: '±', circ: '°', Delta: 'Δ', angle: '∠', to: '→', left: '', right: '', quad: ' ', cdots: '…', ldots: '…' };
    t = t.replace(/\\([a-zA-Z]+)/g, function (_, w) { return map[w] != null ? map[w] : w; });
    return t.replace(/\^\{([^{}]*)\}/g, '^$1').replace(/_\{([^{}]*)\}/g, '_$1').replace(/[{}]/g, '').replace(/\\[,;!: ]?/g, ' ');
  };
  B.mxSize = null;                        // lesson.html: размер отрисованной KaTeX формулы
  B.mxCanvas = null;                      // lesson.html: холст, на котором формулу рисует не он, а KaTeX
  B.extra.mx = function (c, o) {
    if (B.mxCanvas === c) return;
    c.font = '500 ' + o.z + 'px "Times New Roman", serif'; c.textBaseline = 'top'; c.fillText(B.texPlain(o.s), o.x, o.y + o.z * 0.15);
  };
  B.extraBox.mx = function (c, o) {
    var sz = B.mxSize && B.mxSize(o);
    if (sz) return [o.x, o.y, o.x + sz[0], o.y + sz[1]];
    c.save(); c.font = '500 ' + o.z + 'px serif'; var w = c.measureText(B.texPlain(o.s)).width; c.restore();
    return [o.x, o.y, o.x + w, o.y + o.z * 1.5];
  };

  // копия объекта урока без матрицы
  function rectBake(o, m, lo, hi) {
    var p = [B.ap(m, o.x, o.y), B.ap(m, o.x + o.w, o.y), B.ap(m, o.x + o.w, o.y + o.h), B.ap(m, o.x, o.y + o.h)];
    var xs = p.map(function (q) { return q[0]; }), ys = p.map(function (q) { return q[1]; }), x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
    var cl = function (v) { return Math.round(Math.max(lo, Math.min(hi, v))); };
    return { x: Math.round(x), y: Math.round(y), w: cl(Math.max.apply(null, xs) - x), h: cl(Math.max.apply(null, ys) - y) };
  }
  B.extraBake.tp = function (o, m) { return Object.assign({ t: 'tp', c: o.c }, rectBake(o, m, 10, 20000)); };
  B.extraBake.nt = function (o, m) { return Object.assign({ t: 'nt', c: o.c, s: o.s || '' }, rectBake(o, m, 60, 4000)); };
  B.extraBake.gr = function (o, m) { return Object.assign({ t: 'gr', f: o.f.slice(), xr: o.xr.slice(), yr: o.yr.slice() }, rectBake(o, m, 100, 8000)); };
  B.extraBake.st = function (o, m, sc) { var q = B.ap(m, o.x + o.z / 2, o.y + o.z / 2), z = Math.max(20, Math.min(2000, Math.round(o.z * sc))); return { t: 'st', k: o.k, x: Math.round(q[0] - z / 2), y: Math.round(q[1] - z / 2), z: z }; };
  B.extraBake.mx = function (o, m, sc) { var q = B.ap(m, o.x, o.y); return { t: 'mx', s: o.s, c: o.c, x: Math.round(q[0]), y: Math.round(q[1]), z: Math.max(10, Math.min(400, Math.round(o.z * sc))) }; };

  window.AnikBoard = B;
})();
