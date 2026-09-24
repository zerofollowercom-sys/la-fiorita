// Tab "Menu": elenco, ordine, nuovo/modifica, nascondi/elimina
(function () {
  const A = window.App, L = A.L;
  function editSheet(dish) {
    const isNew = !dish; let emoji = dish ? dish.emoji : '🍽️', color = dish ? dish.color : 'rosa';
    A.sheet({ title: isNew ? 'Nuovo menu' : 'Modifica menu', html: `
      <div class="field"><label>Nome</label><input type="text" id="ed-name" value="${A.esc(dish ? dish.name : '')}" autocomplete="off"></div>
      <div class="field"><label>Icona</label><div class="emoji-grid" id="ed-emoji">${L.EMOJI_CIBO.map(e => `<button data-e="${e}" class="${e === emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Colore</label><div class="color-row" id="ed-color">${L.COLORS.map(c => `<button data-c="${c}" class="bg-${c} ${c === color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div></div>
      <div class="muted" id="ed-err"></div><button class="btn btn-block bg-verde mt" id="ed-save">Salva</button>`,
      onMount(b) {
        b.querySelector('#ed-emoji').onclick = e => { const x = e.target.closest('[data-e]'); if (!x) return; emoji = x.dataset.e; b.querySelectorAll('#ed-emoji button').forEach(y => y.classList.toggle('on', y === x)); };
        b.querySelector('#ed-color').onclick = e => { const x = e.target.closest('[data-c]'); if (!x) return; color = x.dataset.c; b.querySelectorAll('#ed-color button').forEach(y => y.classList.toggle('on', y === x)); };
        b.querySelector('#ed-save').onclick = () => {
          const name = b.querySelector('#ed-name').value.trim(), err = b.querySelector('#ed-err');
          if (!name) { err.textContent = 'Scrivi un nome'; return; }
          if (L.nameExists(A.state.dishes, name, dish && dish.id)) { err.textContent = 'Esiste già un menu con questo nome'; return; }
          if (isNew) A.state.dishes.push({ id: L.newId(), name, emoji, color, hidden: false, order: A.state.dishes.length });
          else Object.assign(dish, { name, emoji, color });
          A.closeSheet(); A.save(); A.toast('Salvato ✓');
        };
      } });
  }
  function actionSheet(d) {
    const used = !L.canDeleteDish(d.id, A.state.entries);
    A.sheet({ title: d.name, html: `<div class="list"><button class="btn btn-block" id="pd-edit">✏️ Modifica nome, icona, colore</button>
      ${used ? `<button class="btn btn-block" id="pd-hide">${d.hidden ? '👁️ Mostra di nuovo' : '🙈 Nascondi dai bottoni'}</button>` : ''}
      <button class="btn btn-block danger" id="pd-del">🗑️ Elimina</button>
      ${used ? '<p class="muted">È usato in pasti già segnati: se lo elimini, in quei pasti comparirà "Menu eliminato". Nascondere lo toglie solo dai bottoni.</p>' : ''}</div>`,
      onMount(b) {
        b.querySelector('#pd-edit').onclick = () => editSheet(d);
        b.querySelector('#pd-del').onclick = async () => {
          const msg = used ? `Eliminare "${d.name}"?\nNei pasti già segnati resterà la scritta "Menu eliminato".` : `Eliminare "${d.name}"?`;
          if (await A.confirm(msg)) { A.state.dishes = A.state.dishes.filter(x => x.id !== d.id); A.closeSheet(); A.save(); A.toast('Eliminato'); }
        };
        const hide = b.querySelector('#pd-hide'); if (hide) hide.onclick = () => { d.hidden = !d.hidden; A.closeSheet(); A.save(); A.toast(d.hidden ? 'Nascosto' : 'Visibile'); };
      } });
  }
  A.screens.portate = { render(root) {
    const dishes = A.state.dishes.slice().sort((a, b) => a.order - b.order);
    const use = {}; A.state.entries.forEach(e => { use[e.dishId] = (use[e.dishId] || 0) + 1; });
    root.innerHTML = `<div class="head"><div><h1>Menu</h1><p class="sub">I bottoni che compaiono in Tavolo</p></div><div class="row" style="flex:0 0 auto"><button class="btn btn-sq bg-giallo fix" id="pt-new" aria-label="Nuovo menu">＋</button><button class="btn btn-sq fix" data-go="impostazioni" aria-label="Altro">⚙️</button></div></div>
      <div class="list">${dishes.map((d, i) => `<div class="item" style="cursor:default">${A.iconBox(d.emoji, d.color)}<div class="grow"><div class="name">${A.esc(d.name)}${d.hidden ? ' <span class="muted">(nascosto)</span>' : ''}</div><div class="meta">${use[d.id] || 0} pasti</div></div>
        <button class="btn btn-sq" data-up="${d.id}" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">▲</button><button class="btn btn-sq" data-down="${d.id}" ${i === dishes.length - 1 ? 'disabled' : ''} aria-label="Sposta giù">▼</button><button class="btn btn-sq" data-edit="${d.id}" aria-label="Modifica">✏️</button></div>`).join('')}</div>`;
    root.querySelector('#pt-new').onclick = () => editSheet(null);
    root.onclick = e => {
      const up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]'), ed = e.target.closest('[data-edit]');
      if (up || down) {
        const id = up ? up.dataset.up : down.dataset.down; const i = dishes.findIndex(d => d.id === id); const j = up ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= dishes.length) return;
        dishes.forEach((d, k) => { d.order = k; }); // normalizza prima di scambiare
        [dishes[i].order, dishes[j].order] = [dishes[j].order, dishes[i].order]; A.save(); return;
      }
      if (ed) actionSheet(A.state.dishes.find(x => x.id === ed.dataset.edit));
    };
  } };
})();
