/* Аник — репетитор в приложении ученика («Сегодня»): задания от репетитора, приглашение на урок, кнопка кабинета.
   Видимость по роли (/api/me, bot/tutor_web.py): блок заданий — только ученику с подключённым репетитором,
   кнопка «Кабинет репетитора» — только репетитору. Остальным не показывается ничего.
   Подключение: <div id="tutorbox"></div> + AnikTutorBox(el) после каждой отрисовки страницы. */
(function () {
  var cache = null, at = 0, waiting = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tutorLogin() { try { return !!localStorage.getItem('anik_tutor'); } catch (e) { return false; } }   // репетитор вышел из кабинета в приложение — дорога обратно
  function load(cb) {
    if (cache && Date.now() - at < 30000) return cb(cache);
    waiting.push(cb);
    if (waiting.length > 1) return;
    var S = window.AnikSync, h = S && S.authHeaders && S.authHeaders();
    var done = function (v) { cache = v; at = Date.now(); waiting.splice(0).forEach(function (f) { f(v); }); };
    if (!h || !S.api) return done(null);
    fetch(S.api + '/api/me', { headers: h }).then(function (r) { return r.ok ? r.json() : null; }).then(done).catch(function () { done(null); });
  }
  function plural(n, a, b, c) { var m = n % 10, k = n % 100; return m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 10 || k >= 20) ? b : c; }
  function due(d) {
    var days = Math.round((new Date(d + 'T23:59:00') - new Date()) / 864e5);
    return days < 0 ? 'срок прошёл' : days === 0 ? 'срок сегодня' : 'ещё ' + days + ' ' + plural(days, 'день', 'дня', 'дней');
  }
  function html(m) {
    var h = '';
    if (m.tutor || tutorLogin()) h += '<a class="tut-cab" href="tutor.html"><b>Кабинет репетитора</b><span>ученики, задания, уроки на доске</span></a>';
    if (!m.has_tutor) return h;
    h += '<div class="stl"><span>Задания от репетитора</span><span>' + esc(m.tutors.join(', ')) + '</span></div>';
    (m.rooms || []).forEach(function (r) {
      h += '<div class="tut-room" role="status"><b>Урок начался</b><span>' + esc(r.tutor) + ' ждёт тебя у доски</span>' +
        '<div class="tut-row"><a class="tut-go" href="lesson.html?r=' + encodeURIComponent(r.room) + '&as=s">Открыть доску</a>' +
        (r.call_url ? '<button class="tut-call" data-url="' + esc(r.call_url) + '">' + (/telemost/.test(r.call_url) ? 'Телемост' : 'Звонок') + '</button>' : '') + '</div></div>';
    });
    var hw = m.homework || [];
    if (!hw.length && !(m.rooms || []).length) h += '<div class="tut-empty">Сейчас заданий нет. Когда репетитор их пришлёт, они появятся здесь и в боте.</div>';
    hw.forEach(function (x) {
      var pct = x.total ? Math.round(100 * x.done / x.total) : 0;
      h += '<a class="tut-hw" href="homework.html#hw=' + x.id + '"><span class="t">' + esc(x.title) + '</span>' +
        '<span class="m">' + x.done + ' из ' + x.total + ' · ' + esc(due(x.due)) + '</span><span class="act">' + (x.done ? 'Продолжить' : 'Решать') + '</span>' +
        '<i class="bar"><i style="width:' + pct + '%"></i></i></a>';
    });
    h += '<div class="tut-links">' + (hw.length || (m.rooms || []).length ? '<a class="tut-all" href="homework.html">Все задания →</a>' : '') +
      '<a class="tut-all" href="notes.html">Мои конспекты' + (m.notes ? ' · ' + m.notes : '') + ' →</a></div>';
    return h;
  }
  var css = '.tut-cab{display:flex;flex-direction:column;gap:2px;margin-top:14px;padding:12px 14px;background:var(--ink);color:var(--paper);text-decoration:none}' +
    '.tut-cab b{font-family:var(--display);font-size:18px;font-weight:800}.tut-cab span{font-size:13px;opacity:.85}' +
    '.tut-room{background:var(--yellow);padding:12px 14px;display:flex;flex-direction:column;gap:2px;margin-bottom:8px}' +
    '.tut-room b{font-family:var(--display);font-size:20px;font-weight:800}.tut-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}' +
    '.tut-go,.tut-call{min-height:44px;padding:0 16px;display:inline-flex;align-items:center;font-weight:600;font-size:15px;text-decoration:none;border:2px solid var(--ink);cursor:pointer;font-family:inherit}' +
    '.tut-go{background:var(--ink);color:var(--paper)}.tut-call{background:transparent;color:var(--ink)}' +
    '.tut-hw{position:relative;display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 14px 16px;background:#fff;color:var(--ink);text-decoration:none;margin-bottom:6px}' +
    '.tut-hw .t{font-weight:700}.tut-hw .m{font-size:13px;color:var(--muted);grid-column:1}.tut-hw .act{grid-column:2;grid-row:1/3;align-self:center;font-weight:700;color:var(--blue)}' +
    '.tut-hw .bar{position:absolute;left:0;right:0;bottom:0;height:5px;background:var(--chip)}.tut-hw .bar i{display:block;height:100%;background:var(--blue)}' +
    '.tut-empty{background:#fff;padding:12px 14px;font-size:14px}.tut-all{display:inline-block;margin-top:2px;font-size:14px;font-weight:600;color:var(--ink)}.tut-links{display:flex;gap:18px;flex-wrap:wrap}';
  window.AnikTutorBox = function (el) {
    if (!el) return;
    if (!document.getElementById('tut-css')) { var st = document.createElement('style'); st.id = 'tut-css'; st.textContent = css; document.head.appendChild(st); }
    load(function (m) {
      if (!document.body.contains(el)) return;
      if (!m) m = { tutor: false, has_tutor: false };          // приложение не связано, но в этом браузере вошёл репетитор
      el.innerHTML = html(m);
      el.querySelectorAll('.tut-call').forEach(function (b) {
        b.onclick = function () {                          // звонок — мимо этой страницы, чтобы потом вернуться к доске
          if (window.AnikCall) return AnikCall.open(b.dataset.url);   // на iPhone — шторка с приложением Телемост
          if (window.AnikTutor && AnikTutor.openCall) return AnikTutor.openCall(b.dataset.url);
          var tg = window.Telegram && window.Telegram.WebApp;
          if (tg && tg.initData && tg.openLink) return tg.openLink(b.dataset.url, { try_instant_view: false });
          var a = document.createElement('a'); a.href = b.dataset.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; document.body.appendChild(a); a.click(); a.remove();
        };
      });
    });
  };
  window.AnikTutorMe = load;
})();
