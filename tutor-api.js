/* Аник — общий код кабинета репетитора, урока и домашки ученика (API бота: bot/tutor_web.py).
   Вход — код из бота (/app) → ключ устройства. У репетитора свой ключ (anik_tutor), у ученика — общий с приложением (anik_dev),
   поэтому в одном браузере можно открыть и кабинет, и страницу ученика. ID учеников в адреса не попадают. */
(function () {
  var local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  var API = local ? '' : 'https://2-29-119-233.sslip.io';      // локально — тот же сервер (bot/tutor_demo.py)
  var KEYS = { tutor: 'anik_tutor', student: 'anik_dev' };

  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); return true; } catch (e) { return false; } }

  function Api(role) { this.role = role; }
  Api.prototype.token = function () { return get(KEYS[this.role]); };
  Api.prototype.logout = function () { set(KEYS[this.role], ''); };
  Api.prototype.call = function (method, path, data) {
    var self = this, h = { 'X-Device-Token': this.token() };
    if (data !== undefined) h['Content-Type'] = 'application/json';
    return fetch(API + path, { method: method, headers: h, body: data !== undefined ? JSON.stringify(data) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401) { self.logout(); }
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
        if (x[0] !== 200 || !x[1].token) throw new Error('Код не подошёл: он действует 15 минут и один раз. Возьмите новый в боте: /app');
        if (!set(KEYS[self.role], x[1].token)) throw new Error('Браузер не даёт сохранить вход. Выключите режим инкогнито.');
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
  }

  window.AnikTutor = { Api: Api, esc: esc, loginForm: loginForm, API: API, local: local };
})();
