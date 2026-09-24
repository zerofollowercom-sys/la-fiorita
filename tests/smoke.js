// Smoke test dell'interfaccia (modello v2: un tavolo per giorno e pasto, si salva da solo). Scrive OK/FAIL in <pre id="smoke">
(async function () {
  const out = document.getElementById('smoke'); const lines = [];
  const log = (ok, msg) => { lines.push((ok ? 'OK   ' : 'FAIL ') + msg); out.textContent = lines.join('\n'); };
  const $ = s => document.querySelector(s);
  const click = s => { const el = $(s); if (!el) { log(false, 'manca ' + s); return false; } el.click(); return true; };
  const type = (s, v) => { const el = $(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const A = window.App, L = A.L;
  const realConfirm = A.confirm;
  const tick = () => new Promise(r => setTimeout(r, 0));
  const ticks = async n => { for (let i = 0; i < n; i++) await tick(); };
  const waitFor = async (fn, max = 400) => { for (let i = 0; i < max; i++) { if (fn()) return true; await tick(); } return fn(); }; // il FileReader è asincrono: aspetto la condizione, non un numero fisso di giri
  const saved = () => JSON.parse(localStorage.getItem('lafiorita.v2'));
  try {
    // Codice di accesso: all'avvio senza codice memorizzato si vede la schermata del codice
    log(!!$('#lock-pin') && getComputedStyle(document.getElementById('tabbar')).display === 'none' && !A.unlocked, 'schermata del codice all\'avvio, tab davvero nascoste');
    type('#lock-pin', '0000'); click('#lock-go'); log(!!$('#lock-pin') && $('#toast').textContent === 'Codice sbagliato', 'codice sbagliato: resta bloccata');
    type('#lock-pin', '2026'); click('#lock-go'); log(!$('#lock-pin') && A.unlocked && !document.getElementById('tabbar').hidden && localStorage.getItem('lafiorita.access') === 'ok' && !!$('#tv-add'), 'codice giusto: entra, ricordato sul dispositivo');
    localStorage.clear(); A.store.load(); A.ui.date = '2026-09-10'; A.ui.meal = 'pranzo'; A.lastToday = L.todayISO(); A.loadForm(); A.render(); // lastToday = oggi vero: così pageshow/visibilitychange non spostano la data durante il test
    log(A.state.dishes.length === 4 && A.state.entries.length === 0, 'stato iniziale: 4 menu, 0 tavoli');
    // Conferma interna all'app (niente window.confirm)
    let pc = realConfirm('Prova?'); log(!$('#sheet-backdrop').hidden && $('#sheet-body').textContent.includes('Prova?'), 'conferma: foglio aperto con la domanda');
    click('#cf-yes'); log((await pc) === true && $('#sheet-backdrop').hidden, 'conferma: Sì → true e foglio chiuso');
    pc = realConfirm('Prova?'); click('#cf-no'); log((await pc) === false, 'conferma: No → false');
    pc = realConfirm('Prova?'); click('#sheet-close'); log((await pc) === false, 'conferma: chiusa con ✕ → false');
    A.confirm = () => Promise.resolve(true);

    // Colori
    document.body.insertAdjacentHTML('beforeend', '<div id="cc"><span class="ico bg-rosa">x</span><button class="dish on bg-giallo">y</button><div class="stat bg-verde">z</div></div>');
    const bg = s => getComputedStyle($(s)).backgroundColor;
    log(bg('#cc .ico') === 'rgb(242, 84, 125)' && bg('#cc .dish') === 'rgb(245, 200, 66)' && bg('#cc .stat') === 'rgb(123, 192, 67)', 'classi bg-* colorano icone, menu e tile');
    $('#cc').remove();

    // Famiglie
    A.go('gruppi'); click('#gr-new'); type('#eg-name', 'Famiglia Rossi'); click('#eg-plus'); click('#eg-plus'); click('#eg-save');
    log(A.state.guests.length === 1 && A.state.guests[0].defaultPeople === 4, 'nuova famiglia Rossi con 4 persone');
    click('#gr-new'); type('#eg-name', ' famiglia rossi '); click('#eg-save');
    log(A.state.guests.length === 1 && /Esiste già/.test($('#eg-err').textContent), 'duplicato rifiutato'); A.closeSheet();
    click('#gr-new'); type('#eg-name', 'Bianchi'); click('#eg-minus'); click('#eg-save');
    log(A.state.guests.length === 2 && $('#tab-gruppi').textContent.includes('2 ospiti attivi'), 'seconda famiglia, contatore');
    const rossi = A.state.guests[0], bianchi = A.state.guests[1];

    // Tavolo: aggiungo due famiglie, scelgo il menu, Salva
    A.go('tavolo');
    log(!A.currentService() && $('#tv-save').disabled, 'tavolo vuoto: Salva disabilitato');
    click('#tv-add'); type('#pg-q', 'ross'); let picks = document.querySelectorAll('#pg-list [data-pick]');
    log(picks.length === 1, 'ricerca "ross" trova 1 famiglia'); picks[0].click();
    log(A.ui.guests.length === 1 && A.ui.guests[0].people === 4 && !$('#tv-save').disabled && A.state.entries.length === 0, 'Rossi in bozza con 4 persone, Salva abilitato, niente ancora salvato');
    click('#tv-add'); picks = document.querySelectorAll('#pg-list [data-pick]');
    log(picks.length === 1 && picks[0].dataset.pick === bianchi.id, 'il selettore esclude chi è già al tavolo'); picks[0].click();
    log(A.ui.guests.length === 2 && $('#tab-tavolo').textContent.includes('2 ospiti') && $('.tot .big').textContent === '5', 'due famiglie, 5 persone');
    click('[data-plus="1"]'); click('[data-plus="1"]'); log(A.ui.guests[1].people === 3, '+ + su Bianchi → 3');
    click('[data-minus="0"]'); log(A.ui.guests[0].people === 3, '− su Rossi → 3');
    click('#tv-dishes [data-dish]'); log(A.ui.dishId === A.state.dishes[0].id, 'menu Pizza scelto');
    click('#tv-save'); let svc = A.currentService();
    log(svc && svc.guests.length === 2 && svc.dishId === A.state.dishes[0].id && saved().entries.length === 1 && $('#toast').textContent === 'Tavolo salvato ✓', 'Salva: tavolo scritto e salvato');
    log($('#tv-save').disabled && $('#tv-save').textContent.includes('Tavolo salvato') && !!$('#tv-del'), 'dopo Salva: bottone "Tavolo salvato", Elimina disponibile');
    click('[data-plus="0"]'); log(!$('#tv-save').disabled && !!$('#tv-cancel'), 'modifica → Salva e Annulla disponibili');
    click('#tv-cancel'); log(A.ui.guests[0].people === 3 && $('#tv-save').disabled, 'Annulla ripristina la bozza');
    // cambio pasto con bozza non salvata: chiede e salva
    click('[data-plus="0"]'); click('#tv-cena'); await ticks(3);
    log(L.findService(A.state.entries, '2026-09-10', 'pranzo').guests[0].people === 4 && A.ui.meal === 'cena' && A.ui.guests.length === 0, 'cambio pasto con bozza: salvata su conferma, cena vuota');
    A.confirm = () => Promise.resolve(false); click('#tv-add'); $(`#pg-list [data-pick="${bianchi.id}"]`).click(); click('#tv-pranzo'); await ticks(3);
    log(!L.findService(A.state.entries, '2026-09-10', 'cena') && A.ui.meal === 'pranzo', 'cambio pasto rifiutando: bozza scartata'); A.confirm = () => Promise.resolve(true);
    // tavolo di cena: Bianchi 1 persona, Carne, senza famiglie non si salva, menu facoltativo
    click('#tv-cena'); click('#tv-dishes [data-dish]'); log($('#tv-save').disabled, 'solo menu senza famiglie: Salva disabilitato');
    click('#tv-add'); $(`#pg-list [data-pick="${bianchi.id}"]`).click(); click('#tv-dishes .dish.on'); document.querySelectorAll('#tv-dishes [data-dish]')[1].click(); click('#tv-save');
    log(A.state.entries.length === 2 && A.currentService().meal === 'cena' && A.currentService().guests[0].people === 1 && A.currentService().dishId === A.state.dishes[1].id, 'tavolo di cena con Bianchi (1 persona) e Carne');
    click('#tv-pranzo'); log(A.ui.guests.length === 2 && A.ui.guests[0].people === 4, 'tornando a pranzo si rivede il tavolo di pranzo');
    A.ui.date = '2099-01-01'; A.loadForm(); A.render(); log($('#tab-tavolo').textContent.includes('data futura'), 'banner data futura'); A.ui.date = '2026-09-10'; A.loadForm(); A.render();

    // Storico
    A.go('storico'); const st = () => $('#tab-storico').textContent;
    log(document.querySelectorAll('#tab-storico .svc').length === 2 && st().includes('giovedì 10 settembre') && st().includes('8 persone'), 'storico: 1 giorno, 2 righe, 8 persone');
    log(st().includes('Pranzo · Pizza') && st().includes('Famiglia Rossi') && st().includes('Cena · Carne') && st().includes('Bianchi'), 'righe con pasto, menu e famiglie');
    document.querySelectorAll('#tab-storico .svc')[1].click(); log(A.ui.tab === 'tavolo' && A.ui.meal === 'cena' && A.ui.date === '2026-09-10' && A.ui.guests.length === 1, 'tocco su riga → Tavolo di quella cena');

    // Famiglie: dettaglio
    A.go('gruppi'); $(`[data-g="${rossi.id}"]`).click();
    log(!!$('#gd-del') && !!$('#gd-arch') && $('#sheet-body').textContent.includes('Ultime visite'), 'dettaglio: Archivia ed Elimina, ultime visite');
    click('#gd-arch'); log(rossi.archived === true, 'archiviata');
    A.go('tavolo'); click('#tv-add'); log(document.querySelectorAll('#pg-list [data-pick]').length === 0, 'archiviata (e già al tavolo Bianchi) → selettore vuoto'); A.closeSheet();
    A.go('gruppi'); click('#gr-arch'); $(`[data-g="${rossi.id}"]`).click(); click('#gd-arch'); log(rossi.archived === false, 'ripristinata'); click('#gr-arch');

    // Menu
    A.go('portate'); click('#pt-new'); type('#ed-name', 'Dolce'); document.querySelectorAll('#ed-emoji [data-e]')[30].click(); document.querySelectorAll('#ed-color [data-c]')[3].click(); click('#ed-save');
    log(A.state.dishes.length === 5 && A.state.dishes[4].name === 'Dolce' && A.state.dishes[4].emoji === '🍰' && A.state.dishes[4].color === 'viola', 'nuovo menu Dolce 🍰 viola');
    const dolce = A.state.dishes[4]; $(`[data-up="${dolce.id}"]`).click();
    log(A.state.dishes.slice().sort((a, b) => a.order - b.order)[3].name === 'Dolce', 'Dolce spostato su di uno');
    const pizza = A.state.dishes[0]; $(`[data-edit="${pizza.id}"]`).click(); log(!!$('#pd-del') && !!$('#pd-hide') && $('#sheet-body').textContent.includes('Menu eliminato'), 'menu usato: Nascondi ed Elimina con avviso'); click('#pd-hide');
    log(pizza.hidden === true, 'Pizza nascosta');
    A.go('tavolo'); click('#tv-cena'); await ticks(2); log(document.querySelectorAll('#tv-dishes [data-dish]').length === 4, 'Pizza non compare più fra i bottoni'); click('#tv-pranzo'); await ticks(2);
    log(document.querySelectorAll('#tv-dishes [data-dish]').length === 5, 'ma resta visibile dove è già scelta');
    A.go('portate'); $(`[data-edit="${dolce.id}"]`).click(); log(!!$('#pd-del') && !$('#pd-hide'), 'menu mai usato: solo Elimina'); click('#pd-del'); await ticks(2); log(A.state.dishes.length === 4, 'Dolce eliminato');
    // elimino un menu usato: i pasti restano, con "Menu eliminato"
    const carne = A.state.dishes[1]; $(`[data-edit="${carne.id}"]`).click(); click('#pd-del'); await ticks(2);
    log(A.state.dishes.length === 3 && A.state.entries.length === 2 && A.dish(carne.id).name === 'Menu eliminato', 'menu usato eliminato: pasti conservati con "Menu eliminato"');
    A.go('storico'); log($('#tab-storico').textContent.includes('Menu eliminato'), 'storico mostra "Menu eliminato"');
    A.state.dishes.splice(1, 0, carne); A.save(); // lo rimetto per i test successivi

    // Conti
    A.ui.report = { mode: 'mese', year: 2026, month: 9, from: null, to: null, guestId: null, meal: null, showAllGuests: false };
    A.go('rendiconto'); const t = () => $('#tab-rendiconto').textContent; const val = i => document.querySelectorAll('#tab-rendiconto .stat .val')[i].textContent;
    log(t().includes('Settembre 2026') && val(0) === '2' && val(1) === '8', 'mese: 2 tavoli, 8 persone');
    log(t().includes('Pizza') && t().includes('(nascosto)') && t().includes('Per ospite') && t().includes('2 volte'), 'menu nascosto e classifica famiglie');
    click('[data-meal="cena"]'); log(val(0) === '1' && document.querySelectorAll('#tab-rendiconto .svc').length === 0, 'filtro cena: 1 tavolo, nessun elenco righe (sta nello Storico)');
    click('[data-meal=""]'); click('#rp-guest'); $(`#pg-list [data-pick="${bianchi.id}"]`).click();
    log(A.ui.report.guestId === bianchi.id && !t().includes('Per ospite') && val(0) === '2' && val(1) === '4', 'filtro Bianchi: 2 volte, 4 persone (solo le sue)');
    click('#rp-guest'); document.querySelectorAll('#pg-list [data-pick]')[0].click(); log(A.ui.report.guestId === null, 'Tutte le famiglie');
    click('#rp-prev'); log(t().includes('Agosto 2026') && t().includes('Nessun tavolo'), 'mese precedente vuoto');
    A.ui.report.month = 1; A.render(); click('#rp-prev'); log(A.ui.report.year === 2025 && A.ui.report.month === 12, 'dicembre→gennaio cambia anno');
    A.ui.report.year = 2026; A.ui.report.month = 9; click('[data-mode="da-a"]'); click('[data-q="2"]');
    log($('#rp-from').value === '2026-09-16' && $('#rp-to').value === '2026-09-30', '16–fine settembre');
    click('[data-q="1"]'); log($('#rp-to').value === '2026-09-15' && val(0) === '2', '1–15 include i 2 tavoli del 10');
    click('[data-mode="anno"]'); log(t().includes('2026') && val(0) === '2', 'anno 2026: 2 tavoli');
    // Storico: i gestori di click non si accumulano; aperto da lì un altro giorno, dopo Salva si torna a data e pasto di prima
    A.go('storico'); for (let i = 0; i < 5; i++) A.render();
    let renders = 0; const origT = A.screens.tavolo.render; A.screens.tavolo.render = function (r) { renders++; return origT.call(this, r); };
    $('#tab-storico .svc').click(); A.screens.tavolo.render = origT;
    log(renders === 1 && A.ui.tab === 'tavolo', 'un tocco su una riga = un solo render (' + renders + ')');
    A.ui.date = '2026-09-24'; A.ui.meal = 'pranzo'; A.ui.returnTo = null; A.loadForm(); A.go('storico'); $('#tab-storico .svc').click();
    log(A.ui.date === '2026-09-10' && A.ui.returnTo && A.ui.returnTo.date === '2026-09-24', 'da Storico: data del tavolo aperto, ritorno memorizzato');
    click('[data-plus="0"]'); click('#tv-save'); log(A.ui.date === '2026-09-24' && A.ui.meal === 'pranzo' && !A.ui.returnTo, 'dopo Salva torna a oggi');

    // Ripresa il giorno dopo
    A.ui.date = '2026-09-10'; A.lastToday = '2026-09-10'; A.loadForm(); A.refreshDay(new Date(2026, 8, 24, 19, 0));
    log(A.ui.date === '2026-09-24' && A.ui.meal === 'cena', 'ripresa il giorno dopo: data oggi e pasto cena');
    A.ui.date = '2026-09-01'; A.lastToday = '2026-09-24'; A.loadForm(); A.refreshDay(new Date(2026, 8, 25, 11, 0));
    log(A.ui.date === '2026-09-01', 'ripresa con una data scelta a mano: resta');
    A.ui.date = '2026-09-24'; A.lastToday = '2026-09-24'; A.loadForm(); A.ui.guests.push({ guestId: rossi.id, people: 2 }); A.refreshDay(new Date(2026, 8, 25, 11, 0));
    log(A.ui.date === '2026-09-24' && A.ui.guests.length === 1, 'ripresa con una bozza non salvata: non si tocca nulla'); A.ui.guests = [];
    A.ui.date = '2026-09-10'; A.lastToday = L.todayISO(); A.loadForm();

    // Altro: banner backup con ≥10 tavoli, backup nelle tre varianti, ripristino, dati corrotti, cancella tutto
    for (let i = 0; i < 9; i++) A.state.entries.push({ id: 'x' + i, date: '2026-08-0' + (i + 1), meal: 'pranzo', dishId: A.state.dishes[1].id, guests: [{ guestId: rossi.id, people: 2 }], createdAt: 0, updatedAt: 0 });
    A.save(); A.go('tavolo'); log($('#tab-tavolo').textContent.includes('mai salvato una copia'), 'banner backup con 11 tavoli');
    A.state.lastBackupAt = Date.now(); A.render(); log(!$('#tab-tavolo').textContent.includes('mai salvato'), 'banner sparisce dopo backup');
    click('[data-go="impostazioni"]'); log(A.ui.tab === 'impostazioni' && $('#tab-impostazioni').textContent.includes('11 pasti · 2 ospiti · 4 menu'), 'ingranaggio → Altro, riga Dati');
    let savedReq = null; window.claude = { use: async n => n === 'downloads' ? { save: async r => { savedReq = r; return { status: 'saved' }; } } : null };
    A.state.lastBackupAt = null; A.render(); click('#st-backup'); await ticks(5);
    log(savedReq && savedReq.filename === 'lafiorita-backup-' + L.todayISO() + '.json' && JSON.parse(savedReq.data).entries.length === 11 && A.state.lastBackupAt !== null, 'Salva copia via claude.use("downloads")');
    window.claude = { use: async () => { const e = new Error('no'); e.code = 'declined'; return { save: async () => { throw e; } }; } };
    A.state.lastBackupAt = null; A.save(); click('#st-backup'); await ticks(5); log(A.state.lastBackupAt === null, 'rifiuto del viewer: nessun backup registrato');
    delete window.claude; const origShare = navigator.share, origCan = navigator.canShare; let shared = null;
    navigator.canShare = d => !!(d && d.files); navigator.share = async d => { shared = d; };
    click('#st-backup'); await ticks(5); log(shared && shared.files[0].name === 'lafiorita-backup-' + L.todayISO() + '.json' && A.state.lastBackupAt !== null, 'Salva copia via foglio di condivisione iOS');
    navigator.share = async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }; A.state.lastBackupAt = null; A.save(); click('#st-backup'); await ticks(5);
    log(A.state.lastBackupAt === null, 'condivisione annullata: nessun backup registrato');
    navigator.canShare = () => false; let clicked = null; const origClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { clicked = this.download; };
    click('#st-backup'); await ticks(5); HTMLAnchorElement.prototype.click = origClick; navigator.share = origShare; navigator.canShare = origCan;
    log(clicked === 'lafiorita-backup-' + L.todayISO() + '.json' && A.state.lastBackupAt !== null, 'fuori da claude.ai: download classico');
    const setFile = (text) => { const dt = new DataTransfer(); dt.items.add(new File([text], 'b.json', { type: 'application/json' })); const inp = $('#st-file'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
    const before = A.state.entries.length; setFile('{oops'); await waitFor(() => /backup valido/.test($('#toast').textContent));
    log(A.state.entries.length === before && /backup valido/.test($('#toast').textContent), 'ripristino corrotto: toast e dati intatti');
    setFile(JSON.stringify({ version: 1, guests: [{ id: 'gz', name: 'Zeta', defaultPeople: 3 }], dishes: A.state.dishes, entries: [{ id: 'ez', date: '2026-08-01', meal: 'cena', guestId: 'gz', people: 3, dishId: A.state.dishes[0].id }, { id: 'ey', date: '2026-08-01', meal: 'cena', guestId: 'gz', people: 2, dishId: A.state.dishes[0].id }], lastBackupAt: null }));
    await waitFor(() => A.state.guests.length && A.state.guests[0].name === 'Zeta');
    log(A.state.entries.length === 1 && A.state.guests[0].name === 'Zeta' && A.state.entries[0].guests[0].people === 5, 'ripristino di un backup vecchio (v1): convertito in un tavolo da 5');
    localStorage.setItem('lafiorita.v2', '{oops'); A.store.load(); A.refreshBanners();
    log(!$('#storage-warning').hidden && /illeggibili/.test($('#storage-warning').textContent) && localStorage.getItem('lafiorita.v2.broken') === '{oops', 'dati illeggibili: banner e copia grezza');
    localStorage.removeItem('lafiorita.v2.broken'); A.store.loadError = null; A.save(); A.refreshBanners(); log($('#storage-warning').hidden, 'banner sparisce quando i dati sono sani');
    A.state.guests = [{ id: 'gz', name: 'Zeta', defaultPeople: 3, createdAt: 0, archived: false }]; A.save(); A.go('impostazioni');
    click('#st-wipe'); await ticks(2);
    log(A.state.entries.length === 0 && A.state.guests.length === 0 && A.state.dishes.length === 4 && saved().entries.length === 0, 'Cancella tutto svuota e salva');
    click('[data-go="tavolo"]'); log(A.ui.tab === 'tavolo', '✕ in Altro torna al Tavolo');
  } catch (err) { log(false, 'ECCEZIONE ' + (err && err.stack || err)); }
  lines.push('SMOKE DONE ' + lines.filter(l => l.startsWith('FAIL')).length + ' fail'); out.textContent = lines.join('\n');
})();
