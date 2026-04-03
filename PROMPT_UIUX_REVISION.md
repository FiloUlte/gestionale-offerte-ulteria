# PRAGMA — Revisione Grafica Completa UI/UX
## Prompt operativo per Claude Code

Esegui una revisione grafica completa dell'intera applicazione PRAGMA
(ex Gestionale Offerte Ulteria). Leggi prima CLAUDE.md e
PROMPT_V2_SVILUPPO.md per il contesto completo.

Usa la skill frontend-design installata per tutta la durata
di questo intervento. Questo è un intervento SOLO di UI/UX —
non toccare nessuna logica backend, nessuna route Flask,
nessun DB. Solo HTML, CSS e JS lato presentazione.

---

## FILOSOFIA GENERALE

PRAGMA è uno strumento professionale usato ogni giorno
da 5 persone del reparto commerciale di Ulteria S.r.l.
Non è un sito vetrina. Non è una demo.
È uno strumento di lavoro — deve essere:

- Immediatamente leggibile a colpo d'occhio
- Privo di rumore visivo inutile
- Coerente in ogni pagina
- Rapido da navigare senza pensare
- Piacevole abbastanza da volerlo usare ogni giorno

Il modello mentale di riferimento è tra
Linear.app e Notion — pulito, denso di informazioni
ma mai caotico, con gerarchia visiva cristallina.

---

## PARTE 1 — DESIGN SYSTEM DEFINITIVO

Prima di toccare qualsiasi pagina, definisci e
documenta il design system in un file:
`static/css/pragma-design-system.css`

### Palette colori

```css
:root {
  /* Brand primario */
  --pragma-blue: #009FE3;
  --pragma-blue-dark: #0080B8;
  --pragma-blue-darker: #053550;
  --pragma-blue-light: #E6F5FC;
  --pragma-blue-lighter: #F0FAFF;

  /* Testi */
  --pragma-text-primary: #0D1F35;
  --pragma-text-secondary: #3D5A73;
  --pragma-text-muted: #6B8BA4;
  --pragma-text-placeholder: #9BB5C8;

  /* Superfici */
  --pragma-bg-page: #F4F9FD;
  --pragma-bg-card: #FFFFFF;
  --pragma-bg-sidebar: #0D1F35;
  --pragma-bg-sidebar-hover: rgba(255,255,255,0.06);
  --pragma-bg-sidebar-active: rgba(0,159,227,0.15);

  /* Bordi */
  --pragma-border-light: #E8F2FA;
  --pragma-border-default: #D6E8F5;
  --pragma-border-strong: #B5D4F0;

  /* Stati semantici */
  --pragma-success: #639922;
  --pragma-success-bg: #EAF3DE;
  --pragma-warning: #854F0B;
  --pragma-warning-bg: #FAEEDA;
  --pragma-danger: #A32D2D;
  --pragma-danger-bg: #FCEBEB;
  --pragma-info: #185FA5;
  --pragma-info-bg: #E6F1FB;
  --pragma-neutral: #5F5E5A;
  --pragma-neutral-bg: #F1EFE8;
  --pragma-purple: #3C3489;
  --pragma-purple-bg: #EEEDFE;

  /* Tipologie offerta */
  --pragma-ck: #009FE3;
  --pragma-ck-bg: #E6F5FC;
  --pragma-cl: #0080B8;
  --pragma-cl-bg: #B5D4F4;
  --pragma-rk: #639922;
  --pragma-rk-bg: #EAF3DE;
  --pragma-rd: #3B6D11;
  --pragma-rd-bg: #C0DD97;
  --pragma-modus: #854F0B;
  --pragma-modus-bg: #FAEEDA;
  --pragma-unitron: #3C3489;
  --pragma-unitron-bg: #EEEDFE;

  /* Stati offerta */
  --pragma-stato-attesa: #854F0B;
  --pragma-stato-attesa-bg: #FAEEDA;
  --pragma-stato-richiamato: #185FA5;
  --pragma-stato-richiamato-bg: #E6F1FB;
  --pragma-stato-preso: #639922;
  --pragma-stato-preso-bg: #EAF3DE;
  --pragma-stato-perso: #A32D2D;
  --pragma-stato-perso-bg: #FCEBEB;
  --pragma-stato-rimandato: #3C3489;
  --pragma-stato-rimandato-bg: #EEEDFE;

  /* Spacing */
  --pragma-space-xs: 4px;
  --pragma-space-sm: 8px;
  --pragma-space-md: 16px;
  --pragma-space-lg: 24px;
  --pragma-space-xl: 32px;
  --pragma-space-2xl: 48px;

  /* Border radius */
  --pragma-radius-sm: 6px;
  --pragma-radius-md: 10px;
  --pragma-radius-lg: 14px;
  --pragma-radius-xl: 20px;
  --pragma-radius-pill: 100px;

  /* Shadows */
  --pragma-shadow-sm: 0 1px 3px rgba(13,31,53,0.06);
  --pragma-shadow-md: 0 4px 12px rgba(13,31,53,0.08);
  --pragma-shadow-lg: 0 8px 24px rgba(13,31,53,0.10);

  /* Typography */
  --pragma-font: 'Plus Jakarta Sans', system-ui, sans-serif;
  --pragma-font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Transitions */
  --pragma-transition: 0.15s ease;
  --pragma-transition-slow: 0.3s ease;
}
```

### Scala tipografica

```css
.pragma-kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--pragma-blue);
}

.pragma-h1 { font-size: clamp(22px, 3vw, 28px); font-weight: 700; }
.pragma-h2 { font-size: clamp(18px, 2.5vw, 22px); font-weight: 600; }
.pragma-h3 { font-size: 16px; font-weight: 600; }
.pragma-h4 { font-size: 14px; font-weight: 600; }

.pragma-body { font-size: 14px; line-height: 1.6; }
.pragma-body-sm { font-size: 13px; line-height: 1.5; }
.pragma-caption { font-size: 12px; color: var(--pragma-text-muted); }
.pragma-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.pragma-mono {
  font-family: var(--pragma-font-mono);
  font-size: 13px;
}
```

### Componenti base

**Badge stati offerta:**
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--pragma-radius-pill);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.badge-attesa { background: var(--pragma-stato-attesa-bg); color: var(--pragma-stato-attesa); }
.badge-richiamato { background: var(--pragma-stato-richiamato-bg); color: var(--pragma-stato-richiamato); }
.badge-preso { background: var(--pragma-stato-preso-bg); color: var(--pragma-stato-preso); }
.badge-perso { background: var(--pragma-stato-perso-bg); color: var(--pragma-stato-perso); }
.badge-rimandato { background: var(--pragma-stato-rimandato-bg); color: var(--pragma-stato-rimandato); }
```

**Badge tipologie** — stesso pattern per CK, CL, RK, RD, MANSIS ecc.
usando le variabili --pragma-ck, --pragma-ck-bg ecc.

**Card:**
```css
.pragma-card {
  background: var(--pragma-bg-card);
  border: 0.5px solid var(--pragma-border-default);
  border-radius: var(--pragma-radius-lg);
  box-shadow: var(--pragma-shadow-sm);
}
```

**Bottoni:**
```css
.pragma-btn-primary {
  background: var(--pragma-blue);
  color: white;
  border: none;
  padding: 9px 18px;
  border-radius: var(--pragma-radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--pragma-transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pragma-btn-primary:hover { background: var(--pragma-blue-dark); }
.pragma-btn-primary:active { transform: scale(0.98); }
/* .pragma-btn-secondary: bg trasparente, border 0.5px, color text-primary */
/* .pragma-btn-ghost: solo testo, no border, hover bg-light */
/* .pragma-btn-danger: bg danger, color white */
```

---

## PARTE 2 — SIDEBAR REDESIGN

```
┌─────────────────────┐
│ [Logo PRAGMA Π]     │
│ PRAGMA              │
│ Gestionale v2.0     │
├─────────────────────┤
│ [avatar] Nome       │
│ [badge ruolo]       │
├─────────────────────┤
│ MENU                │
│ Dashboard           │
│ ■ Riepilogo Offerte │  ← voce attiva
│ ⚡ Generatore IA    │
│                     │
│ GESTIONE            │
│ Anagrafica Clienti  │
│ Prodotti            │
│ Agenti              │
│ Segnalatori         │
│                     │
│ SISTEMA             │
│ Impostazioni        │
├─────────────────────┤
│ [badge attività N]  │
│ [avatar] F.Bottani  │
│ Esci →              │
└─────────────────────┘
```

**Regole:**
- Larghezza: 220px
- Sfondo: var(--pragma-bg-sidebar) = #0D1F35
- Voci menu: font-size 13px, font-weight 500
- Icone: 16px, opacity 0.7 normale, 1.0 active/hover
- Voce attiva: bg rgba(0,159,227,0.15), bordo sinistro 3px solid var(--pragma-blue), testo white
- Voce hover: bg rgba(255,255,255,0.06), transition 0.15s
- Label sezioni (MENU, GESTIONE, SISTEMA): font-size 10px, uppercase, letter-spacing 1.5px, color rgba(255,255,255,0.35), margin-top 20px
- Logo PRAGMA: icona Π 28px + "PRAGMA" bold 15px bianco + "Gestionale Offerte" 10px muted

**Logo SVG da inserire in cima alla sidebar:**
```html
<div class="pragma-sidebar-logo">
  <svg width="32" height="32" viewBox="0 0 120 120">
    <rect width="120" height="120" rx="16" fill="#009FE3"/>
    <rect x="22" y="30" width="76" height="10" rx="5" fill="white"/>
    <rect x="32" y="40" width="10" height="48" rx="5" fill="white"/>
    <rect x="78" y="40" width="10" height="48" rx="5" fill="white"/>
  </svg>
  <div>
    <span class="pragma-logo-name">PRAGMA</span>
    <span class="pragma-logo-sub">Gestionale Offerte</span>
  </div>
</div>
```

---

## PARTE 3 — HEADER PAGINE

Pattern fisso applicato a tutte le pagine:

```
[Breadcrumb 12px muted]              [Azioni →]
[Kicker 11px uppercase blu]
[H2 titolo pagina]
[Sottotitolo 13px muted opzionale]
────────────────────────────────────
```

- Breadcrumb: separatore "/", ultimo elemento non cliccabile
- Kicker: classe .pragma-kicker, margin-bottom 4px
- Separatore: border-bottom 0.5px solid border-light
- Padding: 24px 32px
- Azioni di pagina: sempre a destra, MAI sotto il titolo

---

## PARTE 4 — KPI CARDS REDESIGN

**Struttura:**
```
┌──────────────────────────────┐
│ [icona] LABEL CATEGORIA      │  ← 11px uppercase muted
│                              │
│ Inviate: XX    Prese: XX     │  ← 22px bold
│                              │
│ Valore preso                 │
│ € XX.XXX                     │  ← 20px bold colore categoria
│                              │
│ ████████░░ XX%               │  ← progress bar 4px
└──────────────────────────────┘
```

**Regole:**
- Padding: 20px
- Border radius: var(--pragma-radius-lg)
- Border top: 3px solid colore categoria
- Hover: shadow-md, transform translateY(-1px)
- Click su card → filtra tabella per quella categoria
- Card attiva dopo click: bordo 2px blu tutto intorno

---

## PARTE 5 — TABELLA RIEPILOGO OFFERTE

**Header tabella:**
```css
thead th {
  background: var(--pragma-text-primary);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 14px;
}
thead th:first-child { border-radius: 10px 0 0 0; }
thead th:last-child { border-radius: 0 10px 0 0; }
thead th.sort-active { color: var(--pragma-blue); }
```

**Righe:**
```css
tbody tr { border-bottom: 0.5px solid var(--pragma-border-light); }
tbody tr:hover { background: var(--pragma-blue-lighter); }
tbody tr.urgente { border-left: 3px solid var(--pragma-danger); }
tbody td { padding: 11px 14px; font-size: 13px; vertical-align: middle; }
```

**Gerarchia visiva celle:**
- N° Offerta: font-weight 600, font-family mono
- Studio/Cliente: nome 13px 500 + badge tipo 10px sotto
- Riferimento: nome condominio bold + via/comune 12px muted sotto
- Tipologia: solo badge sottotipo colorato da design system
- Valore: €XX.XXX font-weight 600, editabile doppio click
- Agente: avatar 24px + nome 13px
- Giorni: badge pill — verde <14gg, arancione 15-30gg, rosso >30gg
- Azioni: icone 15px sempre visibili, gap 8px

---

## PARTE 6 — TOOLBAR FILTRI

```
Riga 1 — STATO:    [Tutte] [In Attesa] [Richiamato] [Preso] [Perso] [Rimandato]
Riga 2 — TIPO:     [CK] [CL] | [RK] [RD] [MANSIS] [MANCT] | [MODUS] [UNITRON] | [FORNITURA] | [INTERVENTI]
Riga 3 — AVANZATI: [Agente ▾] [Tipo cliente ▾] [Cerca...] [Dal] [Al] [× Reset]
```

- Sfondo toolbar: white, border-bottom border-light, padding 12px 20px
- Label sezione: 10px uppercase muted, margin-right 8px
- Bottoni: pill 12px, selezionato = colore categoria
- Separatori "|" tra gruppi tipo: border-left 1px, height 20px
- Filtri stato e tipo: cumulativi (si possono combinare)

---

## PARTE 7 — PANNELLO ESPANSO RIGA

```
bg: rgba(0,159,227,0.03), border-left 3px blu, padding 16px 20px 16px 32px

[avatar] Nome Agente              [Dashboard →]
Cliente: Studio Rossi [Amm.]      [Scheda →]
Oggetto: Via Roma 15 — Cernusco   [Apri →]
Template: E-ITN40 | Natura: Nuovo | Ver: A

──────────────────────────────────────────

[⚡ DOCX] [📕 PDF] [🔄 Aggiorna] [📋 Duplica]
[✉️ Email] [💶 Foglio Costi] [🗑 Elimina]
```

- Info in 2 colonne 50/50, font-size 13px
- Label 11px muted inline prima del valore
- Bottoni: pragma-btn-secondary normali, pragma-btn-danger solo Elimina
- Foglio Costi visibile solo a admin e staff

---

## PARTE 8 — MICRO-INTERAZIONI

**Toast notifications:**
- Bottom right, max 3 visibili
- Slide in da destra, auto dismiss 3s
- Verde successo, rosso errore, blu info
- Icona + testo + × chiudi

**Loading states:**
- Skeleton loader righe tabella durante caricamento
- Spinner nel bottone durante chiamate API (bottone disabled)

**Empty states:**
- Tabella vuota dopo filtro: SVG semplice + testo +
  bottone "Reset filtri"
- Sezioni senza dati: testo centrato muted

**Focus states:**
- Tutti gli input: outline 2px solid var(--pragma-blue), offset 2px
- Mai outline: none senza sostituto

**Hover cursors:**
- Righe e bottoni clickabili: cursor pointer

---

## PARTE 9 — PAGINE INTERNE

Applica design system coerente a:

**Anagrafica Clienti:**
- Tabella stile identico riepilogo
- Badge tipo cliente colorato
- Scheda cliente: header grande + KPI con bordo top colorato

**Agenti:**
- Card lista: avatar 48px + badge KPI inline
- Dashboard: KPI cards coerenti + lista attività pulita

**Prodotti:**
- Badge categoria colorato
- Badge margine: rosso <20%, arancione 20-35%, verde >35%
- Data prezzo vecchia: testo rosso

**Generatore Offerte IA:**
- Card sezioni: border-left 3px blu
- Bottoni pill apparecchi: default border, selected 2px blu bg-light
- Toggle: switch moderno
- Riepilogo live: sticky, font-mono per valori

**Modali:**
```css
.pragma-modal-overlay { background: rgba(13,31,53,0.5); backdrop-filter: blur(2px); }
.pragma-modal { background: white; border-radius: var(--pragma-radius-xl); box-shadow: var(--pragma-shadow-lg); max-width: 560px; }
.pragma-modal-header { padding: 20px 24px 16px; border-bottom: 0.5px solid var(--pragma-border-light); }
.pragma-modal-footer { display: flex; justify-content: flex-end; gap: 10px; }
```

---

## ORDINE DI ESECUZIONE

1. Crea `static/css/pragma-design-system.css` con variabili e classi base
2. Importa in OGNI template HTML
3. Sidebar redesign + logo PRAGMA Π (tutte le pagine)
4. Header pagine coerente (tutte le pagine)
5. KPI cards refactoring
6. Tabella riepilogo offerte
7. Toolbar filtri
8. Pannello espanso
9. Anagrafica Clienti
10. Agenti e dashboard agente
11. Prodotti
12. Generatore Offerte IA
13. Impostazioni
14. Schede Oggetto e Cliente
15. Micro-interazioni (toast, skeleton, empty states)
16. Test visivo ogni pagina

---

## TEST DA ESEGUIRE

```
[ ] pragma-design-system.css caricato in tutte le pagine
[ ] Sidebar identica in tutte le pagine
[ ] Logo PRAGMA Π visibile in sidebar
[ ] Header pagine coerente ovunque
[ ] Badge stati: colori da design system
[ ] Badge tipologie: colori da design system
[ ] Tabella: header scuro, hover corretto
[ ] KPI cards: bordo top colorato per categoria
[ ] Filtri: 3 righe con label, filtri cumulativi
[ ] Pannello espanso: layout pulito
[ ] Toast funzionanti
[ ] Empty state quando tabella vuota
[ ] Focus states visibili su tutti gli input
[ ] Nessuna inconsistenza colori tra pagine
[ ] App si avvia senza errori CSS/JS
[ ] Generazione DOCX/PDF ancora funzionante
```

---

## REGOLE ASSOLUTE

- NON toccare nessuna route Flask o logica DB
- NON rinominare classi CSS già usate nel JS
  (aggiungi nuove classi, non modificare quelle esistenti)
- JS: solo function declarations, MAI arrow functions () => {}
- Importa Plus Jakarta Sans da Google Fonts se non presente
- Tutti i colori DEVONO venire dalle variabili CSS — zero hardcoded
- Coerenza prima di tutto — meglio semplice e coerente che bello e incoerente
- Al termine: apri ogni pagina e verifica che sembrino tutte la stessa app

---

*PRAGMA — Revisione UI/UX v1.0*
*Da eseguire con skill frontend-design attiva*
