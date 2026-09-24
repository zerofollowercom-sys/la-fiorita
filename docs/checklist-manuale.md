# Checklist manuale (browser a 390×844, poi iPhone reale)
Avvio: `python3 -m http.server 8080` nella cartella e apri http://localhost:8080
- [ ] Le 5 tab cambiano schermata; la tab attiva è colorata.
- [ ] Il foglio (sheet) si apre, si chiude con ✕ e toccando fuori.
- [ ] Il toast compare e sparisce da solo.
- [ ] Nessuno scroll orizzontale a 390px; safe area rispettata su iPhone.
- [ ] In navigazione privata Safari compare il banner rosso e l'app resta usabile.

## Segna
- [ ] Salva è disabilitato finché non scegli gruppo e portata.
- [ ] Scegliendo un gruppo il contatore prende le persone "di solito".
- [ ] Dopo Salva: toast, riga nel giorno giusto, data e pasto restano, gruppo/portata si azzerano.
- [ ] Toccando una riga si entra in modifica; Elimina chiede conferma; Annulla esce senza cambiare.
- [ ] "Ieri" e il campo data cambiano l'elenco del giorno.
- [ ] Data futura mostra il banner giallo ma lascia salvare.
- [ ] Nuovo gruppo con nome duplicato ("rossi " vs "Rossi") viene rifiutato.

## Gruppi
- [ ] Le schede mostrano volte e persone corrette dopo aver segnato tavoli.
- [ ] Gruppo senza tavoli: Elimina disponibile. Gruppo con tavoli: solo Archivia.
- [ ] Archiviato sparisce dal selettore in Segna ma resta nei conti; Ripristina lo riporta.
- [ ] Rinomina con nome già esistente viene rifiutata.

## Portate
- [ ] Nuova portata con emoji e colore compare in Segna nell'ordine giusto.
- [ ] ▲ ▼ cambiano l'ordine anche in Segna.
- [ ] Portata usata: solo Nascondi; nascosta sparisce da Segna ma resta nei conti.
- [ ] Portata mai usata: Elimina con conferma.

## Conti
- [ ] Mese ◀ ▶ attraversa dicembre→gennaio cambiando anno.
- [ ] Da–A: "16–fine" su un mese di 30 e di 31 giorni dà la data giusta; "Questo mese" ripristina.
- [ ] Filtro gruppo nasconde la classifica; "Tutti i gruppi" la riporta.
- [ ] Filtro Pranzo/Cena cambia tutti i numeri in modo coerente (tavoli = somma delle righe elencate).
- [ ] Toccando una riga dell'elenco si va in Segna in modifica; dopo Salva i conti si aggiornano.
- [ ] Gruppo archiviato e portata nascosta compaiono comunque con l'etichetta.

## Altro
- [ ] Salva copia scarica un .json leggibile e aggiorna "Ultima copia".
- [ ] Ripristina con file corrotto: toast di errore, dati intatti.
- [ ] Ripristina valido: conferma con conteggi, poi tutte le schermate mostrano i dati del file.
- [ ] Con ≥10 tavoli e nessun backup compare il banner giallo in Segna e in Altro; sparisce dopo Salva copia.
- [ ] Cancella tutto chiede due conferme.

## Da provare su iPhone reale (non verificabile dal Mac)
- [ ] Aggiunta alla Home: icona a fiore e apertura a schermo intero.
- [ ] Riapertura il giorno dopo: data e pasto aggiornati.
- [ ] Salva copia: si apre il foglio di condivisione con "Salva su File".
- [ ] Dall'artefatto claude.ai: la pagina si apre senza login sul telefono del babbo.
