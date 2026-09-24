// Tab "Conti": periodo, filtri, totali, per portata, per gruppo, elenco
(function () {
  const A = window.App, L = A.L;
  function range(r) {
    if (r.mode === 'mese') return L.monthRange(r.year, r.month);
    if (r.mode === 'anno') return L.yearRange(r.year);
    const m = L.monthRange(r.year, r.month);
    return { from: r.from || m.from, to: r.to || m.to };
  }
  function shiftMonth(r, d) { let m = r.month + d, y = r.year; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } r.month = m; r.year = y; }
  A.screens.rendiconto = { render(root) {
    const r = A.ui.report, { from, to } = range(r);
    const entries = L.filterEntries(A.state.entries, { from, to, guestId: r.guestId, meal: r.meal });
    const s = L.summarize(entries, A.state, { guestId: r.guestId });
    const gname = r.guestId ? A.guestName(r.guestId) : 'Tutti gli ospiti';
    const maxDish = Math.max(1, ...s.byDish.map(d => d.people));
    const guests = r.showAllGuests ? s.byGuest : s.byGuest.slice(0, 10);
    const nav = label => `<div class="row"><button class="btn btn-sq fix" id="rp-prev" aria-label="Precedente">◀</button><div class="center" style="font-weight:700;font-size:20px">${label}</div><button class="btn btn-sq fix" id="rp-next" aria-label="Successivo">▶</button></div>`;
    const periodo = r.mode === 'mese' ? nav(L.monthLabelIt(r.year, r.month))
      : r.mode === 'anno' ? nav(String(r.year))
      : `<div class="row"><input type="date" id="rp-from" value="${from}"><span class="fix">→</span><input type="date" id="rp-to" value="${to}"></div>
         <div class="row mt" style="flex-wrap:wrap"><button class="chip fix" data-q="1">1–15</button><button class="chip fix" data-q="2">16–fine</button><button class="chip fix" data-q="m">Questo mese</button></div>`;
    root.innerHTML = `${A.header('Conti', L.formatDateIt(from) + ' → ' + L.formatDateIt(to))}
      <div class="cols"><div>
      <div class="seg mb"><button data-mode="mese" class="${r.mode === 'mese' ? 'on' : ''}">Mese</button><button data-mode="anno" class="${r.mode === 'anno' ? 'on' : ''}">Anno</button><button data-mode="da-a" class="${r.mode === 'da-a' ? 'on' : ''}">Da – A</button></div>
      ${periodo}
      <div class="row mt"><button class="btn ${r.guestId ? 'bg-viola' : ''}" id="rp-guest">👥 ${A.esc(gname)}</button></div>
      <div class="seg mt"><button data-meal="" class="${!r.meal ? 'on' : ''}">Tutti</button><button data-meal="pranzo" class="${r.meal === 'pranzo' ? 'on' : ''}">☀️ Pranzo</button><button data-meal="cena" class="${r.meal === 'cena' ? 'on' : ''}">🌙 Cena</button></div>
      ${s.tables === 0 ? `<div class="empty"><div class="big">🗓️</div>Nessun tavolo in questo periodo</div>` : `
      <div class="grid2 mt"><div class="stat bg-giallo"><div class="lbl">Pasti</div><div class="val">${s.tables}</div></div><div class="stat bg-rosa"><div class="lbl">Persone</div><div class="val">${s.people}</div></div></div>
      <h3>Pranzo e cena</h3><div class="grid2"><div class="stat"><div class="lbl">☀️ Pranzo</div><div class="val">${s.byMeal.pranzo.people}</div><div class="muted">${s.byMeal.pranzo.tables} pasti</div></div><div class="stat"><div class="lbl">🌙 Cena</div><div class="val">${s.byMeal.cena.people}</div><div class="muted">${s.byMeal.cena.tables} pasti</div></div></div>
      </div><div>
      <h3>Per menu</h3><div class="list">${s.byDish.map(d => `<div class="item" style="cursor:default;flex-wrap:wrap">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${A.esc(d.name)}${d.hidden ? ' <span class="muted">(nascosto)</span>' : ''}</div><div class="meta">${d.tables} pasti</div></div><span class="n">${d.people}</span><span class="muted">👤</span><div class="bar" style="flex-basis:100%"><i class="bg-${d.color}" style="width:${Math.round(d.people / maxDish * 100)}%"></i></div></div>`).join('')}</div>
      ${r.guestId ? '' : `<h3>Per ospite</h3><div class="list">${guests.map((g, i) => `<div class="item" style="cursor:default">${A.iconBox(i + 1, i === 0 ? 'giallo' : 'grigio', 'sm')}<div class="grow"><div class="name">${A.esc(g.name)}${g.archived ? ' <span class="muted">(archiviato)</span>' : ''}</div><div class="meta">${A.plural(g.tables, 'volta', 'volte')}</div></div><span class="n">${g.people}</span><span class="muted">👤</span></div>`).join('')}</div>
        ${s.byGuest.length > 10 && !r.showAllGuests ? `<div class="center mt"><button class="chip" id="rp-all">Mostra tutti (${s.byGuest.length})</button></div>` : ''}`}
`}
      </div></div>`;
    const q = s => root.querySelector(s);
    root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { r.mode = b.dataset.mode; if (r.mode === 'da-a' && !r.from) { const m = L.monthRange(r.year, r.month); r.from = m.from; r.to = m.to; } A.render(); });
    root.querySelectorAll('[data-meal]').forEach(b => b.onclick = () => { r.meal = b.dataset.meal || null; A.render(); });
    if (q('#rp-prev')) { q('#rp-prev').onclick = () => { if (r.mode === 'anno') r.year--; else shiftMonth(r, -1); A.render(); }; q('#rp-next').onclick = () => { if (r.mode === 'anno') r.year++; else shiftMonth(r, 1); A.render(); }; }
    if (q('#rp-from')) {
      q('#rp-from').onchange = e => { if (L.isValidISO(e.target.value)) { r.from = e.target.value; if (r.to < r.from) r.to = r.from; A.render(); } };
      q('#rp-to').onchange = e => { if (L.isValidISO(e.target.value)) { r.to = e.target.value; if (r.to < r.from) r.from = r.to; A.render(); } };
      root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const k = b.dataset.q; const rr = k === 'm' ? L.monthRange(r.year, r.month) : L.fortnightRange(r.year, r.month, Number(k)); r.from = rr.from; r.to = rr.to; A.render(); });
    }
    q('#rp-guest').onclick = () => A.pickGuest({ allowAll: true, onPick(id) { r.guestId = id; A.render(); } });
    if (q('#rp-all')) q('#rp-all').onclick = () => { r.showAllGuests = true; A.render(); };
  } };
})();
