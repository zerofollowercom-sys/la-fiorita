// Tab "Ospiti": schede, dettaglio, archivio
(function () {
  const A = window.App, L = A.L;
  const COL = { rosa: '#F2547D', verde: '#7BC043', giallo: '#F5C842', viola: '#6C4BE0', azzurro: '#4FB3E8', arancio: '#F58A3C', grigio: '#B8B8B8' };
  function detail(g) {
    const st = L.guestStats(A.state.entries)[g.id] || { tables: 0, people: 0 };
    const last = L.sortEntries(A.state.entries.filter(e => e.guests.some(x => x.guestId === g.id))).slice(0, 5);
    const used = !L.canDeleteGuest(g.id, A.state.entries);
    A.sheet({ title: g.name, html: `
      <div class="grid2"><div class="stat"><div class="lbl">Volte</div><div class="val">${st.tables}</div></div><div class="stat"><div class="lbl">Persone</div><div class="val">${st.people}</div></div></div>
      <div class="row mt"><button class="btn" id="gd-edit">✏️ Modifica</button>${used ? `<button class="btn" id="gd-arch">${g.archived ? '↩️ Ripristina' : '📦 Archivia'}</button>` : ''}<button class="btn danger" id="gd-del">🗑️ Elimina</button></div>
      ${used ? '<p class="muted">Ha pasti già segnati: se lo elimini, in quei pasti comparirà "Ospite eliminato". Archiviare lo toglie solo dall\'elenco.</p>' : ''}
      ${last.length ? '<h3>Ultime visite</h3><div class="list">' + last.map(e => { const d = A.dish(e.dishId); const row = e.guests.find(x => x.guestId === g.id); return `<div class="item" style="cursor:default">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${L.formatDateIt(e.date)}</div><div class="meta">${A.mealLabel(e.meal)} · ${A.esc(d.name)}</div></div><span class="n">${row ? row.people : 0}</span></div>`; }).join('') + '</div>' : ''}`,
      onMount(b) {
        b.querySelector('#gd-edit').onclick = () => A.editGuestSheet(g, () => A.render());
        b.querySelector('#gd-del').onclick = async () => {
          const msg = used ? `Eliminare "${g.name}"?\nNei pasti già segnati resterà la scritta "Ospite eliminato".` : `Eliminare "${g.name}"?`;
          if (await A.confirm(msg)) { A.state.guests = A.state.guests.filter(x => x.id !== g.id); A.closeSheet(); A.save(); A.toast('Eliminato'); }
        };
        const arch = b.querySelector('#gd-arch'); if (arch) arch.onclick = () => { g.archived = !g.archived; A.closeSheet(); A.save(); A.toast(g.archived ? 'Archiviato' : 'Ripristinato'); };
      } });
  }
  A.screens.gruppi = { render(root) {
    const stats = L.guestStats(A.state.entries);
    const list = A.state.guests.filter(g => A.ui.showArchived ? g.archived : !g.archived).sort((a, b) => a.name.localeCompare(b.name));
    const active = A.state.guests.filter(g => !g.archived).length;
    root.innerHTML = `<div class="head"><div><h1>Ospiti</h1><p class="sub">${A.plural(active, 'ospite attivo', 'ospiti attivi')}</p></div><div class="row" style="flex:0 0 auto"><button class="btn btn-sq bg-giallo fix" id="gr-new" aria-label="Nuovo ospite">＋</button><button class="btn btn-sq fix" data-go="impostazioni" aria-label="Altro">⚙️</button></div></div>
      ${list.length ? `<div class="grid2">${list.map(g => { const s = stats[g.id] || { tables: 0, people: 0 }; const c = L.colorForName(g.name); return `<button class="folder" style="--tab:${COL[c]}" data-g="${g.id}">${A.iconBox(L.initial(g.name), c)}<div class="name">${A.esc(g.name)}</div><div class="meta">${A.plural(s.tables, 'volta', 'volte')} · ${s.people} persone</div></button>`; }).join('')}</div>`
                   : `<div class="empty"><div class="big">👨‍👩‍👧</div>${A.ui.showArchived ? 'Nessun ospite archiviato' : 'Ancora nessun ospite. Tocca ＋ per crearne uno.'}</div>`}
      <div class="center" style="margin-top:24px"><button class="chip ${A.ui.showArchived ? 'on' : ''}" id="gr-arch">${A.ui.showArchived ? 'Mostra attivi' : 'Mostra archiviati'}</button></div>`;
    root.querySelector('#gr-new').onclick = () => A.editGuestSheet(null, () => A.render());
    root.querySelector('#gr-arch').onclick = () => { A.ui.showArchived = !A.ui.showArchived; A.render(); };
    root.onclick = e => { const b = e.target.closest('[data-g]'); if (b) detail(A.state.guests.find(x => x.id === b.dataset.g)); };
  } };
})();
