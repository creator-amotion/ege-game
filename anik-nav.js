/* Аник — нижняя панель: Сегодня · Задания · Марки. Подключается на всех страницах приложения. */
(function () {
  var ITEMS = [
    { id: 'today', label: 'Сегодня', href: 'today.html' },
    { id: 'tasks', label: 'Задания', href: 'index.html' },
    { id: 'stamps', label: 'Марки', href: 'today.html#stamps' },
  ];
  function active() {
    var p = location.pathname.split('/').pop() || 'index.html';
    if (p === 'today.html') return /^#stamps/.test(location.hash) ? 'stamps' : 'today';
    return 'tasks';
  }
  function render(bar) {
    var a = active();
    bar.innerHTML = ITEMS.map(function (it) {
      return '<a href="' + it.href + '"' + (it.id === a ? ' class="on" aria-current="page"' : '') + '>' + it.label + '</a>';
    }).join('');
  }
  /* «Сообщить об ошибке»: открывает бота с идентификатором задания; методисты получат обращение (бот: feedback.py) */
  var RKEY = 'anik_reports';
  function readReports() { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch (e) { return []; } }
  window.anikReports = readReports;                       // журнал обращений этого устройства: «Сегодня» показывает, что и когда отправлено
  function toast(text) {
    var old = document.getElementById('anik-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'anik-toast';
    t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;left:16px;right:16px;bottom:84px;max-width:488px;margin:0 auto;z-index:50;padding:12px 14px;background:#111;color:#F3EEE2;font:600 14px/1.4 "Golos Text",system-ui,sans-serif';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 6000);
  }
  window.anikReport = function (ref) {
    var id = String(ref || '').slice(0, 56);
    var url = 'https://t.me/examzadrotbot?start=fb_' + encodeURIComponent(id);
    try {
      var list = readReports();
      list.unshift({ ref: id, at: new Date().toISOString().slice(0, 16), status: 'sent' });
      localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 30)));
    } catch (e) {}
    toast('Открываю чат с ботом: там появится вопрос «Что случилось?». Ответь на него, и обращение уйдёт методистам. Статус смотри в «Сегодня».');
    var tg = window.Telegram && window.Telegram.WebApp;
    setTimeout(function () { if (tg && tg.initData && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank'); }, 700);
  };

  /* ───────── План дня без остановок ─────────
     «Сегодня» → «Пройти план дня» кладёт в память список шагов (теория, игра, задания…). Дальше на каждой странице плана висит полоска:
     где мы, «Дальше», «Выйти». Страница сообщает, что шаг выполнен (anikPlanDone) — через несколько секунд открывается следующий шаг,
     после последнего возвращаемся на «Сегодня». */
  var PKEY = 'anik_planrun', PMAX_AGE = 4 * 3600 * 1000, TICK = 5;
  function planRead() {
    try {
      var p = JSON.parse(localStorage.getItem(PKEY));
      if (!p || !p.urls || !p.urls.length || Date.now() - p.t > PMAX_AGE) return null;
      return p;
    } catch (e) { return null; }
  }
  function planWrite(p) { try { if (p) localStorage.setItem(PKEY, JSON.stringify(p)); else localStorage.removeItem(PKEY); } catch (e) {} }
  function stepKey(u) {                                    // страница + раздел хеша: rus-ege.html#game=9&cat=x → rus-ege.html#game=9
    var i = String(u).indexOf('#'), path = (i < 0 ? u : u.slice(0, i)).split('/').pop(), h = i < 0 ? '' : u.slice(i).split('&')[0];
    return path + h;
  }
  function here() { return (location.pathname.split('/').pop() || 'index.html') + location.hash.split('&')[0]; }
  function go(url) {
    var same = stepKey(url).split('#')[0] === (location.pathname.split('/').pop() || 'index.html');
    location.href = url;
    if (same) setTimeout(function () { location.reload(); }, 60);   // тот же файл, другой хеш: страница сама не перечитает адрес
  }
  var timer = null, curState = '';
  function barEl() {
    var b = document.getElementById('anik-plan');
    if (!b) {
      b = document.createElement('div');
      b.id = 'anik-plan';
      b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;left:8px;right:8px;bottom:74px;max-width:504px;margin:0 auto;z-index:55;padding:10px 12px;background:#111;color:#F3EEE2;font:600 14px/1.35 "Golos Text",system-ui,sans-serif;box-shadow:0 2px 0 #FFD400';
      document.body.appendChild(b);
    }
    return b;
  }
  function btn(id, text, primary) {
    return '<button id="' + id + '" style="min-height:40px;padding:0 14px;margin:8px 8px 0 0;border:0;font:700 14px \'Golos Text\',system-ui,sans-serif;cursor:pointer;' +
      (primary ? 'background:#FFD400;color:#111' : 'background:#F3EEE2;color:#111') + '">' + text + '</button>';
  }
  function planNext() {
    clearInterval(timer);
    var p = planRead();
    if (!p) return;
    p.i += 1;
    if (p.i >= p.urls.length) {
      planWrite(null);
      toast('План дня пройден. Молодец!');
      setTimeout(function () { location.href = 'today.html'; }, 900);
      return;
    }
    p.t = Date.now();
    planWrite(p);
    go(p.urls[p.i]);
  }
  function planExit() { clearInterval(timer); curState = ''; planWrite(null); var b = document.getElementById('anik-plan'); if (b) b.remove(); }
  function planBar(state) {                                // state: 'work' — шаг идёт; 'done' — шаг выполнен, идёт отсчёт
    var p = planRead();
    if (!p || stepKey(p.urls[p.i]) !== here()) return;
    var b = barEl(), n = p.urls.length, nxt = p.names && p.names[p.i + 1], last = p.i + 1 >= n;
    clearInterval(timer);
    curState = state;
    var head = '<div>План дня · шаг ' + (p.i + 1) + ' из ' + n + (p.names && p.names[p.i] ? ' · ' + p.names[p.i] : '') + '</div>';
    if (state === 'done') {
      var left = TICK;
      b.innerHTML = '<div>Шаг выполнен ✓</div><div style="font-weight:500">' + (last ? 'Это был последний шаг.' : 'Дальше: ' + (nxt || 'следующий шаг')) + ' <span id="anik-plan-t">· через ' + left + ' с</span></div>' +
        btn('anik-plan-go', last ? 'Закончить' : 'Дальше сейчас', true) + btn('anik-plan-stop', 'Остановиться');
      document.getElementById('anik-plan-go').onclick = planNext;
      document.getElementById('anik-plan-stop').onclick = function () { clearInterval(timer); planBar('work'); };
      timer = setInterval(function () {
        left -= 1;
        var t = document.getElementById('anik-plan-t');
        if (t) t.textContent = '· через ' + left + ' с';
        if (left <= 0) planNext();
      }, 1000);
    } else {
      b.innerHTML = head + '<div style="font-weight:500">' + (last ? 'Последний шаг плана.' : 'Закончишь — откроется следующий: ' + (nxt || '')) + '</div>' +
        btn('anik-plan-go', last ? 'Закончить план' : 'Дальше →', true) + btn('anik-plan-stop', 'Выйти из плана');
      document.getElementById('anik-plan-go').onclick = planNext;
      document.getElementById('anik-plan-stop').onclick = planExit;
    }
  }
  window.anikPlan = {
    start: function (urls, names) { planWrite({ urls: urls, names: names || [], i: 0, t: Date.now() }); go(urls[0]); },
    active: function () { return !!planRead(); },
  };
  window.anikPlanDone = function () { planBar('done'); };   // страница вызывает, когда шаг пройден (итог игры, конец подхода)

  function mount() {
    if (document.getElementById('anik-tabs')) return;
    var bar = document.createElement('div');
    bar.id = 'anik-tabs';
    bar.className = 'anik-tabs';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Разделы приложения');
    render(bar);
    document.body.appendChild(bar);
    document.body.classList.add('has-tabs');
    window.addEventListener('hashchange', function () { render(bar); if (curState !== 'done') planBar('work'); });
    planBar('work');
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
