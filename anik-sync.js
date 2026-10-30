/* Аник — связь игры с ботом через облако (бот: sync_client.py, облако: sync_worker/worker.js).
   Игра кладёт результат в очередь и отправляет его сама, без кнопки; бот присылает снимок прогресса
   (знание, дни занятий, серия, марки, план на сегодня), который игра показывает.
   Пока API пуст или приложение открыто не из Telegram, ничего не происходит, и игры отправляют результат кнопкой, как раньше. */
(function () {
  var API = '';                                   // адрес Worker, например https://anik-sync.<аккаунт>.workers.dev
  var QUEUE = 'anik_q', STATE = 'anik_state';
  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = (tg && tg.initData) || '';       // из кнопки на клавиатуре бота подписи нет — там остаётся старый путь
  var dead = false, busy = false, listeners = [];

  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  var state = read(STATE, null);

  function enabled() { return !!(API && initData && !dead); }
  function newId() {
    var a = new Uint8Array(10);
    (window.crypto || { getRandomValues: function (x) { for (var i = 0; i < x.length; i++) x[i] = Math.random() * 256; } }).getRandomValues(a);
    return 'e' + Array.prototype.map.call(a, function (b) { return b.toString(36).padStart(2, '0'); }).join('');
  }
  function setState(s) {
    if (!s) return;
    state = s;
    write(STATE, s);
    listeners.forEach(function (fn) { try { fn(s); } catch (e) {} });
  }
  function headers() { return { 'Content-Type': 'application/json', 'X-Init-Data': initData }; }

  function flush() {
    if (busy || !enabled()) return;
    var q = read(QUEUE, []);
    if (!q.length) return;
    var batch = q.slice(0, 50);
    busy = true;
    fetch(API + '/api/events', { method: 'POST', headers: headers(), body: JSON.stringify({ events: batch }) })
      .then(function (r) {
        if (r.status === 401) { dead = true; throw new Error('auth'); }      // подпись устарела: до перезапуска приложения не пытаемся
        if (!r.ok) throw new Error('http');
        return r.json();
      })
      .then(function (j) {
        var sent = {};
        batch.forEach(function (e) { sent[e.id] = 1; });
        write(QUEUE, read(QUEUE, []).filter(function (e) { return !sent[e.id]; }));
        setState(j.state);
        busy = false;
        if (read(QUEUE, []).length) flush();
      })
      .catch(function () { busy = false; });                                   // нет сети — очередь останется до следующей попытки
  }

  /** Результат игры в виде короткой строки (та же, что в ссылке-кнопке). true — принят в очередь отправки. */
  function markDay() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    var key = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    var days = read('anik_days', []);
    if (days.indexOf(key) < 0) { days.push(key); write('anik_days', days.slice(-120)); }
  }

  function send(payload) {
    if (payload) markDay();                       // календарь занятий работает и без облака
    if (!enabled() || !payload) return false;
    var q = read(QUEUE, []);
    q.push({ id: newId(), p: payload, ts: Math.floor(Date.now() / 1000) });
    write(QUEUE, q.slice(-200));
    flush();
    return true;
  }

  function refresh() {
    if (!enabled()) return;
    fetch(API + '/api/state', { headers: headers() })
      .then(function (r) { if (r.status === 401) dead = true; return r.ok ? r.json() : null; })
      .then(function (j) { if (j) setState(j.state); })
      .catch(function () {});
  }

  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { flush(); refresh(); } });
  setInterval(flush, 60000);
  if (enabled()) { flush(); refresh(); }

  window.AnikSync = {
    enabled: enabled,
    send: send,
    flush: flush,
    refresh: refresh,
    state: function () { return state; },
    pending: function () { return read(QUEUE, []).length; },
    localDays: function () { return read('anik_days', []); },
    onState: function (fn) { listeners.push(fn); if (state) fn(state); },
  };
})();
