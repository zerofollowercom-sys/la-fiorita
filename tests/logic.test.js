const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

test('monthRange febbraio bisestile', () => {
  assert.deepEqual(L.monthRange(2028, 2), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(L.monthRange(2026, 2), { from: '2026-02-01', to: '2026-02-28' });
});
test('fortnightRange seconda metà arriva a fine mese', () => {
  assert.deepEqual(L.fortnightRange(2026, 1, 1), { from: '2026-01-01', to: '2026-01-15' });
  assert.deepEqual(L.fortnightRange(2026, 1, 2), { from: '2026-01-16', to: '2026-01-31' });
  assert.deepEqual(L.fortnightRange(2026, 4, 2), { from: '2026-04-16', to: '2026-04-30' });
  assert.deepEqual(L.fortnightRange(2028, 2, 2), { from: '2028-02-16', to: '2028-02-29' });
});
test('yearRange', () => {
  assert.deepEqual(L.yearRange(2026), { from: '2026-01-01', to: '2026-12-31' });
});
test('addDays attraversa il mese', () => {
  assert.equal(L.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
});
test('formatDateIt e monthLabelIt', () => {
  assert.equal(L.formatDateIt('2026-09-24'), 'giovedì 24 settembre');
  assert.equal(L.monthLabelIt(2026, 9), 'Settembre 2026');
});
test('defaultMeal', () => {
  assert.equal(L.defaultMeal(9), 'pranzo');
  assert.equal(L.defaultMeal(15), 'pranzo');
  assert.equal(L.defaultMeal(16), 'cena');
});
test('isValidISO', () => {
  assert.equal(L.isValidISO('2026-02-29'), false);
  assert.equal(L.isValidISO('2028-02-29'), true);
  assert.equal(L.isValidISO('2026-9-4'), false);
});

// ---- modello v2: un servizio = data + pasto + menu + famiglie ----
const G = [{id:'g1',name:'Rossi',defaultPeople:4,archived:false},{id:'g2',name:'Bianchi',defaultPeople:2,archived:true},{id:'g3',name:'Verdi',defaultPeople:2,archived:false}];
const D = [{id:'d1',name:'Pizza',emoji:'🍕',color:'giallo',hidden:false,order:0},{id:'d2',name:'Carne',emoji:'🥩',color:'rosa',hidden:true,order:1}];
const E = [
  {id:'e1',date:'2026-09-01',meal:'pranzo',dishId:'d1',guests:[{guestId:'g1',people:4},{guestId:'g3',people:2}]},
  {id:'e2',date:'2026-09-15',meal:'cena',dishId:'d2',guests:[{guestId:'g2',people:2}]},
  {id:'e3',date:'2026-09-16',meal:'cena',dishId:'d1',guests:[{guestId:'g1',people:3}]},
  {id:'e4',date:'2026-10-01',meal:'pranzo',dishId:'d1',guests:[{guestId:'g1',people:5},{guestId:'g2',people:1}]},
];
test('entryPeople somma le famiglie', () => {
  assert.equal(L.entryPeople(E[0]), 6); assert.equal(L.entryPeople({guests:[]}), 0);
});
test('findService trova il servizio di un giorno e pasto', () => {
  assert.equal(L.findService(E, '2026-09-15', 'cena').id, 'e2');
  assert.equal(L.findService(E, '2026-09-15', 'pranzo'), null);
});
test('filterEntries per periodo, famiglia, pasto', () => {
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30'}).length, 3);
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-15'}).length, 2);
  assert.equal(L.filterEntries(E, {guestId:'g2'}).length, 2);
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30',meal:'cena'}).length, 2);
  assert.equal(L.filterEntries(E, {}).length, 4);
});
test('summarize conta servizi e persone, include archiviati e nascosti', () => {
  const s = L.summarize(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30'}), {guests:G,dishes:D});
  assert.equal(s.tables, 3); assert.equal(s.people, 11);
  assert.deepEqual(s.byMeal.pranzo, {tables:1,people:6});
  assert.deepEqual(s.byMeal.cena, {tables:2,people:5});
  assert.equal(s.byDish[0].name, 'Pizza'); assert.equal(s.byDish[0].people, 9); assert.equal(s.byDish[0].tables, 2);
  assert.equal(s.byDish[1].name, 'Carne'); assert.equal(s.byDish[1].hidden, true);
  assert.equal(s.byGuest[0].name, 'Rossi'); assert.equal(s.byGuest[0].people, 7); assert.equal(s.byGuest[0].tables, 2);
  assert.equal(s.byGuest[1].name, 'Bianchi'); assert.equal(s.byGuest[1].archived, true);
  assert.equal(s.byGuest[2].name, 'Verdi'); assert.equal(s.byGuest[2].people, 2);
});
test('summarize filtrato per famiglia conta solo le sue persone', () => {
  const s = L.summarize(L.filterEntries(E, {guestId:'g1'}), {guests:G,dishes:D}, {guestId:'g1'});
  assert.equal(s.tables, 3); assert.equal(s.people, 12);
  assert.equal(s.byDish[0].people, 12);
});
test('summarize senza menu', () => {
  const s = L.summarize([{id:'x',date:'2026-09-01',meal:'pranzo',dishId:null,guests:[{guestId:'g1',people:2}]}], {guests:G,dishes:D});
  assert.equal(s.byDish[0].name, 'Senza menu'); assert.equal(s.byDish[0].people, 2);
});
test('summarize con id sconosciuto non esplode', () => {
  const s = L.summarize([{id:'x',date:'2026-09-01',meal:'pranzo',dishId:'qqq',guests:[{guestId:'zzz',people:2}]}], {guests:G,dishes:D});
  assert.equal(s.byGuest[0].name, 'Ospite eliminato'); assert.equal(s.byDish[0].name, 'Menu eliminato');
});
test('summarize vuoto', () => {
  const s = L.summarize([], {guests:G,dishes:D});
  assert.equal(s.tables, 0); assert.deepEqual(s.byGuest, []); assert.deepEqual(s.byDish, []);
});
test('groupByDay decrescente, pranzo prima di cena', () => {
  const g = L.groupByDay(E);
  assert.deepEqual(g.map(x=>x.date), ['2026-10-01','2026-09-16','2026-09-15','2026-09-01']);
  const s = L.sortEntries([E[2], {id:'e5',date:'2026-09-16',meal:'pranzo',dishId:'d1',guests:[]}]);
  assert.equal(s[0].meal, 'pranzo');
});
test('guestStats', () => {
  const st = L.guestStats(E);
  assert.deepEqual(st.g1, {tables:3,people:12,lastDate:'2026-10-01'});
  assert.deepEqual(st.g3, {tables:1,people:2,lastDate:'2026-09-01'});
});

// ---- validazione, id, colori, backup ----
test('normalizeName e nameExists ignorano maiuscole e spazi', () => {
  assert.equal(L.normalizeName('  Rossi  '), 'rossi');
  assert.equal(L.nameExists(G, 'rossi '), true);
  assert.equal(L.nameExists(G, 'Rossi', 'g1'), false);
  assert.equal(L.nameExists(G, 'Neri'), false);
});
test('validateEntry', () => {
  const ok = {date:'2026-09-24',meal:'cena',dishId:'d1',guests:[{guestId:'g1',people:4}]};
  assert.deepEqual(L.validateEntry(ok, {guests:G,dishes:D}), []);
  const errs = L.validateEntry({date:'2026-02-30',meal:'brunch',dishId:'nope',guests:[]}, {guests:G,dishes:D});
  assert.equal(errs.length, 4);
  assert.deepEqual(L.validateEntry({...ok, dishId:null}, {guests:G,dishes:D}), []);
  assert.equal(L.validateEntry({...ok, guests:[{guestId:'g1',people:100}]}, {guests:G,dishes:D}).length, 1);
  assert.equal(L.validateEntry({...ok, guests:[{guestId:'g1',people:'4'}]}, {guests:G,dishes:D}).length, 1);
  assert.equal(L.validateEntry({...ok, guests:[{guestId:'nope',people:2}]}, {guests:G,dishes:D}).length, 1);
  assert.equal(L.validateEntry({...ok, guests:[{guestId:'g1',people:2},{guestId:'g1',people:3}]}, {guests:G,dishes:D}).length, 1);
});
test('canDelete', () => {
  assert.equal(L.canDeleteGuest('g1', E), false);
  assert.equal(L.canDeleteGuest('g9', E), true);
  assert.equal(L.canDeleteDish('d2', E), false);
});
test('colorForName stabile e nella palette', () => {
  assert.equal(L.colorForName('Rossi'), L.colorForName('Rossi'));
  assert.ok(L.COLORS.includes(L.colorForName('Bianchi')));
});
test('initial gestisce vuoto ed emoji', () => {
  assert.equal(L.initial('Rossi'), 'R'); assert.equal(L.initial(''), '?'); assert.equal(L.initial('🎉 Festa'), '🎉');
});
test('defaultDishes ed emptyState', () => {
  const st = L.emptyState();
  assert.equal(st.version, 2); assert.equal(st.dishes.length, 4);
  assert.deepEqual(st.dishes.map(d=>d.name), ['Pizza','Carne','Primo','Pesce']);
  assert.deepEqual(st.entries, []); assert.equal(st.lastBackupAt, null);
});
test('backup andata e ritorno', () => {
  const st = L.emptyState(); st.guests = G; st.dishes = D; st.entries = E;
  const r = L.parseBackup(L.serializeBackup(st));
  assert.equal(r.ok, true); assert.equal(r.state.entries.length, 4); assert.equal(r.state.guests[0].name, 'Rossi');
  assert.equal(r.state.entries[0].guests.length, 2);
});
test('backup corrotto o futuro', () => {
  assert.equal(L.parseBackup('{not json').ok, false);
  assert.equal(L.parseBackup('{"version":99,"guests":[],"dishes":[],"entries":[]}').ok, false);
  assert.equal(L.parseBackup('{"version":2,"guests":"x"}').ok, false);
});
test('backup normalizza people stringa e scarta righe con id inesistenti', () => {
  const txt = JSON.stringify({version:2,guests:G,dishes:D,entries:[{...E[0],guests:[{guestId:'g1',people:'4'}]},{...E[1],guests:[{guestId:'nope',people:2}]}],lastBackupAt:'x'});
  const r = L.parseBackup(txt);
  assert.equal(r.ok, true); assert.equal(r.state.entries.length, 1); assert.equal(r.state.entries[0].guests[0].people, 4);
  assert.equal(r.skipped, 1); assert.equal(r.state.lastBackupAt, null);
});
test('backup scarta famiglie senza nome e duplicate, e limita defaultPeople', () => {
  const txt = JSON.stringify({version:2,guests:[{id:'a',name:'  '},{id:'b',name:'Rossi',defaultPeople:500},{id:'c',name:'rossi '}],dishes:D,entries:[]});
  const r = L.parseBackup(txt);
  assert.equal(r.state.guests.length, 1); assert.equal(r.state.guests[0].defaultPeople, 2);
});
test('backup v1 (una riga per famiglia) viene convertito in servizi', () => {
  const v1 = {version:1,guests:G,dishes:D,entries:[
    {id:'a',date:'2026-09-01',meal:'pranzo',guestId:'g1',people:4,dishId:'d1'},
    {id:'b',date:'2026-09-01',meal:'pranzo',guestId:'g3',people:2,dishId:'d2'},
    {id:'c',date:'2026-09-01',meal:'pranzo',guestId:'g1',people:1,dishId:'d1'},
    {id:'d',date:'2026-09-02',meal:'cena',guestId:'g2',people:2,dishId:'d2'}]};
  const r = L.parseBackup(JSON.stringify(v1));
  assert.equal(r.ok, true); assert.equal(r.state.version, 2); assert.equal(r.state.entries.length, 2);
  const s = L.findService(r.state.entries, '2026-09-01', 'pranzo');
  assert.equal(s.dishId, 'd1'); assert.deepEqual(s.guests, [{guestId:'g1',people:5},{guestId:'g3',people:2}]);
});
