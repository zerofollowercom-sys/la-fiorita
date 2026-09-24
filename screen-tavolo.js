// Tab "Tavolo": il tavolo di un giorno e pasto. Si aggiungono gli ospiti, si sceglie il menu, si preme Salva.
(function () {
  const A = window.App, L = A.L;
  A.screens.tavolo = { render(root) {
    const u = A.ui, today = L.todayISO(), svc = A.currentService(), dirty = A.formDirty();
    const dishes = A.state.dishes.filter(d => !d.hidden || d.id === u.dishId).sort((a, b) => a.order - b.order);
    const total = L.entryPeople({ guests: u.guests });
    const canSave = u.guests.length > 0 && dirty;
    // Cambio giorno o pasto: se c'è una bozza non salvata, chiedo se salvarla
    const changeDay = async (date, meal) => {
      if (A.formDirty()) {
        if (await A.confirm('Hai modifiche non salvate a questo tavolo. Vuoi salvarle?')) {
          const errs = A.saveForm(); if (errs.length) { A.toast(errs[0]); A.render(); return; }
          A.toast('Tavolo salvato ✓');
        }
      }
      u.date = date; u.meal = meal; u.returnTo = null; A.loadForm(); A.render();
    };
    root.innerHTML = `
      ${A.header('La Fiorita 2.0', L.formatDateIt(u.date), true)}
      ${A.backupWarning ? A.backupWarning() : ''}
      ${u.date > today ? '<div class="banner banner-giallo">📅 Stai segnando una data futura</div>' : ''}
      <div class="cols"><div>
      <div class="row"><input type="date" id="tv-date" value="${u.date}"><button class="chip fix ${u.date === today ? 'on' : ''}" id="tv-today">Oggi</button><button class="chip fix ${u.date === L.addDays(today, -1) ? 'on' : ''}" id="tv-yday">Ieri</button></div>
      <div class="seg mt"><button id="tv-pranzo" class="${u.meal === 'pranzo' ? 'on' : ''}">☀️ Pranzo</button><button id="tv-cena" class="${u.meal === 'cena' ? 'on' : ''}">🌙 Cena</button></div>
      <h3>Ospiti al tavolo</h3>
      <div class="list" id="tv-fams">${u.guests.map((g, i) => `<div class="fam"><div class="fam-top">${A.iconBox(L.initial(A.guestName(g.guestId)), L.colorForName(A.guestName(g.guestId)), 'sm')}<span class="name">${A.esc(A.guestName(g.guestId))}</span></div><div class="fam-ctl"><button class="btn btn-sq" data-minus="${i}" aria-label="Meno">−</button><span class="num">${g.people}</span><button class="btn btn-sq" data-plus="${i}" aria-label="Più">＋</button><span class="lbl">persone</span><button class="btn btn-sq danger rm" data-rm="${i}" aria-label="Togli dal tavolo">✕</button></div></div>`).join('')}
        ${u.guests.length ? '' : '<div class="empty" style="padding:10px">Nessun ospite. Tocca il tasto qui sotto.</div>'}</div>
      <button class="btn btn-block bg-viola mt" id="tv-add">＋ Aggiungi ospite</button>
      ${u.guests.length ? `<div class="tot mt"><span>${A.plural(u.guests.length, 'ospite', 'ospiti')}</span><span><span class="big">${total}</span> persone</span></div>` : ''}
      </div><div>
      <h3>Menu</h3>
      <div class="grid2" id="tv-dishes">${dishes.map(d => `<button class="dish ${u.dishId === d.id ? 'on bg-' + d.color : ''}" data-dish="${d.id}">${A.iconBox(d.emoji, d.color)}<span>${A.esc(d.name)}</span></button>`).join('')}</div>
      <div class="mt"><button class="btn btn-block bg-verde" id="tv-save" ${canSave ? '' : 'disabled'}>${svc && !dirty ? '✓ Tavolo salvato' : '✅ Salva tavolo'}</button></div>
      ${(svc || dirty) ? `<div class="row mt">${svc ? '<button class="btn danger" id="tv-del">🗑️ Elimina tavolo</button>' : ''}${dirty ? '<button class="btn" id="tv-cancel">Annulla</button>' : ''}</div>` : ''}
      </div></div>`;
    const q = s => root.querySelector(s);
    q('#tv-date').onchange = e => { if (L.isValidISO(e.target.value)) changeDay(e.target.value, u.meal); };
    q('#tv-today').onclick = () => changeDay(today, u.meal);
    q('#tv-yday').onclick = () => changeDay(L.addDays(today, -1), u.meal);
    q('#tv-pranzo').onclick = () => changeDay(u.date, 'pranzo');
    q('#tv-cena').onclick = () => changeDay(u.date, 'cena');
    q('#tv-dishes').onclick = e => { const b = e.target.closest('[data-dish]'); if (!b) return; u.dishId = u.dishId === b.dataset.dish ? null : b.dataset.dish; A.render(); };
    q('#tv-fams').onclick = e => {
      const m = e.target.closest('[data-minus]'), p = e.target.closest('[data-plus]'), r = e.target.closest('[data-rm]');
      if (m) u.guests[+m.dataset.minus].people = Math.max(1, u.guests[+m.dataset.minus].people - 1);
      else if (p) u.guests[+p.dataset.plus].people = Math.min(L.PEOPLE_MAX, u.guests[+p.dataset.plus].people + 1);
      else if (r) u.guests.splice(+r.dataset.rm, 1);
      else return;
      A.render();
    };
    q('#tv-add').onclick = () => A.pickGuest({ exclude: u.guests.map(g => g.guestId), onPick(id) {
      const g = A.state.guests.find(x => x.id === id); if (!g || u.guests.some(x => x.guestId === id)) return;
      u.guests.push({ guestId: id, people: g.defaultPeople }); A.render();
    } });
    q('#tv-save').onclick = () => {
      const btn = q('#tv-save'); btn.disabled = true;
      const existed = !!A.currentService();
      const errs = A.saveForm(); if (errs.length) { btn.disabled = false; A.toast(errs[0]); return; }
      A.afterForm(); A.render(); A.toast(existed ? 'Modifiche salvate ✓' : 'Tavolo salvato ✓');
    };
    if (q('#tv-cancel')) q('#tv-cancel').onclick = () => { A.afterForm(); A.render(); };
    if (q('#tv-del')) q('#tv-del').onclick = async () => {
      if (!await A.confirm(`Eliminare il tavolo di ${A.mealLabel(u.meal)} del ${L.formatDateIt(u.date)}?`)) return;
      A.state.entries = A.state.entries.filter(x => x !== svc); A.afterForm(); A.save(); A.toast('Eliminato');
    };
  } };
})();
