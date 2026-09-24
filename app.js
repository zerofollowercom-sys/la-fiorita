// La Fiorita 2.0 — stato globale, navigazione, helper DOM condivisi (intestazione, sheet, toast, selettore famiglia)
window.App = (function () {
  const L = window.LaFioritaLogic;
  let storage = null;
  try { storage = window.localStorage; } catch (_) { storage = null; }
  const noStorage = { getItem() { throw new Error('no storage'); }, setItem() { throw new Error('no storage'); } };
  const store = window.LaFioritaStore.createStore(storage || noStorage, L);
  const now = new Date();
  const ACCESS_KEY = 'lafiorita.access';
  const ACCESS_HASH = '7c53f6a6'; // hash del codice di accesso (vedi hashPin); per cambiarlo: node -e "..." e ricostruire
  function hashPin(str) { let h = 5381; for (const ch of String(str)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0'); }

  const App = {
    L, store, screens: {},
    get state() { return store.state; },
    ui: {
      tab: 'tavolo',
      // bozza del tavolo: data + pasto + menu + famiglie; si scrive in state.entries con il tasto Salva
      date: L.todayISO(now), meal: L.defaultMeal(now.getHours()), dishId: null, guests: [], returnTo: null,
      report: { mode: 'mese', year: now.getFullYear(), month: now.getMonth() + 1, from: null, to: null, guestId: null, meal: null, showAllGuests: false },
      storicoLimit: 30, showArchived: false,
    },
    lastToday: L.todayISO(now),
    unlocked: false,
    hashPin,
    // ---- codice di accesso ----
    checkAccess() {
      try { if (storage && storage.getItem(ACCESS_KEY) === 'ok') App.unlocked = true; } catch (_) { /* senza memoria si chiede il codice ogni volta */ }
      return App.unlocked;
    },
    unlock() { App.unlocked = true; try { if (storage) storage.setItem(ACCESS_KEY, 'ok'); } catch (_) { /* pazienza */ } },
    renderLock() {
      const main = document.getElementById('screens');
      document.getElementById('tabbar').hidden = true;
      main.innerHTML = `<section class="screen" id="lock"><div class="center" style="padding-top:8vh"><img class="logo" src="logo.png" alt="La Fiorita" style="margin:0 auto 10px" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><h1 hidden>La Fiorita 2.0</h1>
        <p class="sub">Scrivi il codice per entrare</p></div>
        <div class="field"><label>Codice</label><input type="tel" inputmode="numeric" id="lock-pin" autocomplete="off" placeholder="····" style="text-align:center;font-size:1.8rem;letter-spacing:.3em"></div>
        <button class="btn btn-block bg-verde" id="lock-go">Entra</button><p class="muted center mt">Lo chiede solo la prima volta su questo telefono.</p></section>`;
      const go = () => {
        const v = main.querySelector('#lock-pin').value.trim();
        if (hashPin(v) === ACCESS_HASH) { App.unlock(); App.mount(); }
        else { App.toast('Codice sbagliato'); main.querySelector('#lock-pin').value = ''; main.querySelector('#lock-pin').focus(); }
      };
      main.querySelector('#lock-go').onclick = go;
      main.querySelector('#lock-pin').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      main.querySelector('#lock-pin').focus();
    },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    iconBox(emoji, color, cls) { return `<span class="ico bg-${color || 'grigio'} ${cls || ''}">${App.esc(emoji)}</span>`; },
    guestName(id) { const g = store.state.guests.find(x => x.id === id); return g ? g.name : 'Ospite eliminato'; },
    dish(id) { return store.state.dishes.find(x => x.id === id) || { name: id == null ? 'Senza menu' : 'Menu eliminato', emoji: '❔', color: 'grigio' }; },
    mealLabel(m) { return m === 'pranzo' ? '☀️ Pranzo' : '🌙 Cena'; },
    plural(n, s, p) { return `${n} ${n === 1 ? s : p}`; },
    // Intestazione con titolo, sottotitolo e ingranaggio per "Altro"
    // Nella tab Tavolo, al posto del titolo, il logo (logo.png); se il file manca resta la scritta
    header(title, sub, withLogo) {
      const brand = withLogo
        ? `<img class="logo" src="logo.png" alt="La Fiorita" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><h1 hidden>${title}</h1>`
        : `<h1>${title}</h1>`;
      return `<div class="head"><div class="brand">${brand}${sub ? `<p class="sub">${sub}</p>` : ''}</div><button class="btn btn-sq" data-go="impostazioni" aria-label="Altro">⚙️</button></div>`;
    },

    // ---- bozza del tavolo ----
    currentService() { return L.findService(store.state.entries, App.ui.date, App.ui.meal); },
    loadForm() {
      const svc = App.currentService();
      App.ui.dishId = svc ? svc.dishId : null;
      App.ui.guests = svc ? svc.guests.map(g => ({ guestId: g.guestId, people: g.people })) : [];
    },
    formDirty() {
      const svc = App.currentService(); const u = App.ui;
      if (!svc) return !!u.dishId || u.guests.length > 0;
      return svc.dishId !== u.dishId || JSON.stringify(svc.guests) !== JSON.stringify(u.guests);
    },
    // Scrive la bozza nel tavolo del giorno/pasto. Torna gli errori (vuoto = salvato)
    saveForm() {
      const u = App.ui;
      const entry = { date: u.date, meal: u.meal, dishId: u.dishId, guests: u.guests.map(g => ({ guestId: g.guestId, people: g.people })) };
      const errs = L.validateEntry(entry, store.state); if (errs.length) return errs;
      const existing = App.currentService();
      if (existing) Object.assign(existing, { dishId: entry.dishId, guests: entry.guests, updatedAt: Date.now() });
      else store.state.entries.push(Object.assign({ id: L.newId(), createdAt: Date.now(), updatedAt: Date.now() }, entry));
      store.save(); App.refreshBanners();
      return [];
    },
    // Apre il tavolo di un giorno e pasto (da Storico o Conti); dopo Salva si torna a data e pasto di prima
    openService(date, meal) {
      const u = App.ui;
      if (!u.returnTo && (date !== u.date || meal !== u.meal)) u.returnTo = { date: u.date, meal: u.meal };
      u.date = date; u.meal = meal; App.loadForm(); App.go('tavolo');
    },
    afterForm() {
      const u = App.ui;
      if (u.returnTo) { u.date = u.returnTo.date; u.meal = u.returnTo.meal; u.returnTo = null; }
      App.loadForm();
    },
    // L'app in Home resta congelata per giorni: alla ripresa, se non c'è niente da salvare e la data era "oggi", passa al nuovo oggi
    refreshDay(nowDate) {
      const u = App.ui, t = L.todayISO(nowDate);
      if (!App.formDirty() && u.date === App.lastToday && t !== App.lastToday) { u.date = t; u.meal = L.defaultMeal(nowDate.getHours()); u.returnTo = null; App.loadForm(); }
      App.lastToday = t; App.render();
    },
    refreshBanners() {
      const el = document.getElementById('storage-warning');
      let msg = '';
      if (!store.storageOk) msg = '⚠️ Memoria del telefono non disponibile: i dati non verranno salvati.';
      else if (store.loadError) msg = '⚠️ I dati salvati erano illeggibili: si riparte da zero. Una copia grezza è conservata nella memoria del telefono (chiave lafiorita.v2.broken).';
      else if (store.loadSkipped > 0) msg = `⚠️ ${store.loadSkipped} righe salvate non erano valide e sono state scartate.`;
      el.textContent = msg; el.hidden = !msg;
    },

    start() {
      store.load(); App.loadForm();
      App.refreshBanners();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) App.refreshDay(new Date()); });
      window.addEventListener('pageshow', () => App.refreshDay(new Date()));
      document.getElementById('tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) App.go(b.dataset.tab); });
      document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); App.go(a.dataset.go); } });
      document.getElementById('sheet-close').addEventListener('click', App.closeSheet);
      document.getElementById('sheet-backdrop').addEventListener('click', e => { if (e.target.id === 'sheet-backdrop') App.closeSheet(); });
      App.screensHtml = document.getElementById('screens').innerHTML;
      if (App.checkAccess()) App.mount(); else App.renderLock();
    },
    mount() {
      document.getElementById('screens').innerHTML = App.screensHtml;
      document.getElementById('tabbar').hidden = false;
      App.render();
    },
    go(tab) { App.ui.tab = tab; App.render(); window.scrollTo(0, 0); },
    render() {
      if (!App.unlocked) return;
      document.querySelectorAll('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === App.ui.tab));
      document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'tab-' + App.ui.tab; });
      const scr = App.screens[App.ui.tab]; const root = document.getElementById('tab-' + App.ui.tab);
      if (scr) scr.render(root);
    },
    save() { const ok = store.save(); App.refreshBanners(); App.render(); return ok; },
    toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 1800); },
    sheet({ title, html, onMount }) {
      document.getElementById('sheet-title').textContent = title || '';
      const body = document.getElementById('sheet-body'); body.innerHTML = html;
      document.getElementById('sheet-backdrop').hidden = false; document.body.style.overflow = 'hidden';
      document.getElementById('sheet').scrollTop = 0;
      if (onMount) onMount(body);
    },
    closeSheet() {
      document.getElementById('sheet-backdrop').hidden = true; document.body.style.overflow = '';
      if (App._confirmPending) { const r = App._confirmPending; App._confirmPending = null; r(false); } // chiusa con ✕ o toccando fuori = No
    },
    // Conferma dentro l'app (window.confirm è bloccato nel riquadro di claude.ai): foglio con Sì / No
    _confirmPending: null,
    confirm(msg) {
      return new Promise(resolve => {
        const done = v => { App._confirmPending = null; App.closeSheet(); resolve(v); };
        App.sheet({
          title: 'Conferma',
          html: `<p style="font-size:1.1rem;margin:4px 0 18px;white-space:pre-line">${App.esc(msg)}</p><div class="row"><button class="btn" id="cf-no">No</button><button class="btn bg-verde" id="cf-yes">Sì</button></div>`,
          onMount(b) { b.querySelector('#cf-yes').onclick = () => done(true); b.querySelector('#cf-no').onclick = () => done(false); },
        });
        App._confirmPending = resolve;
      });
    },

    // Foglio "Scegli la famiglia": ricerca, elenco attive (meno quelle escluse), nuova famiglia al volo
    pickGuest({ allowAll, exclude, onPick }) {
      const ex = new Set(exclude || []);
      const draw = (q) => {
        const n = L.normalizeName(q);
        const list = store.state.guests.filter(g => !g.archived && !ex.has(g.id) && (!n || L.normalizeName(g.name).includes(n))).sort((a, b) => a.name.localeCompare(b.name));
        return (allowAll ? `<button class="item" data-pick=""><span class="ico bg-grigio">👥</span><div class="grow"><div class="name">Tutti gli ospiti</div></div></button>` : '') +
          (list.length
            ? list.map(g => `<button class="item" data-pick="${g.id}">${App.iconBox(L.initial(g.name), L.colorForName(g.name))}<div class="grow"><div class="name">${App.esc(g.name)}</div><div class="meta">di solito ${App.plural(g.defaultPeople, 'persona', 'persone')}</div></div></button>`).join('')
            : `<div class="empty">Nessun ospite trovato</div>`);
      };
      App.sheet({
        title: 'Scegli l\'ospite',
        html: `<input type="search" id="pg-q" placeholder="Cerca…" autocomplete="off"><button class="btn btn-block bg-verde mt" id="pg-new">＋ Nuovo ospite</button><div class="list mt" id="pg-list">${draw('')}</div>`,
        onMount(body) {
          const q = body.querySelector('#pg-q'), list = body.querySelector('#pg-list');
          q.addEventListener('input', () => { list.innerHTML = draw(q.value); });
          list.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; App.closeSheet(); onPick(b.dataset.pick || null); });
          body.querySelector('#pg-new').addEventListener('click', () => App.editGuestSheet(null, g => onPick(g.id), q.value));
        },
      });
    },

    // Foglio nuova/modifica famiglia
    editGuestSheet(guest, done, presetName) {
      const isNew = !guest;
      App.sheet({
        title: isNew ? 'Nuovo ospite' : 'Modifica ospite',
        html: `<div class="field"><label>Nome (es. Rossi, o Famiglia Rossi)</label><input type="text" id="eg-name" value="${App.esc(guest ? guest.name : (presetName || ''))}" autocomplete="off"></div>
               <div class="field"><label>Persone di solito</label><div class="counter"><button class="btn btn-big" id="eg-minus">−</button><span class="num" id="eg-num">${guest ? guest.defaultPeople : 2}</span><button class="btn btn-big" id="eg-plus">＋</button></div></div>
               <div class="muted" id="eg-err"></div>
               <button class="btn btn-block bg-verde mt" id="eg-save">Salva</button>`,
        onMount(body) {
          let n = guest ? guest.defaultPeople : 2; const num = body.querySelector('#eg-num');
          body.querySelector('#eg-minus').onclick = () => { n = Math.max(1, n - 1); num.textContent = n; };
          body.querySelector('#eg-plus').onclick = () => { n = Math.min(L.PEOPLE_MAX, n + 1); num.textContent = n; };
          const nameInput = body.querySelector('#eg-name'); nameInput.focus();
          const save = () => {
            const name = nameInput.value.trim(); const err = body.querySelector('#eg-err');
            if (!name) { err.textContent = 'Scrivi un nome'; return; }
            if (L.nameExists(store.state.guests, name, guest && guest.id)) { err.textContent = 'Esiste già un ospite con questo nome'; return; }
            let g = guest;
            if (isNew) { g = { id: L.newId(), name, defaultPeople: n, createdAt: Date.now(), archived: false }; store.state.guests.push(g); }
            else { g.name = name; g.defaultPeople = n; }
            App.save(); App.closeSheet(); App.toast(isNew ? 'Ospite creato ✓' : 'Salvato ✓'); if (done) done(g);
          };
          body.querySelector('#eg-save').onclick = save;
          nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
        },
      });
    },
  };
  return App;
})();
