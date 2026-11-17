/* Аник — конспекты уроков на устройстве ученика (IndexedDB).
   Каждый открытый учеником конспект сохраняется сюда целиком: журнал доски и картинки материалов. На сервере конспект живёт
   120 дней, а копия на устройстве открывается и без сервера, и без интернета.
   Копии помечены меткой владельца (owner, её даёт сервер) — если устройством пользуются двое, каждый видит только свои. */
(function () {
  var DB = 'anik_notes', VER = 1, OWNER = 'anik_notes_owner';
  var dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, bad) {
      if (!window.indexedDB) return bad(new Error('no_idb'));
      var r = indexedDB.open(DB, VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { bad(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (ok, bad) {
        var t = db.transaction(store, mode), s = t.objectStore(store), res;
        res = fn(s);
        t.oncomplete = function () { ok(res && 'result' in res ? res.result : res); };
        t.onerror = t.onabort = function () { bad(t.error); };
      });
    });
  }
  function setOwner(o) { try { if (o) localStorage.setItem(OWNER, o); } catch (e) {} }
  function lastOwner() { try { return localStorage.getItem(OWNER) || ''; } catch (e) { return ''; } }

  /* сохранить конспект: note — ответ сервера (/api/note), fileUrl(f) — адрес картинки материала */
  function save(note, fileUrl) {
    if (!note || note.viewer !== 'student') return Promise.resolve(false);
    setOwner(note.owner);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // просим браузер не чистить
    var fids = {};
    (note.ops || []).forEach(function (o) { if (o.t === 'im' && o.f) fids[o.f] = 1; });
    return tx('files', 'readonly', function (s) { return s.getAllKeys(); }).then(function (have) {
      var need = Object.keys(fids).filter(function (f) { return have.indexOf(f) < 0; });
      return Promise.all(need.map(function (f) {
        return fetch(fileUrl(f)).then(function (r) { return r.ok ? r.blob() : null; }).catch(function () { return null; })
          .then(function (b) { return b && tx('files', 'readwrite', function (s) { s.put(b, f); }); });
      }));
    }).then(function () {
      var rec = { id: note.id, title: note.title, created: note.created, expires: note.expires, tutor: note.tutor, owner: note.owner,
        ops: note.ops, w: note.w, h: note.h, files: Object.keys(fids), saved: new Date().toISOString() };
      return tx('notes', 'readwrite', function (s) { s.put(rec); });
    }).then(function () { return true; });
  }
  /* копия с устройства: { note, urls: {fid: objectURL} } или null */
  function load(id) {
    return tx('notes', 'readonly', function (s) { return s.get(id); }).then(function (n) {
      if (!n) return null;
      var urls = {};
      return Promise.all((n.files || []).map(function (f) {
        return tx('files', 'readonly', function (s) { return s.get(f); }).then(function (b) { if (b) urls[f] = URL.createObjectURL(b); });
      })).then(function () { return { note: n, urls: urls }; });
    }).catch(function () { return null; });
  }
  /* список копий владельца (без журнала доски) */
  function list(owner) {
    owner = owner || lastOwner();
    return tx('notes', 'readonly', function (s) { return s.getAll(); }).then(function (all) {
      return (all || []).filter(function (n) { return !owner || n.owner === owner; })
        .map(function (n) { return { id: n.id, title: n.title, created: n.created, expires: n.expires, tutor: n.tutor, saved: n.saved }; })
        .sort(function (a, b) { return b.id - a.id; });
    }).catch(function () { return []; });
  }
  function remove(id) {
    return tx('notes', 'readonly', function (s) { return s.getAll(); }).then(function (all) {
      var n = (all || []).filter(function (x) { return x.id === id; })[0];
      var still = {};
      (all || []).forEach(function (x) { if (x.id !== id) (x.files || []).forEach(function (f) { still[f] = 1; }); });
      return tx('notes', 'readwrite', function (s) { s.delete(id); }).then(function () {
        return Promise.all(((n && n.files) || []).filter(function (f) { return !still[f]; }).map(function (f) { return tx('files', 'readwrite', function (s) { s.delete(f); }); }));
      });
    });
  }
  window.AnikNotes = { save: save, load: load, list: list, remove: remove, setOwner: setOwner, lastOwner: lastOwner };
})();
