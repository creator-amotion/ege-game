/* Аник — кнопка «Разобрать с репетитором» под заданием.
   Подключение: одна строка <script src="anik-ask.js?v=1" defer></script> после anik-sync.js. Страницу менять не нужно:
   модуль сам находит текущее задание в тренажёре, ленте, практике профиля и русском (адаптеры ниже).
   Кнопка видна только ученику с подключённым репетитором (GET /api/ask/state, bot/tutor_web.py).
   Домашка вызывает AnikAsk.mount(элемент, {hw_item, ref}) сама. */
(function () {
  var S = window.AnikSync, state = null, waiting = null, TTL = 300000;
  var SUBJ = { 'ege-rus': 1, 'oge-rus': 1, 'ege-math': 1, 'ege-mathb': 1, 'oge-math': 1 };
  function auth() { return S && S.authHeaders ? S.authHeaders() : null; }
  function key() { return 'anik_ask_' + hash(JSON.stringify(auth() || '')); }      // у каждого входа своя память
  function load() {
    if (state) return Promise.resolve(state);
    if (waiting) return waiting;
    try { var c = JSON.parse(sessionStorage.getItem(key()) || 'null'); if (c && Date.now() - c.at < TTL) { state = c.s; return Promise.resolve(state); } } catch (e) {}
    var h = auth();
    if (!h || !S.api) return Promise.resolve({ has_tutor: false, open: [] });
    waiting = fetch(S.api + '/api/ask/state', { headers: h }).then(function (r) { return r.ok ? r.json() : { has_tutor: false, open: [] }; })
      .catch(function () { return { has_tutor: false, open: [] }; })
      .then(function (s) { state = s; waiting = null; remember(); return s; });
    return waiting;
  }
  function remember() { try { sessionStorage.setItem(key(), JSON.stringify({ at: Date.now(), s: state })); } catch (e) {} }
  function hash(t) { var h = 5381; for (var i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) >>> 0; return 'h' + h.toString(36) + t.length.toString(36); }
  function css() {
    if (document.getElementById('ask-css')) return;
    var st = document.createElement('style'); st.id = 'ask-css';
    st.textContent = '.ask{margin-top:10px;font-family:var(--body,inherit)}' +
      '.ask button{min-height:44px;padding:0 14px;border:2px solid var(--ink,#111);border-radius:0;background:transparent;color:var(--ink,#111);font-family:inherit;font-size:14px;font-weight:600;line-height:1.2;cursor:pointer}' +
      '.ask .ask-go{width:100%}.ask .ask-send{background:var(--ink,#111);color:var(--paper,#F3EEE2)}' +
      '.ask textarea{display:block;width:100%;box-sizing:border-box;min-height:64px;padding:8px 10px;border:2px solid var(--ink,#111);border-radius:0;background:#fff;color:var(--ink,#111);font-family:inherit;font-size:15px;line-height:1.4;resize:vertical}' +
      '.ask .ask-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.ask .ask-done{padding:8px 10px;background:var(--yellow,#F6CE2E);color:#111;font-size:14px;font-weight:600}.ask .ask-err{margin-top:6px;font-size:13px;color:var(--red,#E5332A)}';
    document.head.appendChild(st);
  }
  /* box — пустой блок .ask; get() — данные задания в момент отправки */
  function render(box, get, ref) {
    if (ref && state.open.indexOf(ref) >= 0) { box.innerHTML = '<div class="ask-done">Отмечено: разберёшь это с репетитором на уроке</div>'; return; }
    box.innerHTML = '<button type="button" class="ask-go">Разобрать с репетитором</button>';
    box.querySelector('.ask-go').onclick = function () {
      box.innerHTML = '<textarea maxlength="300" aria-label="Что непонятно" placeholder="Что непонятно? Можно не писать"></textarea>' +
        '<div class="ask-row"><button type="button" class="ask-send">Отправить репетитору</button><button type="button" class="ask-no">Отмена</button></div><div class="ask-err" role="status"></div>';
      var ta = box.querySelector('textarea'); ta.focus();
      box.querySelector('.ask-no').onclick = function () { render(box, get, ref); };
      box.querySelector('.ask-send').onclick = function () {
        var b = this, d = get(); d.question = ta.value.trim(); b.disabled = true;
        var h = auth() || {}; h['Content-Type'] = 'application/json';
        fetch(S.api + '/api/ask', { method: 'POST', headers: h, body: JSON.stringify(d) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
          .then(function (j) { if (state.open.indexOf(j.ref) < 0) state.open.push(j.ref); remember(); render(box, get, j.ref); })
          .catch(function (e) { b.disabled = false; box.querySelector('.ask-err').textContent = e && e.error === 'too_many' ? 'Уже много отмеченных заданий. Разбери их с репетитором.' : 'Не отправилось. Попробуй ещё раз.'; });
      };
    };
  }
  /* поставить кнопку: after — после какого элемента (или parent — в конец блока) */
  function place(where, key, ref, get) {
    var parent = where.parent || where.after.parentNode, old = parent.querySelector(':scope > .ask');
    if (old && old.dataset.key === key) return;
    if (old) old.remove();
    var box = document.createElement('div'); box.className = 'ask'; box.dataset.key = key;
    if (where.after) where.after.insertAdjacentElement('afterend', box); else parent.appendChild(box);
    render(box, get, ref);
  }
  /* формулы KaTeX обратно в $…$, чтобы на доске они снова стали формулами */
  function domText(el) {
    var c = el.cloneNode(true);
    [].forEach.call(c.querySelectorAll('.katex'), function (k) { var a = k.querySelector('annotation'); k.replaceWith(a ? '$' + a.textContent + '$' : k.textContent); });
    [].forEach.call(c.querySelectorAll('br'), function (b) { b.replaceWith('\n'); });
    [].forEach.call(c.querySelectorAll('img,button,script,style'), function (b) { b.remove(); });
    return c.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }
  function figOf(f) { var v = Array.isArray(f) ? f[0] : f; return /^(figs|trainer\/figs)\/[A-Za-z0-9_.-]+$/.test(v || '') ? v : ''; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function glob(fn) { try { return fn(); } catch (e) { return null; } }

  var ADAPTERS = [
    function trainer() {                                     // trainer.html: run.items[run.i], кнопка #report
      var rep = document.getElementById('report'), r = window.run;
      if (!rep || !r || !r.items || !r.items[r.i]) return;
      var t = r.items[r.i], ref = String(t.id || hash(t.t));
      place({ after: rep }, 'tr:' + ref, ref, function () {
        var p = t.p !== undefined && r.pack && r.pack.passages ? r.pack.passages[t.p] : '';
        return { source: 'trainer', subject: SUBJ[r.set] ? r.set : '', n: r.n || 0, ref: ref, text: ((p ? p + '\n\n' : '') + t.t).slice(-4000), fig: figOf(t.f), answer: val('ans') };
      });
    },
    function math() {                                        // math.html: практика, pr.items[pr.i]
      var ok = glob(function () { return view === 'prac' && pr && pr.items[pr.i]; }); if (!ok) return;
      var host = document.getElementById('pskip') || document.getElementById('pnext'), t = ok; if (!host) return;
      var ref = String(t.id || hash(t.t));
      place({ parent: host.parentNode }, 'm:' + ref, ref, function () { return { source: 'math', subject: 'ege-math', n: t.n || 0, ref: ref, text: t.t, fig: figOf(t.f || t.fig), answer: val('inp') }; });
    },
    function rus() {                                         // rus-ege.html: задание с кнопкой «Ошибка в задании»
      [].forEach.call(document.querySelectorAll('#tb1 .fblink, #tb2 .fblink'), function (fb) {
        var m = /anikReport\('([^']+)'\)/.exec(fb.getAttribute('onclick') || ''), box = fb.parentNode, tx = box.querySelector('.tsk-txt');
        if (!m || !tx) return;
        place({ after: fb }, 'r:' + m[1], m[1], function () {
          var n = box.id === 'tb2' ? window._gn : glob(function () { return curNum; });
          var picked = glob(function () { return Array.from(sel).sort().join(''); }) || '';
          return { source: 'rus', subject: 'ege-rus', n: +n || 0, ref: m[1], text: domText(tx), answer: val(box.id === 'tb2' ? 'gInp' : 'ansInp') || picked };
        });
      });
    },
    function feed() {                                        // feed.html: у каждой карточки своя задача
      [].forEach.call(document.querySelectorAll('#feed .slide'), function (s) {
        var inner = s.querySelector('.inner'), task = s.querySelector('.task'); if (!inner || !task || !s.querySelector('.ans,.out')) return;
        if (s.dataset.askRef === undefined) s.dataset.askRef = hash(domText(task));
        var ref = s.dataset.askRef;
        place({ parent: inner }, 'f:' + ref, ref, function () {
          var tag = s.querySelector('.tg span'), lab = tag ? tag.textContent : '', n = (/№(\d+)/.exec(s.querySelector('.tg').textContent) || [])[1], sub = '';
          var all = glob(function () { return SUBJ_FEED(); }) || {};
          Object.keys(all).forEach(function (k) { if (lab.indexOf(all[k]) === 0) sub = k; });
          if (!sub) sub = glob(function () { return SID; }) || '';
          var img = task.querySelector('img'), inp = s.querySelector('input');
          return { source: 'feed', subject: SUBJ[sub] ? sub : '', n: +n || 0, ref: ref, text: domText(task), fig: figOf(img && img.getAttribute('src')), answer: inp ? inp.value : '' };
        });
      });
    },
  ];
  function SUBJ_FEED() { var o = {}; Object.keys(window.SUBJ || {}).forEach(function (k) { o[k] = window.SUBJ[k].t; }); return o; }

  var timer = null;
  function tick() { timer = null; ADAPTERS.forEach(function (a) { try { a(); } catch (e) {} }); }
  function auto() {
    if (!/(^|\/)(trainer|feed|math|rus-ege)\.html$/.test(location.pathname)) return;
    load().then(function (s) {
      if (!s.has_tutor) return;
      css(); tick();
      new MutationObserver(function () { if (!timer) timer = setTimeout(tick, 250); }).observe(document.body, { childList: true, subtree: true });
    });
  }
  window.AnikAsk = {
    mount: function (host, o) {                              // домашка: {hw_item, ref}
      return load().then(function (s) {
        if (!s.has_tutor || !document.body.contains(host)) return;
        css();
        place({ parent: host }, 'hw:' + o.hw_item, o.ref || '', function () { return { hw_item: o.hw_item, answer: o.answer || '' }; });
      });
    },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
