# Cantiere360 · Fase 1

Gestionale CRM + ERP per l'impresa edile, costruito sul flusso `FLOW ERP & CRM.pdf` e sulle note di progetto.
Questa è la **Fase 1**: dalla trattativa al cantiere, fino al DDT firmato in cantiere e ai FIR per RENTRI.

## Cosa fa

| Nel PDF / nelle note | Nell'app |
|---|---|
| Fasi trattativa CRM: potenziale, sopralluogo, preventivo (e computo metrico), contratto firmato, in corso, chiuso, perso [motivo], stand by [motivo] | **Trattative**: kanban con i passaggi controllati, motivo obbligatorio per perso e stand by, storico dei cambi |
| Contratto firmato → Pianificazione | Al passaggio a "Contratto firmato" nasce il **progetto** (codice `P-AAAA-NNN`) |
| Progetti suddivisi in cantieri, allocazione risorse | **Progetto** → cantieri → **allocazione** di mezzi, attrezzature, dipendenti, materiali e subappaltatori per periodo. Avvisa se la risorsa è già impegnata altrove |
| Per ogni progetto e fatture relative | Scheda progetto con fatture (acconto, SAL, saldo), incassato, costi stimati e margine |
| Anagrafiche (sidebar): mezzi, attrezzature, dipendenti (priorità, certificazioni), materiali, subappaltatori, extra (campi custom) | **Anagrafiche** nella barra laterale, campi extra creabili dall'utente, scadenze (revisioni, DURC, certificazioni) evidenziate |
| Giornale dei lavori & overall status | **Giornale dei lavori** per cantiere con avanzamento %, presenti precompilati dalle allocazioni |
| FIR (peso e costo di conferimento) → RENTRI | **FIR** per cantiere e pagina **FIR e RENTRI** con export CSV e "segna come caricati" |
| Webapp per dipendenti: DDT con campi precompilati + firme + foto | **Webapp cantiere** su `/m`: DDT numerati `AAAA/NNNN`, righe precompilate, firma col dito, foto compresse, stampa/PDF |
| Firebase per la memoria | Firestore + Auth + Storage, con cache offline |

In più, dal documento di strategia: ruoli e permessi applicati anche lato server e **registro modifiche** non cancellabile.

### Ruoli

| Ruolo | Cosa può fare |
|---|---|
| Amministratore | Tutto, compresa la gestione utenti |
| Ufficio | CRM, anagrafiche, progetti, pianificazione, giornale, FIR, DDT |
| Capocantiere | Giornale dei lavori, FIR e DDT; vede anagrafiche e progetti, non il CRM |
| Operaio | Solo la webapp DDT |

Le regole sono in `src/domain/permessi.ts` (interfaccia) e `firestore.rules` / `storage.rules` (server).

## Provarla subito (modalità demo)

```bash
cd cantiere360
npm install
npm run dev
```

Apri http://localhost:5173, scegli un ruolo e premi **Carica dati di esempio**. Senza configurazione Firebase i dati restano nel browser.

## Collegare Firebase

1. Crea un progetto su https://console.firebase.google.com e attiva **Authentication** (email/password), **Firestore** e **Storage**.
2. Copia `.env.example` in `.env.local` e incolla i dati della web app Firebase.
3. Pubblica le regole: `npx firebase-tools deploy --only firestore:rules,storage`.
4. Apri l'app, scegli **Crea un account** con la tua email.
5. Solo per il primo amministratore: in Firestore apri `tenants/mk-service/utenti/<tuo uid>` e imposta `ruolo` = `admin`, `attivo` = `true`. Gli utenti successivi li abiliti dalla pagina **Utenti**.
6. Pubblicazione: `npm run build && npx firebase-tools deploy --only hosting`.

I dati stanno sotto `tenants/{VITE_TENANT_ID}/…`: aggiungere altre aziende in futuro (SaaS multi-tenant) non richiede di spostarli.

## Comandi

| Comando | |
|---|---|
| `npm run dev` | Avvio in sviluppo |
| `npm test` | Test (stati trattativa, conflitti di allocazione, costi, export RENTRI, numerazione, permessi) |
| `npm run typecheck` | Controllo dei tipi |
| `npm run build` | Build di produzione in `dist/` |

## Struttura

```
src/
  domain/   regole di business pure e testate (trattative, allocazioni, costi, RENTRI, permessi)
  data/     accesso ai dati: Firebase o browser (demo), registro modifiche, sessione utente
  pages/    schermate: trattative, progetti, cantiere, DDT, webapp mobile, anagrafiche
  ui/       componenti comuni: moduli, modale, firma, foto
```

## Limiti noti della Fase 1

- **RENTRI**: l'export è un CSV con le colonne definite in `src/domain/rentri.ts`. Va confrontato con il modello di caricamento ufficiale del portale prima dell'uso; per adattarlo basta cambiare l'elenco `COLONNE_RENTRI`. Nessuna integrazione con le API RENTRI.
- **DDT offline**: compilazione e firma funzionano con la cache offline, ma il numero progressivo richiede la rete al momento del salvataggio.
- **Registro modifiche**: è scritto subito dopo ogni modifica, non nella stessa transazione.
- Il capocantiere vede tutti i cantieri, non solo i propri.

## Fuori dalla Fase 1

Modulo 2 (disponibilità futura delle risorse, menu a tendina con valori nuovi, vista subappaltatori per cantiere), foglio presenze e buste paga, recap Gemini dello standup, contabilità attiva e passiva, banche e riconciliazione (PRIO 3 del PDF).
