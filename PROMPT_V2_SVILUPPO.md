# GESTIONALE COMMERCIALE ULTERIA v2.0
# Prompt di sviluppo completo — da eseguire in sessioni successive

---

## CONTESTO AZIENDALE

Ulteria S.r.l. è una ESCo certificata UNI CEI 11352 che si occupa di:
- Contabilizzazione del calore nei condomini (ripartitori, contatori acqua, contatori calore)
- Contratti di servizio lettura (RK, RD, MANCT)
- Fornitura materiale e ricambi

Il gestionale commerciale serve a tracciare l'intera pipeline commerciale di 5 persone con ruoli diversi.

---

## UTENTI E RUOLI

### Tabella ruoli

| Utente | Ruolo sistema | Accesso |
|--------|--------------|---------|
| Filippo | admin | Tutto + impostazioni |
| Antonello | admin | Tutto + impostazioni |
| Fabiana | staff | Tutto tranne dashboard personali agenti |
| Neluma | staff | Tutto tranne dashboard personali agenti |
| Enzo | agente | Solo propria dashboard + anagrafica/offerte lettura |
| Andrea | agente | Solo propria dashboard + anagrafica/offerte lettura |

### Regole accesso dashboard personale

- Ruolo 'agente': vede SOLO /agenti/<proprio_id>
  Se tenta /agenti/<id_altro_agente> → redirect a propria dashboard
- Ruolo 'staff': vede anagrafica, offerte, attività globali
  NON può accedere a /agenti/<id> di Enzo o Andrea
  PUÒ accedere alle dashboard di Filippo e Antonello
- Ruolo 'admin': accesso completo senza restrizioni

Implementa questo controllo in un decorator Flask:

```python
@require_dashboard_access(agente_id)
```

che legge il ruolo dal session e applica le regole sopra.

---

## MODELLO DATI COMPLETO

### Principio fondamentale

Gerarchia entità:

```
CLIENTE (studio/persona)
  → N OGGETTI (edificio o servizio specifico)
    → N OFFERTE (per quell'oggetto specifico)
      → N VERSIONI offerta (-A, -B, -C)
```

Un'offerta è sempre legata a UN oggetto.
Un oggetto è sempre legato a UN cliente.
Un cliente può avere N oggetti.
Un oggetto può avere N offerte di tipo diverso
(es. prima sostituzione ripartitori, poi contratto RK).

### Schema DB completo

```sql
-- ETICHETTE DINAMICHE (configurabili da impostazioni)
CREATE TABLE IF NOT EXISTS etichette (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    -- categorie: tipo_cliente | stato_pipeline | tipo_attivita
    --            motivo_perdita | tipo_offerta | settore
    valore TEXT NOT NULL,
    colore_bg TEXT DEFAULT '#F4F9FD',
    colore_testo TEXT DEFAULT '#0D1F35',
    ordine INTEGER DEFAULT 0,
    attiva INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Valori default etichette da inserire al primo avvio:
-- tipo_cliente: Amministratore | Gestore | Costruttore |
--               Progettista | Condomino | Rivenditore
-- stato_pipeline: prospect | offerta_inviata |
--                 in_attesa_assemblea | preso | perso | rimandato
-- tipo_attivita: chiamata | email | visita | assemblea | to-do | altro
-- motivo_perdita: Prezzo | Competitor | Assemblea non approva |
--                 Non risponde | Rimandato | Cambio amministratore | Altro
-- tipo_offerta: fornitura | installazione | servizio
-- settore: amministratori | progettisti | gestori | costruttori

-- CLIENTI — modifica tabella esistente
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS tipo_cliente TEXT DEFAULT 'Amministratore';
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS settore TEXT;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS note_generali TEXT;

-- OGGETTI (condominio, edificio, servizio, fornitura)
CREATE TABLE IF NOT EXISTS oggetti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,

    -- Identificazione
    nome TEXT,            -- opzionale (es. "Cond. Aurora")
    via TEXT NOT NULL,    -- obbligatorio
    civico TEXT,
    comune TEXT NOT NULL, -- obbligatorio
    provincia TEXT,
    cap TEXT,

    -- Tipo oggetto
    tipo_oggetto TEXT DEFAULT 'condominio',
    -- condominio | fornitura | servizio

    -- Stato pipeline
    stato_pipeline TEXT DEFAULT 'prospect',

    -- Agente responsabile
    agente_id INTEGER,

    -- Natura della trattativa
    natura TEXT,
    -- nuovo | rinnovo | subentro_diretto | subentro_intermediario

    -- Per condomini: dati tecnici
    n_unita INTEGER,
    n_scale INTEGER,

    -- Cambio intestazione
    cliente_precedente_id INTEGER,
    data_cambio_intestazione DATE,

    -- Tracking
    data_primo_contatto DATE,
    data_ultimo_contatto DATE,
    motivo_perdita TEXT,
    note_perdita TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id) REFERENCES clienti(id),
    FOREIGN KEY (agente_id) REFERENCES agenti(id),
    FOREIGN KEY (cliente_precedente_id) REFERENCES clienti(id)
);

-- OFFERTE — modifica tabella esistente
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS oggetto_id INTEGER REFERENCES oggetti(id);
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS versione TEXT DEFAULT 'A';
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS offerta_padre_id INTEGER REFERENCES offerte(id);
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS stato_versione TEXT DEFAULT 'attiva';
-- attiva | aggiornata | annullata
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS tipo_offerta TEXT DEFAULT 'installazione';
-- fornitura | installazione | servizio
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS natura TEXT DEFAULT 'nuovo';
-- nuovo | rinnovo | subentro_diretto | subentro_intermediario
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS importo REAL;
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS importo_servizio_annuo REAL;
-- per contratti RK/RD/MANCT: canone annuo
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS motivo_perdita TEXT;
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS note_perdita TEXT;
ALTER TABLE offerte ADD COLUMN IF NOT EXISTS is_accordo_quadro INTEGER DEFAULT 0;
-- 1 = accordo quadro (non conta nei KPI valore)

-- RIGHE ECONOMICHE OFFERTA
CREATE TABLE IF NOT EXISTS offerte_righe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offerta_id INTEGER NOT NULL,
    descrizione TEXT NOT NULL,
    tipo_riga TEXT DEFAULT 'fornitura',
    -- fornitura | servizio_annuo | care | installazione
    prezzo_unitario REAL,
    quantita REAL,
    quantita_stimata INTEGER DEFAULT 0,
    -- 1 = quantità non confermata, è una stima
    totale_riga REAL,
    -- calcolato: prezzo_unitario * quantita
    ordine INTEGER DEFAULT 0,
    FOREIGN KEY (offerta_id) REFERENCES offerte(id)
);

-- NOTE
CREATE TABLE IF NOT EXISTS note_clienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    oggetto_id INTEGER,
    offerta_id INTEGER,
    testo TEXT NOT NULL,
    autore TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clienti(id),
    FOREIGN KEY (oggetto_id) REFERENCES oggetti(id),
    FOREIGN KEY (offerta_id) REFERENCES offerte(id)
);

-- TIMELINE EVENTI
CREATE TABLE IF NOT EXISTS timeline_eventi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_evento TEXT NOT NULL,
    -- offerta_creata | offerta_aggiornata | stato_cambiato |
    -- nota_aggiunta | attivita_completata | intestazione_cambiata
    descrizione TEXT NOT NULL,
    cliente_id INTEGER,
    oggetto_id INTEGER,
    offerta_id INTEGER,
    utente TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ATTIVITÀ
CREATE TABLE IF NOT EXISTS attivita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agente_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    data_scadenza DATETIME,
    priorita TEXT DEFAULT 'media',
    stato TEXT DEFAULT 'aperta',
    cliente_id INTEGER,
    oggetto_id INTEGER,
    offerta_id INTEGER,
    completato_il DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agente_id) REFERENCES agenti(id),
    FOREIGN KEY (cliente_id) REFERENCES clienti(id),
    FOREIGN KEY (oggetto_id) REFERENCES oggetti(id),
    FOREIGN KEY (offerta_id) REFERENCES offerte(id)
);

-- USERS (per auth)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL DEFAULT 'agente',
    -- admin | staff | agente
    agente_id INTEGER REFERENCES agenti(id),
    is_active INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## LOGICHE DI BUSINESS FONDAMENTALI

### Calcolo valore offerta automatico

Quando si usa il generatore offerte con template specifico:

```
valore_fornitura    = SUM(prezzo_unitario * quantita WHERE tipo_riga IN ('fornitura','installazione'))
valore_care         = SUM(prezzo_unitario * quantita WHERE tipo_riga = 'care')
valore_lettura      = SUM(prezzo_unitario * quantita WHERE tipo_riga = 'servizio_annuo')

importo             = valore_fornitura
importo_servizio_annuo = valore_care + valore_lettura
```

Se almeno una riga ha quantita_stimata = 1:
mostra badge "STIMA" accanto al valore ovunque appaia nell'app.

### Versioning offerte

Quando si crea aggiornamento offerta (versione -B, -C ecc.):

1. Conta versioni esistenti per quell'offerta base → calcola lettera successiva
2. Crea nuova riga offerte con:
   - Stesso numero_offerta base
   - Numero visualizzato = base + "-" + versione (es. "26014-B")
   - offerta_padre_id = id offerta originale
   - Tutti i dati copiati dall'originale, modificabili
   - stato_versione = 'attiva'
3. Aggiorna versione precedente: stato_versione = 'aggiornata'
4. Scrivi in timeline_eventi tipo = 'offerta_aggiornata'

Nelle liste mostra SOLO versioni attive per default.
Toggle "Mostra storico versioni" espande le versioni aggiornate
in grigio sotto la riga attiva.

### KPI — cosa conta e cosa no

```
KPI valore pipeline e lavori presi:
✅ Offerte installazione/fornitura con importo
✅ Offerte servizio con importo_servizio_annuo
❌ Accordi quadro (is_accordo_quadro = 1)
❌ Versioni stato_versione = 'aggiornata' o 'annullata'
❌ Offerte senza importo

KPI separati nella dashboard:
- Card "Fornitura/Installazione": SUM(importo) WHERE tipo_offerta IN ('fornitura','installazione')
- Card "Servizi — canone annuo": SUM(importo_servizio_annuo) WHERE tipo_offerta = 'servizio'
- Card "Accordi Quadro": COUNT(*) WHERE is_accordo_quadro = 1
  (solo contatore, nessun valore €)
```

### Natura trattativa — campo obbligatorio

Quando si crea qualsiasi offerta su un oggetto/condominio,
select obbligatorio con 4 opzioni:

- **Nuovo** — primo contatto con questo condominio
- **Rinnovo** — condominio già nostro cliente che rinnova contratto
- **Subentro diretto** — subentro a contratto avuto tramite intermediario, ora diretto
- **Subentro intermediario** — nuovo contratto tramite gestore/manutentore

Questo campo alimenta KPI specifico nella dashboard admin:
"Nuovi vs Rinnovi vs Subentri" come tabella con valori e percentuali.

---

## PANNELLO IMPOSTAZIONI — 5 TAB

### Tab 1 — Generale
- Numero progressivo offerta (esistente)
- Nome azienda, indirizzo, P.IVA
- Versione app

### Tab 2 — Etichette e Valori

Per ogni categoria (tipo_cliente, stato_pipeline, tipo_attivita,
motivo_perdita, tipo_offerta, settore) mostra tabella con:

| Valore | Colore sfondo | Colore testo | Ordine | Attiva | Elimina |
|--------|--------------|--------------|--------|--------|---------|

- Valore: editabile inline
- Colori: color picker HTML
- Ordine: drag & drop per riordinare
- Attiva: toggle on/off
- Elimina: solo se il valore non è usato in nessun record
- Bottone "+ Aggiungi" sotto ogni categoria

Tutti i select e badge nell'app leggono da questa tabella,
non da valori hardcoded nel codice.

### Tab 3 — Utenti

Tabella: Nome | Email | Ruolo | Agente collegato | Ultimo accesso | Stato

Bottone "Nuovo utente" → modale con campi:
Nome, Cognome, Email, Password temporanea, Ruolo (select), Agente collegato (select)

### Tab 4 — Template Email

Lista template con campi:
- Nome template
- Tipo: invio_offerta | richiesta_aggiornamento | follow_up | conferma_preso | altro
- Oggetto email (con placeholder)
- Corpo email (textarea con placeholder disponibili)

Placeholder supportati:
{{nome_cliente}} {{nome_condominio}} {{via_condominio}}
{{nome_agente}} {{numero_offerta}} {{importo}} {{data}}

### Tab 5 — Prezzi base

Tabella prezzi unitari default per tipo apparecchio:

| Apparecchio | Prezzo unitario (€) |
|-------------|-------------------|
| Ripartitore calore | €/cad |
| Contatore acqua radio | €/cad |
| Contatore acqua impulsi | €/cad |
| Contatore calore M-Bus | €/cad |
| Canone lettura RK | €/app/anno |
| Canone lettura RD | €/app/anno |
| Canone Care | €/app/anno |

Editabili inline, salvati in tabella impostazioni.
Usati come default nel generatore offerte ma modificabili
per ogni offerta specifica.

---

## PAGINA OGGETTO /oggetti/<id>

Questa è la pagina più importante del sistema.
Ogni condominio/edificio/servizio ha la sua pagina dedicata.

### Header

- Breadcrumb: Home > [Nome Cliente] > [Via + Comune]
- Titolo H2: Via Civico — Comune
- Nome condominio sotto il titolo (se presente, in grigio)
- Badge natura: NUOVO | RINNOVO | SUBENTRO DIRETTO | SUBENTRO INTERMEDIARIO
- Badge stato pipeline (colore da tabella etichette)
- Nome cliente con link a /clienti/<id>
- Nome agente con link a /agenti/<id>
- Bottone "Cambia stato pipeline"
- Bottone "Cambia intestazione" (per cambio studio amministratore)

### KPI row (4 card)

- N. Offerte totali
- Valore fornitura offerta attiva (€)
- Valore servizio annuo offerta attiva (€/anno)
- Giorni in stato attuale (con badge colore se > soglia)

### Sezione Offerte

Tutte le offerte per questo oggetto:
- Versioni attive in evidenza (stile normale)
- Versioni aggiornate in grigio, collassate, espandibili con toggle
- Per ogni offerta: numero versione, data, template, agente,
  importo, importo servizio annuo, stato versione, azioni
- Bottone "Nuova offerta per questo oggetto"
- Bottone "Aggiorna offerta" sull'offerta attiva
  → crea versione -B pre-compilata aprendo wizard step 3

### Sezione Note

- Textarea "Aggiungi nota..." + bottone Salva
- Lista note ordine cronologico inverso
- Ogni nota: testo + autore + data italiana + bottone elimina
- Salvataggio via AJAX POST /api/oggetti/<id>/note

### Sezione Attività

- Lista attività collegate a questo oggetto
- Bottone "+ Nuova attività" che pre-compila oggetto
- Stessa struttura della dashboard agente

### Sezione Timeline

Log cronologico inverso di tutto ciò che è accaduto:

Esempi:
- 🟢 "Offerta 26014 generata — €12.400" — 12 mar 2026 — Filippo
- 🔵 "Stato: Prospect → Offerta inviata" — 15 mar 2026 — Filippo
- 📝 "Nota aggiunta" — 20 mar 2026 — Fabiana
- 🔄 "Offerta aggiornata: 26014-B — €11.800" — 5 apr 2026 — Filippo
- 👤 "Intestazione: Studio X → Studio Y" — 10 apr 2026 — Neluma

### Modale Cambia Intestazione

Quando il condominio passa da un cliente all'altro:
- Autocomplete nuovo cliente
- Data cambio (date picker)
- Note libere
- Effetto: cliente_id aggiornato, cliente_precedente_id salvato,
  evento scritto in timeline_eventi

---

## PAGINA CLIENTE /clienti/<id>

### Header

- Breadcrumb: Home > Anagrafica Clienti > [Nome Studio]
- H2: Nome studio
- Badge tipo_cliente (da etichette, editabile inline con click)
- Badge settore
- Info inline: città | email | telefono | referente
- Bottone "Modifica cliente"

### KPI row (4 card)

- Offerte Totali (blu)
- Prese (verde)
- Perse (rosso)
- In Attesa (arancione)

### Sezione Oggetti/Condomini

Tabella oggetti del cliente:

| Nome/Via | Comune | Agente | Stato Pipeline | N. Offerte | Ult. contatto | Azioni |

Badge stato pipeline con colori da tabella etichette.
Bottone "+ Aggiungi oggetto/condominio".
Click su riga → naviga a /oggetti/<id>.

### Sezione Note (identica a pagina oggetto)

### Sezione Storico Offerte

Tutte le offerte di tutti gli oggetti di questo cliente:
- Numero offerta | Data | Oggetto/Condominio | Template |
  Importo | Importo annuo | Stato versione | Azioni
- Mostra solo versioni attive per default
- Toggle "Mostra storico versioni"

---

## DASHBOARD AGENTE /agenti/<id>

### Controllo accesso

```python
# Prima di renderizzare la pagina:
if current_user.ruolo == 'agente' and agente.id != current_user.agente_id:
    return redirect(url_for('agenti_dashboard', id=current_user.agente_id))

if current_user.ruolo == 'staff' and agente.ruolo == 'agente':
    # staff non può vedere dashboard di Enzo o Andrea
    abort(403)
```

### Header

- Avatar grande (60px) iniziali + colore agente
- H2: Nome Cognome
- Email + badge ruolo
- Bottone "← Agenti" | Bottone "Modifica profilo" (solo admin)

### KPI row 1 (3 card)

- Offerte Totali (blu #009FE3)
- Lavori Presi (verde #639922)
- Offerte Perse (rosso #E24B4A)

### KPI row 2 (3 card)

- Valore Preso € (somma importo offerte stato Preso Lavoro)
- Valore Prospect € (somma importo offerte aperte)
- Tasso Conversione % (prese/totali*100, 1 decimale)

### Sezione Pipeline personale

Tabs: [Tutte] [In Attesa Assemblea] [Richiamato] [Preso] [Perso] [Rimandato]

Tabella offerte agente:
N. Offerta | Cliente | Oggetto/Condominio | Tipo | Importo | Stato | Giorni | Link

Giorni apertura: badge verde <14 | arancione 14-30 | rosso >30
Totale valore filtrato aggiornato dinamicamente.

### Sezione Attività e To-Do

Tabs: [Aperte] [Completate] [Tutte]

Per ogni attività:
- Pallino priorità (rosso=alta | arancione=media | grigio=bassa)
- Icona tipo (Phone | Mail | Building2 | Users | CheckSquare | ClipboardList)
- Titolo in bold
- Link cliente/oggetto collegato
- Badge data scadenza (scaduta rosso | oggi arancione | domani giallo | futura grigio)
- Bottone "Completa" | Bottone "Modifica" | Bottone "Elimina"

Bottone "+ Nuova Attività" → modale con campi:
Tipo | Titolo | Descrizione | Data scadenza | Priorità |
Collega cliente (autocomplete) | Collega oggetto | Collega offerta

Salva via POST /api/attivita, aggiorna lista senza reload.

### Sezione Clienti affidati

Clienti con almeno un oggetto assegnato a questo agente:

| Nome Studio | Città | Tipo | N. Oggetti | Ult. contatto | Stato migliore | Link |

Contatore: "X clienti · Y attivi · Z prospect"

### Sezione Statistiche mensili (tabella ultimi 6 mesi)

| Mese | Inviate | Prese | Perse | Tasso % | Valore Fornitura | Valore Annuo |
|------|---------|-------|-------|---------|-----------------|--------------|

---

## RIEPILOGO OFFERTE — AGGIORNAMENTI

### Colonne tabella (ordine fisso)

| ☐ | N. Offerta | Data | Studio/Cliente | Oggetto | Template | Tipo | Natura | Agente | Importo | Importo annuo | Stato | Giorni | Azioni |

- Tipo: Fornitura | Installazione | Servizio | Accordo Quadro
- Natura: N=Nuovo | R=Rinnovo | SD=Subentro Dir. | SI=Subentro Int.
- Importo annuo: visibile solo se tipo = servizio
- Badge "STIMA" se quantita_stimata presente

### Versioni nella tabella

- Mostra solo versioni attive
- Se offerta ha versioni precedenti: badge "v2" o "v3" accanto al numero
- Click badge → espande versioni precedenti sotto la riga in grigio

### Filtri rapidi aggiuntivi

[Tutte] [In Attesa] [Richiamato] [Preso] [Perso] [Rimandato]
[Fornitura] [Installazione] [Servizio] [Accordo Quadro]
Select Agente | Select Tipo cliente | Date range

### KPI aggiornate (6 card)

- Totale Offerte
- Offerte Aperte
- Lavori Presi
- Valore Preso Fornitura €
- Valore Servizi Annui €/anno
- Tasso Conversione %

Tutti i valori si aggiornano dinamicamente al cambio filtro.

### Modale Motivo Perdita

Si apre automaticamente quando stato → "Perso":

- Select motivo (da tabella etichette categoria=motivo_perdita) — obbligatorio
- Textarea note aggiuntive — opzionale
- Bottone "Conferma perdita" rosso | Bottone "Annulla"

---

## WIZARD NUOVA OFFERTA — AGGIORNAMENTI

### Step 1 — Template

Sezione A: "Accordo Quadro" (template generici, nessun condominio)
Sezione B: "Offerta Specifica" con sottosezioni:
  - Fornitura / Installazione
  - Servizio (RK, RD, MANCT)
  - Misto (fornitura + servizio)

Template non ancora caricati → badge "In arrivo", non selezionabili.

### Step 2 — Dati

Se accordo quadro:
  - Box Cliente + Box Agente
  - is_accordo_quadro = 1 automatico
  - Nessun oggetto obbligatorio

Se offerta specifica:
  - Box Cliente (autocomplete anagrafica)
  - Box Oggetto/Condominio:
    Autocomplete oggetti esistenti del cliente selezionato
    Se nuovo: Via (obbl.) + Civico + Comune (obbl.) + Nome (opz.)
  - Select Natura trattativa (obbligatorio):
    Nuovo | Rinnovo | Subentro diretto | Subentro intermediario
  - Select Tipo offerta (obbligatorio):
    Fornitura | Installazione | Servizio
  - Box Agente (pre-compilato e bloccato se ruolo = agente)

### Step 3 — Economici

Se template con calcolo automatico:
  Tabella righe economiche:
  | Descrizione | Tipo | Prezzo unit. | Quantità | Stima? | Totale |

  Righe pre-popolate con prezzi da Tab 5 impostazioni.
  Totali automatici aggiornati live:
  - Totale fornitura/installazione
  - Totale canone annuo (care + lettura)
  Badge "STIMA" se almeno una riga ha quantita_stimata = 1

Se accordo quadro o offerta manuale:
  Campo importo singolo (come ora)

---

## EMAIL PREIMPOSTATE (sistema mailto:)

Su ogni offerta nel riepilogo e nella pagina oggetto, due bottoni:

### Bottone "Invia offerta"

Apre modale con:
- Select template email (da Tab 4, default tipo=invio_offerta)
- Destinatario: email cliente pre-compilata (modificabile)
- Oggetto: pre-compilato con placeholder sostituiti
- Corpo: textarea pre-compilata (editabile prima di inviare)
- Info allegato: nome file PDF (utente lo allega manualmente)
- Bottone "Apri in Mail" → genera mailto: con subject + body
- Nota: "Il PDF va allegato manualmente in Outlook"

Dopo click "Apri in Mail":
Scrivi evento in timeline_eventi tipo='email_inviata'

### Bottone "Richiedi aggiornamento"

Stesso sistema, default tipo=richiesta_aggiornamento

---

## ANAGRAFICA CLIENTI — AGGIORNAMENTI

### Lista clienti

- Filtri rapidi: [Tutti] [Amministratore] [Gestore] [Costruttore] 
  [Progettista] [Condomino] [Rivenditore]
  (letti dinamicamente da tabella etichette)
- Ricerca full-text: nome_studio + referente + citta
- Colonne: Nome Studio | Referente | Tipo (badge) | Città | 
  N. Oggetti | Offerte aperte | Attività aperte | Email | Telefono
- Click su riga → naviga a /clienti/<id> (non pannello inline)

### Badge tipo_cliente

Tutti i badge leggono colori da tabella etichette.
Click sul badge in /clienti/<id> → dropdown inline per cambiare tipo.

---

## SIDEBAR — AGGIORNAMENTI

Dopo implementazione auth:

- In cima sidebar: avatar + nome utente loggato + badge ruolo
- Voci menu aggiuntive:
  - "Dashboard" (bar-chart-2) — tutti i ruoli
  - "Attività" (check-square) — tutti i ruoli
    con badge rosso contatore attività scadute/oggi
- "Agenti" visibile a tutti ma con accesso controllato
- "Impostazioni" visibile solo a admin
- Link "Esci" in fondo

Badge contatore attività (aggiorna al caricamento pagina via AJAX):
```javascript
// GET /api/attivita/badge_count → {"count": N}
// Mostra badge rosso se count > 0
```

---

## DASHBOARD ADMIN

### KPI globali (6 card)

- Offerte totali YTD
- Valore preso fornitura €
- Valore servizi annui €/anno
- Tasso conversione aziendale %
- Offerte aperte
- Accordi quadro inviati

### Analisi per natura trattativa

| Natura | N. Offerte | Valore | % totale |
|--------|-----------|--------|----------|
| Nuovo | | | |
| Rinnovo | | | |
| Subentro diretto | | | |
| Subentro intermediario | | | |

### Analisi per tipo cliente

Stessa struttura con tipi da tabella etichette.

### Performance team

Tabella agenti:
| Agente | Offerte mese | Offerte YTD | Valore preso | Valore prospect | Tasso % | Attività aperte |
Ogni riga cliccabile → /agenti/<id>

### Oggetti che richiedono attenzione

- Offerte in stato "in_attesa_assemblea" da > 30 giorni
- Oggetti senza contatto da > 60 giorni
Ogni riga con link azione rapida.

---

## API ROUTES NECESSARIE

```
# Auth
GET/POST  /login
GET       /logout
GET/POST  /profilo

# Clienti
GET       /clienti                        → lista
GET       /clienti/<id>                   → scheda
PATCH     /api/clienti/<id>              → modifica
POST      /api/clienti/<id>/note         → aggiungi nota
DELETE    /api/note/clienti/<id>         → elimina nota
GET       /api/clienti/search?q=         → autocomplete

# Oggetti
GET       /oggetti/<id>                  → pagina oggetto
POST      /api/oggetti                   → crea nuovo
PATCH     /api/oggetti/<id>             → modifica
POST      /api/oggetti/<id>/note        → aggiungi nota
POST      /api/oggetti/<id>/intestazione → cambia cliente
GET       /api/oggetti/by-cliente/<id>  → oggetti per autocomplete

# Offerte
GET       /api/offerte                   → lista con filtri
PATCH     /api/offerte/<id>             → modifica campi
POST      /api/offerte/<id>/duplica     → duplica
POST      /api/offerte/<id>/versione    → crea versione aggiornata

# Attività
POST      /api/attivita                 → crea
PATCH     /api/attivita/<id>           → modifica
PATCH     /api/attivita/<id>/completa  → segna completata
DELETE    /api/attivita/<id>           → elimina
GET       /api/attivita/badge_count    → contatore sidebar

# Etichette
GET       /api/etichette?categoria=    → lista per categoria
POST      /api/etichette               → crea
PATCH     /api/etichette/<id>         → modifica
DELETE    /api/etichette/<id>         → elimina

# Stats
GET       /api/agenti/<id>/stats       → KPI agente JSON
GET       /api/dashboard/admin         → KPI globali JSON
```

Tutte le API ritornano:
```json
{"ok": true, "data": {}}
{"ok": false, "error": "messaggio leggibile"}
```

---

## TOAST NOTIFICATIONS

Sistema toast leggero senza librerie esterne:
- Posizione: bottom-right
- Colori: verde successo | rosso errore | blu info
- Auto-dismiss dopo 3 secondi
- Max 3 toast visibili contemporaneamente
- Animazione slide-in da destra

Usa per: salvataggio celle, duplica offerta, cambi stato,
completamento attività, errori API.

---

## ORDINE DI IMPLEMENTAZIONE

Esegui in questo ordine. Completa e testa ogni punto prima di passare al successivo.

1.  Crea tabella etichette + inserisci tutti i valori default
2.  Crea tabella oggetti
3.  Crea tabella offerte_righe
4.  Crea tabella timeline_eventi
5.  Crea tabella attivita
6.  Crea tabella users
7.  Aggiungi colonne mancanti a offerte e clienti
8.  CRUD /api/etichette + aggiorna tutti i select dell'app a leggerle
9.  Impostazioni con 5 tab (Generale | Etichette | Utenti | Email | Prezzi)
10. Auth completa (login, logout, session, decorators ruoli)
11. Aggiorna sidebar (utente loggato, badge attività, nuove voci)
12. Pagina /clienti/<id> con oggetti + note + timeline
13. Pagina /oggetti/<id> completa con tutto
14. Dashboard /agenti/<id> con restrizioni ruolo
15. Wizard nuova offerta aggiornato (step 1 categorie, step 2 oggetto + natura, step 3 righe)
16. Versioning offerte (-B, -C) con stato_versione
17. Riepilogo offerte con nuove colonne, filtri, KPI dinamici
18. Sistema email preimpostate mailto:
19. Dashboard admin con KPI avanzati e analisi
20. Audit completo collegamenti tra tutte le sezioni

---

## REGOLE TECNICHE INVARIABILI

- **JS**: solo function declarations, MAI arrow functions `() => {}`
- **CSS**: variabili design system Ulteria, no `text-transform: uppercase`
- **Colori sistema**:
  - primary `#009FE3` | dark `#0080B8`
  - text `#0D1F35` | mid `#3D5A73` | muted `#6B8BA4`
  - bg `#F4F9FD` | border `#D6E8F5`
- **Frontend**: Vanilla JS puro, zero librerie aggiuntive
- **Icone**: Lucide icons (già nell'app)
- **API**: sempre JSON con struttura `{ok, data, error}`
- **Errori**: try/except su ogni route Flask
- **DB**: ogni ALTER preceduto da commento rollback
- **DOCX/PDF**: non toccare MAI la logica win32com esistente
- **Test**: verifica generazione DOCX funzionante dopo ogni modifica

---

## NOTE OPERATIVE

- I template Word per le nuove offerte (sostituzione ripartitori,
  contatori acqua, ecc.) verranno caricati in una fase successiva.
  Nel wizard mostrare come "In arrivo" con badge disabilitato.

- Per l'accesso remoto di Andrea: valutare Cloudflare Tunnel
  o soluzione VPN aziendale in fase separata.

- I testi email preimpostati verranno definiti in una fase successiva.
  Creare la struttura Tab 4 impostazioni con placeholder di esempio.

- L'import massivo clienti (lista lead) avverrà tramite CSV.
  Tutti i clienti importati avranno tipo_cliente = 'Amministratore'
  (o valore di default) e potranno essere modificati dopo l'import.

---

*Fine documento — Gestionale Commerciale Ulteria v2.0*
*Ultima revisione: aprile 2026*
