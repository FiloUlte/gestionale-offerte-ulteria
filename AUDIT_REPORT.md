# Audit Report v2 — Gestionale Offerte Ulteria
Data: 2026-04-02

## PROMPT_V2_SVILUPPO — Stato implementazione 20 punti

| # | Punto | Stato |
|---|-------|-------|
| 1 | Tabella etichette + valori default | Fatto |
| 2 | Tabella oggetti | Fatto |
| 3 | Tabella offerte_righe | Fatto |
| 4 | Tabella timeline_eventi | Fatto |
| 5 | Tabella attivita (estesa) | Fatto |
| 6 | Tabella users | Fatto |
| 7 | Colonne mancanti offerte + clienti | Fatto |
| 8 | CRUD /api/etichette + select dinamici | Fatto |
| 9 | Impostazioni 5 tab | Fatto |
| 10 | Auth (login/logout/session/decorators) | Fatto |
| 11 | Sidebar aggiornata | Fatto |
| 12 | Pagina /clienti/id | Fatto |
| 13 | Pagina /oggetti/id | Fatto |
| 14 | Dashboard /agenti/id (con restrizioni) | Fatto |
| 15 | Wizard aggiornato (natura + tipo offerta) | Fatto |
| 16 | Versioning offerte (-B, -C) | Fatto (backend) |
| 17 | Riepilogo offerte con nuove colonne | Fatto |
| 18 | Email preimpostate (mailto) | Fatto (base) |
| 19 | Dashboard admin con KPI avanzati | Fatto |
| 20 | Audit collegamenti | Fatto |

## Database — 11 tabelle

| Tabella | Stato |
|---------|-------|
| agenti | OK |
| clienti | OK (+tipo_cliente, settore, note_generali) |
| offerte | OK (+13 nuove colonne v2) |
| attivita | OK (+oggetto_id) |
| etichette | OK (32 valori default) |
| oggetti | OK (nuovo) |
| offerte_righe | OK (nuovo) |
| timeline_eventi | OK (nuovo) |
| users | OK (nuovo) |
| note_clienti | OK (+oggetto_id, offerta_id) |
| condomini | OK (legacy) |

## Route — 40+ endpoint

Tutte le route rispondono 200. Verificato con curl.

## File JS — 5 file

| File | Righe | Braces | Parens |
|------|-------|--------|--------|
| app.js | 1467 | 332/332 OK | 1140/1140 OK |
| agente.js | 532 | 90/90 OK | 303/303 OK |
| cliente.js | 207 | 51/51 OK | 155/155 OK |
| oggetto.js | ~220 | OK | OK |
| impostazioni.js | ~220 | OK | OK |

## Pagine

| Pagina | URL | Template | JS |
|--------|-----|----------|----|
| Riepilogo Offerte | / | index.html | app.js |
| Dashboard Admin | / (view admin) | index.html | app.js |
| Nuova Offerta | / (view nuova) | index.html | app.js |
| Anagrafica Clienti | / (view clienti) | index.html | app.js |
| Agenti | / (view agenti) | index.html | app.js |
| Scheda Cliente | /clienti/id | cliente.html | cliente.js |
| Dashboard Agente | /agenti/id | agente.html | agente.js |
| Pagina Oggetto | /oggetti/id | oggetto.html | oggetto.js |
| Impostazioni | /impostazioni | impostazioni.html | impostazioni.js |
| Login | /login | login.html | (inline) |
