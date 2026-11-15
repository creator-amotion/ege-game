/* A/B-тесты сайта: вариант приходит от бота в ссылке ?ab=<тест>-<вариант>.<тест2>-<вариант>
   (bot/experiments.py, with_ab). В параметре только имя теста и буква варианта — никаких личных данных.
   Вариант запоминается в браузере, чтобы страницы, открытые без параметра (переходы внутри сайта), показывали то же.
   Использование:
     <script src="anik-ab.js"></script>
     if (AnikAB.variant('today_cta') === 'B') { ...вариант B... }   // null — теста нет, обычное поведение
   Результаты считает бот: вариант уже записан у него в момент выдачи ссылки, слать обратно ничего не нужно. */
(function () {
  var KEY = 'anik_ab', OK = /^[a-z0-9_]{3,40}-[A-Za-z0-9]{1,8}$/;
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  var m = /[?&]ab=([^&#]*)/.exec(location.search);
  if (m) {
    var fresh = {};
    decodeURIComponent(m[1]).split('.').forEach(function (p) {
      if (OK.test(p)) { var i = p.lastIndexOf('-'); fresh[p.slice(0, i)] = p.slice(i + 1); }
    });
    saved = fresh;   // в ссылке всегда полный список работающих тестов: остановленные уходят
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
  }
  window.AnikAB = {
    variant: function (name) { return Object.prototype.hasOwnProperty.call(saved, name) ? saved[name] : null; },
    all: function () { var o = {}; for (var k in saved) o[k] = saved[k]; return o; }
  };
})();
