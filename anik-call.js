/* Аник — кнопка «Телемост» (урок, «Сегодня», задания).
   На iPhone и iPad веб-страница Телемоста в Safari или во встроенном браузере Telegram засыпает вместе с микрофоном,
   когда переключаешься обратно на доску, и звонок рвётся. Приложение «Яндекс Телемост» держит звонок в фоне.
   Поэтому на iOS вместо прямого перехода — шторка: открыть в приложении, скопировать ссылку, установить приложение.
   Первый раз шторка подробная, дальше (запомнено на устройстве) — компактная. На Android и компьютере — как раньше.
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

  /* ссылка — мимо текущей страницы: в Telegram через openLink, в браузере — новой вкладкой */
  function go(url) {
    if (!/^https:\/\//.test(String(url || ''))) return;
    if (tg && tg.initData && tg.openLink) { try { tg.openLink(url, { try_instant_view: false }); return; } catch (e) {} }
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 0);
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
    '.tms .note{font-size:13px;color:var(--muted,#555);margin:12px 0 0}';

  function close(back, opener) {
    back.remove(); document.removeEventListener('keydown', back._esc);
    if (opener && opener.focus) try { opener.focus({ preventScroll: true }); } catch (e) {}
  }

  function sheet(url) {
    if (!document.getElementById('tms-css')) { var st = document.createElement('style'); st.id = 'tms-css'; st.textContent = css; document.head.appendChild(st); }
    var old = document.querySelector('.tms-back'); if (old) old.remove();
    var full = !seen(), opener = document.activeElement;
    var back = document.createElement('div'); back.className = 'tms-back';
    var LINE = 'На iPhone звони из приложения Телемост — тогда звонок не прервётся, когда переключаешься на доску.';
    back.innerHTML = '<div class="tms" role="dialog" aria-modal="true" aria-labelledby="tms-h">' +
      '<h2 id="tms-h">Звонок в Телемосте<button class="x" data-a="close" aria-label="Закрыть">×</button></h2>' +
      (full
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
      if (a === 'open') { go(url); return close(back, opener); }
      if (a === 'store') { go(STORE); return; }
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
      if (isIOS() && /telemost/.test(url)) return sheet(url);    // своя ссылка (не Телемост) — как раньше
      go(url);
    },
    go: go, isIOS: isIOS, STORE: STORE
  };
})();
