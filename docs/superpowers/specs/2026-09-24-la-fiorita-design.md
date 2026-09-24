# La Fiorita 2.0 — specifica di design

Data: 2026-09-24
Stato: approvata a voce da Lorenzo, in attesa di revisione del documento

## 1. Scopo

App amatoriale per il babbo di Lorenzo. Serve a segnare, giorno per giorno,
i tavoli serviti a "La Fiorita" a pranzo e a cena, e a tirare i conti per
periodo (mese, anno, quindicina o intervallo libero) e per gruppo di ospiti.

Chi la usa: una sola persona, su iPhone, senza competenze tecniche.
Successo: segnare un tavolo richiede meno di 10 secondi e 4 tocchi; il
rendiconto di un mese si legge in una schermata senza scorrere troppo.

Cosa NON fa (fuori scopo, deciso con Lorenzo):
- niente prezzi né euro;
- niente esportazione (né PDF, né Excel, né condivisione): il rendiconto
  si guarda a schermo;
- niente conteggio delle portate per persona: un tavolo ha UNA portata;
- niente sincronizzazione con altri dispositivi: i dati vivono solo sul
  telefono, con backup manuale su file.

## 2. Architettura

- Una pagina web statica: `index.html` + `style.css` + `app.js` +
  `logic.js`. Nessun server, nessun passaggio di build per lo sviluppo (si apre `index.html` e funziona), nessuna dipendenza npm a
  runtime. Font da Google Fonts con fallback di sistema; se offline il
  font di sistema va bene.
- Persistenza: `localStorage`, una sola chiave `lafiorita.v1` con un
  oggetto JSON `{ version, guests, dishes, entries, lastBackupAt }`.
  Ogni lettura/scrittura è avvolta in try/catch; se lo storage non è
  disponibile l'app funziona in memoria e mostra un avviso fisso.
- Distribuzione: pubblicata come artefatto privato su claude.ai; Lorenzo
  la apre sull'iPhone del babbo e la aggiunge alla schermata Home da
  Safari. Il codice sorgente resta nel workspace in
  `Nuovi_Progetti/La_Fiorita_2.0/`.
- Meta tag per iOS: `apple-mobile-web-app-capable`, `viewport-fit=cover`,
  colore barra di stato, icona `apple-touch-icon` generata come SVG/PNG
  inline (un fiore stilizzato in stile neo-brutalista).
- `logic.js` non tocca il DOM: contiene solo funzioni pure (periodi,
  filtri, aggregazioni, validazioni, migrazioni). È testato con Node
  (`node --test`). `app.js` contiene stato, rendering e gestori eventi.

## 3. Modello dati

```
Guest  { id, name, defaultPeople (int ≥1, default 2), createdAt, archived (bool) }
Dish   { id, name, emoji, color (uno dei token della palette), hidden (bool), order (int) }
Entry  { id, date "YYYY-MM-DD", meal "pranzo"|"cena", guestId, people (int ≥1), dishId, createdAt, updatedAt }
```

- `id`: stringa casuale (`crypto.randomUUID()` con fallback).
- Portate iniziali (seed al primo avvio): 🍕 Pizza (giallo), 🥩 Carne
  (rosa), 🍝 Primo (verde), 🐟 Pesce (azzurro).
- Un gruppo si può cancellare solo se non ha registrazioni; altrimenti si
  archivia (sparisce dal selettore, resta nello storico e nei rendiconti).
- Una portata si può cancellare solo se non ha registrazioni; altrimenti
  si nasconde (`hidden`), con lo stesso effetto.
- Il nome di un gruppo è unico ignorando maiuscole e spazi ai bordi.
- Validazione di una registrazione: data valida, pasto valido, gruppo
  esistente, persone intero ≥1 e ≤ 99, portata esistente.

## 4. Schermate

Navigazione: barra fissa in basso con 5 tab, icona grande sopra
etichetta corta. Tab attivo: sfondo colorato con bordo nero e ombra dura.

### 4.1 Segna (home)

Ordine dall'alto:
1. Titolo "La Fiorita 2.0" e data lunga in italiano ("giovedì 24 settembre").
2. Riga data: campo `input type=date` in stile bottone + due chip "Oggi"
   e "Ieri". Default: oggi.
3. Interruttore a due segmenti: ☀️ Pranzo / 🌙 Cena. Default: pranzo se
   ora < 16:00, altrimenti cena.
4. Selettore gruppo: bottone grande che apre un foglio (bottom sheet)
   con campo di ricerca, elenco dei gruppi non archiviati in ordine
   alfabetico, e in cima "+ Nuovo gruppo" che chiede solo il nome (e
   persone solite, opzionale). Il gruppo scelto compare nel bottone con
   la sua iniziale in un quadrato colorato.
5. Contatore persone: bottoni − e + (min 1, max 99) con numero grande in
   mezzo, e chip preset 1 · 2 · 4 · 6. Scegliendo un gruppo il contatore
   prende `defaultPeople` del gruppo.
6. Griglia portate: bottoni 2 per riga, ognuno con emoji in quadrato
   colorato e nome; scelta singola; la selezionata ha bordo più spesso e
   sfondo colorato. Solo portate non nascoste, in ordine `order`.
7. Bottone "Salva tavolo" a tutta larghezza, disabilitato finché mancano
   gruppo o portata. Al salvataggio: toast "Salvato ✓", il form resetta
   solo gruppo, persone e portata (data e pasto restano, perché di
   solito si segnano più tavoli dello stesso servizio).
8. Sotto: "Tavoli di oggi" (della data selezionata), divisi in Pranzo e
   Cena, con totale tavoli e persone per servizio. Ogni riga: emoji
   portata, nome gruppo, persone. Tocco su una riga: apre lo stesso form
   in modalità modifica, con bottone "Elimina" (con conferma).

### 4.2 Gruppi

- Elenco a schede in stile screenshot (2 per riga): iniziale in quadrato
  colorato (colore derivato dal nome in modo stabile), nome, "N volte ·
  M persone" (totali di sempre).
- Bottone "+" in alto a destra: nuovo gruppo (nome, persone solite).
- Tocco su scheda: foglio con Rinomina, Persone solite, Archivia (o
  Elimina se senza registrazioni), e le ultime 5 visite.
- Interruttore "Mostra archiviati" in fondo, che permette di ripristinare.

### 4.3 Portate

- Elenco verticale: emoji, nome, colore, contatore uso; trascinamento
  non richiesto: bottoni ▲ ▼ per l'ordine.
- Bottone "+": nome, emoji scelta da una griglia di ~40 emoji di cibo,
  colore scelto tra 6 token della palette.
- Tocco: Rinomina, cambia emoji/colore, Nascondi (o Elimina se inutilizzata).

### 4.4 Rendiconto

- Selettore periodo a segmenti: Mese | Anno | Da–A.
  - Mese: frecce ← → e nome "Settembre 2026". Default: mese corrente.
  - Anno: frecce ← → e anno.
  - Da–A: due campi data, più chip "1–15" e "16–fine" che impostano la
    quindicina del mese mostrato; chip "Questo mese".
- Filtri: Gruppo (tutti / uno, via foglio con ricerca) e Pasto (tutti /
  pranzo / cena).
- Risultati, dall'alto:
  1. Due riquadri grandi: "Tavoli" e "Persone" (totali del periodo).
  2. Riga Pranzo / Cena: tavoli e persone per ciascuno.
  3. Per portata: una riga per portata con emoji, tavoli, persone, e
     barra proporzionale alle persone.
  4. Per gruppo: classifica per persone (poi tavoli), massimo 10 con
     "Mostra tutti"; nascosta quando il filtro gruppo è già impostato.
  5. Elenco registrazioni del periodo in ordine di data decrescente,
     raggruppate per giorno; tocco = modifica come in Segna.
- Stato vuoto: illustrazione emoji e testo "Nessun tavolo in questo periodo".

### 4.5 Impostazioni

- "Salva copia": scarica `lafiorita-backup-AAAA-MM-GG.json` (Blob +
  link download; su iOS finisce in File). Aggiorna `lastBackupAt`.
- "Ripristina copia": input file JSON; valida la struttura; chiede
  conferma "Sostituisce tutti i dati attuali"; poi ricarica.
- Avviso in alto (banner giallo) se `lastBackupAt` manca o è più vecchio
  di 30 giorni e ci sono almeno 10 registrazioni.
- Riga "Dati": conteggi di gruppi, portate, registrazioni; versione app.
- "Come aggiungere alla Home" con 3 righe di istruzioni per Safari.
- Zona pericolosa in fondo: "Cancella tutto" con doppia conferma.

## 5. Stile

Ricalca lo screenshot fornito (neo-brutalismo morbido):
- Sfondo crema `#FAF7F2`; testo nero `#111`.
- Bordi 3px neri, raggio 14px, ombra dura `4px 4px 0 #111`; al tocco
  l'elemento si sposta di 2px e l'ombra si riduce (feedback tattile).
- Palette token: rosa `#F2547D`, verde `#7BC043`, giallo `#F5C842`, viola
  `#6C4BE0`, azzurro `#4FB3E8`, arancio `#F58A3C`, grigio `#B8B8B8`.
- Font: "Space Grotesk" 700 per titoli e numeri, 500 per testo; fallback
  `-apple-system, system-ui`.
- Dimensioni: testo base 17px, titoli 30–34px, numeri dei riquadri 40px,
  altezza minima dei bottoni 52px, area di tocco ≥ 44px.
- Icone: emoji in quadrato colorato con bordo nero (come le cartelle
  dello screenshot). Nessuna libreria di icone.
- Tema chiaro fisso: niente dark mode (scelta deliberata per coerenza
  con lo screenshot e per leggibilità).
- Larghezza massima 480px centrata, così su iPad o Mac resta a misura
  telefono.
- Rispetta le safe area di iPhone (`env(safe-area-inset-*)`).

## 6. Logica pura (`logic.js`) e test

Funzioni esportate, tutte senza DOM:
- `monthRange(year, month)`, `yearRange(year)`, `fortnightRange(year,
  month, half)` → `{ from, to }` in "YYYY-MM-DD".
- `filterEntries(entries, { from, to, guestId, meal })`.
- `summarize(entries, { guests, dishes })` → `{ tables, people, byMeal,
  byDish, byGuest }` con tavoli e persone per ogni voce, ordinamenti
  come da §4.4.
- `groupByDay(entries)` per gli elenchi.
- `validateEntry(entry, { guests, dishes })` → lista errori.
- `guestStats(entries)` → per gruppo: volte e persone totali.
- `canDeleteGuest / canDeleteDish`.
- `serializeBackup(state)`, `parseBackup(text)` con validazione e
  migrazione da `version`.
- `formatDateIt(date)` ("giovedì 24 settembre").
- `defaultMeal(hour)`.

Test con `node --test` in `tests/logic.test.js`: periodi ai bordi (anni
bisestili, febbraio, fine mese), filtri combinati, somme, ordinamenti,
validazione, backup corrotto, migrazione.

L'interfaccia si verifica a mano nel browser a 390×844 (iPhone 14/15) e
con una checklist manuale scritta in `docs/checklist-manuale.md`.

## 7. Errori e casi limite

- Storage pieno o non disponibile: avviso rosso fisso, app in memoria.
- Backup con JSON non valido o versione futura: messaggio chiaro, nessun
  cambiamento ai dati.
- Doppio tocco su "Salva": bottone disabilitato durante il salvataggio.
- Cancellazione: sempre con conferma; nessun "annulla" dopo.
- Data futura: consentita ma con avviso discreto.
- Nomi gruppo duplicati: rifiutati con messaggio.

## 8. File del progetto

```
Nuovi_Progetti/La_Fiorita_2.0/
├── index.html
├── style.css
├── app.js
├── logic.js
├── tests/logic.test.js
├── docs/superpowers/specs/2026-09-24-la-fiorita-design.md
├── docs/superpowers/plans/…
└── docs/checklist-manuale.md
```

Per la pubblicazione come artefatto viene generato `dist/index.html` con
CSS e JS inline (script di build minimale in Node, senza dipendenze), così
il file pubblicato è uno solo.

## 9. Revisione del 24-09-2026 (pomeriggio) — un tavolo per servizio

Lorenzo ha cambiato il modello dopo la prima versione:
- **Un solo tavolo per giorno e pasto.** Una registrazione = data + pranzo/cena + un menu (facoltativo) + l'elenco delle famiglie con le persone di ciascuna. Il totale persone è la somma. Non esistono più righe separate per famiglia.
- **Tab**: Tavolo (inserimento con tasto Salva grande; se si cambia giorno con modifiche in sospeso l'app chiede se salvarle), Storico (tutte le righe per giorno con pasto, menu, famiglie e persone; tocco = apre quel tavolo), Conti (tavoli = servizi; filtro per famiglia conta solo le sue persone), Famiglie, Menu. "Altro" (backup ecc.) sta dietro l'ingranaggio in alto a destra.
- **Semplicità prima di tutto**: il babbo non è pratico. Niente autosalvataggio (preferisce il tasto Salva), niente passaggi nascosti.
- **Dati**: chiave `lafiorita.v2`; un backup o uno storage v1 viene convertito raggruppando le righe per giorno e pasto (menu = quello della prima riga).
