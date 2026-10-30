/* Аник — знаки и цвета плиток. У каждой плитки в разделе свой цвет: плавный переход жёлтый → розовый → красный → синий
   (без повторов), и свой знак: огромный, срезанный краем плитки. Подключается на всех страницах приложения. */
(function () {
  var STOPS = ['#F6CE2E', '#F49AC1', '#E5332A', '#2E55C9'];

  // Знаки заданий. SQUARE/ARC/PREFIX/SUFFIX — значки разбора слова по составу, рисуются рамками. Где знака нет — номер задания.
  var SIGNS = {
    'ege.rus': { 1: '&', 2: '?', 3: '«»', 4: 'а́', 5: '≈', 6: '=', 7: 'SQUARE', 8: '¿', 9: 'ARC', 10: 'PREFIX', 11: 'SUFFIX', 12: 'е/и', 13: 'не',
      14: '-', 15: 'нн', 16: ',', 17: ',', 18: '()', 19: '[ ]', 20: '+', 21: ':', 22: '*', 23: '…', 24: '→', 25: '≠', 26: '¶' },
    'oge.rus': { 2: '=', 3: '[ ]', 4: ',', 5: ':', 6: 'о/а', 7: 'нн', 8: '¿', 9: '→', 10: '…', 11: '*', 12: '≈' }
  };

  function toLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLin(c) { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function toLab(hex) {
    var r = toLin(parseInt(hex.substr(1, 2), 16) / 255), g = toLin(parseInt(hex.substr(3, 2), 16) / 255), b = toLin(parseInt(hex.substr(5, 2), 16) / 255);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function toHex(L, a, b) {
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
      .map(function (c) { var h = Math.round(fromLin(c) * 255).toString(16).toUpperCase(); return h.length < 2 ? '0' + h : h; }).join('');
  }
  // фон, цвет текста, цвет знака: знак — тот же оттенок, темнее (на тёмных плитках — светлее)
  function skin(lab) {
    var L = lab[0], a = lab[1], b = lab[2], dark = L < 0.62;
    return [toHex(L, a, b), dark ? '#FFFFFF' : '#111111', dark ? toHex(Math.min(L + 0.2, 0.97), a * 0.8, b * 0.8) : toHex(L - 0.2, a * 1.1, b * 1.1)];
  }
  var cache = {};
  // n цветов подряд; reverse — от синего к жёлтому (так у математики, чтобы не совпадать с русским)
  function ramp(n, reverse) {
    var key = n + (reverse ? 'r' : '');
    if (cache[key]) return cache[key];
    var labs = (reverse ? STOPS.slice().reverse() : STOPS).map(toLab), out = [];
    for (var i = 0; i < n; i++) {
      var t = n < 2 ? 0 : i / (n - 1) * (labs.length - 1), k = Math.min(Math.floor(t), labs.length - 2), f = t - k;
      out.push(skin([0, 1, 2].map(function (j) { return labs[k][j] + (labs[k + 1][j] - labs[k][j]) * f; })));
    }
    return (cache[key] = out);
  }

  function signOf(group, number) { var t = SIGNS[group]; return (t && t[number]) || String(number); }
  // разметка знака для плитки с классом .sgt
  function signHTML(g) {
    if (g === 'SQUARE' || g === 'ARC' || g === 'PREFIX' || g === 'SUFFIX') return '<span class="big mk mk-' + g.toLowerCase() + '" aria-hidden="true"></span>';
    var cls = g === ',' || g === '…' ? ' low' : g.length > 1 && g !== 'а́' ? ' wide' : '';
    if (/^\d+$/.test(g)) cls = g.length > 1 ? ' num wide' : ' num';
    return '<span class="big' + cls + '" aria-hidden="true">' + g + '</span>';
  }
  function paint(el, c) { el.style.setProperty('--col', c[0]); el.style.setProperty('--ink', c[1]); el.style.setProperty('--bigc', c[2]); }
  function style(c) { return '--col:' + c[0] + ';--ink:' + c[1] + ';--bigc:' + c[2]; }

  window.AnikLook = { SIGNS: SIGNS, ramp: ramp, signOf: signOf, signHTML: signHTML, paint: paint, style: style };
})();
