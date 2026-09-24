// Tab "Altro": backup, ripristino, info, istruzioni Home, cancella tutto
(function () {
  const A = window.App, L = A.L;
  const APP_VERSION = '2.0.0';
  A.backupWarning = function () {
    const st = A.state; if (st.entries.length < 10) return '';
    const days = st.lastBackupAt ? Math.floor((Date.now() - st.lastBackupAt) / 86400000) : null;
    if (days !== null && days < 30) return '';
    return `<div class="banner banner-giallo">💾 ${days === null ? 'Non hai mai salvato una copia dei dati.' : `Ultima copia ${days} giorni fa.`} <a href="#" data-go="impostazioni">Salva ora</a></div>`;
  };
  // Tre strade per "Salva copia", e il backup conta solo se va a buon fine:
  // 1) dentro claude.ai i download avviati dalla pagina sono bloccati → capacità "downloads";
  // 2) su iPhone (anche in Home) → foglio di condivisione con "Salva su File";
  // 3) altrove → download classico.
  async function download() {
    const text = L.serializeBackup(A.state);
    const filename = `lafiorita-backup-${L.todayISO()}.json`;
    let dl = null;
    try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (_) { dl = null; }
    if (dl) {
      try { await dl.save({ filename, data: text }); }
      catch (err) { if (!err || err.code !== 'declined') A.toast('❌ Salvataggio non riuscito'); return; }
    } else {
      const file = new File([text], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'La Fiorita - copia dei dati' }); }
        catch (err) { if (!err || err.name !== 'AbortError') A.toast('❌ Condivisione non riuscita'); return; }
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = filename;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }
    }
    A.state.lastBackupAt = Date.now(); A.save(); A.toast('Copia salvata ✓');
  }
  function restore(file) {
    const rd = new FileReader();
    rd.onload = async () => {
      const r = L.parseBackup(String(rd.result));
      if (!r.ok) { A.toast('❌ ' + r.error); return; }
      const ok = await A.confirm(`Sostituire tutti i dati attuali con la copia?\n${r.state.entries.length} pasti, ${r.state.guests.length} ospiti${r.skipped ? `\n(${r.skipped} righe non valide scartate)` : ''}`);
      if (!ok) return;
      A.store.replace(r.state); A.ui.returnTo = null; A.ui.report.guestId = null; A.loadForm(); A.render(); A.toast('Ripristinato ✓');
    };
    rd.readAsText(file);
  }
  A.screens.impostazioni = { render(root) {
    const st = A.state; const last = st.lastBackupAt ? new Date(st.lastBackupAt).toLocaleDateString('it-IT') : 'mai';
    root.innerHTML = `<div class="head"><div><h1>Altro</h1><p class="sub">Copie di sicurezza e impostazioni</p></div><button class="btn btn-sq" data-go="tavolo" aria-label="Torna al tavolo">✕</button></div>
      ${A.backupWarning()}
      <div class="card"><h2>💾 Copia dei dati</h2><p class="muted">Ultima copia: <b>${last}</b>. Il file finisce in "File" sull'iPhone: tienilo su iCloud.</p>
        <button class="btn btn-block bg-verde mt" id="st-backup">Salva copia</button>
        <label class="btn btn-block mt" for="st-file">Ripristina da copia…</label><input type="file" id="st-file" accept=".json,application/json" hidden></div>
      <div class="card mt"><h2>📋 Dati</h2><p class="muted">${st.entries.length} pasti · ${st.guests.length} ospiti · ${st.dishes.length} menu<br>La Fiorita ${APP_VERSION}</p></div>
      <div class="card mt"><h2>📱 Mettila in Home</h2><ol class="muted" style="padding-left:20px;margin:8px 0 0"><li>Apri questa pagina in <b>Safari</b></li><li>Tocca il tasto <b>Condividi</b> (quadrato con la freccia)</li><li>Scegli <b>"Aggiungi alla schermata Home"</b></li></ol></div>
      <div class="card mt" style="border-color:#b00020"><h2 class="danger">⚠️ Zona pericolosa</h2><button class="btn btn-block danger mt" id="st-wipe">Cancella tutto</button></div>`;
    root.querySelector('#st-backup').onclick = download;
    root.querySelector('#st-file').onchange = e => { const f = e.target.files[0]; if (f) restore(f); e.target.value = ''; };
    root.querySelector('#st-wipe').onclick = async () => {
      if (!await A.confirm('Cancellare TUTTI i dati? Non si può annullare.')) return;
      if (!await A.confirm('Sei sicuro? Ospiti, menu e pasti spariranno.')) return;
      A.store.replace(L.emptyState()); A.ui.returnTo = null; A.ui.report.guestId = null; A.loadForm(); A.render(); A.toast('Tutto cancellato');
    };
  } };
})();
