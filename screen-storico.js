// Tab "Storico": tutte le righe per giorno, con pranzo e cena, famiglie e menu
(function () {
  const A = window.App, L = A.L;
  // Riga di un servizio (usata anche dai Conti): menu, pasto, persone, elenco famiglie
  A.serviceRow = function (e) {
    const d = A.dish(e.dishId), p = L.entryPeople(e);
    return `<button class="svc" data-svc="${e.date}|${e.meal}">
      <div class="top">${A.iconBox(d.emoji, d.color, 'sm')}<div class="grow"><div class="name">${A.mealLabel(e.meal)} · ${A.esc(d.name)}</div></div><span class="n">${p}</span><span class="muted">👤</span></div>
      <div class="fams">${e.guests.map(g => `<b>${A.esc(A.guestName(g.guestId))}</b> ${g.people}`).join(' · ')}</div></button>`;
  };
  A.bindServiceRows = function (root) {
    root.onclick = e => { const b = e.target.closest('[data-svc]'); if (b) { const [date, meal] = b.dataset.svc.split('|'); A.openService(date, meal); } };
  };
  A.screens.storico = { render(root) {
    const days = L.groupByDay(A.state.entries);
    const shown = days.slice(0, A.ui.storicoLimit);
    root.innerHTML = `${A.header('Storico', A.plural(A.state.entries.length, 'pasto segnato', 'pasti segnati'))}
      ${days.length ? '<div class="storico-grid">' + shown.map(day => { const p = day.entries.reduce((s, e) => s + L.entryPeople(e), 0);
        return `<div class="day"><h3>${L.formatDateIt(day.date)} <span class="muted" style="text-transform:none;letter-spacing:0">· ${p} persone</span></h3><div class="list">${day.entries.map(A.serviceRow).join('')}</div></div>`; }).join('') + '</div>'
        : `<div class="empty"><div class="big">📅</div>Ancora nessun tavolo. Segnalo dalla tab Tavolo.</div>`}
      ${days.length > shown.length ? `<div class="center mt"><button class="chip" id="st-more">Mostra altri giorni (${days.length - shown.length})</button></div>` : ''}`;
    A.bindServiceRows(root);
    if (root.querySelector('#st-more')) root.querySelector('#st-more').onclick = () => { A.ui.storicoLimit += 30; A.render(); };
  } };
})();
