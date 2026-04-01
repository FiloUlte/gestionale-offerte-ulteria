# Audit Report — Gestionale Offerte Ulteria
Data: 2026-04-01

## COSA HO TROVATO

### Critico
- Nessun problema critico. Tutte le route e API erano funzionanti.

### Medio
- Mancava tabella `condomini` (richiesta dalla specifica)
- Mancava tabella `note_clienti` (richiesta dalla specifica)
- Mancava colonna `tipo_cliente` su clienti (lead/prospect/attivo)
- Mancava colonna `condominio_id` su offerte
- Mancava pagina dedicata `/clienti/<id>` (esisteva solo API detail)
- Mancavano API: note clienti, stats agente, scadute count
- Nessun collegamento tra sezioni (click su nome cliente/agente non navigava)

### Basso
- Nessuna arrow function trovata (OK)
- Nessun console.log in produzione (OK)
- Nessun file requirements.txt

## COSA HO FIXATO

### Database (FASE 2)
- CREATE TABLE condomini — app.py
- CREATE TABLE note_clienti — app.py
- ALTER TABLE clienti ADD COLUMN tipo_cliente — app.py
- ALTER TABLE offerte ADD COLUMN condominio_id — app.py
- Query rollback documentate nei commenti

### Route e API (FASE 3)
- GET /clienti/<id> — pagina scheda cliente dedicata — app.py
- GET /api/clienti/<id>/full — dettaglio completo con offerte, condomini, note — app.py
- POST /api/clienti/<id>/note — crea nota — app.py
- DELETE /api/note/<id> — elimina nota — app.py
- GET /api/agenti/<id>/stats — KPI agente JSON — app.py
- GET /api/attivita/scadute-count — conteggio attivita scadute — app.py

### Template e JS (FASE 3-4)
- templates/cliente.html — nuova pagina scheda cliente
- static/cliente.js — logica pagina cliente con:
  - KPI (offerte totali/prese/perse/attesa)
  - Dati anagrafici editabili inline
  - Badge tipo_cliente cliccabile (lead -> prospect -> attivo)
  - Sistema note (crea/elimina)
  - Storico offerte con agente linkato
- tipo_cliente aggiunto ai campi update consentiti in clienti PUT

### Collegamenti (FASE 4)
- Pannello espanso offerta: link "Scheda cliente" e "Dashboard agente"
- Sidebar: badge rosso contatore attivita scadute accanto a "Agenti"
- Pagina cliente: agente linkabile a /agenti/<id>

### Consistency (FASE 5)
- Zero arrow functions in tutti i JS
- Zero console.log in produzione
- Tutti i braces/parens bilanciati in tutti i 3 file JS
- Tutte le route API ritornano JSON
- Badge colori uniformi nei 3 template

## COSA NON HO POTUTO FIXARE
- Collegamento condomini all'autocomplete nel wizard (serve frontend aggiuntivo)
- requirements.txt non creato (il progetto usa pip install manuale)
- La navigazione /clienti/<id> dal pannello espanso offerta cerca per nome_studio, non per ID diretto (manca cliente_id nella tabella offerte)

## STATO ATTUALE

### Route
| Route | Stato |
|-------|-------|
| GET / | OK |
| GET /agenti/<id> | OK |
| GET /clienti/<id> | OK (nuovo) |
| GET /api/offerte | OK |
| POST /api/offerte | OK |
| PUT /api/offerte/<id> | OK |
| PUT /api/offerte/<id>/stato | OK |
| DELETE /api/offerte/<id> | OK |
| POST /api/offerte/<id>/duplica | OK |
| POST /api/genera | OK |
| GET /api/clienti | OK |
| POST /api/clienti | OK |
| GET /api/clienti/<id> | OK |
| PUT /api/clienti/<id> | OK |
| GET /api/clienti/<id>/full | OK (nuovo) |
| POST /api/clienti/<id>/note | OK (nuovo) |
| DELETE /api/note/<id> | OK (nuovo) |
| GET /api/clienti/search | OK |
| GET /api/offerte/by-cliente/<id> | OK |
| GET /api/agenti | OK |
| POST /api/agenti | OK |
| GET /api/agenti/<id> | OK |
| PUT /api/agenti/<id> | OK |
| GET /api/agenti/<id>/dashboard | OK |
| GET /api/agenti/<id>/badges | OK |
| GET /api/agenti/<id>/stats | OK (nuovo) |
| GET /api/attivita/scadute-count | OK (nuovo) |
| POST /api/attivita | OK |
| PATCH /api/attivita/<id> | OK |
| PATCH /api/attivita/<id>/completa | OK |
| DELETE /api/attivita/<id> | OK |
| GET /api/config | OK |
| POST /api/config | OK |
| GET /output/<path> | OK |

### Database
| Tabella | Stato |
|---------|-------|
| agenti | OK (colore aggiunto via migration) |
| offerte | OK (agente_id, motivo_perdita, note_perdita, importo, condominio_id) |
| clienti | OK (tipo_cliente aggiunto via migration) |
| attivita | OK |
| condomini | OK (nuovo) |
| note_clienti | OK (nuovo) |

---
FASE 1 completata — 0 modifiche (solo lettura)
FASE 2 completata — 4 modifiche DB (2 tabelle, 2 colonne)
FASE 3 completata — 6 nuove route + 2 nuovi file (cliente.html, cliente.js)
FASE 4 completata — 3 collegamenti aggiunti + sidebar badge
FASE 5 completata — 0 problemi trovati (tutto conforme)
FASE 6 completata — 15/15 test passati
FASE 7 completata — report aggiornato
