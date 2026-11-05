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
    window.addEventListener('hashchange', function () { render(bar); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
