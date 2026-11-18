/* Аник — общий код кабинета репетитора, урока и заданий от репетитора (API бота: bot/tutor_web.py).
   Кто я: внутри Telegram — подпись Telegram (X-Init-Data); в браузере — ключ устройства, полученный по коду из бота (/app).
   Ученик — ключ приложения (anik_dev, общий с anik-sync.js). Репетитор может войти отдельным кодом (anik_tutor), чтобы в одном
   браузере жили и кабинет, и приложение ученика; если отдельного входа нет, кабинет пробует ключ приложения.
   ID учеников в адреса не попадают. */
(function () {
  var local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  var API = local ? location.origin : 'https://2-29-119-233.sslip.io';     // локально — тот же сервер (bot/tutor_demo.py)
  var KEYS = { tutor: 'anik_tutor', student: 'anik_dev' };
  var tg = window.Telegram && window.Telegram.WebApp, initData = (tg && tg.initData) || '';

  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); return true; } catch (e) { return false; } }

  function Api(role) { this.role = role; }
  /* заголовки входа или null, если человек ещё не связан с ботом */
  Api.prototype.auth = function () {
    if (this.role === 'tutor' && get(KEYS.tutor)) return { 'X-Device-Token': get(KEYS.tutor) };
    if (initData) return { 'X-Init-Data': initData };
    return get(KEYS.student) ? { 'X-Device-Token': get(KEYS.student) } : null;
  };
  Api.prototype.token = function () { return !!this.auth(); };
  Api.prototype.ownLogin = function () { return this.role === 'tutor' && !!get(KEYS.tutor); };   // отдельный вход кодом репетитора
  Api.prototype.logout = function () { set(KEYS[this.role], ''); };
  Api.prototype.call = function (method, path, data) {
    var self = this, h = this.auth() || {};
    if (data !== undefined) h['Content-Type'] = 'application/json';
    return fetch(API + path, { method: method, headers: h, body: data !== undefined ? JSON.stringify(data) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && !initData) { if (self.role === 'tutor' && get(KEYS.tutor)) set(KEYS.tutor, ''); else set(KEYS.student, ''); }
          if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; e.body = j; throw e; }
          return j;
        });
      });
  };
  Api.prototype.get = function (p) { return this.call('GET', p); };
  Api.prototype.post = function (p, d) { return this.call('POST', p, d || {}); };
  Api.prototype.link = function (code) {
    var self = this;
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return fetch(API + '/api/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }) })
      .then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); })
      .then(function (x) {
        if (x[0] !== 200 || !x[1].token) throw new Error(self.role === 'student' ? 'Код не подошёл: он действует 15 минут и один раз. Возьми новый в боте: /app' : 'Код не подошёл: он действует 15 минут и один раз. Возьмите новый в боте: /app');
        if (!set(KEYS[self.role], x[1].token)) throw new Error(self.role === 'student' ? 'Браузер не даёт сохранить вход. Выключи режим инкогнито.' : 'Браузер не даёт сохранить вход. Выключите режим инкогнито.');
        return true;
      });
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* форма входа по коду: el — контейнер, onDone — после успешной связки */
  function loginForm(api, el, title, hint, onDone) {
    el.innerHTML = '<section class="login"><h1>' + esc(title) + '</h1><p class="lead">' + hint + '</p>' +
      '<form class="row"><input class="inp code" maxlength="12" autocomplete="one-time-code" placeholder="КОД ИЗ БОТА" aria-label="Код из бота">' +
      '<button class="b">Войти</button></form><p class="msg" role="status"></p></section>';
    var f = el.querySelector('form'), msg = el.querySelector('.msg');
    f.onsubmit = function (e) {
      e.preventDefault();
      msg.textContent = 'Проверяю…';
      api.link(f.querySelector('input').value).then(onDone).catch(function (err) { msg.textContent = err.message; });
    };
    f.querySelector('input').focus();
    var m = /[#&]tl=([A-Za-z0-9]{8})/.exec(location.hash);     // ссылка из бота «Открыть кабинет»: код уже в адресе
    if (m) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      f.querySelector('input').value = m[1];
      f.onsubmit({ preventDefault: function () {} });
    }
  }

  /* формулы $…$ как на сайте (vendor/katex); без KaTeX — просто текст */
  function math(el) {
    if (window.renderMathInElement) {
      try { renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } catch (e) {}
    }
  }

  /* звонок: ссылка на Телемост (или другую комнату) — в новом окне; внутри Telegram — через openLink */
  function openCall(url) {
    if (tg && initData && tg.openLink) tg.openLink(url); else window.open(url, '_blank', 'noopener');
  }

  window.AnikTutor = { Api: Api, esc: esc, loginForm: loginForm, math: math, openCall: openCall, API: API, local: local, inTelegram: !!initData };
})();
