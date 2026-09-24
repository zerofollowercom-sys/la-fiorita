const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');
const { createStore, KEY, KEY_V1 } = require('../store.js');

function fakeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
test('primo avvio: seed con 4 portate e salvataggio', () => {
  const st = fakeStorage(); const s = createStore(st, L); s.load();
  assert.equal(s.state.dishes.length, 4); assert.equal(s.storageOk, true);
  s.save(); assert.ok(st._m.get(KEY).includes('"Pizza"'));
});
test('ricarica quello che c\'era', () => {
  const st = fakeStorage(); const a = createStore(st, L); a.load();
  a.state.guests.push({ id: 'g1', name: 'Rossi', defaultPeople: 3, createdAt: 1, archived: false }); a.save();
  const b = createStore(st, L); b.load(); assert.equal(b.state.guests[0].name, 'Rossi');
});
test('storage che lancia: resta in memoria e storageOk=false', () => {
  const broken = { getItem() { throw new Error('quota'); }, setItem() { throw new Error('quota'); } };
  const s = createStore(broken, L); s.load();
  assert.equal(s.storageOk, false); assert.equal(s.state.dishes.length, 4);
  assert.doesNotThrow(() => s.save());
});
test('la chiave è la v2 e i vecchi dati v1 vengono convertiti una volta', () => {
  assert.equal(KEY, 'lafiorita.v2');
  const G = [{ id: 'g1', name: 'Rossi', defaultPeople: 2, createdAt: 1, archived: false }];
  const D = L.defaultDishes();
  const v1 = JSON.stringify({ version: 1, guests: G, dishes: D, entries: [{ id: 'a', date: '2026-09-01', meal: 'pranzo', guestId: 'g1', people: 4, dishId: D[0].id }], lastBackupAt: null });
  const st = fakeStorage({ [KEY_V1]: v1 }); const s = createStore(st, L); s.load();
  assert.equal(s.state.entries.length, 1); assert.deepEqual(s.state.entries[0].guests, [{ guestId: 'g1', people: 4 }]);
  assert.equal(s.loadMigrated, true);
  s.save(); assert.ok(st._m.get(KEY).includes('"version": 2'));
});
test('dati salvati corrotti: riparte da vuoto senza esplodere', () => {
  const s = createStore(fakeStorage({ [KEY]: '{oops' }), L); s.load();
  assert.equal(s.state.entries.length, 0); assert.equal(s.state.dishes.length, 4);
});
test('replace sostituisce e salva', () => {
  const st = fakeStorage(); const s = createStore(st, L); s.load();
  const ns = L.emptyState(); ns.guests = [{ id: 'g1', name: 'Verdi', defaultPeople: 2, createdAt: 1, archived: false }];
  s.replace(ns); assert.equal(s.state.guests[0].name, 'Verdi'); assert.ok(st._m.get(KEY).includes('Verdi'));
});

test('dati salvati corrotti: il testo originale viene conservato e segnalato', () => {
  const st = fakeStorage({ [KEY]: '{oops' }); const s = createStore(st, L); s.load();
  assert.equal(st._m.get(KEY + '.broken'), '{oops');
  assert.equal(typeof s.loadError, 'string');
  s.save(); assert.equal(st._m.get(KEY + '.broken'), '{oops');
});
test('righe scartate al caricamento vengono contate', () => {
  const G = [{ id: 'g1', name: 'Rossi', defaultPeople: 2, createdAt: 1, archived: false }];
  const bad = JSON.stringify({ version: 1, guests: G, dishes: L.defaultDishes(), entries: [{ id: 'e1', date: '2026-09-01', meal: 'pranzo', guestId: 'nope', people: 2, dishId: 'x' }], lastBackupAt: null });
  const s = createStore(fakeStorage({ [KEY]: bad }), L); s.load();
  assert.equal(s.loadSkipped, 1); assert.equal(s.loadError, null);
});
