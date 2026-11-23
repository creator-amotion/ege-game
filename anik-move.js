/* Аник — переезд с creator-amotion.github.io/ege-game на anik-ege.ru.
   Браузер хранит прогресс (localStorage: anik_*, ege_*, math_*) отдельно для каждого адреса сайта, поэтому при смене адреса
   ученик увидел бы пустые очки, пройденные правила и банк задач. Перенос — один раз на устройство:
   1) новый сайт, если на этом устройстве переноса ещё не было, уходит на старый адрес: move.html#back=…;
   2) старая move.html собирает ключи anik_/ege_/math_, сжимает их и возвращает на новый адрес с #anik_move=…;
   3) новый сайт записывает ключи и открывает исходную страницу (с исходным #tgWebAppData — вход через Telegram не теряется).
   Остальные страницы старого адреса просто переадресуют на те же страницы нового.
   Возврат — только на https://anik-ege.ru, чтобы данные нельзя было увести на чужой адрес.
   Подключается сразу после telegram-web-app.js, до остальных скриптов. */
(function () {
  var NEW_HOST = 'anik-ege.ru', NEW = 'https://anik-ege.ru/';
  var OLD_HOST = 'creator-amotion.github.io', OLD = 'https://creator-amotion.github.io/ege-game/';
  var DONE = 'anik_moved', TRIES = 'anik_move_tries', BACK = 'anik_move_back';
  var KEEP_NEW = { anik_dev: 1, anik_tutor: 1 };               // ключи входа, уже полученные на новом адресе, не перетираем
  var MINE = /^(anik|ege|math)_/;
  var HEAVY = [/^ege_cgseen_/, /^math_var_seen$/, /^anik_reports$/, /^math_variants$/, /^anik_bank$/];   // что выкинуть, если не влезает
  var MAX = 1500000;                                            // символов в адресе — с запасом для WebView

  var ls; try { ls = window.localStorage; ls.getItem('x'); } catch (e) { return; }
  var ss; try { ss = window.sessionStorage; } catch (e) { ss = null; }
  var host = location.hostname, page = location.pathname.split('/').pop() || 'index.html';
  var zip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  function hide() { try { document.documentElement.style.visibility = 'hidden'; } catch (e) {} }
  function b64u(u) { var s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function pipe(u, Stream) { return new Response(new Blob([u]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer()
    .then(function (b) { return new Uint8Array(b); }); }
  function pack(obj) {
    var raw = new TextEncoder().encode(JSON.stringify(obj));
    if (!zip) return Promise.resolve('j.' + b64u(raw));
    return pipe(raw, CompressionStream).then(function (z) { return 'z.' + b64u(z); }, function () { return 'j.' + b64u(raw); });
  }
  function unpack(s) {
    var u = unb64u(s.slice(2));
    return (s.slice(0, 2) === 'z.' ? pipe(u, DecompressionStream) : Promise.resolve(u))
      .then(function (b) { return JSON.parse(new TextDecoder().decode(b)); });
  }
  function backUrl(raw) {                                       // только https://anik-ege.ru/…, без хвоста
    try { var u = new URL(raw); if (u.protocol === 'https:' && u.hostname === NEW_HOST) return u.origin + u.pathname + u.search; } catch (e) {}
    return NEW;
  }

  // ───── старый адрес ─────
  if (host === OLD_HOST) {
    if (page !== 'move.html') {                                  // старые ссылки и закладки → та же страница на новом адресе
      hide();
      var rest = location.pathname.replace(/^\/ege-game\/?/, '');
      location.replace(NEW + rest + location.search + location.hash);
      return;
    }
    hide();
    var back = backUrl(decodeURIComponent((location.hash.match(/[#&]back=([^&]*)/) || [])[1] || ''));
    var data = {};
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (MINE.test(k)) data[k] = ls.getItem(k); }
    (function fit() {
      pack(data).then(function (p) {
        if (p.length > MAX) {
          for (var h = 0; h < HEAVY.length; h++) {
            var cut = Object.keys(data).filter(function (k) { return HEAVY[h].test(k); });
            if (cut.length) { cut.forEach(function (k) { delete data[k]; }); return fit(); }
          }
          p = 'j.' + b64u(new TextEncoder().encode('{}'));       // даже без тяжёлых не влезло — вернём пустой перенос
        }
        location.replace(back + '#anik_move=' + p);
      }).catch(function () { location.replace(back + '#anik_move=j.e30'); });
    })();
    return;
  }

  // ───── новый адрес ─────
  if (host !== NEW_HOST) return;                                // локально и на тестовых адресах переноса нет
  var m = location.hash.match(/^#anik_move=([zj]\.[A-Za-z0-9_-]*)/);
  if (m) {
    hide();
    var target = (ss && ss.getItem(BACK)) || (location.origin + location.pathname + location.search);
    unpack(m[1]).then(function (data) {
      Object.keys(data || {}).forEach(function (k) {
        if (!MINE.test(k) || typeof data[k] !== 'string') return;
        if (KEEP_NEW[k] && ls.getItem(k)) return;
        try { ls.setItem(k, data[k]); } catch (e) {}
      });
    }).catch(function () {}).then(function () {
      try { ls.setItem(DONE, String(Date.now())); ls.removeItem(TRIES); if (ss) ss.removeItem(BACK); } catch (e) {}
      // тот же документ с другим #… браузер не перезагрузит — меняем адрес и перезагружаем явно, чтобы страницы прочли перенесённое
      try { history.replaceState(null, '', target); } catch (e) { location.replace(target); return; }
      location.reload();
    });
    return;
  }
  if (ls.getItem(DONE)) return;
  var tries = parseInt(ls.getItem(TRIES) || '0', 10) || 0;
  if (tries >= 2) { try { ls.setItem(DONE, 'skip'); } catch (e) {} return; }   // старый адрес не открылся дважды — не мучаем ученика
  try { ls.setItem(TRIES, String(tries + 1)); if (ss) ss.setItem(BACK, location.href); } catch (e) { return; }
  if (!ss) { try { ls.setItem(DONE, 'skip'); } catch (e) {} return; }       // без sessionStorage не вернём исходный адрес — не переносим
  hide();
  location.replace(OLD + 'move.html#back=' + encodeURIComponent(location.origin + location.pathname + location.search));
})();
