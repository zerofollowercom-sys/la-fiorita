// La Fiorita 2.0 — persistenza su localStorage con fallback in memoria. UMD come logic.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LaFioritaStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'lafiorita.v2';
  const KEY_V1 = 'lafiorita.v1'; // formato vecchio (una riga per famiglia), letto solo se manca la v2
  function createStore(storage, logic) {
    const store = { state: logic.emptyState(), storageOk: true, loadError: null, loadSkipped: 0, loadMigrated: false };
    store.load = function () {
      let text = null;
      store.loadError = null; store.loadSkipped = 0; store.loadMigrated = false;
      try { text = storage.getItem(KEY); if (!text) { text = storage.getItem(KEY_V1); store.loadMigrated = !!text; } } catch (_) { store.storageOk = false; return store; }
      if (!text) { store.state = logic.emptyState(); return store; }
      const r = logic.parseBackup(text);
      if (r.ok) { store.state = r.state; store.loadSkipped = r.skipped || 0; return store; }
      // Dati illeggibili: si riparte da vuoto ma il testo originale viene messo da parte, mai sovrascritto
      store.state = logic.emptyState();
      store.loadError = r.error;
      try { storage.setItem(KEY + '.broken', text); } catch (_) { /* meglio di niente */ }
      return store;
    };
    store.save = function () {
      try { storage.setItem(KEY, logic.serializeBackup(store.state)); store.storageOk = true; }
      catch (_) { store.storageOk = false; }
      return store.storageOk;
    };
    store.replace = function (newState) { store.state = newState; return store.save(); };
    return store;
  }
  return { createStore, KEY, KEY_V1 };
});
