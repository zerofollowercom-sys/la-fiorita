// La Fiorita 2.0 — funzioni pure (nessun DOM). UMD: browser → window.LaFioritaLogic, Node → module.exports
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LaFioritaLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GIORNI = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const pad = n => String(n).padStart(2, '0');

  // ---- date ----
  function todayISO(d) { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
  function isValidISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }
  function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return todayISO(d); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function monthRange(y, m) { return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` }; }
  function yearRange(y) { return { from: `${y}-01-01`, to: `${y}-12-31` }; }
  function fortnightRange(y, m, half) {
    return half === 1 ? { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-15` }
                      : { from: `${y}-${pad(m)}-16`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
  }
  function formatDateIt(iso) { const d = parseISO(iso); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; }
  function monthLabelIt(y, m) { const n = MESI[m - 1]; return `${n[0].toUpperCase()}${n.slice(1)} ${y}`; }
  function defaultMeal(hour) { return hour < 16 ? 'pranzo' : 'cena'; }

  // ---- servizi (un tavolo = data + pasto + menu + famiglie) ----
  function entryPeople(e) { return (e.guests || []).reduce((s, g) => s + (Number(g.people) || 0), 0); }
  function findService(entries, date, meal) { return entries.find(e => e.date === date && e.meal === meal) || null; }
  function filterEntries(entries, f) {
    f = f || {};
    return entries.filter(e =>
      (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) &&
      (!f.guestId || (e.guests || []).some(g => g.guestId === f.guestId)) && (!f.meal || e.meal === f.meal));
  }
  function sortEntries(entries) {
    const mealOrder = { pranzo: 0, cena: 1 };
    return entries.slice().sort((a, b) => b.date.localeCompare(a.date) || mealOrder[a.meal] - mealOrder[b.meal]);
  }
  function groupByDay(entries) {
    const map = new Map();
    for (const e of sortEntries(entries)) { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e); }
    return Array.from(map, ([date, list]) => ({ date, entries: list }));
  }
  // opts.guestId: conta solo le persone di quella famiglia (filtro "per famiglia" dei Conti)
  function summarize(entries, ctx, opts) {
    opts = opts || {};
    const gById = new Map(ctx.guests.map(g => [g.id, g]));
    const dById = new Map(ctx.dishes.map(d => [d.id, d]));
    const s = { tables: 0, people: 0, byMeal: { pranzo: { tables: 0, people: 0 }, cena: { tables: 0, people: 0 } }, byDish: [], byGuest: [] };
    const dish = new Map(), guest = new Map();
    for (const e of entries) {
      const rows = (e.guests || []).filter(g => !opts.guestId || g.guestId === opts.guestId);
      const p = rows.reduce((t, g) => t + (Number(g.people) || 0), 0);
      s.tables++; s.people += p;
      const m = s.byMeal[e.meal] || (s.byMeal[e.meal] = { tables: 0, people: 0 }); m.tables++; m.people += p;
      if (!dish.has(e.dishId)) {
        const d = dById.get(e.dishId);
        dish.set(e.dishId, { id: e.dishId, name: d ? d.name : (e.dishId == null ? 'Senza menu' : 'Menu eliminato'), emoji: d ? d.emoji : '❔', color: d ? d.color : 'grigio', hidden: d ? !!d.hidden : true, order: d ? d.order : 999, tables: 0, people: 0 });
      }
      const dd = dish.get(e.dishId); dd.tables++; dd.people += p;
      for (const row of rows) {
        if (!guest.has(row.guestId)) {
          const g = gById.get(row.guestId);
          guest.set(row.guestId, { id: row.guestId, name: g ? g.name : 'Ospite eliminato', archived: g ? !!g.archived : true, tables: 0, people: 0 });
        }
        const gg = guest.get(row.guestId); gg.tables++; gg.people += Number(row.people) || 0;
      }
    }
    s.byDish = Array.from(dish.values()).sort((a, b) => b.people - a.people || b.tables - a.tables || a.order - b.order);
    s.byGuest = Array.from(guest.values()).sort((a, b) => b.people - a.people || b.tables - a.tables || a.name.localeCompare(b.name));
    return s;
  }
  function guestStats(entries) {
    const out = {};
    for (const e of entries) for (const row of (e.guests || [])) {
      const o = out[row.guestId] || (out[row.guestId] = { tables: 0, people: 0, lastDate: null });
      o.tables++; o.people += Number(row.people) || 0;
      if (!o.lastDate || e.date > o.lastDate) o.lastDate = e.date;
    }
    return out;
  }

  // ---- costanti ----
  const PEOPLE_MAX = 99;
  const COLORS = ['rosa', 'verde', 'giallo', 'viola', 'azzurro', 'arancio'];
  const EMOJI_CIBO = ['🍕','🥩','🍝','🐟','🍗','🥗','🍔','🌭','🍟','🍤','🦐','🦑','🐙','🥓','🍖','🌮','🌯','🥪','🍞','🧀','🥚','🍳','🥘','🍲','🍛','🍜','🍣','🍱','🥟','🍚','🍰','🎂','🍨','🍦','🍩','🍪','🍷','🍺','☕','🥂'];

  // ---- id, nomi, validazione ----
  function newId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function normalizeName(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function nameExists(list, name, excludeId) {
    const n = normalizeName(name);
    return list.some(x => x.id !== excludeId && normalizeName(x.name) === n);
  }
  function initial(name) { const c = Array.from(String(name || '').trim())[0]; return c ? c.toUpperCase() : '?'; }
  function validPeople(n) { return Number.isInteger(n) && n >= 1 && n <= PEOPLE_MAX; }
  function validateEntry(e, ctx) {
    const errs = [];
    if (!isValidISO(e.date)) errs.push('Data non valida');
    if (e.meal !== 'pranzo' && e.meal !== 'cena') errs.push('Scegli pranzo o cena');
    if (e.dishId != null && !ctx.dishes.some(d => d.id === e.dishId)) errs.push('Menu non valido'); // il menu è facoltativo
    const rows = Array.isArray(e.guests) ? e.guests : [];
    if (!rows.length) errs.push('Aggiungi almeno un ospite');
    else {
      const seen = new Set();
      for (const r of rows) {
        if (!r || !ctx.guests.some(g => g.id === r.guestId)) { errs.push('Ospite non valido'); break; }
        if (seen.has(r.guestId)) { errs.push('Ospite inserito due volte'); break; }
        seen.add(r.guestId);
        if (!validPeople(r.people)) { errs.push(`Persone: da 1 a ${PEOPLE_MAX}`); break; }
      }
    }
    return errs;
  }
  function canDeleteGuest(id, entries) { return !entries.some(e => (e.guests || []).some(g => g.guestId === id)); }
  function canDeleteDish(id, entries) { return !entries.some(e => e.dishId === id); }
  function colorForName(name) {
    let h = 0; for (const ch of normalizeName(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  // ---- stato e backup ----
  function defaultDishes() {
    return [['Pizza', '🍕', 'giallo'], ['Carne', '🥩', 'rosa'], ['Primo', '🍝', 'verde'], ['Pesce', '🐟', 'azzurro']]
      .map(([name, emoji, color], i) => ({ id: newId(), name, emoji, color, hidden: false, order: i }));
  }
  function emptyState() { return { version: 2, guests: [], dishes: defaultDishes(), entries: [], lastBackupAt: null }; }
  function serializeBackup(state) {
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), guests: state.guests, dishes: state.dishes, entries: state.entries, lastBackupAt: state.lastBackupAt || null }, null, 1);
  }
  // Vecchio formato (v1): una riga per famiglia → raggruppo per giorno e pasto; il menu è quello della prima riga
  function convertV1Entries(rows) {
    const map = new Map();
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const key = r.date + '|' + r.meal;
      if (!map.has(key)) map.set(key, { id: typeof r.id === 'string' ? r.id : newId(), date: r.date, meal: r.meal, dishId: r.dishId, guests: [], createdAt: r.createdAt || 0, updatedAt: r.updatedAt || 0 });
      const svc = map.get(key); const people = Number.isInteger(r.people) ? r.people : parseInt(r.people, 10);
      const g = svc.guests.find(x => x.guestId === r.guestId);
      if (g) g.people += people; else svc.guests.push({ guestId: r.guestId, people });
    }
    return Array.from(map.values());
  }
  function parseBackup(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (_) { return { ok: false, error: 'Il file non è un backup valido' }; }
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Il file non è un backup valido' };
    if (raw.version !== 1 && raw.version !== 2) return { ok: false, error: 'Versione del backup non supportata' };
    if (!Array.isArray(raw.guests) || !Array.isArray(raw.dishes) || !Array.isArray(raw.entries)) return { ok: false, error: 'Il backup è incompleto' };
    const guests = [];
    for (const g of raw.guests) {
      if (!g || typeof g.id !== 'string' || typeof g.name !== 'string' || !g.name.trim() || nameExists(guests, g.name)) continue;
      guests.push({ id: g.id, name: g.name.trim(), defaultPeople: validPeople(g.defaultPeople) ? g.defaultPeople : 2, createdAt: g.createdAt || 0, archived: !!g.archived });
    }
    const dishes = raw.dishes.filter(d => d && typeof d.id === 'string' && typeof d.name === 'string')
      .map((d, i) => ({ id: d.id, name: d.name.trim(), emoji: typeof d.emoji === 'string' ? Array.from(d.emoji).slice(0, 2).join('') : '🍽️', color: COLORS.includes(d.color) ? d.color : 'grigio', hidden: !!d.hidden, order: Number.isInteger(d.order) ? d.order : i }));
    const ctx = { guests, dishes };
    const source = raw.version === 1 ? convertV1Entries(raw.entries) : raw.entries;
    let skipped = 0; const entries = [];
    for (const e of source) {
      if (!e || typeof e !== 'object') { skipped++; continue; }
      const rows = Array.isArray(e.guests) ? e.guests.map(r => r && typeof r === 'object' ? { guestId: r.guestId, people: Number.isInteger(r.people) ? r.people : parseInt(r.people, 10) } : null) : [];
      const n = { id: typeof e.id === 'string' ? e.id : newId(), date: e.date, meal: e.meal, dishId: e.dishId == null ? null : e.dishId, guests: rows, createdAt: e.createdAt || 0, updatedAt: e.updatedAt || 0 };
      if (validateEntry(n, ctx).length || findService(entries, n.date, n.meal)) { skipped++; continue; }
      entries.push(n);
    }
    const lastBackupAt = Number.isFinite(raw.lastBackupAt) && raw.lastBackupAt > 0 ? raw.lastBackupAt : null;
    return { ok: true, skipped, state: { version: 2, guests, dishes, entries, lastBackupAt } };
  }
  return {
    MESI, GIORNI,
    todayISO, parseISO, isValidISO, addDays, daysInMonth, monthRange, yearRange, fortnightRange, formatDateIt, monthLabelIt, defaultMeal,
    entryPeople, findService, filterEntries, sortEntries, groupByDay, summarize, guestStats,
    PEOPLE_MAX, COLORS, EMOJI_CIBO, newId, normalizeName, nameExists, initial, validateEntry, canDeleteGuest, canDeleteDish, colorForName,
    defaultDishes, emptyState, serializeBackup, parseBackup,
  };
});
