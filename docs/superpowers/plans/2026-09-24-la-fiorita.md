# La Fiorita 2.0 — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app a pagina singola per iPhone che registra i tavoli (data, pranzo/cena, gruppo, persone, portata) e produce rendiconti per periodo e per gruppo, in stile neo-brutalista.

**Architecture:** File statici senza build per lo sviluppo: `logic.js` (funzioni pure, testate con `node --test`), `store.js` (localStorage con fallback in memoria), `app.js` + un file per schermata (DOM). Uno script Node `build.js` produce `dist/index.html` con tutto inline per la pubblicazione come artefatto.

**Tech Stack:** HTML, CSS, JavaScript vanilla (nessuna dipendenza), Node 24 solo per test e build, Google Fonts "Space Grotesk".

**Spec:** `docs/superpowers/specs/2026-09-24-la-fiorita-design.md`

**Nota git:** il workspace non è un repository. Non ci sono step di commit. Al posto del commit, ogni task termina con "Verifica: `node --test tests/`" e, per le schermate, con la checklist manuale.

## Global Constraints

- Nessuna dipendenza npm a runtime; `package.json` serve solo a `node --test`.
- `logic.js` non tocca il DOM e si carica sia in browser (globale `LaFioritaLogic`) sia in Node (`module.exports`).
- Chiave di storage: `lafiorita.v1`; oggetto `{ version: 1, guests, dishes, entries, lastBackupAt }`.
- Date sempre stringhe `"YYYY-MM-DD"`; pasto sempre `"pranzo"` o `"cena"`.
- Persone: intero, min 1, max 99.
- Palette token: rosa `#F2547D`, verde `#7BC043`, giallo `#F5C842`, viola `#6C4BE0`, azzurro `#4FB3E8`, arancio `#F58A3C`, grigio `#B8B8B8`; sfondo `#FAF7F2`; nero `#111`.
- Bordi 3px, raggio 14px, ombra `4px 4px 0 #111`, bottoni min 52px, tocco ≥ 44px, testo base 17px, larghezza max 480px.
- Tutta l'interfaccia in italiano. Tema chiaro fisso.
- Ogni accesso a `localStorage` in try/catch.

## Review Focus

1. Fine mese con 31 giorni e febbraio bisestile in `fortnightRange` e `monthRange`: il chip "16–fine" deve arrivare al 29/30/31 giusto. → test in Task 1.
2. Registrazione che punta a un gruppo archiviato o a una portata nascosta: deve comparire nel rendiconto e nell'elenco del giorno con il nome corretto, non "undefined". → test `summarize` in Task 2.
3. Backup con `entries` che citano id inesistenti, o con `people` come stringa `"4"`: `parseBackup` deve rifiutare o normalizzare, mai far esplodere il rendering. → test in Task 3.
4. `localStorage` che lancia (Safari in navigazione privata, quota piena): l'app deve restare usabile in memoria e mostrare l'avviso. → test in Task 4.
5. Nome gruppo con spazi e maiuscole diverse ("Rossi " vs "rossi"): deve essere rifiutato come duplicato. → test in Task 3.

---

## File

```
Nuovi_Progetti/La_Fiorita_2.0/
├── package.json            # { "scripts": { "test": "node --test tests/" } }
├── index.html              # markup delle 5 schermate, fogli, toast
├── style.css               # token, componenti, layout
├── logic.js                # funzioni pure (UMD)
├── store.js                # persistenza + stato iniziale
├── app.js                  # stato globale, router tab, helper DOM (sheet, toast, picker gruppo)
├── screen-segna.js         # tab Segna
├── screen-gruppi.js        # tab Gruppi
├── screen-portate.js       # tab Portate
├── screen-rendiconto.js    # tab Rendiconto
├── screen-impostazioni.js  # tab Impostazioni
├── icon.svg                # icona home
├── build.js                # genera dist/index.html
├── dist/index.html         # output
├── tests/logic.test.js
├── tests/store.test.js
└── docs/checklist-manuale.md
```

Ordine di caricamento in `index.html`: `logic.js`, `store.js`, `app.js`, poi le 5 schermate. Ogni schermata registra `App.screens.<nome> = { render() }`.

---

### Task 1: Scaffold e funzioni di periodo in `logic.js`

**Files:**
- Create: `package.json`, `logic.js`, `tests/logic.test.js`

**Interfaces:**
- Produces: `todayISO(d?: Date) → "YYYY-MM-DD"`, `addDays(iso, n) → iso`, `monthRange(year, month1to12) → {from,to}`, `yearRange(year)`, `fortnightRange(year, month, half: 1|2)`, `formatDateIt(iso) → "giovedì 24 settembre"`, `monthLabelIt(year, month) → "Settembre 2026"`, `defaultMeal(hour) → "pranzo"|"cena"`, `isValidISO(s) → bool`.

- [ ] **Step 1: package.json**

```json
{ "name": "la-fiorita-2", "private": true, "scripts": { "test": "node --test tests/" } }
```

- [ ] **Step 2: Test che fallisce**

```js
// tests/logic.test.js
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
```

- [ ] **Step 3: Esegui: `node --test tests/` → FAIL (modulo mancante)**

- [ ] **Step 4: Implementazione**

```js
// logic.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LaFioritaLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GIORNI = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const pad = n => String(n).padStart(2, '0');
  function todayISO(d) { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function parseISO(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
  function isValidISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y,m,d] = s.split('-').map(Number); const dt = new Date(y, m-1, d);
    return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d;
  }
  function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate()+n); return todayISO(d); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function monthRange(y, m) { return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y,m))}` }; }
  function yearRange(y) { return { from: `${y}-01-01`, to: `${y}-12-31` }; }
  function fortnightRange(y, m, half) {
    return half === 1 ? { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-15` }
                      : { from: `${y}-${pad(m)}-16`, to: `${y}-${pad(m)}-${pad(daysInMonth(y,m))}` };
  }
  function formatDateIt(iso) { const d = parseISO(iso); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; }
  function monthLabelIt(y, m) { const n = MESI[m-1]; return `${n[0].toUpperCase()}${n.slice(1)} ${y}`; }
  function defaultMeal(hour) { return hour < 16 ? 'pranzo' : 'cena'; }
  return { todayISO, parseISO, isValidISO, addDays, daysInMonth, monthRange, yearRange, fortnightRange, formatDateIt, monthLabelIt, defaultMeal, MESI, GIORNI };
});
```

- [ ] **Step 5: `node --test tests/` → tutti PASS**

---

### Task 2: Filtri e aggregazioni in `logic.js`

**Files:**
- Modify: `logic.js` (aggiungi funzioni e voci al `return`)
- Modify: `tests/logic.test.js`

**Interfaces:**
- Consumes: `Entry`, `Guest`, `Dish` come da spec §3.
- Produces: `filterEntries(entries, {from, to, guestId, meal})`, `summarize(entries, {guests, dishes})` → `{ tables, people, byMeal: {pranzo:{tables,people}, cena:{...}}, byDish: [{id,name,emoji,color,hidden,tables,people}], byGuest: [{id,name,archived,tables,people}] }`, `groupByDay(entries)` → `[{date, entries}]` decrescente, `guestStats(entries)` → `{ [guestId]: {tables, people, lastDate} }`, `sortEntries(entries)`.

- [ ] **Step 1: Test che fallisce**

```js
const G = [{id:'g1',name:'Rossi',defaultPeople:4,archived:false},{id:'g2',name:'Bianchi',defaultPeople:2,archived:true}];
const D = [{id:'d1',name:'Pizza',emoji:'🍕',color:'giallo',hidden:false,order:0},{id:'d2',name:'Carne',emoji:'🥩',color:'rosa',hidden:true,order:1}];
const E = [
  {id:'e1',date:'2026-09-01',meal:'pranzo',guestId:'g1',people:4,dishId:'d1'},
  {id:'e2',date:'2026-09-15',meal:'cena',guestId:'g2',people:2,dishId:'d2'},
  {id:'e3',date:'2026-09-16',meal:'cena',guestId:'g1',people:3,dishId:'d1'},
  {id:'e4',date:'2026-10-01',meal:'pranzo',guestId:'g1',people:5,dishId:'d1'},
];
test('filterEntries per periodo, gruppo, pasto', () => {
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30'}).length, 3);
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-15'}).length, 2);
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30',guestId:'g2'}).length, 1);
  assert.equal(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30',meal:'cena'}).length, 2);
  assert.equal(L.filterEntries(E, {}).length, 4);
});
test('summarize conta tavoli e persone, include archiviati e nascosti', () => {
  const s = L.summarize(L.filterEntries(E, {from:'2026-09-01',to:'2026-09-30'}), {guests:G,dishes:D});
  assert.equal(s.tables, 3); assert.equal(s.people, 9);
  assert.deepEqual(s.byMeal.pranzo, {tables:1,people:4});
  assert.deepEqual(s.byMeal.cena, {tables:2,people:5});
  assert.equal(s.byDish[0].name, 'Pizza'); assert.equal(s.byDish[0].people, 7);
  assert.equal(s.byDish[1].name, 'Carne'); assert.equal(s.byDish[1].hidden, true);
  assert.equal(s.byGuest[0].name, 'Rossi'); assert.equal(s.byGuest[0].people, 7); assert.equal(s.byGuest[0].tables, 2);
  assert.equal(s.byGuest[1].name, 'Bianchi'); assert.equal(s.byGuest[1].archived, true);
});
test('summarize con id sconosciuto non esplode', () => {
  const s = L.summarize([{id:'x',date:'2026-09-01',meal:'pranzo',guestId:'zzz',people:2,dishId:'qqq'}], {guests:G,dishes:D});
  assert.equal(s.byGuest[0].name, 'Gruppo eliminato'); assert.equal(s.byDish[0].name, 'Portata eliminata');
});
test('summarize vuoto', () => {
  const s = L.summarize([], {guests:G,dishes:D});
  assert.equal(s.tables, 0); assert.deepEqual(s.byGuest, []); assert.deepEqual(s.byDish, []);
});
test('groupByDay decrescente, pranzo prima di cena', () => {
  const g = L.groupByDay(E);
  assert.deepEqual(g.map(x=>x.date), ['2026-10-01','2026-09-16','2026-09-15','2026-09-01']);
  const s = L.sortEntries([E[2], {id:'e5',date:'2026-09-16',meal:'pranzo',guestId:'g1',people:1,dishId:'d1'}]);
  assert.equal(s[0].meal, 'pranzo');
});
test('guestStats', () => {
  const st = L.guestStats(E);
  assert.deepEqual(st.g1, {tables:3,people:12,lastDate:'2026-10-01'});
});
```

- [ ] **Step 2: `node --test tests/` → FAIL (funzioni mancanti)**

- [ ] **Step 3: Implementazione (dentro la factory, prima del `return`)**

```js
  function filterEntries(entries, f) {
    f = f || {};
    return entries.filter(e =>
      (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) &&
      (!f.guestId || e.guestId === f.guestId) && (!f.meal || e.meal === f.meal));
  }
  function sortEntries(entries) {
    const mealOrder = { pranzo: 0, cena: 1 };
    return entries.slice().sort((a, b) =>
      b.date.localeCompare(a.date) || mealOrder[a.meal] - mealOrder[b.meal] || (a.createdAt || 0) - (b.createdAt || 0));
  }
  function groupByDay(entries) {
    const map = new Map();
    for (const e of sortEntries(entries)) { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e); }
    return Array.from(map, ([date, list]) => ({ date, entries: list }));
  }
  function summarize(entries, ctx) {
    const gById = new Map(ctx.guests.map(g => [g.id, g]));
    const dById = new Map(ctx.dishes.map(d => [d.id, d]));
    const s = { tables: 0, people: 0, byMeal: { pranzo: {tables:0,people:0}, cena: {tables:0,people:0} }, byDish: [], byGuest: [] };
    const dish = new Map(), guest = new Map();
    for (const e of entries) {
      const p = Number(e.people) || 0;
      s.tables++; s.people += p;
      const m = s.byMeal[e.meal] || (s.byMeal[e.meal] = {tables:0,people:0}); m.tables++; m.people += p;
      if (!dish.has(e.dishId)) { const d = dById.get(e.dishId); dish.set(e.dishId, { id: e.dishId, name: d ? d.name : 'Portata eliminata', emoji: d ? d.emoji : '❔', color: d ? d.color : 'grigio', hidden: d ? !!d.hidden : true, order: d ? d.order : 999, tables: 0, people: 0 }); }
      const dd = dish.get(e.dishId); dd.tables++; dd.people += p;
      if (!guest.has(e.guestId)) { const g = gById.get(e.guestId); guest.set(e.guestId, { id: e.guestId, name: g ? g.name : 'Gruppo eliminato', archived: g ? !!g.archived : true, tables: 0, people: 0 }); }
      const gg = guest.get(e.guestId); gg.tables++; gg.people += p;
    }
    s.byDish = Array.from(dish.values()).sort((a, b) => b.people - a.people || b.tables - a.tables || a.order - b.order);
    s.byGuest = Array.from(guest.values()).sort((a, b) => b.people - a.people || b.tables - a.tables || a.name.localeCompare(b.name));
    return s;
  }
  function guestStats(entries) {
    const out = {};
    for (const e of entries) {
      const o = out[e.guestId] || (out[e.guestId] = { tables: 0, people: 0, lastDate: null });
      o.tables++; o.people += Number(e.people) || 0;
      if (!o.lastDate || e.date > o.lastDate) o.lastDate = e.date;
    }
    return out;
  }
```

Aggiungi al `return`: `filterEntries, sortEntries, groupByDay, summarize, guestStats`.

- [ ] **Step 4: `node --test tests/` → PASS**

---

### Task 3: Validazione, id, colori, backup in `logic.js`

**Files:**
- Modify: `logic.js`, `tests/logic.test.js`

**Interfaces:**
- Produces: `newId()`, `normalizeName(s)`, `nameExists(list, name, excludeId?)`, `validateEntry(entry, {guests, dishes}) → string[]`, `canDeleteGuest(id, entries)`, `canDeleteDish(id, entries)`, `colorForName(name) → token`, `defaultDishes() → Dish[]`, `emptyState()`, `serializeBackup(state) → string`, `parseBackup(text) → {ok:true,state} | {ok:false,error}`, `COLORS` (array di token), `EMOJI_CIBO` (array), `PEOPLE_MAX = 99`.

- [ ] **Step 1: Test che fallisce**

```js
test('normalizeName e nameExists ignorano maiuscole e spazi', () => {
  assert.equal(L.normalizeName('  Rossi  '), 'rossi');
  assert.equal(L.nameExists(G, 'rossi '), true);
  assert.equal(L.nameExists(G, 'Rossi', 'g1'), false);
  assert.equal(L.nameExists(G, 'Verdi'), false);
});
test('validateEntry', () => {
  const ok = {date:'2026-09-24',meal:'cena',guestId:'g1',people:4,dishId:'d1'};
  assert.deepEqual(L.validateEntry(ok, {guests:G,dishes:D}), []);
  const errs = L.validateEntry({date:'2026-02-30',meal:'brunch',guestId:'nope',people:0,dishId:'nope'}, {guests:G,dishes:D});
  assert.equal(errs.length, 5);
  assert.equal(L.validateEntry({...ok, people:100}, {guests:G,dishes:D}).length, 1);
  assert.equal(L.validateEntry({...ok, people:'4'}, {guests:G,dishes:D}).length, 1);
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
test('defaultDishes ed emptyState', () => {
  const st = L.emptyState();
  assert.equal(st.version, 1); assert.equal(st.dishes.length, 4);
  assert.deepEqual(st.dishes.map(d=>d.name), ['Pizza','Carne','Primo','Pesce']);
  assert.deepEqual(st.entries, []); assert.equal(st.lastBackupAt, null);
});
test('backup andata e ritorno', () => {
  const st = L.emptyState(); st.guests = G; st.entries = E;
  const r = L.parseBackup(L.serializeBackup(st));
  assert.equal(r.ok, true); assert.equal(r.state.entries.length, 4); assert.equal(r.state.guests[0].name, 'Rossi');
});
test('backup corrotto o futuro', () => {
  assert.equal(L.parseBackup('{not json').ok, false);
  assert.equal(L.parseBackup('{"version":99,"guests":[],"dishes":[],"entries":[]}').ok, false);
  assert.equal(L.parseBackup('{"version":1,"guests":"x"}').ok, false);
});
test('backup normalizza people stringa e scarta righe con id inesistenti', () => {
  const txt = JSON.stringify({version:1,guests:G,dishes:D,entries:[{...E[0],people:'4'},{...E[1],guestId:'nope'}],lastBackupAt:null});
  const r = L.parseBackup(txt);
  assert.equal(r.ok, true); assert.equal(r.state.entries.length, 1); assert.equal(r.state.entries[0].people, 4);
  assert.equal(r.skipped, 1);
});
```

- [ ] **Step 2: `node --test tests/` → FAIL**

- [ ] **Step 3: Implementazione**

```js
  const PEOPLE_MAX = 99;
  const COLORS = ['rosa','verde','giallo','viola','azzurro','arancio'];
  const EMOJI_CIBO = ['🍕','🥩','🍝','🐟','🍗','🥗','🍔','🌭','🍟','🍤','🦐','🦑','🐙','🥓','🍖','🌮','🌯','🥪','🍞','🧀','🥚','🍳','🥘','🍲','🍛','🍜','🍣','🍱','🥟','🍚','🍰','🎂','🍨','🍦','🍩','🍪','🍷','🍺','☕','🥂'];
  function newId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function normalizeName(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function nameExists(list, name, excludeId) {
    const n = normalizeName(name);
    return list.some(x => x.id !== excludeId && normalizeName(x.name) === n);
  }
  function validateEntry(e, ctx) {
    const errs = [];
    if (!isValidISO(e.date)) errs.push('Data non valida');
    if (e.meal !== 'pranzo' && e.meal !== 'cena') errs.push('Scegli pranzo o cena');
    if (!ctx.guests.some(g => g.id === e.guestId)) errs.push('Scegli un gruppo');
    if (!Number.isInteger(e.people) || e.people < 1 || e.people > PEOPLE_MAX) errs.push(`Persone: da 1 a ${PEOPLE_MAX}`);
    if (!ctx.dishes.some(d => d.id === e.dishId)) errs.push('Scegli una portata');
    return errs;
  }
  function canDeleteGuest(id, entries) { return !entries.some(e => e.guestId === id); }
  function canDeleteDish(id, entries) { return !entries.some(e => e.dishId === id); }
  function colorForName(name) {
    let h = 0; for (const ch of normalizeName(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }
  function defaultDishes() {
    return [['Pizza','🍕','giallo'],['Carne','🥩','rosa'],['Primo','🍝','verde'],['Pesce','🐟','azzurro']]
      .map(([name, emoji, color], i) => ({ id: newId(), name, emoji, color, hidden: false, order: i }));
  }
  function emptyState() { return { version: 1, guests: [], dishes: defaultDishes(), entries: [], lastBackupAt: null }; }
  function serializeBackup(state) {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), guests: state.guests, dishes: state.dishes, entries: state.entries, lastBackupAt: state.lastBackupAt || null }, null, 1);
  }
  function parseBackup(text) {
    let raw; try { raw = JSON.parse(text); } catch (_) { return { ok: false, error: 'Il file non è un backup valido' }; }
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Il file non è un backup valido' };
    if (raw.version !== 1) return { ok: false, error: 'Versione del backup non supportata' };
    if (!Array.isArray(raw.guests) || !Array.isArray(raw.dishes) || !Array.isArray(raw.entries)) return { ok: false, error: 'Il backup è incompleto' };
    const guests = raw.guests.filter(g => g && typeof g.id === 'string' && typeof g.name === 'string')
      .map(g => ({ id: g.id, name: g.name.trim(), defaultPeople: Number.isInteger(g.defaultPeople) && g.defaultPeople >= 1 ? g.defaultPeople : 2, createdAt: g.createdAt || 0, archived: !!g.archived }));
    const dishes = raw.dishes.filter(d => d && typeof d.id === 'string' && typeof d.name === 'string')
      .map((d, i) => ({ id: d.id, name: d.name.trim(), emoji: d.emoji || '🍽️', color: COLORS.includes(d.color) ? d.color : 'grigio', hidden: !!d.hidden, order: Number.isInteger(d.order) ? d.order : i }));
    const ctx = { guests, dishes };
    let skipped = 0; const entries = [];
    for (const e of raw.entries) {
      if (!e || typeof e !== 'object') { skipped++; continue; }
      const n = { id: typeof e.id === 'string' ? e.id : newId(), date: e.date, meal: e.meal, guestId: e.guestId, people: Number.isInteger(e.people) ? e.people : parseInt(e.people, 10), dishId: e.dishId, createdAt: e.createdAt || 0, updatedAt: e.updatedAt || 0 };
      if (validateEntry(n, ctx).length) { skipped++; continue; }
      entries.push(n);
    }
    return { ok: true, skipped, state: { version: 1, guests, dishes, entries, lastBackupAt: raw.lastBackupAt || null } };
  }
```

Aggiungi al `return`: `PEOPLE_MAX, COLORS, EMOJI_CIBO, newId, normalizeName, nameExists, validateEntry, canDeleteGuest, canDeleteDish, colorForName, defaultDishes, emptyState, serializeBackup, parseBackup`.

- [ ] **Step 4: `node --test tests/` → PASS**

---

### Task 4: `store.js` — persistenza con fallback in memoria

**Files:**
- Create: `store.js`, `tests/store.test.js`

**Interfaces:**
- Consumes: `LaFioritaLogic.emptyState`, `parseBackup`.
- Produces: `createStore(storage, logic)` → `{ state, load(), save(), replace(newState), storageOk }`. `storage` è un oggetto con `getItem/setItem` (in browser `window.localStorage`, nei test un finto). UMD come `logic.js`, globale `LaFioritaStore`.

- [ ] **Step 1: Test che fallisce**

```js
// tests/store.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');
const { createStore, KEY } = require('../store.js');

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
test('dati salvati corrotti: riparte da vuoto senza esplodere', () => {
  const s = createStore(fakeStorage({ [KEY]: '{oops' }), L); s.load();
  assert.equal(s.state.entries.length, 0); assert.equal(s.state.dishes.length, 4);
});
test('replace sostituisce e salva', () => {
  const st = fakeStorage(); const s = createStore(st, L); s.load();
  const ns = L.emptyState(); ns.guests = [{ id: 'g1', name: 'Verdi', defaultPeople: 2, createdAt: 1, archived: false }];
  s.replace(ns); assert.equal(s.state.guests[0].name, 'Verdi'); assert.ok(st._m.get(KEY).includes('Verdi'));
});
```

- [ ] **Step 2: `node --test tests/` → FAIL**

- [ ] **Step 3: Implementazione**

```js
// store.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LaFioritaStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'lafiorita.v1';
  function createStore(storage, logic) {
    const store = { state: logic.emptyState(), storageOk: true };
    store.load = function () {
      let text = null;
      try { text = storage.getItem(KEY); } catch (_) { store.storageOk = false; return store; }
      if (text) {
        const r = logic.parseBackup(text);
        store.state = r.ok ? r.state : logic.emptyState();
      } else {
        store.state = logic.emptyState();
      }
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
  return { createStore, KEY };
});
```

- [ ] **Step 4: `node --test tests/` → PASS**

---

### Task 5: Guscio dell'app — `index.html`, `style.css`, `app.js`

**Files:**
- Create: `index.html`, `style.css`, `app.js`, `icon.svg`, `docs/checklist-manuale.md`

**Interfaces:**
- Produces (globale `App`): `App.store`, `App.L` (logic), `App.state` (getter su `store.state`), `App.ui = { tab: 'segna', date, meal, ... }`, `App.go(tab)`, `App.render()`, `App.save()` (salva e ri-renderizza), `App.toast(msg)`, `App.sheet({ title, html, onMount })` + `App.closeSheet()`, `App.confirm(msg) → Promise<bool>`, `App.pickGuest({ allowAll, onPick })`, `App.iconBox(emoji, color, cls)` → html string, `App.esc(s)` (escape HTML), `App.screens = {}`.
- Ogni schermata (task 6–10) definisce `App.screens.<tab> = { render(root) }` con `root` il `<section>` del tab.

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>La Fiorita 2.0</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="La Fiorita">
<meta name="theme-color" content="#FAF7F2">
<link rel="apple-touch-icon" href="icon.svg">
<link rel="icon" href="icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
  <div id="storage-warning" class="banner banner-rosso" hidden>⚠️ Memoria del telefono non disponibile: i dati non verranno salvati.</div>
  <main id="screens">
    <section id="tab-segna" class="screen"></section>
    <section id="tab-gruppi" class="screen" hidden></section>
    <section id="tab-portate" class="screen" hidden></section>
    <section id="tab-rendiconto" class="screen" hidden></section>
    <section id="tab-impostazioni" class="screen" hidden></section>
  </main>
  <nav id="tabbar">
    <button data-tab="segna" class="tab tab-rosa"><span class="tab-ico">✏️</span>Segna</button>
    <button data-tab="gruppi" class="tab tab-viola"><span class="tab-ico">👨‍👩‍👧</span>Gruppi</button>
    <button data-tab="portate" class="tab tab-giallo"><span class="tab-ico">🍽️</span>Portate</button>
    <button data-tab="rendiconto" class="tab tab-verde"><span class="tab-ico">📊</span>Conti</button>
    <button data-tab="impostazioni" class="tab tab-azzurro"><span class="tab-ico">⚙️</span>Altro</button>
  </nav>
</div>
<div id="sheet-backdrop" hidden><div id="sheet" role="dialog"><div id="sheet-head"><h2 id="sheet-title"></h2><button id="sheet-close" class="btn btn-sq" aria-label="Chiudi">✕</button></div><div id="sheet-body"></div></div></div>
<div id="toast" hidden></div>
<script src="logic.js"></script>
<script src="store.js"></script>
<script src="app.js"></script>
<script src="screen-segna.js"></script>
<script src="screen-gruppi.js"></script>
<script src="screen-portate.js"></script>
<script src="screen-rendiconto.js"></script>
<script src="screen-impostazioni.js"></script>
<script>App.start();</script>
</body>
</html>
```

- [ ] **Step 2: `icon.svg`** (fiore stilizzato: cerchio giallo con 6 petali rosa su fondo crema, bordo nero 3)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" rx="40" fill="#FAF7F2"/><g stroke="#111" stroke-width="6"><circle cx="90" cy="50" r="22" fill="#F2547D"/><circle cx="125" cy="70" r="22" fill="#F2547D"/><circle cx="125" cy="110" r="22" fill="#F2547D"/><circle cx="90" cy="130" r="22" fill="#F2547D"/><circle cx="55" cy="110" r="22" fill="#F2547D"/><circle cx="55" cy="70" r="22" fill="#F2547D"/><circle cx="90" cy="90" r="26" fill="#F5C842"/></g></svg>
```

- [ ] **Step 3: `style.css`** — token e componenti

```css
:root{--bg:#FAF7F2;--ink:#111;--rosa:#F2547D;--verde:#7BC043;--giallo:#F5C842;--viola:#6C4BE0;--azzurro:#4FB3E8;--arancio:#F58A3C;--grigio:#B8B8B8;--bianco:#fff;--r:14px;--bw:3px;--sh:4px 4px 0 var(--ink);--font:'Space Grotesk',-apple-system,system-ui,sans-serif;--tabh:76px}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--ink);font:500 17px/1.3 var(--font);-webkit-text-size-adjust:100%}
body{background:var(--bg)}
#app{max-width:480px;margin:0 auto;min-height:100vh;padding:calc(env(safe-area-inset-top) + 12px) 16px calc(var(--tabh) + env(safe-area-inset-bottom) + 16px)}
h1{font-size:32px;line-height:1.05;margin:4px 0 2px;font-weight:700}
h2{font-size:22px;margin:0;font-weight:700}
h3{font-size:15px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.04em}
.sub{color:#555;margin:0 0 14px}
.card{background:var(--bianco);border:var(--bw) solid var(--ink);border-radius:var(--r);box-shadow:var(--sh);padding:14px}
.btn{font:700 17px var(--font);color:var(--ink);background:var(--bianco);border:var(--bw) solid var(--ink);border-radius:var(--r);box-shadow:var(--sh);min-height:52px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;transition:transform .05s,box-shadow .05s}
.btn:active,.tab:active,.dish:active,.chip:active{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
.btn:disabled{opacity:.45;box-shadow:var(--sh);transform:none}
.btn-block{width:100%;font-size:20px;min-height:60px}
.btn-sq{width:52px;padding:0;font-size:24px}
.btn-big{min-height:64px;font-size:34px;width:64px;padding:0}
.bg-rosa{background:var(--rosa)}.bg-verde{background:var(--verde)}.bg-giallo{background:var(--giallo)}.bg-viola{background:var(--viola);color:#fff}.bg-azzurro{background:var(--azzurro)}.bg-arancio{background:var(--arancio)}.bg-grigio{background:var(--grigio)}
.row{display:flex;gap:10px;align-items:center}.row>*{flex:1}.row>.fix{flex:0 0 auto}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.chip{font:700 15px var(--font);background:var(--bianco);border:var(--bw) solid var(--ink);border-radius:999px;padding:8px 14px;min-height:44px;box-shadow:3px 3px 0 var(--ink);cursor:pointer}
.chip.on{background:var(--ink);color:#fff}
.seg{display:flex;border:var(--bw) solid var(--ink);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh);background:#fff}
.seg button{flex:1;font:700 17px var(--font);background:#fff;border:0;min-height:52px;cursor:pointer;color:var(--ink)}
.seg button+button{border-left:var(--bw) solid var(--ink)}
.seg button.on{background:var(--ink);color:#fff}
.ico{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border:var(--bw) solid var(--ink);border-radius:12px;font-size:26px;flex:0 0 auto;background:#fff}
.ico.sm{width:36px;height:36px;font-size:20px;border-radius:9px;border-width:2px}
.dish{display:flex;align-items:center;gap:10px;background:#fff;border:var(--bw) solid var(--ink);border-radius:var(--r);box-shadow:var(--sh);padding:10px;min-height:68px;font:700 17px var(--font);cursor:pointer;text-align:left;color:var(--ink)}
.dish.on{outline:var(--bw) solid var(--ink);outline-offset:2px}
input[type=text],input[type=date],input[type=number],input[type=search]{font:500 17px var(--font);color:var(--ink);background:#fff;border:var(--bw) solid var(--ink);border-radius:var(--r);min-height:52px;padding:0 14px;width:100%;box-shadow:var(--sh);-webkit-appearance:none;appearance:none}
input[type=date]{min-width:0}
.counter{display:flex;align-items:center;gap:12px;justify-content:center}
.counter .num{font-size:44px;font-weight:700;min-width:70px;text-align:center}
.list{display:flex;flex-direction:column;gap:10px}
.item{display:flex;align-items:center;gap:12px;background:#fff;border:var(--bw) solid var(--ink);border-radius:var(--r);box-shadow:var(--sh);padding:10px 12px;min-height:60px;cursor:pointer}
.item .grow{flex:1;min-width:0}.item .name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.item .meta{color:#555;font-size:14px}
.item .n{font-size:22px;font-weight:700}
.folder{position:relative;background:#fff;border:var(--bw) solid var(--ink);border-radius:var(--r);box-shadow:var(--sh);padding:14px;margin-top:14px;cursor:pointer;min-height:120px}
.folder::before{content:"";position:absolute;left:-3px;top:-14px;width:45%;height:22px;border:var(--bw) solid var(--ink);border-bottom:0;border-radius:12px 12px 0 0;background:var(--tab,#B8B8B8)}
.folder .name{font-weight:700;font-size:18px;margin-top:10px}.folder .meta{color:#555;font-size:14px}
.stat{background:#fff;border:var(--bw) solid var(--ink);border-radius:var(--r);box-shadow:var(--sh);padding:12px 14px}
.stat .lbl{font-size:14px;color:#555;font-weight:700;text-transform:uppercase}.stat .val{font-size:40px;font-weight:700;line-height:1.1}
.bar{height:12px;border:2px solid var(--ink);border-radius:999px;overflow:hidden;background:#fff;margin-top:6px}.bar>i{display:block;height:100%}
.banner{border:var(--bw) solid var(--ink);border-radius:var(--r);padding:10px 12px;margin-bottom:12px;font-weight:700}
.banner-rosso{background:#ffb3c1}.banner-giallo{background:var(--giallo)}
.empty{text-align:center;padding:30px 10px;color:#555}.empty .big{font-size:48px}
#tabbar{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:480px;display:flex;gap:6px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:var(--bg);border-top:var(--bw) solid var(--ink);z-index:5}
.tab{flex:1;font:700 12px var(--font);color:var(--ink);background:#fff;border:var(--bw) solid var(--ink);border-radius:12px;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;box-shadow:3px 3px 0 var(--ink)}
.tab-ico{font-size:22px}
.tab.on.tab-rosa{background:var(--rosa)}.tab.on.tab-viola{background:var(--viola);color:#fff}.tab.on.tab-giallo{background:var(--giallo)}.tab.on.tab-verde{background:var(--verde)}.tab.on.tab-azzurro{background:var(--azzurro)}
#sheet-backdrop{position:fixed;inset:0;background:rgba(17,17,17,.5);z-index:20;display:flex;align-items:flex-end;justify-content:center}
#sheet{width:100%;max-width:480px;max-height:88vh;overflow:auto;background:var(--bg);border:var(--bw) solid var(--ink);border-bottom:0;border-radius:22px 22px 0 0;padding:14px 16px calc(20px + env(safe-area-inset-bottom))}
#sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
#toast{position:fixed;left:50%;bottom:calc(var(--tabh) + 24px + env(safe-area-inset-bottom));transform:translateX(-50%);background:var(--ink);color:#fff;font-weight:700;padding:12px 20px;border-radius:999px;z-index:30;border:var(--bw) solid #fff;box-shadow:var(--sh)}
.field{margin:12px 0}.field label{display:block;font-weight:700;font-size:14px;margin-bottom:6px;text-transform:uppercase}
.emoji-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.emoji-grid button{font-size:26px;min-height:48px;background:#fff;border:2px solid var(--ink);border-radius:10px;cursor:pointer}.emoji-grid button.on{background:var(--ink)}
.color-row{display:flex;gap:10px}.color-row button{flex:1;min-height:44px;border:var(--bw) solid var(--ink);border-radius:10px;cursor:pointer}.color-row button.on{outline:var(--bw) solid var(--ink);outline-offset:2px}
.danger{border-color:#b00020;color:#b00020}
.mt{margin-top:12px}.mb{margin-bottom:12px}.center{text-align:center}.muted{color:#555;font-size:14px}
```

- [ ] **Step 4: `app.js`**

```js
window.App = (function () {
  const L = window.LaFioritaLogic;
  let storage = null; try { storage = window.localStorage; } catch (_) { storage = null; }
  const store = window.LaFioritaStore.createStore(storage || { getItem() { throw new Error('no storage'); }, setItem() { throw new Error('no storage'); } }, L);
  const now = new Date();
  const App = {
    L, store, screens: {},
    get state() { return store.state; },
    ui: { tab: 'segna', date: L.todayISO(now), meal: L.defaultMeal(now.getHours()), guestId: null, people: 2, dishId: null, editingId: null,
          report: { mode: 'mese', year: now.getFullYear(), month: now.getMonth() + 1, from: null, to: null, guestId: null, meal: null, showAllGuests: false },
          showArchived: false },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    iconBox(emoji, color, cls) { return `<span class="ico bg-${color || 'grigio'} ${cls || ''}">${emoji}</span>`; },
    guestName(id) { const g = store.state.guests.find(x => x.id === id); return g ? g.name : 'Gruppo eliminato'; },
    dish(id) { return store.state.dishes.find(x => x.id === id) || { name: 'Portata eliminata', emoji: '❔', color: 'grigio' }; },
    start() {
      store.load();
      document.getElementById('storage-warning').hidden = store.storageOk;
      document.getElementById('tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) App.go(b.dataset.tab); });
      document.getElementById('sheet-close').addEventListener('click', App.closeSheet);
      document.getElementById('sheet-backdrop').addEventListener('click', e => { if (e.target.id === 'sheet-backdrop') App.closeSheet(); });
      App.render();
    },
    go(tab) { App.ui.tab = tab; App.render(); window.scrollTo(0, 0); },
    render() {
      document.querySelectorAll('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === App.ui.tab));
      document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'tab-' + App.ui.tab; });
      const scr = App.screens[App.ui.tab]; const root = document.getElementById('tab-' + App.ui.tab);
      if (scr) scr.render(root);
    },
    save() { const ok = store.save(); document.getElementById('storage-warning').hidden = ok; App.render(); return ok; },
    toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 1800); },
    sheet({ title, html, onMount }) {
      document.getElementById('sheet-title').textContent = title || '';
      const body = document.getElementById('sheet-body'); body.innerHTML = html;
      document.getElementById('sheet-backdrop').hidden = false; document.body.style.overflow = 'hidden';
      if (onMount) onMount(body);
    },
    closeSheet() { document.getElementById('sheet-backdrop').hidden = true; document.body.style.overflow = ''; },
    confirm(msg) { return Promise.resolve(window.confirm(msg)); },
    pickGuest({ allowAll, onPick }) {
      const draw = (q) => {
        const n = L.normalizeName(q);
        const list = store.state.guests.filter(g => !g.archived && (!n || L.normalizeName(g.name).includes(n))).sort((a, b) => a.name.localeCompare(b.name));
        return (allowAll ? `<button class="item" data-pick=""><span class="ico bg-grigio">👥</span><div class="grow"><div class="name">Tutti i gruppi</div></div></button>` : '') +
          (list.length ? list.map(g => `<button class="item" data-pick="${g.id}">${App.iconBox(App.esc(g.name[0].toUpperCase()), L.colorForName(g.name))}<div class="grow"><div class="name">${App.esc(g.name)}</div><div class="meta">di solito ${g.defaultPeople} persone</div></div></button>`).join('')
            : `<div class="empty">Nessun gruppo trovato</div>`);
      };
      App.sheet({ title: 'Scegli il gruppo', html: `<input type="search" id="pg-q" placeholder="Cerca…" autocomplete="off"><button class="btn btn-block bg-verde mt" id="pg-new">＋ Nuovo gruppo</button><div class="list mt" id="pg-list">${draw('')}</div>`,
        onMount(body) {
          const q = body.querySelector('#pg-q'), list = body.querySelector('#pg-list');
          q.addEventListener('input', () => { list.innerHTML = draw(q.value); });
          list.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; App.closeSheet(); onPick(b.dataset.pick || null); });
          body.querySelector('#pg-new').addEventListener('click', () => App.editGuestSheet(null, g => onPick(g.id), q.value));
        } });
    },
    editGuestSheet(guest, done, presetName) {
      const isNew = !guest;
      App.sheet({ title: isNew ? 'Nuovo gruppo' : 'Modifica gruppo',
        html: `<div class="field"><label>Nome (es. Famiglia Rossi)</label><input type="text" id="eg-name" value="${App.esc(guest ? guest.name : (presetName || ''))}" autocomplete="off"></div>
               <div class="field"><label>Persone di solito</label><div class="counter"><button class="btn btn-big" id="eg-minus">−</button><span class="num" id="eg-num">${guest ? guest.defaultPeople : 2}</span><button class="btn btn-big" id="eg-plus">＋</button></div></div>
               <div class="muted" id="eg-err"></div>
               <button class="btn btn-block bg-verde mt" id="eg-save">Salva</button>`,
        onMount(body) {
          let n = guest ? guest.defaultPeople : 2; const num = body.querySelector('#eg-num');
          body.querySelector('#eg-minus').onclick = () => { n = Math.max(1, n - 1); num.textContent = n; };
          body.querySelector('#eg-plus').onclick = () => { n = Math.min(L.PEOPLE_MAX, n + 1); num.textContent = n; };
          body.querySelector('#eg-name').focus();
          body.querySelector('#eg-save').onclick = () => {
            const name = body.querySelector('#eg-name').value.trim(); const err = body.querySelector('#eg-err');
            if (!name) { err.textContent = 'Scrivi un nome'; return; }
            if (L.nameExists(store.state.guests, name, guest && guest.id)) { err.textContent = 'Esiste già un gruppo con questo nome'; return; }
            let g = guest;
            if (isNew) { g = { id: L.newId(), name, defaultPeople: n, createdAt: Date.now(), archived: false }; store.state.guests.push(g); }
            else { g.name = name; g.defaultPeople = n; }
            App.save(); App.closeSheet(); App.toast(isNew ? 'Gruppo creato ✓' : 'Salvato ✓'); if (done) done(g);
          };
        } });
    }
  };
  return App;
})();
```

- [ ] **Step 5: `docs/checklist-manuale.md`**

```markdown
# Checklist manuale (browser a 390×844, poi iPhone reale)
Avvio: `python3 -m http.server 8080` nella cartella e apri http://localhost:8080
- [ ] Le 5 tab cambiano schermata; la tab attiva è colorata.
- [ ] Il foglio (sheet) si apre, si chiude con ✕ e toccando fuori.
- [ ] Il toast compare e sparisce da solo.
- [ ] Nessuno scroll orizzontale a 390px; safe area rispettata su iPhone.
- [ ] In navigazione privata Safari compare il banner rosso e l'app resta usabile.
```

- [ ] **Step 6: Verifica** — avvia `python3 -m http.server 8080`, apri, tutti i tab vuoti ma cliccabili senza errori in console. Se hai un browser headless, screenshot a 390×844.

---

### Task 6: Schermata Segna (`screen-segna.js`)

**Files:**
- Create: `screen-segna.js`

**Interfaces:**
- Consumes: `App.ui.{date,meal,guestId,people,dishId,editingId}`, `App.pickGuest`, `App.iconBox`, `L.validateEntry`, `L.formatDateIt`, `L.addDays`, `L.todayISO`, `L.groupByDay`.
- Produces: `App.screens.segna.render(root)`, `App.openEntry(entryId)` (usato anche dal Rendiconto per modificare una riga).

- [ ] **Step 1: Implementazione**

```js
(function () {
  const A = window.App, L = A.L;
  function resetForm() { A.ui.guestId = null; A.ui.people = 2; A.ui.dishId = null; A.ui.editingId = null; }
  A.openEntry = function (id) {
    const e = A.state.entries.find(x => x.id === id); if (!e) return;
    A.ui.date = e.date; A.ui.meal = e.meal; A.ui.guestId = e.guestId; A.ui.people = e.people; A.ui.dishId = e.dishId; A.ui.editingId = e.id;
    A.go('segna');
  };
  function dayList() {
    const list = A.state.entries.filter(e => e.date === A.ui.date);
    if (!list.length) return `<div class="empty"><div class="big">🍽️</div>Nessun tavolo segnato per questo giorno</div>`;
    const byMeal = m => L.sortEntries(list.filter(e => e.meal === m));
    const block = (m, label, ico) => { const l = byMeal(m); if (!l.length) return '';
      const p = l.reduce((s, e) => s + e.people, 0);
      return `<h3>${ico} ${label} · ${l.length} tavol${l.length === 1 ? 'o' : 'i'} · ${p} person${p === 1 ? 'a' : 'e'}</h3><div class="list">` +
        l.map(e => { const d = A.dish(e.dishId); return `<button class="item" data-entry="${e.id}">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${A.esc(A.guestName(e.guestId))}</div><div class="meta">${A.esc(d.name)}</div></div><span class="n">${e.people}</span><span class="muted">👤</span></button>`; }).join('') + `</div>`; };
    return block('pranzo', 'Pranzo', '☀️') + block('cena', 'Cena', '🌙');
  }
  A.screens.segna = { render(root) {
    const u = A.ui, today = L.todayISO();
    const dishes = A.state.dishes.filter(d => !d.hidden || d.id === u.dishId).sort((a, b) => a.order - b.order);
    const g = u.guestId ? A.state.guests.find(x => x.id === u.guestId) : null;
    root.innerHTML = `
      <h1>La Fiorita 2.0</h1><p class="sub">${L.formatDateIt(u.date)}${u.editingId ? ' · <b>modifica</b>' : ''}</p>
      ${u.date > today ? '<div class="banner banner-giallo">📅 Stai segnando una data futura</div>' : ''}
      <div class="row"><input type="date" id="sg-date" value="${u.date}"><button class="chip fix ${u.date === today ? 'on' : ''}" id="sg-today">Oggi</button><button class="chip fix ${u.date === L.addDays(today, -1) ? 'on' : ''}" id="sg-yday">Ieri</button></div>
      <div class="seg mt"><button id="sg-pranzo" class="${u.meal === 'pranzo' ? 'on' : ''}">☀️ Pranzo</button><button id="sg-cena" class="${u.meal === 'cena' ? 'on' : ''}">🌙 Cena</button></div>
      <h3>Chi</h3>
      <button class="btn btn-block ${g ? '' : 'bg-viola'}" id="sg-guest">${g ? A.iconBox(A.esc(g.name[0].toUpperCase()), L.colorForName(g.name), 'sm') + A.esc(g.name) : '👥 Scegli il gruppo'}</button>
      <h3>Quante persone</h3>
      <div class="counter"><button class="btn btn-big" id="sg-minus">−</button><span class="num" id="sg-num">${u.people}</span><button class="btn btn-big" id="sg-plus">＋</button></div>
      <div class="row mt" id="sg-presets" style="justify-content:center">${[1, 2, 4, 6].map(n => `<button class="chip fix ${u.people === n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
      <h3>Portata</h3>
      <div class="grid2" id="sg-dishes">${dishes.map(d => `<button class="dish ${u.dishId === d.id ? 'on bg-' + d.color : ''}" data-dish="${d.id}">${A.iconBox(d.emoji, d.color)}<span>${A.esc(d.name)}</span></button>`).join('')}</div>
      <div class="mt"><button class="btn btn-block bg-verde" id="sg-save" ${(!u.guestId || !u.dishId) ? 'disabled' : ''}>${u.editingId ? '💾 Salva modifica' : '✅ Salva tavolo'}</button></div>
      ${u.editingId ? `<div class="row mt"><button class="btn danger" id="sg-del">🗑️ Elimina</button><button class="btn" id="sg-cancel">Annulla</button></div>` : ''}
      <h3>Tavoli del giorno</h3><div id="sg-list">${dayList()}</div>`;
    const q = s => root.querySelector(s);
    q('#sg-date').onchange = e => { if (L.isValidISO(e.target.value)) { u.date = e.target.value; A.render(); } };
    q('#sg-today').onclick = () => { u.date = today; A.render(); };
    q('#sg-yday').onclick = () => { u.date = L.addDays(today, -1); A.render(); };
    q('#sg-pranzo').onclick = () => { u.meal = 'pranzo'; A.render(); };
    q('#sg-cena').onclick = () => { u.meal = 'cena'; A.render(); };
    q('#sg-guest').onclick = () => A.pickGuest({ onPick(id) { u.guestId = id; const gg = A.state.guests.find(x => x.id === id); if (gg && !u.editingId) u.people = gg.defaultPeople; A.render(); } });
    q('#sg-minus').onclick = () => { u.people = Math.max(1, u.people - 1); A.render(); };
    q('#sg-plus').onclick = () => { u.people = Math.min(L.PEOPLE_MAX, u.people + 1); A.render(); };
    q('#sg-presets').onclick = e => { const b = e.target.closest('[data-n]'); if (b) { u.people = Number(b.dataset.n); A.render(); } };
    q('#sg-dishes').onclick = e => { const b = e.target.closest('[data-dish]'); if (b) { u.dishId = b.dataset.dish; A.render(); } };
    q('#sg-list').onclick = e => { const b = e.target.closest('[data-entry]'); if (b) A.openEntry(b.dataset.entry); };
    q('#sg-save').onclick = () => {
      const btn = q('#sg-save'); btn.disabled = true;
      const entry = { date: u.date, meal: u.meal, guestId: u.guestId, people: u.people, dishId: u.dishId };
      const errs = L.validateEntry(entry, A.state); if (errs.length) { btn.disabled = false; A.toast(errs[0]); return; }
      if (u.editingId) { const e = A.state.entries.find(x => x.id === u.editingId); Object.assign(e, entry, { updatedAt: Date.now() }); }
      else A.state.entries.push(Object.assign({ id: L.newId(), createdAt: Date.now(), updatedAt: Date.now() }, entry));
      const wasEdit = !!u.editingId; resetForm(); A.save(); A.toast(wasEdit ? 'Modificato ✓' : 'Salvato ✓');
    };
    if (u.editingId) {
      q('#sg-cancel').onclick = () => { resetForm(); A.render(); };
      q('#sg-del').onclick = async () => { if (await A.confirm('Eliminare questo tavolo?')) { A.state.entries = A.state.entries.filter(x => x.id !== u.editingId); resetForm(); A.save(); A.toast('Eliminato'); } };
    }
  } };
})();
```

- [ ] **Step 2: Checklist manuale (aggiungi a `docs/checklist-manuale.md`)**

```markdown
## Segna
- [ ] Salva è disabilitato finché non scegli gruppo e portata.
- [ ] Scegliendo un gruppo il contatore prende le persone "di solito".
- [ ] Dopo Salva: toast, riga nel giorno giusto, data e pasto restano, gruppo/portata si azzerano.
- [ ] Toccando una riga si entra in modifica; Elimina chiede conferma; Annulla esce senza cambiare.
- [ ] "Ieri" e il campo data cambiano l'elenco del giorno.
- [ ] Data futura mostra il banner giallo ma lascia salvare.
- [ ] Nuovo gruppo con nome duplicato ("rossi " vs "Rossi") viene rifiutato.
```

- [ ] **Step 3: Verifica** — esegui la checklist nel browser; `node --test tests/` ancora verde.

---

### Task 7: Schermata Gruppi (`screen-gruppi.js`)

**Files:**
- Create: `screen-gruppi.js`

**Interfaces:**
- Consumes: `App.editGuestSheet(guest, done)`, `L.guestStats`, `L.canDeleteGuest`, `L.colorForName`, `App.ui.showArchived`.
- Produces: `App.screens.gruppi.render(root)`.

- [ ] **Step 1: Implementazione**

```js
(function () {
  const A = window.App, L = A.L;
  const COL = { rosa: '#F2547D', verde: '#7BC043', giallo: '#F5C842', viola: '#6C4BE0', azzurro: '#4FB3E8', arancio: '#F58A3C', grigio: '#B8B8B8' };
  function detail(g) {
    const st = L.guestStats(A.state.entries)[g.id] || { tables: 0, people: 0 };
    const last = L.sortEntries(A.state.entries.filter(e => e.guestId === g.id)).slice(0, 5);
    const deletable = L.canDeleteGuest(g.id, A.state.entries);
    A.sheet({ title: g.name, html: `
      <div class="grid2"><div class="stat"><div class="lbl">Volte</div><div class="val">${st.tables}</div></div><div class="stat"><div class="lbl">Persone</div><div class="val">${st.people}</div></div></div>
      <div class="row mt"><button class="btn" id="gd-edit">✏️ Modifica</button>${deletable ? '<button class="btn danger" id="gd-del">🗑️ Elimina</button>' : `<button class="btn" id="gd-arch">${g.archived ? '↩️ Ripristina' : '📦 Archivia'}</button>`}</div>
      ${last.length ? '<h3>Ultime visite</h3><div class="list">' + last.map(e => { const d = A.dish(e.dishId); return `<div class="item">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${L.formatDateIt(e.date)}</div><div class="meta">${e.meal === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'} · ${A.esc(d.name)}</div></div><span class="n">${e.people}</span></div>`; }).join('') + '</div>' : ''}`,
      onMount(b) {
        b.querySelector('#gd-edit').onclick = () => A.editGuestSheet(g, () => A.render());
        const del = b.querySelector('#gd-del'); if (del) del.onclick = async () => { if (await A.confirm(`Eliminare "${g.name}"?`)) { A.state.guests = A.state.guests.filter(x => x.id !== g.id); A.closeSheet(); A.save(); A.toast('Eliminato'); } };
        const arch = b.querySelector('#gd-arch'); if (arch) arch.onclick = () => { g.archived = !g.archived; A.closeSheet(); A.save(); A.toast(g.archived ? 'Archiviato' : 'Ripristinato'); };
      } });
  }
  A.screens.gruppi = { render(root) {
    const stats = L.guestStats(A.state.entries);
    const list = A.state.guests.filter(g => A.ui.showArchived ? g.archived : !g.archived).sort((a, b) => a.name.localeCompare(b.name));
    root.innerHTML = `<div class="row"><h1>Gruppi</h1><button class="btn btn-sq bg-giallo fix" id="gr-new">＋</button></div><p class="sub">${A.state.guests.filter(g => !g.archived).length} gruppi attivi</p>
      ${list.length ? `<div class="grid2">${list.map(g => { const s = stats[g.id] || { tables: 0, people: 0 }; const c = L.colorForName(g.name); return `<button class="folder" style="--tab:${COL[c]}" data-g="${g.id}">${A.iconBox(A.esc(g.name[0].toUpperCase()), c)}<div class="name">${A.esc(g.name)}</div><div class="meta">${s.tables} volte · ${s.people} persone</div></button>`; }).join('')}</div>`
                   : `<div class="empty"><div class="big">👨‍👩‍👧</div>${A.ui.showArchived ? 'Nessun gruppo archiviato' : 'Ancora nessun gruppo. Tocca ＋ per crearne uno.'}</div>`}
      <div class="center mt" style="margin-top:24px"><button class="chip ${A.ui.showArchived ? 'on' : ''}" id="gr-arch">${A.ui.showArchived ? 'Mostra attivi' : 'Mostra archiviati'}</button></div>`;
    root.querySelector('#gr-new').onclick = () => A.editGuestSheet(null, () => A.render());
    root.querySelector('#gr-arch').onclick = () => { A.ui.showArchived = !A.ui.showArchived; A.render(); };
    root.onclick = e => { const b = e.target.closest('[data-g]'); if (b) detail(A.state.guests.find(x => x.id === b.dataset.g)); };
  } };
})();
```

- [ ] **Step 2: Checklist**

```markdown
## Gruppi
- [ ] Le schede mostrano volte e persone corrette dopo aver segnato tavoli.
- [ ] Gruppo senza tavoli: Elimina disponibile. Gruppo con tavoli: solo Archivia.
- [ ] Archiviato sparisce dal selettore in Segna ma resta nei conti; Ripristina lo riporta.
- [ ] Rinomina con nome già esistente viene rifiutata.
```

- [ ] **Step 3: Verifica** — checklist nel browser.

---

### Task 8: Schermata Portate (`screen-portate.js`)

**Files:**
- Create: `screen-portate.js`

**Interfaces:**
- Consumes: `L.EMOJI_CIBO`, `L.COLORS`, `L.canDeleteDish`, `L.nameExists`, `L.newId`.
- Produces: `App.screens.portate.render(root)`.

- [ ] **Step 1: Implementazione**

```js
(function () {
  const A = window.App, L = A.L;
  function editSheet(dish) {
    const isNew = !dish; let emoji = dish ? dish.emoji : '🍽️', color = dish ? dish.color : 'rosa';
    A.sheet({ title: isNew ? 'Nuova portata' : 'Modifica portata', html: `
      <div class="field"><label>Nome</label><input type="text" id="ed-name" value="${A.esc(dish ? dish.name : '')}" autocomplete="off"></div>
      <div class="field"><label>Icona</label><div class="emoji-grid" id="ed-emoji">${L.EMOJI_CIBO.map(e => `<button data-e="${e}" class="${e === emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Colore</label><div class="color-row" id="ed-color">${L.COLORS.map(c => `<button data-c="${c}" class="bg-${c} ${c === color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="muted" id="ed-err"></div><button class="btn btn-block bg-verde mt" id="ed-save">Salva</button>`,
      onMount(b) {
        b.querySelector('#ed-emoji').onclick = e => { const x = e.target.closest('[data-e]'); if (!x) return; emoji = x.dataset.e; b.querySelectorAll('#ed-emoji button').forEach(y => y.classList.toggle('on', y === x)); };
        b.querySelector('#ed-color').onclick = e => { const x = e.target.closest('[data-c]'); if (!x) return; color = x.dataset.c; b.querySelectorAll('#ed-color button').forEach(y => y.classList.toggle('on', y === x)); };
        b.querySelector('#ed-save').onclick = () => {
          const name = b.querySelector('#ed-name').value.trim(), err = b.querySelector('#ed-err');
          if (!name) { err.textContent = 'Scrivi un nome'; return; }
          if (L.nameExists(A.state.dishes, name, dish && dish.id)) { err.textContent = 'Esiste già una portata con questo nome'; return; }
          if (isNew) A.state.dishes.push({ id: L.newId(), name, emoji, color, hidden: false, order: A.state.dishes.length });
          else Object.assign(dish, { name, emoji, color });
          A.closeSheet(); A.save(); A.toast('Salvato ✓');
        };
      } });
  }
  A.screens.portate = { render(root) {
    const dishes = A.state.dishes.slice().sort((a, b) => a.order - b.order);
    const use = {}; A.state.entries.forEach(e => { use[e.dishId] = (use[e.dishId] || 0) + 1; });
    root.innerHTML = `<div class="row"><h1>Portate</h1><button class="btn btn-sq bg-giallo fix" id="pt-new">＋</button></div><p class="sub">I bottoni che compaiono in Segna</p>
      <div class="list">${dishes.map((d, i) => `<div class="item" style="cursor:default">${A.iconBox(d.emoji, d.color)}<div class="grow"><div class="name">${A.esc(d.name)}${d.hidden ? ' <span class="muted">(nascosta)</span>' : ''}</div><div class="meta">${use[d.id] || 0} tavoli</div></div>
        <button class="btn btn-sq" data-up="${d.id}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn btn-sq" data-down="${d.id}" ${i === dishes.length - 1 ? 'disabled' : ''}>▼</button><button class="btn btn-sq" data-edit="${d.id}">✏️</button></div>`).join('')}</div>`;
    root.querySelector('#pt-new').onclick = () => editSheet(null);
    root.onclick = e => {
      const up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]'), ed = e.target.closest('[data-edit]');
      if (up || down) { const id = (up || down).dataset.up || (up || down).dataset.down; const i = dishes.findIndex(d => d.id === id); const j = up ? i - 1 : i + 1;
        if (j < 0 || j >= dishes.length) return; [dishes[i].order, dishes[j].order] = [dishes[j].order, dishes[i].order]; A.save(); return; }
      if (ed) { const d = A.state.dishes.find(x => x.id === ed.dataset.edit); const deletable = L.canDeleteDish(d.id, A.state.entries);
        A.sheet({ title: d.name, html: `<div class="list"><button class="btn btn-block" id="pd-edit">✏️ Modifica nome, icona, colore</button>
          ${deletable ? '<button class="btn btn-block danger" id="pd-del">🗑️ Elimina</button>' : `<button class="btn btn-block" id="pd-hide">${d.hidden ? '👁️ Mostra di nuovo' : '🙈 Nascondi dai bottoni'}</button><p class="muted">Ha dei tavoli registrati: si può nascondere ma non eliminare.</p>`}</div>`,
          onMount(b) {
            b.querySelector('#pd-edit').onclick = () => editSheet(d);
            const del = b.querySelector('#pd-del'); if (del) del.onclick = async () => { if (await A.confirm(`Eliminare "${d.name}"?`)) { A.state.dishes = A.state.dishes.filter(x => x.id !== d.id); A.closeSheet(); A.save(); A.toast('Eliminata'); } };
            const hide = b.querySelector('#pd-hide'); if (hide) hide.onclick = () => { d.hidden = !d.hidden; A.closeSheet(); A.save(); A.toast(d.hidden ? 'Nascosta' : 'Visibile'); };
          } }); }
    };
  } };
})();
```

- [ ] **Step 2: Checklist**

```markdown
## Portate
- [ ] Nuova portata con emoji e colore compare in Segna nell'ordine giusto.
- [ ] ▲ ▼ cambiano l'ordine anche in Segna.
- [ ] Portata usata: solo Nascondi; nascosta sparisce da Segna ma resta nei conti.
- [ ] Portata mai usata: Elimina con conferma.
```

- [ ] **Step 3: Verifica** — checklist nel browser.

---

### Task 9: Schermata Rendiconto (`screen-rendiconto.js`)

**Files:**
- Create: `screen-rendiconto.js`

**Interfaces:**
- Consumes: `App.ui.report`, `L.monthRange/yearRange/fortnightRange/monthLabelIt`, `L.filterEntries`, `L.summarize`, `L.groupByDay`, `App.pickGuest({allowAll:true})`, `App.openEntry`.
- Produces: `App.screens.rendiconto.render(root)`.

- [ ] **Step 1: Implementazione**

```js
(function () {
  const A = window.App, L = A.L;
  function range(r) {
    if (r.mode === 'mese') return L.monthRange(r.year, r.month);
    if (r.mode === 'anno') return L.yearRange(r.year);
    return { from: r.from || L.monthRange(r.year, r.month).from, to: r.to || L.monthRange(r.year, r.month).to };
  }
  function shiftMonth(r, d) { let m = r.month + d, y = r.year; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } r.month = m; r.year = y; }
  A.screens.rendiconto = { render(root) {
    const r = A.ui.report, { from, to } = range(r);
    const entries = L.filterEntries(A.state.entries, { from, to, guestId: r.guestId, meal: r.meal });
    const s = L.summarize(entries, A.state);
    const gname = r.guestId ? A.guestName(r.guestId) : 'Tutti i gruppi';
    const maxDish = Math.max(1, ...s.byDish.map(d => d.people));
    const guests = r.showAllGuests ? s.byGuest : s.byGuest.slice(0, 10);
    const periodo = r.mode === 'mese' ? `<div class="row"><button class="btn btn-sq fix" id="rp-prev">◀</button><div class="center" style="font-weight:700;font-size:20px">${L.monthLabelIt(r.year, r.month)}</div><button class="btn btn-sq fix" id="rp-next">▶</button></div>`
      : r.mode === 'anno' ? `<div class="row"><button class="btn btn-sq fix" id="rp-prev">◀</button><div class="center" style="font-weight:700;font-size:20px">${r.year}</div><button class="btn btn-sq fix" id="rp-next">▶</button></div>`
      : `<div class="row"><input type="date" id="rp-from" value="${from}"><span class="fix">→</span><input type="date" id="rp-to" value="${to}"></div>
         <div class="row mt" style="flex-wrap:wrap"><button class="chip fix" data-q="1">1–15</button><button class="chip fix" data-q="2">16–fine</button><button class="chip fix" data-q="m">Questo mese</button></div>`;
    root.innerHTML = `<h1>Conti</h1><p class="sub">${L.formatDateIt(from)} → ${L.formatDateIt(to)}</p>
      <div class="seg mb"><button data-mode="mese" class="${r.mode === 'mese' ? 'on' : ''}">Mese</button><button data-mode="anno" class="${r.mode === 'anno' ? 'on' : ''}">Anno</button><button data-mode="da-a" class="${r.mode === 'da-a' ? 'on' : ''}">Da – A</button></div>
      ${periodo}
      <div class="row mt"><button class="btn ${r.guestId ? 'bg-viola' : ''}" id="rp-guest">👥 ${A.esc(gname)}</button></div>
      <div class="seg mt"><button data-meal="" class="${!r.meal ? 'on' : ''}">Tutti</button><button data-meal="pranzo" class="${r.meal === 'pranzo' ? 'on' : ''}">☀️ Pranzo</button><button data-meal="cena" class="${r.meal === 'cena' ? 'on' : ''}">🌙 Cena</button></div>
      ${s.tables === 0 ? `<div class="empty"><div class="big">🗓️</div>Nessun tavolo in questo periodo</div>` : `
      <div class="grid2 mt"><div class="stat bg-giallo"><div class="lbl">Tavoli</div><div class="val">${s.tables}</div></div><div class="stat bg-rosa"><div class="lbl">Persone</div><div class="val">${s.people}</div></div></div>
      <h3>Pranzo e cena</h3><div class="grid2"><div class="stat"><div class="lbl">☀️ Pranzo</div><div class="val">${s.byMeal.pranzo.people}</div><div class="muted">${s.byMeal.pranzo.tables} tavoli</div></div><div class="stat"><div class="lbl">🌙 Cena</div><div class="val">${s.byMeal.cena.people}</div><div class="muted">${s.byMeal.cena.tables} tavoli</div></div></div>
      <h3>Per portata</h3><div class="list">${s.byDish.map(d => `<div class="item" style="cursor:default;flex-wrap:wrap">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${A.esc(d.name)}</div><div class="meta">${d.tables} tavoli</div></div><span class="n">${d.people}</span><span class="muted">👤</span><div class="bar" style="flex-basis:100%"><i class="bg-${d.color}" style="width:${Math.round(d.people / maxDish * 100)}%"></i></div></div>`).join('')}</div>
      ${r.guestId ? '' : `<h3>Per gruppo</h3><div class="list">${guests.map((g, i) => `<div class="item" style="cursor:default">${A.iconBox(i + 1, i === 0 ? 'giallo' : 'grigio', 'sm')}<div class="grow"><div class="name">${A.esc(g.name)}${g.archived ? ' <span class="muted">(archiviato)</span>' : ''}</div><div class="meta">${g.tables} tavoli</div></div><span class="n">${g.people}</span><span class="muted">👤</span></div>`).join('')}</div>
        ${s.byGuest.length > 10 && !r.showAllGuests ? `<div class="center mt"><button class="chip" id="rp-all">Mostra tutti (${s.byGuest.length})</button></div>` : ''}`}
      <h3>Tutti i tavoli</h3>${L.groupByDay(entries).map(day => `<div class="muted" style="margin:10px 0 6px;font-weight:700">${L.formatDateIt(day.date)}</div><div class="list">${day.entries.map(e => { const d = A.dish(e.dishId); return `<button class="item" data-entry="${e.id}">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${A.esc(A.guestName(e.guestId))}</div><div class="meta">${e.meal === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'} · ${A.esc(d.name)}</div></div><span class="n">${e.people}</span><span class="muted">👤</span></button>`; }).join('')}</div>`).join('')}`}`;
    const q = s => root.querySelector(s);
    root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { r.mode = b.dataset.mode; if (r.mode === 'da-a' && !r.from) { const m = L.monthRange(r.year, r.month); r.from = m.from; r.to = m.to; } A.render(); });
    root.querySelectorAll('[data-meal]').forEach(b => b.onclick = () => { r.meal = b.dataset.meal || null; A.render(); });
    if (q('#rp-prev')) { q('#rp-prev').onclick = () => { r.mode === 'anno' ? r.year-- : shiftMonth(r, -1); A.render(); }; q('#rp-next').onclick = () => { r.mode === 'anno' ? r.year++ : shiftMonth(r, 1); A.render(); }; }
    if (q('#rp-from')) {
      q('#rp-from').onchange = e => { if (L.isValidISO(e.target.value)) { r.from = e.target.value; if (r.to < r.from) r.to = r.from; A.render(); } };
      q('#rp-to').onchange = e => { if (L.isValidISO(e.target.value)) { r.to = e.target.value; if (r.to < r.from) r.from = r.to; A.render(); } };
      root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const k = b.dataset.q; const rr = k === 'm' ? L.monthRange(r.year, r.month) : L.fortnightRange(r.year, r.month, Number(k)); r.from = rr.from; r.to = rr.to; A.render(); });
    }
    q('#rp-guest').onclick = () => A.pickGuest({ allowAll: true, onPick(id) { r.guestId = id; A.render(); } });
    if (q('#rp-all')) q('#rp-all').onclick = () => { r.showAllGuests = true; A.render(); };
    root.addEventListener('click', e => { const b = e.target.closest('[data-entry]'); if (b) A.openEntry(b.dataset.entry); });
  } };
})();
```

- [ ] **Step 2: Checklist**

```markdown
## Conti
- [ ] Mese ◀ ▶ attraversa dicembre→gennaio cambiando anno.
- [ ] Da–A: "16–fine" su un mese di 30 e di 31 giorni dà la data giusta; "Questo mese" ripristina.
- [ ] Filtro gruppo nasconde la classifica; "Tutti i gruppi" la riporta.
- [ ] Filtro Pranzo/Cena cambia tutti i numeri in modo coerente (tavoli = somma delle righe elencate).
- [ ] Toccando una riga dell'elenco si va in Segna in modifica; dopo Salva i conti si aggiornano.
- [ ] Gruppo archiviato e portata nascosta compaiono comunque con l'etichetta.
```

- [ ] **Step 3: Verifica** — checklist nel browser.

---

### Task 10: Schermata Impostazioni (`screen-impostazioni.js`)

**Files:**
- Create: `screen-impostazioni.js`

**Interfaces:**
- Consumes: `L.serializeBackup`, `L.parseBackup`, `L.emptyState`, `App.store.replace`, `App.state.lastBackupAt`.
- Produces: `App.screens.impostazioni.render(root)`; banner backup mostrato in cima alla schermata Segna tramite `App.backupWarning()` (html string, usato da Task 6: aggiungi `${A.backupWarning()}` subito dopo il `<p class="sub">` in Segna).

- [ ] **Step 1: Implementazione**

```js
(function () {
  const A = window.App, L = A.L;
  const APP_VERSION = '2.0.0';
  A.backupWarning = function () {
    const st = A.state; if (st.entries.length < 10) return '';
    const days = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 86400000) : null;
    if (days !== null && days < 30) return '';
    return `<div class="banner banner-giallo">💾 ${days === null ? 'Non hai mai salvato una copia dei dati.' : `Ultima copia ${days} giorni fa.`} <a href="#" data-go="impostazioni">Salva ora</a></div>`;
  };
  document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); A.go(a.dataset.go); } });
  function download() {
    const text = L.serializeBackup(A.state);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lafiorita-backup-${L.todayISO()}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    A.state.lastBackupAt = Date.now(); A.save(); A.toast('Copia salvata ✓');
  }
  function restore(file) {
    const rd = new FileReader();
    rd.onload = async () => {
      const r = L.parseBackup(String(rd.result));
      if (!r.ok) { A.toast('❌ ' + r.error); return; }
      const ok = await A.confirm(`Sostituire tutti i dati attuali con la copia?\n${r.state.entries.length} tavoli, ${r.state.guests.length} gruppi${r.skipped ? `\n(${r.skipped} righe non valide scartate)` : ''}`);
      if (!ok) return;
      A.store.replace(r.state); A.render(); A.toast('Ripristinato ✓');
    };
    rd.readAsText(file);
  }
  A.screens.impostazioni = { render(root) {
    const st = A.state; const last = st.lastBackupAt ? new Date(st.lastBackupAt).toLocaleDateString('it-IT') : 'mai';
    root.innerHTML = `<h1>Altro</h1><p class="sub">Copie di sicurezza e impostazioni</p>
      ${A.backupWarning()}
      <div class="card"><h2>💾 Copia dei dati</h2><p class="muted">Ultima copia: <b>${last}</b>. Il file finisce in "File" sull'iPhone: tienilo su iCloud.</p>
        <button class="btn btn-block bg-verde mt" id="st-backup">Salva copia</button>
        <label class="btn btn-block mt" for="st-file">Ripristina da copia…</label><input type="file" id="st-file" accept=".json,application/json" hidden></div>
      <div class="card mt"><h2>📋 Dati</h2><p class="muted">${st.entries.length} tavoli · ${st.guests.length} gruppi · ${st.dishes.length} portate<br>La Fiorita ${APP_VERSION}</p></div>
      <div class="card mt"><h2>📱 Mettila in Home</h2><ol class="muted" style="padding-left:20px;margin:8px 0 0"><li>Apri questa pagina in <b>Safari</b></li><li>Tocca il tasto <b>Condividi</b> (quadrato con la freccia)</li><li>Scegli <b>"Aggiungi alla schermata Home"</b></li></ol></div>
      <div class="card mt" style="border-color:#b00020"><h2 class="danger">⚠️ Zona pericolosa</h2><button class="btn btn-block danger mt" id="st-wipe">Cancella tutto</button></div>`;
    root.querySelector('#st-backup').onclick = download;
    root.querySelector('#st-file').onchange = e => { const f = e.target.files[0]; if (f) restore(f); e.target.value = ''; };
    root.querySelector('#st-wipe').onclick = async () => {
      if (!await A.confirm('Cancellare TUTTI i dati? Non si può annullare.')) return;
      if (!await A.confirm('Sei sicuro? Gruppi, portate e tavoli spariranno.')) return;
      A.store.replace(L.emptyState()); A.render(); A.toast('Tutto cancellato');
    };
  } };
})();
```

- [ ] **Step 2: Modifica Task 6** — in `screen-segna.js`, dopo `<p class="sub">…</p>` inserisci `${A.backupWarning ? A.backupWarning() : ''}`.

- [ ] **Step 3: Checklist**

```markdown
## Altro
- [ ] Salva copia scarica un .json leggibile e aggiorna "Ultima copia".
- [ ] Ripristina con file corrotto: toast di errore, dati intatti.
- [ ] Ripristina valido: conferma con conteggi, poi tutte le schermate mostrano i dati del file.
- [ ] Con ≥10 tavoli e nessun backup compare il banner giallo in Segna e in Altro; sparisce dopo Salva copia.
- [ ] Cancella tutto chiede due conferme.
```

- [ ] **Step 4: Verifica** — checklist nel browser; `node --test tests/` verde.

---

### Task 11: Build inline, revisione e pubblicazione

**Files:**
- Create: `build.js`, `dist/index.html`

**Interfaces:**
- Consumes: tutti i file sorgente.
- Produces: `dist/index.html` autosufficiente (CSS e JS inline, icona come data URI).

- [ ] **Step 1: `build.js`**

```js
const fs = require('fs'), path = require('path');
const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent(read('icon.svg'));
html = html.replace(/href="icon\.svg"/g, `href="${svg}"`);
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`);
html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (_, f) => `<script>\n${read(f)}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
```

- [ ] **Step 2: `node build.js`** → stampa la dimensione; apri `dist/index.html` direttamente (file://) e ripeti la checklist "Segna" e "Conti" in breve.

- [ ] **Step 3: Test finale** — `node --test tests/` verde; nessun errore in console.

- [ ] **Step 4: Pubblicazione** — pubblica `dist/index.html` come artefatto (favicon 🌸, titolo "La Fiorita 2.0"). Poi salva in memoria dove stanno i file e l'URL.

- [ ] **Step 5: Revisione** — richiedi una code review del progetto (skill `superpowers:requesting-code-review`) e correggi quanto emerge.
