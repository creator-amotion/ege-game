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
