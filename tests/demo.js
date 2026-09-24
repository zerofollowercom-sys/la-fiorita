// Dati dimostrativi per screenshot: #tavolo | #storico | #rendiconto | #gruppi | #portate | #impostazioni | #picker
(function () {
  const A = window.App, L = A.L; const st = L.emptyState();
  if (location.hash !== '#lock') { A.unlock(); A.mount(); } else { return; }
  const names = [['Famiglia Rossi', 4], ['Bianchi', 2], ['Gli amici di Marco', 6], ['Nonna Pina', 3], ['Verdi', 2], ['Compagnia del sabato', 8]];
  st.guests = names.map(([name, n], i) => ({ id: 'g' + i, name, defaultPeople: n, createdAt: i, archived: false }));
  let k = 0;
  for (let d = 1; d <= 24; d++) for (const meal of ['pranzo', 'cena']) {
    const howMany = (d * 7 + (meal === 'cena' ? 3 : 0)) % 4; // 0..3 famiglie al tavolo
    if (!howMany) continue;
    const guests = []; for (let j = 0; j < howMany; j++) { const g = st.guests[(d + j * 2 + k) % st.guests.length]; k++; if (!guests.some(x => x.guestId === g.id)) guests.push({ guestId: g.id, people: g.defaultPeople - (j % 2) }); }
    st.entries.push({ id: 'e' + k, date: `2026-09-${String(d).padStart(2, '0')}`, meal, dishId: st.dishes[(d + k) % 4].id, guests, createdAt: k, updatedAt: k });
  }
  A.store.replace(st);
  A.ui.date = '2026-09-24'; A.ui.meal = 'pranzo'; A.ui.report.year = 2026; A.ui.report.month = 9;
  const h = (location.hash || '#tavolo').slice(1);
  if (h === 'picker') { A.go('tavolo'); document.getElementById('tv-add').click(); }
  else if (h === 'tavolo-pieno') { A.ui.meal = 'cena'; A.loadForm(); A.go('tavolo'); }
  else A.go(h);
})();
