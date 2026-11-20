/* Аник — кнопка «Телемост» (урок, «Сегодня», задания).
   На iPhone и iPad веб-страница Телемоста в Safari или во встроенном браузере Telegram засыпает вместе с микрофоном,
   когда переключаешься обратно на доску, и звонок рвётся. Приложение «Яндекс Телемост» держит звонок в фоне.
   Поэтому на iOS вместо прямого перехода — шторка: открыть в приложении, скопировать ссылку, установить приложение.
   Первый раз шторка подробная, дальше (запомнено на устройстве) — компактная.
   Звонок и доска — всегда в разных окнах: если они в одной вкладке или одном WebView, звонок рвётся.
   В Telegram — openLink (внешний браузер, мини-приложение с доской остаётся); на компьютере — отдельное окно «anik_call»
   рядом с доской; на телефоне в браузере — новая вкладка. Повторное нажатие не перезагружает уже идущий звонок.
   Подключение: <script src="anik-call.js"></script>, затем AnikCall.open(url). */
(function () {
  var STORE = 'https://apps.apple.com/app/id1527737302';   // «Яндекс Телемост» в App Store
  var SEEN = 'anik_tm_sheet';
  var tg = window.Telegram && window.Telegram.WebApp;

  function isIOS() {
    if (tg && tg.platform === 'ios') return true;
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;  // iPadOS притворяется Mac
  }
  function seen() { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN, '1'); } catch (e) {} }

  function inTg() { return !!(tg && tg.initData && tg.openLink); }
  function phone() { return isIOS() || /Android|Mobi/i.test(navigator.userAgent || ''); }
  var callWin = null;

  /* ссылка — в отдельном окне, страница с доской остаётся на месте. Возвращает, как открыли: tg | win | tab | focus */
  function go(url, why) {
    if (!/^https:\/\//.test(String(url || ''))) return '';
    if (inTg()) { try { tg.openLink(url, { try_instant_view: false }); return 'tg'; } catch (e) {} }
    if (callWin && !callWin.closed && why === 'call') { try { callWin.focus(); } catch (e) {} return 'focus'; }   // звонок уже идёт — не перезагружать
    var feats = '';
    if (!phone()) {                                     // компьютер: окно справа, доска остаётся слева
      var sw = screen.availWidth || 1280, sh = screen.availHeight || 800, w = Math.min(640, Math.max(420, Math.round(sw * 0.4)));
      feats = 'popup=yes,width=' + w + ',height=' + Math.min(sh - 40, 900) + ',left=' + ((screen.availLeft || 0) + sw - w) + ',top=' + (screen.availTop || 0);
    }
    var name = why === 'call' ? 'anik_call' : '_blank', win = null;
    try { win = window.open(why === 'call' ? '' : url, name, why === 'call' ? feats : 'noopener'); } catch (e) {}
    if (why !== 'call') return 'tab';
    if (win) {
      var fresh = true;
      try { fresh = win.location.href === 'about:blank'; } catch (e) { fresh = false; }   // чужой адрес не читается — там уже звонок
      if (fresh) {
        try { win.opener = null; } catch (e) {}                                     // как noopener: окно звонка не трогает доску
        try { win.location.replace(url); } catch (e) { win.location.href = url; }
      }
      try { win.focus(); } catch (e) {}
      callWin = win;
      return fresh ? (feats ? 'win' : 'tab') : 'focus';
    }
    var a = document.createElement('a');                // окно не открылось (блокировщик) — новая вкладка
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 0);
    return 'tab';
  }
  function openCall(url) {
    var how = go(url, 'call');
    if (!how) return;
    if (how === 'tg') say('Звонок открылся в браузере, доска осталась здесь. Вернись в Telegram — звонок продолжится.');
    else if (isIOS()) say('Звонок открылся отдельно. Вернись в Аник жестом или кнопкой «назад» — звонок продолжится в Телемосте.', 7000);
    else if (how === 'win') say('Звонок открылся в отдельном окне — доска осталась здесь.');
    else if (how === 'tab') say('Звонок открылся в новой вкладке — доска осталась здесь.');
  }
  function say(text, ms) {
    var d = document.createElement('div');
    d.className = 'tms-say'; d.setAttribute('role', 'status'); d.textContent = text;
    if (!document.getElementById('tms-css')) addCss();
    var old = document.querySelector('.tms-say'); if (old) old.remove();
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, ms || 4500);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    return new Promise(function (ok, bad) {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
      document.body.appendChild(t);
      var r = document.createRange(); r.selectNodeContents(t);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); t.setSelectionRange(0, text.length);
      var done = false; try { done = document.execCommand('copy'); } catch (e) {}
      s.removeAllRanges(); t.remove();
      done ? ok() : bad(new Error('copy'));
    });
  }

  var css = '.tms-back{position:fixed;inset:0;z-index:90;background:rgba(17,17,17,.35);display:flex;align-items:flex-end;justify-content:center}' +
    '.tms{width:100%;max-width:480px;background:var(--paper,#F3EEE2);color:var(--ink,#111);border:2px solid var(--ink,#111);border-bottom:0;' +
    'padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));font-family:"Golos Text",system-ui,sans-serif;max-height:90vh;overflow:auto}' +
    '.tms h2{font-family:var(--display,"Inter Tight",sans-serif);font-size:22px;font-weight:800;letter-spacing:-.4px;margin:0 0 6px;display:flex;justify-content:space-between;align-items:center;gap:10px}' +
    '.tms .x{flex:0 0 40px;height:40px;border:2px solid var(--ink,#111);background:#fff;font-family:inherit;font-weight:800;font-size:20px;line-height:1;cursor:pointer;color:inherit}' +
    '.tms p{font-size:15px;line-height:1.45;margin:0 0 12px}' +
    '.tms .bt{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:8px;padding:0 14px;border:2px solid var(--ink,#111);' +
    'background:#fff;color:var(--ink,#111);font-family:inherit;font-weight:700;font-size:16px;cursor:pointer;text-align:center;touch-action:manipulation}' +
    '.tms .bt.main{background:var(--blue,#2E55C9);color:#fff}' +
    '.tms .sm{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;font-size:14px}' +
    '.tms .sm button{border:0;background:none;padding:6px 0;font-family:inherit;font-weight:600;font-size:14px;color:var(--ink,#111);text-decoration:underline;cursor:pointer;min-height:36px}' +
    '.tms .ok{margin-top:10px;padding:8px 10px;background:var(--yellow,#F6CE2E);font-weight:600;font-size:14px}' +
    '.tms .note{font-size:13px;color:var(--muted,#555);margin:12px 0 0}' +
    '.tms .win{font-weight:600;background:var(--yellow-t,#FBEFB5);padding:6px 10px;margin:0 0 10px;font-size:14px}' +
    '.tms-say{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:95;background:var(--ink,#111);color:var(--paper,#F3EEE2);' +
    'padding:10px 14px;font:600 14px/1.4 "Golos Text",system-ui,sans-serif;width:max-content;max-width:calc(100vw - 32px)}';
  function addCss() { var st = document.createElement('style'); st.id = 'tms-css'; st.textContent = css; document.head.appendChild(st); }

  function close(back, opener) {
    back.remove(); document.removeEventListener('keydown', back._esc);
    if (opener && opener.focus) try { opener.focus({ preventScroll: true }); } catch (e) {}
  }

  function sheet(url) {
    if (!document.getElementById('tms-css')) addCss();
    var old = document.querySelector('.tms-back'); if (old) old.remove();
    var full = !seen(), opener = document.activeElement;
    var back = document.createElement('div'); back.className = 'tms-back';
    var LINE = 'На iPhone звони из приложения Телемост — тогда звонок не прервётся, когда переключаешься на доску.';
    var WIN = '<p class="win">Звонок откроется в отдельном окне — доска останется здесь.</p>';
    back.innerHTML = '<div class="tms" role="dialog" aria-modal="true" aria-labelledby="tms-h">' +
      '<h2 id="tms-h">Звонок в Телемосте<button class="x" data-a="close" aria-label="Закрыть">×</button></h2>' +
      WIN + (full
        ? '<p>' + LINE + '</p>' +
          '<button class="bt main" data-a="open">Открыть в приложении Телемост</button>' +
          '<button class="bt" data-a="copy">Скопировать ссылку на звонок</button>' +
          '<button class="bt" data-a="store">Установить Телемост</button>'
        : '<button class="bt main" data-a="open">Открыть в приложении Телемост</button>' +
          '<div class="sm"><button data-a="copy">Скопировать ссылку</button><button data-a="store">Установить Телемост</button></div>' +
          '<p class="note">' + LINE + '</p>') +
      '<div class="ok" role="status" aria-live="polite" hidden></div></div>';
    document.body.appendChild(back);
    markSeen();
    var msg = back.querySelector('.ok');
    back.addEventListener('click', function (e) {
      if (e.target === back) return close(back, opener);
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'close') return close(back, opener);
      if (a === 'open') { close(back, opener); return openCall(url); }
      if (a === 'store') { go(STORE, 'store'); return; }
      if (a === 'copy') {
        copy(url).then(function () { msg.textContent = 'Скопировано — вставь в приложении Телемост'; })
          .catch(function () { msg.textContent = 'Не получилось скопировать. Ссылка: ' + url; });
        msg.hidden = false;
      }
    });
    back._esc = function (e) { if (e.key === 'Escape') close(back, opener); };
    document.addEventListener('keydown', back._esc);
    var first = back.querySelector('.bt.main'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
  }

  window.AnikCall = {
    open: function (url) {
      if (!/^https:\/\//.test(String(url || ''))) return;
      if (isIOS() && /telemost/.test(url)) return sheet(url);    // своя ссылка (не Телемост) — сразу
      openCall(url);
    },
    go: go, isIOS: isIOS, STORE: STORE
  };
})();
