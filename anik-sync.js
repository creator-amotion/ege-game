/* Аник — связь игры с ботом через облако (бот: sync_client.py, облако: sync_worker/worker.js).
   Игра кладёт результат в очередь и отправляет его сама, без кнопки; бот присылает снимок прогресса
   (знание, дни занятий, серия, марки, план на сегодня), который игра показывает.
   Пока API пуст или приложение открыто не из Telegram, ничего не происходит, и игры отправляют результат кнопкой, как раньше.
   Вне Telegram (браузер, приложение на экране «Домой») ученик один раз вводит код из бота (AnikSync.link) — устройство
   получает ключ (anik_dev), и прогресс общий с ботом. Ответы, решённые до связки, копятся в очереди и уходят после неё. */
(function () {
  var API = 'https://2-29-119-233.sslip.io';    // почтовый ящик бота на сервере (deploy/server/enable_app_link.sh)
  var QUEUE = 'anik_q', STATE = 'anik_state';
  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = (tg && tg.initData) || '';       // из кнопки на клавиатуре бота подписи нет — там остаётся старый путь
  var DEV = 'anik_dev';
  var dead = false, busy = false, listeners = [];

  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  var state = read(STATE, null);

  function device() { try { return localStorage.getItem(DEV) || ''; } catch (e) { return ''; } }
  function outside() { return !initData && !(tg && tg.platform && tg.platform !== 'unknown'); }   // не внутри Telegram
  function enabled() { return !!(API && (initData || device()) && !dead); }
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
  function headers() {
    return initData ? { 'Content-Type': 'application/json', 'X-Init-Data': initData }
                    : { 'Content-Type': 'application/json', 'X-Device-Token': device() };
  }
  function lost() { dead = true; if (!initData) { try { localStorage.removeItem(DEV); } catch (e) {} } }   // ключ отозван — связать заново

  function flush() {
    if (busy || !enabled()) return;
    var q = read(QUEUE, []);
    if (!q.length) return;
    var batch = q.slice(0, 50);
    busy = true;
    fetch(API + '/api/events', { method: 'POST', headers: headers(), body: JSON.stringify({ events: batch }) })
      .then(function (r) {
        if (r.status === 401) { lost(); throw new Error('auth'); }          // подпись устарела: до перезапуска приложения не пытаемся
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
    if (!payload) return false;
    if (!enabled()) {
      if (API && outside()) {                     // вне Telegram и ещё не связано: копим, уйдёт после связки с ботом
        var w = read(QUEUE, []);
        w.push({ id: newId(), p: payload, ts: Math.floor(Date.now() / 1000) });
        write(QUEUE, w.slice(-200));
      }
      return false;
    }
    var q = read(QUEUE, []);
    q.push({ id: newId(), p: payload, ts: Math.floor(Date.now() / 1000) });
    write(QUEUE, q.slice(-200));
    flush();
    return true;
  }

  function refresh() {
    if (!enabled()) return;
    fetch(API + '/api/state', { headers: headers() })
      .then(function (r) { if (r.status === 401) lost(); return r.ok ? r.json() : null; })
      .then(function (j) { if (j) setState(j.state); })
      .catch(function () {});
  }

  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { flush(); refresh(); } });
  setInterval(flush, 60000);
  if (enabled()) { flush(); refresh(); }

  /** Связать это устройство с учеником по коду из бота (8 знаков). Promise<true|сообщение об ошибке>. */
  function link(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) return Promise.resolve('В коде 8 знаков — проверь и попробуй ещё раз.');
    return fetch(API + '/api/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }) })
      .then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); })
      .then(function (x) {
        if (x[0] === 429) return 'Слишком много попыток. Подожди минуту.';
        if (x[0] !== 200 || !x[1].token) return 'Код не подошёл: он действует 15 минут и один раз. Попроси в боте новый.';
        try { localStorage.setItem(DEV, x[1].token); } catch (e) { return 'Браузер не даёт сохранить связку. Выключи режим инкогнито.'; }
        dead = false;
        if (x[1].state) setState(x[1].state);
        flush(); refresh();
        return true;
      })
      .catch(function () { return 'Нет связи с сервером. Проверь интернет.'; });
  }
  /** Карточка «Связать с ботом» для страниц вне Telegram: поле для кода и кнопка. done() — после удачной связки. */
  function linkCard(el, done) {
    if (!el) return;
    el.innerHTML = '<div style="border:2px solid #111;background:#fff;padding:12px 14px;margin:12px 0;text-align:left;font:15px/1.4 Golos Text,system-ui,sans-serif;color:#111">' +
      '<b>Свяжи приложение с ботом</b><br><span style="font-size:14px;color:#4A463E">Тогда прогресс один: бот, приложение и лента видят одно и то же, решённое здесь не пропадёт. ' +
      'В боте нажми «Меню» → «Аник на телефоне» и введи код.</span>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><input id="anik-code" placeholder="Код из бота" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" ' +
      'style="flex:1;min-width:0;height:44px;border:2px solid #111;padding:0 10px;font:700 18px Golos Text,system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase;border-radius:0">' +
      '<button id="anik-link" style="height:44px;padding:0 14px;border:2px solid #111;background:#111;color:#F3EEE2;font:700 15px Golos Text,system-ui,sans-serif;cursor:pointer">Связать</button></div>' +
      (navigator.clipboard && navigator.clipboard.readText ? '<button id="anik-paste" style="margin-top:8px;width:100%;height:44px;border:2px solid #111;background:#F6CE2E;color:#111;font:700 15px Golos Text,system-ui,sans-serif;cursor:pointer">Вставить код из буфера</button>' : '') +
      '<div id="anik-link-msg" style="font-size:14px;margin-top:6px"></div></div>';
    var btn = el.querySelector('#anik-link'), inp = el.querySelector('#anik-code'), msg = el.querySelector('#anik-link-msg');
    var paste = el.querySelector('#anik-paste');
    try { var le = sessionStorage.getItem('anik_link_err'); if (le) { msg.textContent = 'Ссылка не сработала: ' + le; sessionStorage.removeItem('anik_link_err'); } } catch (e) {}
    if (paste) paste.onclick = function () {
      navigator.clipboard.readText().then(function (t) {
        var c = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c.length !== 8) { msg.textContent = 'В буфере нет кода. Нажми в боте «Скопировать код».'; return; }
        inp.value = c.slice(0, 4) + '-' + c.slice(4); go();
      }).catch(function () { msg.textContent = 'Не получилось вставить — зажми поле и выбери «Вставить».'; });
    };
    var go = function () {
      btn.disabled = true; msg.textContent = 'Проверяю…';
      link(inp.value).then(function (r) {
        btn.disabled = false;
        if (r === true) { el.innerHTML = '<div style="border:2px solid #111;background:#E3F3E8;padding:12px 14px;margin:12px 0;font:600 15px Golos Text,system-ui,sans-serif">Готово: приложение связано с ботом, прогресс общий.</div>'; if (done) done(); }
        else msg.textContent = r;
      });
    };
    btn.onclick = go;
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  }
  function unlink() { try { localStorage.removeItem(DEV); } catch (e) {} }

  /* связка по ссылке из бота: …/feed.html#link=КОД — код убирается из адреса, связка идёт сама, страница перезагружается */
  (function () {
    var m = /[#&]link=([A-Za-z0-9-]{8,9})/.exec(location.hash);
    if (!m) {                                       // после перезагрузки — короткое «готово»
      var done = false;
      try { done = !!sessionStorage.getItem('anik_linked_now'); sessionStorage.removeItem('anik_linked_now'); } catch (e) {}
      if (done) document.addEventListener('DOMContentLoaded', function () {
        var t = document.createElement('div');
        t.setAttribute('role', 'status');
        t.textContent = 'Готово: приложение связано с ботом, прогресс общий ✓';
        t.style.cssText = 'position:fixed;left:16px;right:16px;top:16px;max-width:488px;margin:0 auto;z-index:60;padding:12px 14px;background:#E3F3E8;border:2px solid #111;color:#111;font:600 15px/1.4 Golos Text,system-ui,sans-serif';
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 4500);
      });
      return;
    }
    if (!API) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (initData) return;                         // внутри Telegram и так всё общее
    link(m[1]).then(function (r) {
      if (r === true) { try { sessionStorage.setItem('anik_linked_now', '1'); } catch (e) {} location.reload(); }
      else {
        var box = document.getElementById('anik-link-msg');
        if (box) box.textContent = 'Ссылка не сработала: ' + r;
        else { try { sessionStorage.setItem('anik_link_err', r); } catch (e) {} }
      }
    });
  })();

  window.AnikSync = {
    enabled: enabled,
    link: link,
    unlink: unlink,
    linkCard: linkCard,
    linked: function () { return !!initData || !!device(); },
    justLinked: function () { try { var v = sessionStorage.getItem('anik_linked_now'); sessionStorage.removeItem('anik_linked_now'); return !!v; } catch (e) { return false; } },
    linkError: function () { try { var v = sessionStorage.getItem('anik_link_err'); sessionStorage.removeItem('anik_link_err'); return v || ''; } catch (e) { return ''; } },
    inTelegram: function () { return !outside(); },
    send: send,
    flush: flush,
    refresh: refresh,
    state: function () { return state; },
    pending: function () { return read(QUEUE, []).length; },
    localDays: function () { return read('anik_days', []); },
    onState: function (fn) { listeners.push(fn); if (state) fn(state); },
  };
})();
