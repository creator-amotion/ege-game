/* Банк задач ученика: что показывать снова, а что отложить.
   Верно решённая задача уходит «в долгий ящик» (вернётся не раньше чем через 45 дней, если банк не кончился),
   решённая с ошибкой возвращается через пару дней, а только показанная (открыл, но не ответил) снова в обороте уже завтра.
   Хранится на устройстве (localStorage «anik_bank»): {ключ банка: {id задачи: [код, день]}}, код: 1 верно, 0 ошибка, 's' показана. */
(function () {
  var KEY = 'anik_bank', CAP = 1500, OK_DAYS = 45, BAD_DAYS = 2, SHOWN_DAYS = 1;
  var db = null;
  function load() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { db = {}; }
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function today() { return Math.floor(Date.now() / 864e5); }
  function idOf(t, i) { return t && t.id != null ? String(t.id) : String(i); }
  /* 0 — не видел или давно открывал; 1 — ошибся, пора повторить; 2 — верно, но давно / открывал вчера-сегодня;
     3 — ошибся только что; 4 — верно и недавно (берём, только когда банк кончился) */
  function tier(bank, id) {
    var r = load()[bank] && db[bank][id];
    if (!r) return 0;
    var age = today() - r[1];
    if (r[0] === 's') return age >= SHOWN_DAYS ? 0 : 2;
    if (r[0] === 0) return age >= BAD_DAYS ? 1 : 3;
    return age >= OK_DAYS ? 2 : 4;
  }
  function put(bank, id, code) {
    var b = load()[bank] || (db[bank] = {});
    if (code === 's' && b[id] && b[id][0] !== 's') return;     // показ не стирает, как задача была решена
    b[id] = [code, today()];
    var ids = Object.keys(b);
    if (ids.length > CAP) {
      ids.sort(function (x, y) { return b[x][1] - b[y][1]; });
      ids.slice(0, ids.length - CAP).forEach(function (k) { delete b[k]; });
    }
  }
  /* список задач по порядку: сначала свежие, потом ошибки, решённые верно — в конце; внутри — pri(t) и случай */
  function order(bank, list, pri) {
    return list.map(function (t, i) { return [t, tier(bank, idOf(t, i)) * 10 + (pri ? pri(t) : 0) + Math.random() * 1.2]; })
      .sort(function (a, b) { return a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  function shown(bank, items, list) {
    items.forEach(function (t) { put(bank, idOf(t, list ? list.indexOf(t) : 0), 's'); });
    save();
  }
  window.AnikBank = {
    order: order,
    tier: function (bank, id) { return tier(bank, String(id)); },
    /* n задач для подхода; отмечаются показанными, чтобы завтра не повторились первыми */
    pick: function (bank, list, n, pri) { var out = order(bank, list, pri).slice(0, n); shown(bank, out, list); return out; },
    shown: shown,
    mark: function (bank, id, ok) { if (id == null) return; put(bank, String(id), ok ? 1 : 0); save(); },
  };
})();
