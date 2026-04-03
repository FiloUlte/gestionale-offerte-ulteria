/* ══════════════════════════════════════════════════════════════
   Ulteria Gestionale Offerte — Frontend JS v5 (clean rewrite)
   ══════════════════════════════════════════════════════════════ */

var currentView = "dashboard";
var offerte = [];
var clienti = [];
var agenti = [];
var sortCol = null;
var sortDir = "desc";
var searchTerm = "";
var wizardStep = 1;
var wizardData = {
  template: "", nome_studio: "", nome_condominio: "",
  cond_via: "", cond_citta: "",
  via: "", cap: "", citta: "", email_studio: "",
  telefono: "", referente: "",
  modalita: "vendita", prezzo_fornitura: "", prezzo_care: "",
  canone_lettura: "", note: "", salva_cliente: false, agente_id: "",
  natura: "nuovo", tipo_offerta: "installazione"
};

var STATI = [
  { value: "richiamato", label: "Richiamato", color: "#f59e0b", cls: "stato-richiamato" },
  { value: "in_attesa_assemblea", label: "In Attesa Assemblea", color: "#0ea5e9", cls: "stato-in_attesa_assemblea" },
  { value: "preso_lavoro", label: "Preso Lavoro", color: "#22c55e", cls: "stato-preso_lavoro" },
  { value: "perso", label: "Perso", color: "#ef4444", cls: "stato-perso" },
  { value: "rimandato", label: "Rimandato", color: "#7c3aed", cls: "stato-rimandato" }
];
var AGENTE_COLORS = ["#009FE3","#22c55e","#f59e0b","#ef4444","#7c3aed","#ec4899","#14b8a6","#f97316"];

function statoInfo(val) {
  for (var i = 0; i < STATI.length; i++) {
    if (STATI[i].value === val) return STATI[i];
  }
  return STATI[0];
}

/* ─── UTILS ─── */

function fmt(val) {
  if (val === null || val === undefined || val === "") return "\u2014";
  var n = parseFloat(val);
  if (isNaN(n)) return "\u2014";
  return n.toFixed(2).replace(".", ",");
}

function fmtData(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("it-IT");
}

function esc(s) {
  if (!s) return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

function getAgente(id) {
  for (var i = 0; i < agenti.length; i++) {
    if (agenti[i].id === id) return agenti[i];
  }
  return null;
}

function agenteHtml(aid) {
  var a = getAgente(aid);
  if (!a) return "\u2014";
  var ini = (a.nome || " ")[0].toUpperCase() + (a.cognome || " ")[0].toUpperCase();
  var col = a.colore || "#009FE3";
  return '<span class="agente-pill"><span class="agente-dot" style="background:' + col + '">' + ini + "</span>" + esc(a.nome) + "</span>";
}

function icons() {
  try { lucide.createIcons(); } catch (e) { /* ignore */ }
}

/* ─── NAVIGATION ─── */

function navigate(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(function(el) {
    el.classList.toggle("active", el.getAttribute("data-view") === view);
  });
  var map = {
    dashboard: "Riepilogo Offerte",
    nuova: "Nuova Offerta",
    clienti: "Anagrafica Clienti",
    agenti: "Agenti",
    admin: "Dashboard",
    impostazioni: "Impostazioni"
  };
  document.getElementById("bc-title").textContent = map[view] || "";
  renderView();
}

function renderView() {
  var c = document.getElementById("content");
  switch (currentView) {
    case "dashboard": renderDashboard(c); break;
    case "nuova": window.location.href = "/generatore"; break;
    case "clienti": renderClienti(c); break;
    case "agenti": renderAgenti(c); break;
    case "admin": renderAdminDashboard(c); break;
    case "impostazioni": renderImpostazioni(c); break;
  }
}


/* ═══════════════════════════════════════════════════════════
   DASHBOARD — Excel-like
   ═══════════════════════════════════════════════════════════ */

var dashFilters = null;
var dashSort = { col: null, dir: null };
var dashSelected = {};
var dashExpanded = null;
var PAGE_SIZE = 50;
var dashPage = 0;
var dashVisibleCols = null;
var ALL_COLS = ["checkbox","numero","nome_studio","riferimento","tipologia","valore","agente_id","stato","giorni","elimina"];
var COL_LABELS = {checkbox:"",numero:"N. Offerta",nome_studio:"Studio / Cliente",riferimento:"Riferimento",tipologia:"Tipologia",valore:"Valore",agente_id:"Agente",stato:"Stato",giorni:"Giorni",elimina:""};

function loadDashFilters() {
  try {
    var saved = localStorage.getItem("dashFilters");
    if (saved) return JSON.parse(saved);
  } catch (e) { /* */ }
  return { stati: [], agente_id: "", template: "", q: "", dal: "", al: "", tipo_servizio: "", macro_cat: "", tipo_cliente: "" };
}

function saveDashFilters() {
  try { localStorage.setItem("dashFilters", JSON.stringify(dashFilters)); } catch (e) { /* */ }
}

function renderDashboard(c) {
  if (!dashFilters) dashFilters = loadDashFilters();
  if (!dashVisibleCols) {
    try { var s = localStorage.getItem("dashCols"); if (s) dashVisibleCols = JSON.parse(s); } catch (e) { /* */ }
    if (!dashVisibleCols) dashVisibleCols = ALL_COLS.slice();
  }
  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
  Promise.all([api("GET", "/api/offerte"), api("GET", "/api/agenti")]).then(function(r) {
    offerte = r[0];
    agenti = r[1];
    buildDashboard(c);
  }).catch(function(e) {
    c.innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function calcKpi(list) {
  var tot = 0, aperte = 0, prese = 0, valFornitura = 0, valServizi = 0;
  list.forEach(function(o) {
    if (o.stato_versione && o.stato_versione !== "attiva") return;
    tot++;
    if (o.stato === "preso_lavoro") {
      prese++;
      if (!o.is_accordo_quadro) valFornitura += (o.importo || 0);
      valServizi += (o.importo_servizio_annuo || 0);
    }
    if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") aperte++;
  });
  var tasso = tot > 0 ? (prese / tot * 100).toFixed(1) : "\u2014";
  return { tot: tot, aperte: aperte, prese: prese, valFornitura: valFornitura, valServizi: valServizi, tasso: tasso };
}

function fmtEurDash(val) {
  if (!val && val !== 0) return "\u2014";
  return "\u20ac " + Math.round(val).toLocaleString("it-IT");
}

function dashFilterSort() {
  var list = offerte.slice();
  var f = dashFilters;

  if (f.stati && f.stati.length > 0) {
    list = list.filter(function(o) { return f.stati.indexOf(o.stato) >= 0; });
  }
  if (f.agente_id) {
    list = list.filter(function(o) { return o.agente_id === parseInt(f.agente_id); });
  }
  if (f.template) {
    list = list.filter(function(o) { return o.template === f.template; });
  }
  if (f.tipo_servizio) {
    list = list.filter(function(o) { return o.tipo_servizio === f.tipo_servizio; });
  }
  if (f.macro_cat) {
    if (f.macro_cat === "CK" || f.macro_cat === "CL") {
      list = list.filter(function(o) { return o.sottotipo === f.macro_cat; });
    } else {
      list = list.filter(function(o) { return o.macro_categoria === f.macro_cat; });
    }
  }
  if (f.tipo_cliente) {
    list = list.filter(function(o) { return o.cliente_tipo === f.tipo_cliente; });
  }
  if (f.q) {
    var q = f.q.toLowerCase();
    list = list.filter(function(o) {
      return [o.numero, o.nome_studio, o.nome_condominio, o.citta].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  if (f.dal) {
    list = list.filter(function(o) { return o.data_creazione && o.data_creazione >= f.dal; });
  }
  if (f.al) {
    list = list.filter(function(o) { return o.data_creazione && o.data_creazione <= f.al + " 23:59:59"; });
  }

  if (dashSort.col) {
    var col = dashSort.col, dir = dashSort.dir === "asc" ? 1 : -1;
    list.sort(function(a, b) {
      var va = a[col], vb = b[col];
      if (va === null || va === undefined) va = "";
      if (vb === null || vb === undefined) vb = "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }
  return list;
}

function daysDiff(d) {
  if (!d) return null;
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var dt = new Date(d); dt.setHours(0, 0, 0, 0);
  return Math.round((now - dt) / 86400000);
}

function buildDashboard(c) {
  var filtered = dashFilterSort();
  var kpi = calcKpi(filtered);
  var selCount = Object.keys(dashSelected).length;

  // Pagination
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (dashPage >= totalPages) dashPage = totalPages - 1;
  var pageItems = filtered.slice(dashPage * PAGE_SIZE, (dashPage + 1) * PAGE_SIZE);

  var h = "";

  /* KPI — loaded async from /api/dashboard/kpi */
  h += '<div id="kpi-cards" class="g3 mb12" style="min-height:80px"></div>';
  h += '<div id="kpi-cards-2" class="g3 mb20" style="min-height:80px"></div>';

  /* Stato filter tabs */
  h += '<div class="fac gap4 mb12" id="stato-tabs">';
  var stTabs = [
    { val: "", label: "Tutte", bg: "#E6F5FC", color: "#0080B8" },
    { val: "in_attesa_assemblea", label: "In Attesa", bg: "#FFF3E0", color: "#E65100" },
    { val: "richiamato", label: "Richiamato", bg: "#FAEEDA", color: "#854F0B" },
    { val: "preso_lavoro", label: "Preso", bg: "#EAF3DE", color: "#639922" },
    { val: "perso", label: "Perso", bg: "#FCEBEB", color: "#A32D2D" },
    { val: "rimandato", label: "Rimandato", bg: "#EEEDFE", color: "#534AB7" }
  ];
  stTabs.forEach(function(t) {
    var active = t.val === "" ? (dashFilters.stati.length === 0) : (dashFilters.stati.indexOf(t.val) >= 0);
    var style = active ? "background:" + t.color + ";color:#fff;border-color:" + t.color : "background:" + t.bg + ";color:" + t.color + ";border-color:" + t.bg;
    h += '<button class="btn btn-sm" data-stato-filter="' + t.val + '" style="' + style + ';font-weight:700;font-size:.72rem;border-radius:20px;padding:4px 12px">' + t.label + "</button>";
  });
  h += "</div>";

  /* Servizi filter buttons removed — filtering happens via KPI cards and Excel-like column headers */

  /* Filter bar */
  h += '<div class="fac gap8 mb12 flex-wrap" style="flex-wrap:wrap">';
  h += '<select class="inp" id="f-agente" style="width:150px;padding:5px 8px;font-size:.75rem"><option value="">Tutti gli agenti</option>';
  agenti.forEach(function(a) {
    h += '<option value="' + a.id + '"' + (dashFilters.agente_id == a.id ? " selected" : "") + ">" + esc(a.nome + " " + a.cognome) + "</option>";
  });
  h += "</select>";
  h += '<select class="inp" id="f-template" style="width:120px;padding:5px 8px;font-size:.75rem"><option value="">Tutti template</option><option value="E40"' + (dashFilters.template === "E40" ? " selected" : "") + '>E-ITN40</option><option value="Q55"' + (dashFilters.template === "Q55" ? " selected" : "") + ">Q5.5</option></select>";
  h += '<input class="inp" id="f-search" placeholder="Cerca..." value="' + esc(dashFilters.q) + '" style="width:180px;padding:5px 8px;font-size:.75rem" />';
  h += '<input class="inp" id="f-dal" type="date" value="' + (dashFilters.dal || "") + '" style="width:130px;padding:5px 8px;font-size:.75rem" title="Dal" />';
  h += '<input class="inp" id="f-al" type="date" value="' + (dashFilters.al || "") + '" style="width:130px;padding:5px 8px;font-size:.75rem" title="Al" />';
  h += '<button class="btn btn-ghost btn-sm" id="f-reset" title="Reset filtri"><i data-lucide="x" style="width:14px;height:14px"></i></button>';
  h += "</div>";

  /* Bulk + actions bar */
  h += '<div class="fjb mb8">';
  h += '<div class="fac gap8">';
  if (selCount > 0) {
    h += '<span style="font-size:.78rem;font-weight:700;color:var(--blue)">' + selCount + " selezionate</span>";
    h += '<button class="btn btn-sm btn-sec" id="bulk-desel">Deseleziona</button>';
    h += '<button class="btn btn-sm btn-sec" id="bulk-csv">Esporta selezione</button>';
  }
  h += "</div>";
  h += '<div class="fac gap8">';
  h += '<a href="/generatore" class="btn btn-primary btn-sm" style="text-decoration:none"><i data-lucide="zap" style="width:14px;height:14px"></i> Generatore Offerte</a>';
  h += '<button class="btn btn-sec btn-sm" id="btn-nuova-riga"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuova Riga</button>';
  h += '<button class="btn btn-sec btn-sm" id="btn-csv"><i data-lucide="download" style="width:14px;height:14px"></i> Esporta CSV</button>';
  h += "</div></div>";

  /* Table */
  h += '<div class="card-0"><div class="scx"><table class="tbl" id="dash-tbl"><thead><tr>';
  h += '<th style="width:40px"><input type="checkbox" id="sel-all" /></th>';

  var sortable = { numero: 1, nome_studio: 1, riferimento: 1, valore: 1, stato: 1, giorni: 1 };
  var colDefs = [
    { key: "numero", w: "100px" },
    { key: "nome_studio", w: "180px" }, { key: "riferimento", w: "200px" },
    { key: "tipologia", w: "100px" },
    { key: "valore", w: "110px", cls: "r" },
    { key: "agente_id", w: "60px" },
    { key: "stato", w: "140px" },
    { key: "giorni", w: "60px" }, { key: "elimina", w: "40px" }
  ];
  colDefs.forEach(function(cd) {
    if (dashVisibleCols.indexOf(cd.key) < 0) return;
    var label = COL_LABELS[cd.key] || cd.key;
    var arrow = "";
    if (sortable[cd.key]) {
      if (dashSort.col === cd.key) arrow = dashSort.dir === "asc" ? " \u2191" : " \u2193";
      h += '<th style="width:' + cd.w + ';cursor:pointer" data-sort-col="' + cd.key + '" class="' + (cd.cls || "") + '">' + label + arrow + "</th>";
    } else {
      h += '<th style="width:' + cd.w + '" class="' + (cd.cls || "") + '">' + label + "</th>";
    }
  });
  h += "</tr></thead><tbody>";

  if (pageItems.length === 0) {
    h += '<tr><td colspan="' + (colDefs.length + 1) + '" style="text-align:center;padding:30px;color:var(--muted)">Nessuna offerta</td></tr>';
  }

  pageItems.forEach(function(o) {
    var imp = (o.prezzo_fornitura || 0) + (o.prezzo_care || 0) + (o.canone_lettura || 0);
    var si = statoInfo(o.stato);
    var isOpen = o.stato !== "preso_lavoro" && o.stato !== "perso" && o.stato !== "rimandato";
    var gg = isOpen ? daysDiff(o.data_creazione) : null;
    var ggHtml = "\u2014";
    if (gg !== null) {
      var gcls = gg < 15 ? "giorni-verde" : (gg <= 30 ? "giorni-arancione" : "giorni-rosso");
      ggHtml = '<span class="giorni-badge ' + gcls + '">' + gg + " gg</span>";
      if (gg > 30) ggHtml += '<span class="pulse-dot"></span>';
    }
    var isSel = !!dashSelected[o.id];
    var isExp = dashExpanded === o.id;
    var urgentCls = (gg !== null && gg > 30) ? " row-urgent" : "";

    h += '<tr data-oid="' + o.id + '" class="' + (isSel ? "row-selected" : "") + urgentCls + '">';
    h += '<td><input type="checkbox" class="row-sel" data-sel-id="' + o.id + '"' + (isSel ? " checked" : "") + " /></td>";

    /* N. Offerta (merged with versione) + chevron expand icon */
    if (dashVisibleCols.indexOf("numero") >= 0) {
      var numDisp = o.numero || "\u2014";
      if (o.versione && o.versione !== "A") numDisp = numDisp + "-" + o.versione;
      var chevIcon = isExp ? "chevron-down" : "chevron-right";
      h += '<td class="mono" style="cursor:pointer"><i data-lucide="' + chevIcon + '" style="width:14px;height:14px;vertical-align:-2px;color:var(--blue);margin-right:4px"></i>' + numDisp + "</td>";
    }
    /* Studio / Cliente */
    if (dashVisibleCols.indexOf("nome_studio") >= 0) {
      h += '<td class="editable" data-field="nome_studio"><div><strong>' + esc(o.nome_studio || "") + "</strong></div>";
      if (o.cliente_tipo) h += '<div><span class="badge" style="font-size:.55rem;background:#E6F5FC;color:#0080B8">' + esc(o.cliente_tipo) + "</span></div>";
      h += "</td>";
    }
    /* Riferimento (oggetto via + comune) */
    if (dashVisibleCols.indexOf("riferimento") >= 0) {
      var rif = "";
      if (o.oggetto_nome) rif += '<div style="font-weight:700;font-size:.78rem">' + esc(o.oggetto_nome) + "</div>";
      var addr = (o.oggetto_via || o.via || "") + (o.oggetto_civico ? " " + o.oggetto_civico : "");
      var com = o.oggetto_comune || o.citta || "";
      if (addr || com) rif += '<div style="font-size:.72rem;color:var(--mid)">' + esc(addr + (com ? " \u2014 " + com : "")) + "</div>";
      h += "<td>" + (rif || '<span style="color:var(--muted)">\u2014</span>') + "</td>";
    }
    /* Tipologia (sottotipo badge) */
    if (dashVisibleCols.indexOf("tipologia") >= 0) {
      var tipoBadge = "";
      if (o.sottotipo) {
        tipoBadge = '<span class="badge" style="font-size:.6rem">' + esc(o.sottotipo) + "</span>";
      } else if (o.macro_categoria === "cc_modus") {
        tipoBadge = '<span class="badge" style="font-size:.6rem;background:#FAEEDA;color:#854F0B">CC-MODUS</span>';
      } else if (o.macro_categoria === "cu_unitron") {
        tipoBadge = '<span class="badge" style="font-size:.6rem;background:#EEEDFE;color:#3C3489">UNITRON</span>';
      } else if (o.tipo_offerta) {
        tipoBadge = '<span class="badge b-gray" style="font-size:.6rem">' + esc(o.tipo_offerta) + "</span>";
      }
      if (o.is_gara_appalto) tipoBadge += ' <span class="badge" style="font-size:.5rem;background:#FCEBEB;color:#A32D2D">GARA</span>';
      h += "<td>" + (tipoBadge || "\u2014") + "</td>";
    }
    /* Valore */
    if (dashVisibleCols.indexOf("valore") >= 0) {
      var valDisp = o.valore_commessa || o.importo || imp;
      h += '<td class="num editable" data-field="valore_commessa">' + (valDisp ? fmtEurDash(valDisp) : '<span style="color:var(--muted)">\u2014</span>');
      if (o.is_gara_appalto) h += '<div style="font-size:.6rem;color:var(--muted)">(gara)</div>';
      h += "</td>";
    }
    /* Agente — solo iniziali */
    if (dashVisibleCols.indexOf("agente_id") >= 0) {
      var agName = o.agente_nome || "";
      var agSur = o.agente_cognome || "";
      var agCol2 = o.agente_colore || "#009FE3";
      if (o.agente_id || agName) {
        var agI = (agName[0] || "").toUpperCase() + (agSur[0] || "").toUpperCase();
        if (!agI && o.agente_id) {
          var agObj = getAgente(o.agente_id);
          if (agObj) { agI = ((agObj.nome || " ")[0] + (agObj.cognome || " ")[0]).toUpperCase(); agCol2 = agObj.colore || "#009FE3"; }
        }
        h += '<td class="editable" data-field="agente_id" title="' + esc(agName + " " + agSur) + '"><span class="agente-dot" style="background:' + agCol2 + ';width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-size:.65rem;font-weight:800;color:#fff">' + agI + "</span></td>";
      } else {
        h += '<td class="editable" data-field="agente_id" style="text-align:center"><span style="color:var(--muted);font-size:.7rem;cursor:pointer" title="Clicca per assegnare agente">+</span></td>';
      }
    }
    /* Stato */
    if (dashVisibleCols.indexOf("stato") >= 0) h += '<td><span class="stato-badge ' + si.cls + '" style="cursor:pointer" data-stato-click="' + o.id + '">' + si.label + "</span></td>";
    /* Giorni */
    if (dashVisibleCols.indexOf("giorni") >= 0) h += "<td>" + ggHtml + "</td>";
    /* Elimina (solo cestino) */
    if (dashVisibleCols.indexOf("elimina") >= 0) {
      h += '<td><button class="act-btn act-del" data-del-id="' + o.id + '" data-del-num="' + (o.numero || "") + '" title="Elimina" style="padding:4px"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button></td>';
    }
    h += "</tr>";

    /* Expanded detail row */
    if (isExp) {
      var hasDocx = !!o.path_docx, hasPdf = !!o.path_pdf;
      var natMap2 = { nuovo: "Nuovo", rinnovo: "Rinnovo", subentro_diretto: "Subentro Dir.", subentro_intermediario: "Subentro Int." };
      h += '<tr class="row-expanded"><td colspan="' + (colDefs.length + 1) + '">';
      h += '<div class="expand-panel">';
      h += '<div style="display:flex;gap:20px;margin-bottom:12px">';
      /* Left */
      h += '<div style="flex:1">';
      h += "<div style='margin-bottom:4px'><strong>" + esc(o.nome_studio || "") + "</strong>";
      if (o.cliente_tipo) h += ' <span class="badge" style="font-size:.55rem;background:#E6F5FC;color:#0080B8">' + esc(o.cliente_tipo) + "</span>";
      h += "</div>";
      if (o.agente_id || o.agente_nome) {
        h += '<div style="font-size:.82rem;margin-bottom:4px">';
        if (o.agente_id) h += agenteHtml(o.agente_id);
        else if (o.agente_nome) h += esc(o.agente_nome + " " + (o.agente_cognome || ""));
        if (o.agente_id) h += ' <a href="/agenti/' + o.agente_id + '" style="color:var(--blue);font-size:.72rem">[Dashboard]</a>';
        h += "</div>";
      }
      var rifAddr = (o.oggetto_via || o.via || "") + (o.oggetto_civico ? " " + o.oggetto_civico : "");
      var rifCom = o.oggetto_comune || o.citta || "";
      if (rifAddr || rifCom) {
        h += '<div style="font-size:.82rem;color:var(--mid);margin-bottom:4px">Rif: ' + esc(rifAddr + (rifCom ? " \u2014 " + rifCom : ""));
        if (o.oggetto_id) h += ' <a href="/oggetti/' + o.oggetto_id + '" style="color:var(--blue);font-size:.72rem">[Apri]</a>';
        h += "</div>";
      }
      h += '<div style="font-size:.75rem;color:var(--muted)">';
      h += "Template: " + esc(o.template || "\u2014") + " | Tipologia: " + esc(o.macro_categoria || o.tipo_offerta || "\u2014") + "/" + esc(o.sottotipo || "\u2014");
      h += " | Natura: " + esc(natMap2[o.natura] || o.natura || "\u2014") + " | Ver.: " + esc(o.versione || "A");
      h += "</div>";
      if (o.importo_servizio_annuo) h += '<div style="font-size:.78rem;margin-top:4px">Canone annuo: <strong>' + fmtEurDash(o.importo_servizio_annuo) + "/anno</strong></div>";
      if (o.segnalatore_nome) h += '<div style="font-size:.78rem">Segnalatore: ' + esc(o.segnalatore_nome) + "</div>";
      if (o.is_gara_appalto) h += '<div style="font-size:.78rem;color:#A32D2D">Gara appalto: ' + esc(o.gara_id || "") + " \u2014 " + fmtEurDash(o.valore_gara) + "</div>";
      h += "</div>";
      /* Right */
      h += '<div style="text-align:right">';
      h += '<div><span class="stato-badge ' + si.cls + '" style="font-size:.78rem">' + si.label + "</span></div>";
      if (gg !== null) h += "<div style='margin-top:4px'>" + ggHtml + "</div>";
      h += '<div style="margin-top:4px;font-size:.72rem;color:var(--muted)">' + fmtData(o.data_creazione) + "</div>";
      h += "</div></div>";
      /* Actions */
      h += '<div class="fac gap6" style="flex-wrap:wrap">';
      h += '<button class="btn btn-sm btn-sec" data-edit-off="' + o.id + '"><i data-lucide="edit" style="width:12px;height:12px"></i> Modifica</button>';
      h += '<button class="btn btn-sm btn-primary" data-gen-id="' + o.id + '"><i data-lucide="zap" style="width:12px;height:12px"></i> Genera DOCX</button>';
      if (hasDocx) h += '<button class="btn btn-sm btn-sec" data-open="' + esc(o.path_docx) + '"><i data-lucide="file-text" style="width:12px;height:12px"></i> DOCX</button>';
      if (hasPdf) h += '<button class="btn btn-sm btn-pdf" data-open="' + esc(o.path_pdf) + '"><i data-lucide="file" style="width:12px;height:12px"></i> PDF</button>';
      h += '<button class="btn btn-sm btn-sec" data-ver-id="' + o.id + '"><i data-lucide="refresh-cw" style="width:12px;height:12px"></i> Aggiorna</button>';
      h += '<button class="btn btn-sm btn-sec" data-dup-id="' + o.id + '"><i data-lucide="copy" style="width:12px;height:12px"></i> Duplica</button>';
      if (o.oggetto_id) h += '<button class="btn btn-sm btn-sec" data-fc-oggetto="' + o.oggetto_id + '"><i data-lucide="euro" style="width:12px;height:12px"></i> Foglio Costi</button>';
      h += '<button class="btn btn-sm btn-sec" data-mail-id="' + o.id + '"><i data-lucide="mail" style="width:12px;height:12px"></i> Email</button>';
      h += '<button class="btn btn-sm btn-danger" data-del-id="' + o.id + '" data-del-num="' + (o.numero || "") + '"><i data-lucide="trash-2" style="width:12px;height:12px"></i> Elimina</button>';
      h += "</div></div></td></tr>";
    }
  });

  h += "</tbody></table></div>";

  /* Pagination */
  if (totalPages > 1) {
    h += '<div class="fac gap6" style="padding:10px 14px;justify-content:center">';
    h += '<button class="btn btn-sm btn-ghost" id="pg-prev"' + (dashPage === 0 ? " disabled" : "") + '>&lt; Prec</button>';
    for (var p = 0; p < totalPages; p++) {
      h += '<button class="btn btn-sm ' + (p === dashPage ? "btn-primary" : "btn-ghost") + '" data-pg="' + p + '">' + (p + 1) + "</button>";
    }
    h += '<button class="btn btn-sm btn-ghost" id="pg-next"' + (dashPage >= totalPages - 1 ? " disabled" : "") + '>Succ &gt;</button>';
    h += "</div>";
  }
  h += "</div>";

  c.innerHTML = h;
  icons();
  attachDashEvents(c);
  loadKpiCards();
}

function loadKpiCards() {
  api("GET", "/api/dashboard/kpi").then(function(res) {
    if (!res.ok) return;
    var d = res.data;
    var kpiDefs = [
      { key: "CK", label: "CK — Sostituzione Ripartitori", icon: "heater", color: "#009FE3", data: d.CK },
      { key: "CL", label: "CL — Commesse Lavori", icon: "wrench", color: "#EF9F27", data: d.CL },
      { key: "servizi", label: "Servizi", icon: "repeat", color: "#639922", data: d.servizi }
    ];
    var kpiDefs2 = [
      { key: "cc_modus", label: "CC-Modus", icon: "layers", color: "#854F0B", data: d.cc_modus },
      { key: "cu_unitron", label: "CU-Unitron", icon: "radio", color: "#534AB7", data: d.cu_unitron },
      { key: "fornitura", label: "Fornitura Materiale", icon: "package", color: "#993C1D", data: d.fornitura }
    ];

    function renderKpiCard(def) {
      var k = def.data || { inviate: 0, prese: 0, valore_preso: 0, valore_annuo: 0 };
      var val = k.valore_annuo ? fmtEurDash(k.valore_annuo) + "/anno" : fmtEurDash(k.valore_preso || 0);
      var tasso = k.inviate > 0 ? Math.round(k.prese / k.inviate * 100) : 0;
      var active = dashFilters.macro_cat === def.key;
      return '<div class="kpi" style="cursor:pointer;border-left:3px solid ' + def.color + (active ? ";outline:2px solid " + def.color : "") + '" data-kpi-cat="' + def.key + '">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><i data-lucide="' + def.icon + '" style="width:16px;height:16px;color:' + def.color + '"></i><span style="font-size:.72rem;font-weight:700;color:' + def.color + '">' + def.label + '</span></div>' +
        '<div style="display:flex;gap:12px;font-size:.78rem;margin-bottom:4px"><span>Inviate: <strong>' + k.inviate + '</strong></span><span>Prese: <strong style="color:#639922">' + k.prese + '</strong></span></div>' +
        '<div style="font-size:.85rem;font-weight:800;color:' + def.color + '">' + val + '</div>' +
        '<div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + tasso + '%;background:' + def.color + ';border-radius:2px"></div></div>' +
        "</div>";
    }

    var h1 = "";
    kpiDefs.forEach(function(def) { h1 += renderKpiCard(def); });
    var el1 = document.getElementById("kpi-cards");
    if (el1) { el1.innerHTML = h1; icons(); }

    var h2 = "";
    kpiDefs2.forEach(function(def) { h2 += renderKpiCard(def); });
    var el2 = document.getElementById("kpi-cards-2");
    if (el2) { el2.innerHTML = h2; icons(); }

    /* KPI card click to filter */
    document.querySelectorAll("[data-kpi-cat]").forEach(function(card) {
      card.addEventListener("click", function() {
        var cat = this.getAttribute("data-kpi-cat");
        if (dashFilters.macro_cat === cat) dashFilters.macro_cat = "";
        else dashFilters.macro_cat = cat;
        saveDashFilters();
        buildDashboard(document.getElementById("content"));
      });
    });
  });
}

/* ─── Dashboard events ─── */

function attachDashEvents(c) {
  var searchTimer = null;

  /* Stato filter tabs */
  c.querySelectorAll("[data-stato-filter]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var val = this.getAttribute("data-stato-filter");
      if (val === "") { dashFilters.stati = []; }
      else {
        var idx = dashFilters.stati.indexOf(val);
        if (idx >= 0) dashFilters.stati.splice(idx, 1);
        else dashFilters.stati.push(val);
      }
      dashPage = 0;
      saveDashFilters();
      buildDashboard(c);
    });
  });

  /* Servizi filter buttons removed */

  /* Filters */
  var fAgente = document.getElementById("f-agente");
  if (fAgente) fAgente.addEventListener("change", function() { dashFilters.agente_id = this.value; dashPage = 0; saveDashFilters(); buildDashboard(c); });
  var fTemplate = document.getElementById("f-template");
  if (fTemplate) fTemplate.addEventListener("change", function() { dashFilters.template = this.value; dashPage = 0; saveDashFilters(); buildDashboard(c); });
  var fSearch = document.getElementById("f-search");
  if (fSearch) fSearch.addEventListener("input", function() {
    var val = this.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { dashFilters.q = val; dashPage = 0; saveDashFilters(); buildDashboard(c); }, 300);
  });
  var fDal = document.getElementById("f-dal");
  if (fDal) fDal.addEventListener("change", function() { dashFilters.dal = this.value; dashPage = 0; saveDashFilters(); buildDashboard(c); });
  var fAl = document.getElementById("f-al");
  if (fAl) fAl.addEventListener("change", function() { dashFilters.al = this.value; dashPage = 0; saveDashFilters(); buildDashboard(c); });
  var fReset = document.getElementById("f-reset");
  if (fReset) fReset.addEventListener("click", function() {
    dashFilters = { stati: [], agente_id: "", template: "", q: "", dal: "", al: "", tipo_servizio: "", macro_cat: "", tipo_cliente: "" };
    dashSort = { col: null, dir: null };
    dashPage = 0;
    localStorage.removeItem("dashFilters");
    buildDashboard(c);
  });

  /* Toolbar */
  var btnNuovaRiga = document.getElementById("btn-nuova-riga");
  if (btnNuovaRiga) btnNuovaRiga.addEventListener("click", function() { showNuovaOffertaModal(c); });
  var btnCsv = document.getElementById("btn-csv");
  if (btnCsv) btnCsv.addEventListener("click", function() { esportaCsv(offerte); });
  var bulkDesel = document.getElementById("bulk-desel");
  if (bulkDesel) bulkDesel.addEventListener("click", function() { dashSelected = {}; buildDashboard(c); });
  var bulkCsv = document.getElementById("bulk-csv");
  if (bulkCsv) bulkCsv.addEventListener("click", function() {
    var sel = offerte.filter(function(o) { return !!dashSelected[o.id]; });
    esportaCsv(sel);
  });

  /* Select all */
  var selAll = document.getElementById("sel-all");
  if (selAll) selAll.addEventListener("change", function() {
    var checked = this.checked;
    var filtered = dashFilterSort();
    var page = filtered.slice(dashPage * PAGE_SIZE, (dashPage + 1) * PAGE_SIZE);
    page.forEach(function(o) { if (checked) dashSelected[o.id] = true; else delete dashSelected[o.id]; });
    buildDashboard(c);
  });

  /* Row checkboxes */
  c.querySelectorAll(".row-sel").forEach(function(cb) {
    cb.addEventListener("change", function() {
      var id = parseInt(this.getAttribute("data-sel-id"));
      if (this.checked) dashSelected[id] = true; else delete dashSelected[id];
      buildDashboard(c);
    });
  });

  /* Sort */
  c.querySelectorAll("[data-sort-col]").forEach(function(th) {
    th.addEventListener("click", function() {
      var col = this.getAttribute("data-sort-col");
      if (dashSort.col === col) {
        if (dashSort.dir === "asc") dashSort.dir = "desc";
        else if (dashSort.dir === "desc") { dashSort.col = null; dashSort.dir = null; }
      } else { dashSort.col = col; dashSort.dir = "asc"; }
      buildDashboard(c);
    });
  });

  /* Row click to expand */
  c.querySelectorAll("tr[data-oid]").forEach(function(tr) {
    tr.addEventListener("click", function(e) {
      if (e.target.closest(".editable") || e.target.closest(".act-btns") || e.target.closest(".act-del") || e.target.closest(".stato-badge") || e.target.closest("input[type=checkbox]")) return;
      var oid = parseInt(this.getAttribute("data-oid"));
      dashExpanded = dashExpanded === oid ? null : oid;
      buildDashboard(c);
    });
  });

  /* Inline editing */
  c.querySelectorAll("td.editable").forEach(function(td) {
    td.addEventListener("dblclick", function(e) {
      e.stopPropagation();
      var oid = parseInt(td.parentElement.getAttribute("data-oid"));
      var field = td.getAttribute("data-field");
      if (field === "agente_id") editAgente(td, oid, c);
      else if (field === "template") editTemplate(td, oid, c);
      else if (field === "importo" || field === "valore_commessa") editImporto(td, oid, c);
      else editCell(td, oid, field, c);
    });
  });

  /* Stato click */
  c.querySelectorAll("[data-stato-click]").forEach(function(badge) {
    badge.addEventListener("click", function(e) {
      e.stopPropagation();
      showStatoDropdown(badge, parseInt(badge.getAttribute("data-stato-click")), c);
    });
  });

  /* Actions */
  c.querySelectorAll("[data-gen-id]").forEach(function(btn) {
    btn.addEventListener("click", function(e) { e.stopPropagation(); doGenera(parseInt(btn.getAttribute("data-gen-id")), c); });
  });
  c.querySelectorAll("[data-open]").forEach(function(btn) {
    btn.addEventListener("click", function(e) { e.stopPropagation(); var p = btn.getAttribute("data-open"); if (p) window.open(p, "_blank"); });
  });
  c.querySelectorAll("[data-mail-id]").forEach(function(btn) {
    btn.addEventListener("click", function(e) { e.stopPropagation(); doMail(parseInt(btn.getAttribute("data-mail-id"))); });
  });
  c.querySelectorAll("[data-del-id]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var id = parseInt(btn.getAttribute("data-del-id"));
      var num = btn.getAttribute("data-del-num") || id;
      showModal("Conferma", "Eliminare offerta N. " + num + "?", [
        { label: "Annulla", cls: "btn btn-sec", fn: closeModal },
        { label: "Elimina", cls: "btn btn-danger", fn: function() { closeModal(); api("DELETE", "/api/offerte/" + id).then(function() { renderDashboard(c); toast("Offerta eliminata", "ok"); }); } }
      ]);
    });
  });
  c.querySelectorAll("[data-dup-id]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var id = parseInt(btn.getAttribute("data-dup-id"));
      api("POST", "/api/offerte/" + id + "/duplica").then(function(res) {
        toast("Offerta duplicata: N. " + (res.numero || ""), "ok");
        renderDashboard(c);
      });
    });
  });

  /* Aggiorna offerta (versione) */
  c.querySelectorAll("[data-ver-id]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var id = parseInt(btn.getAttribute("data-ver-id"));
      if (confirm("Creare nuova versione di questa offerta?")) {
        api("POST", "/api/offerte/" + id + "/versione").then(function(res) {
          if (res.ok) { toast("Versione " + (res.data ? res.data.versione : "") + " creata", "ok"); renderDashboard(c); }
          else toast(res.error || "Errore", "error");
        });
      }
    });
  });

  /* Modifica offerta */
  c.querySelectorAll("[data-edit-off]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var id = parseInt(btn.getAttribute("data-edit-off"));
      var off = offerte.find(function(o) { return o.id === id; });
      if (off) showEditOffertaModal(off, c);
    });
  });

  /* Foglio Costi link */
  c.querySelectorAll("[data-fc-oggetto]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      window.location.href = "/oggetti/" + btn.getAttribute("data-fc-oggetto");
    });
  });

  /* Pagination */
  var pgPrev = document.getElementById("pg-prev");
  if (pgPrev) pgPrev.addEventListener("click", function() { if (dashPage > 0) { dashPage--; buildDashboard(c); } });
  var pgNext = document.getElementById("pg-next");
  if (pgNext) pgNext.addEventListener("click", function() { dashPage++; buildDashboard(c); });
  c.querySelectorAll("[data-pg]").forEach(function(btn) {
    btn.addEventListener("click", function() { dashPage = parseInt(this.getAttribute("data-pg")); buildDashboard(c); });
  });
}

/* ─── Inline editing ─── */

function editCell(td, oid, field, cont) {
  if (td.querySelector("input")) return;
  var off = offerte.find(function(o) { return o.id === oid; });
  var val = off ? (off[field] || "") : "";
  var inp = document.createElement("input");
  inp.className = "cell-edit";
  inp.value = val;
  td.textContent = "";
  td.appendChild(inp);
  inp.focus();
  inp.select();

  function save() {
    var data = {};
    data[field] = inp.value;
    api("PUT", "/api/offerte/" + oid, data).then(function() {
      toast("Salvato", "ok");
      renderDashboard(cont);
    });
  }
  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") buildDashboard(cont);
  });
  inp.addEventListener("blur", save);
}

function editImporto(td, oid, cont) {
  if (td.querySelector("input")) return;
  var off = offerte.find(function(o) { return o.id === oid; });
  var imp = off ? (off.valore_commessa || off.importo || 0) : 0;
  var inp = document.createElement("input");
  inp.className = "cell-edit";
  inp.type = "number";
  inp.step = "0.01";
  inp.value = imp || "";
  td.textContent = "";
  td.appendChild(inp);
  inp.focus();
  inp.select();

  function save() {
    var v = parseFloat(inp.value) || 0;
    api("PUT", "/api/offerte/" + oid, { valore_commessa: v, importo: v }).then(function() {
      toast("Salvato", "ok");
      renderDashboard(cont);
    });
  }
  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") buildDashboard(cont);
  });
  inp.addEventListener("blur", save);
}

function editTemplate(td, oid, cont) {
  if (td.querySelector("select")) return;
  var off = offerte.find(function(o) { return o.id === oid; });
  var sel = document.createElement("select");
  sel.className = "cell-edit";
  sel.innerHTML = '<option value="E40"' + (off && off.template === "E40" ? " selected" : "") + '>E-ITN40</option><option value="Q55"' + (off && off.template === "Q55" ? " selected" : "") + ">Q5.5</option>";
  td.textContent = "";
  td.appendChild(sel);
  sel.focus();
  function save() {
    api("PUT", "/api/offerte/" + oid, { template: sel.value }).then(function() { toast("Salvato", "ok"); renderDashboard(cont); });
  }
  sel.addEventListener("change", save);
  sel.addEventListener("blur", save);
}

function editAgente(td, oid, cont) {
  if (td.querySelector("select")) return;
  var off = offerte.find(function(o) { return o.id === oid; });
  var sel = document.createElement("select");
  sel.className = "cell-edit";
  var optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Non assegnato";
  sel.appendChild(optNone);
  agenti.forEach(function(a) {
    var opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = a.nome + " " + a.cognome;
    if (off && off.agente_id === a.id) opt.selected = true;
    sel.appendChild(opt);
  });
  td.textContent = "";
  td.appendChild(sel);
  sel.focus();
  function save() {
    api("PUT", "/api/offerte/" + oid, { agente_id: sel.value ? parseInt(sel.value) : null }).then(function() { toast("Salvato", "ok"); renderDashboard(cont); });
  }
  sel.addEventListener("change", save);
  sel.addEventListener("blur", save);
}

/* ─── Stato dropdown with motivo perdita ─── */

function showStatoDropdown(badge, oid, cont) {
  closeStatoDropdown();
  var oldOff = offerte.find(function(o) { return o.id === oid; });
  var oldStato = oldOff ? oldOff.stato : "";

  var dd = document.createElement("div");
  dd.className = "stato-dropdown";
  dd.id = "stato-dd";
  STATI.forEach(function(s) {
    var row = document.createElement("div");
    row.className = "stato-option";
    row.innerHTML = '<span class="stato-dot" style="background:' + s.color + '"></span>' + s.label;
    row.addEventListener("click", function(e) {
      e.stopPropagation();
      closeStatoDropdown();
      if (s.value === "perso") {
        showMotivoPerdita(oid, oldStato, cont);
      } else {
        api("PUT", "/api/offerte/" + oid, { stato: s.value }).then(function() {
          toast("Stato aggiornato: " + s.label, "ok");
          renderDashboard(cont);
        });
      }
    });
    dd.appendChild(row);
  });
  badge.parentElement.appendChild(dd);
  setTimeout(function() { document.addEventListener("click", closeStatoDropdown, { once: true }); }, 10);
}

function closeStatoDropdown() {
  var dd = document.getElementById("stato-dd");
  if (dd) dd.remove();
}

function showMotivoPerdita(oid, oldStato, cont) {
  var motivi = ["Prezzo troppo alto", "Competitor", "Assemblea non approva", "Cliente non risponde", "Rimandato", "Cambio amministratore", "Altro"];
  showModal("Motivo Perdita", "", []);
  var body = document.querySelector("#modal-overlay .modal-body");
  if (!body) return;
  var bh = '<div class="form-field"><label>Motivo principale *</label><select class="inp" id="mp-motivo">';
  motivi.forEach(function(m) { bh += "<option>" + m + "</option>"; });
  bh += '</select></div><div class="form-field"><label>Note aggiuntive</label><textarea class="inp" id="mp-note" rows="2"></textarea></div>';
  body.innerHTML = bh;

  var footer = document.querySelector("#modal-overlay .modal-footer");
  if (footer) {
    footer.innerHTML = "";
    var btnCancel = document.createElement("button");
    btnCancel.className = "btn btn-sec";
    btnCancel.textContent = "Annulla";
    btnCancel.addEventListener("click", closeModal);
    var btnConfirm = document.createElement("button");
    btnConfirm.className = "btn btn-danger";
    btnConfirm.textContent = "Conferma perdita";
    btnConfirm.addEventListener("click", function() {
      var motivo = document.getElementById("mp-motivo").value;
      var note = document.getElementById("mp-note").value;
      api("PUT", "/api/offerte/" + oid, { stato: "perso", motivo_perdita: motivo, note_perdita: note }).then(function() {
        closeModal();
        toast("Stato aggiornato: Perso", "error");
        renderDashboard(cont);
      });
    });
    footer.appendChild(btnCancel);
    footer.appendChild(btnConfirm);
  }
}

/* ─── Modifica Offerta Modal ─── */

function showEditOffertaModal(off, cont) {
  closeModal();

  var agOpts = '<option value="">-- Seleziona --</option>';
  agenti.forEach(function(a) {
    agOpts += '<option value="' + a.id + '"' + (off.agente_id === a.id ? " selected" : "") + '>' + esc(a.nome + ' ' + a.cognome) + '</option>';
  });

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.id = "modal-overlay";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) closeModal(); });

  var modal = document.createElement("div");
  modal.className = "modal";
  modal.style.width = "700px";
  modal.style.maxHeight = "90vh";
  modal.style.overflowY = "auto";

  var header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = '<h2>Modifica Offerta N. ' + (off.numero || off.id) + '</h2>';

  var body = document.createElement("div");
  body.className = "modal-body";

  var bh = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Studio / Cliente</label><input class="inp" id="eo-studio" value="' + esc(off.nome_studio || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Agente</label><select class="inp" id="eo-agente" style="font-size:.88rem;padding:9px 12px">' + agOpts + '</select></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Nome Condominio</label><input class="inp" id="eo-cond" value="' + esc(off.nome_condominio || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Via</label><input class="inp" id="eo-via" value="' + esc(off.via || off.oggetto_via || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Comune</label><input class="inp" id="eo-citta" value="' + esc(off.citta || off.oggetto_comune || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Macro Categoria</label><select class="inp" id="eo-macro" style="font-size:.88rem;padding:9px 12px"><option value="">--</option><option value="installazione"' + (off.macro_categoria === 'installazione' ? ' selected' : '') + '>Installazione</option><option value="servizi"' + (off.macro_categoria === 'servizi' ? ' selected' : '') + '>Servizi</option><option value="cc_modus"' + (off.macro_categoria === 'cc_modus' ? ' selected' : '') + '>CC-Modus</option><option value="cu_unitron"' + (off.macro_categoria === 'cu_unitron' ? ' selected' : '') + '>CU-Unitron</option><option value="fornitura"' + (off.macro_categoria === 'fornitura' ? ' selected' : '') + '>Fornitura</option><option value="interventi"' + (off.macro_categoria === 'interventi' ? ' selected' : '') + '>Interventi</option></select></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Sottotipo</label><input class="inp" id="eo-sottotipo" value="' + esc(off.sottotipo || '') + '" placeholder="CK, CL, RK, RD..." style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Natura</label><select class="inp" id="eo-natura" style="font-size:.88rem;padding:9px 12px"><option value="nuovo"' + (off.natura === 'nuovo' ? ' selected' : '') + '>Nuovo</option><option value="rinnovo"' + (off.natura === 'rinnovo' ? ' selected' : '') + '>Rinnovo</option><option value="subentro_diretto"' + (off.natura === 'subentro_diretto' ? ' selected' : '') + '>Subentro Diretto</option><option value="subentro_intermediario"' + (off.natura === 'subentro_intermediario' ? ' selected' : '') + '>Subentro Intermediario</option></select></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Stato</label><select class="inp" id="eo-stato" style="font-size:.88rem;padding:9px 12px"><option value="richiamato"' + (off.stato === 'richiamato' ? ' selected' : '') + '>Richiamato</option><option value="in_attesa_assemblea"' + (off.stato === 'in_attesa_assemblea' ? ' selected' : '') + '>In Attesa Assemblea</option><option value="preso_lavoro"' + (off.stato === 'preso_lavoro' ? ' selected' : '') + '>Preso Lavoro</option><option value="perso"' + (off.stato === 'perso' ? ' selected' : '') + '>Perso</option><option value="rimandato"' + (off.stato === 'rimandato' ? ' selected' : '') + '>Rimandato</option></select></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Valore Commessa &euro;</label><input class="inp" type="number" step="0.01" id="eo-valore" value="' + (off.valore_commessa || off.importo || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Canone Annuo &euro;/anno</label><input class="inp" type="number" step="0.01" id="eo-annuo" value="' + (off.importo_servizio_annuo || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Email</label><input class="inp" id="eo-email" value="' + esc(off.email_studio || '') + '" style="font-size:.88rem;padding:9px 12px" /></div>';
  bh += '<div class="form-field" style="grid-column:1/-1"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Note</label><textarea class="inp" id="eo-note" rows="2" style="font-size:.88rem;padding:9px 12px">' + esc(off.note || '') + '</textarea></div>';
  bh += '</div>';
  body.innerHTML = bh;

  var footer = document.createElement("div");
  footer.className = "modal-footer";
  var btnCancel = document.createElement("button");
  btnCancel.className = "btn btn-sec";
  btnCancel.textContent = "Annulla";
  btnCancel.addEventListener("click", closeModal);
  var btnSave = document.createElement("button");
  btnSave.className = "btn btn-primary";
  btnSave.textContent = "Salva Modifiche";
  btnSave.addEventListener("click", function() {
    var payload = {
      nome_studio: document.getElementById("eo-studio").value,
      agente_id: document.getElementById("eo-agente").value ? parseInt(document.getElementById("eo-agente").value) : null,
      nome_condominio: document.getElementById("eo-cond").value,
      via: document.getElementById("eo-via").value,
      citta: document.getElementById("eo-citta").value,
      macro_categoria: document.getElementById("eo-macro").value || null,
      sottotipo: document.getElementById("eo-sottotipo").value || null,
      natura: document.getElementById("eo-natura").value,
      stato: document.getElementById("eo-stato").value,
      valore_commessa: parseFloat(document.getElementById("eo-valore").value) || null,
      importo: parseFloat(document.getElementById("eo-valore").value) || null,
      importo_servizio_annuo: parseFloat(document.getElementById("eo-annuo").value) || null,
      email_studio: document.getElementById("eo-email").value || null,
      note: document.getElementById("eo-note").value || null
    };
    api("PUT", "/api/offerte/" + off.id, payload).then(function() {
      closeModal();
      toast("Offerta aggiornata", "ok");
      renderDashboard(cont);
    }).catch(function(e) {
      toast("Errore: " + e.message, "error");
    });
  });
  footer.appendChild(btnCancel);
  footer.appendChild(btnSave);
  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  icons();
}


/* ─── Nuova Offerta Modal (v3 — styled + complete) ─── */

var _noAcClienti = [];
var _noTipo = "";
var _noMacro = "";

function showNuovaOffertaModal(cont) {
  closeModal();
  _noTipo = "";
  _noMacro = "";

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.id = "modal-overlay";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) closeModal(); });

  var modal = document.createElement("div");
  modal.className = "modal";
  modal.style.width = "800px";
  modal.style.maxHeight = "92vh";
  modal.style.overflowY = "auto";
  modal.style.borderRadius = "14px";

  var header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = '<h2>Nuova Offerta</h2><button class="btn btn-ghost btn-sm" id="no-close-x"><i data-lucide="x" style="width:18px;height:18px"></i></button>';

  var body = document.createElement("div");
  body.className = "modal-body";
  body.id = "no-body";

  var agOpts = '<option value="">-- Seleziona agente --</option>';
  agenti.forEach(function(a) {
    agOpts += '<option value="' + a.id + '">' + esc(a.nome + " " + a.cognome) + "</option>";
  });

  var sottotipiDef = [
    { val: "CK", label: "CK", desc: "Sostituzione Ripartitori", macro: "installazione", icon: "heater", color: "#009FE3", bg: "#E6F5FC" },
    { val: "CL", label: "CL", desc: "Commesse Lavori", macro: "installazione", icon: "wrench", color: "#EF9F27", bg: "#FFF3E0" },
    { val: "RK", label: "RK", desc: "Lettura Ripartitori", macro: "servizi", icon: "radio", color: "#639922", bg: "#EAF3DE" },
    { val: "RD", label: "RD", desc: "Lettura Diretta", macro: "servizi", icon: "radio", color: "#173404", bg: "#C0DD97" },
    { val: "MANSIS", label: "MANSIS", desc: "Manutenzione Sistemi", macro: "servizi", icon: "settings", color: "#854F0B", bg: "#FAEEDA" },
    { val: "MANCT", label: "MANCT", desc: "Manutenzione CT", macro: "servizi", icon: "settings", color: "#3C3489", bg: "#EEEDFE" },
    { val: "MAN-DOMO", label: "MAN-DOMO", desc: "Domotica", macro: "servizi", icon: "home", color: "#412402", bg: "#FAC775" },
    { val: "cc_modus", label: "CC-Modus", desc: "Contabilizzazione", macro: "cc_modus", icon: "layers", color: "#854F0B", bg: "#FAEEDA" },
    { val: "cu_unitron", label: "CU-Unitron", desc: "Telegestione", macro: "cu_unitron", icon: "wifi", color: "#3C3489", bg: "#EEEDFE" },
    { val: "MISURATORI", label: "Fornitura", desc: "Misuratori", macro: "fornitura", icon: "package", color: "#993C1D", bg: "#FAECE7" },
    { val: "RICAMBI", label: "Ricambi", desc: "Ricambi", macro: "fornitura", icon: "package", color: "#4A1B0C", bg: "#F5C4B3" },
    { val: "CM", label: "CM", desc: "Intervento", macro: "interventi", icon: "tool", color: "#5F5E5A", bg: "#F1EFE8" },
    { val: "_altro", label: "Altro", desc: "Campo libero", macro: "", icon: "edit", color: "#5F5E5A", bg: "#F1EFE8" }
  ];

  var bh = "";

  /* ── SEZIONE 1: Cliente ── */
  bh += '<div style="border-left:3px solid var(--blue);padding-left:16px;margin-bottom:20px">';
  bh += '<div style="font-size:.95rem;font-weight:800;margin-bottom:10px;color:var(--text)"><i data-lucide="user" style="width:16px;height:16px;vertical-align:-3px;color:var(--blue)"></i> Cliente / Amministratore</div>';
  bh += '<div style="position:relative"><input class="inp" id="no-studio" placeholder="Digita per cercare in anagrafica..." style="width:100%;font-size:.9rem;padding:10px 14px" />';
  bh += '<div id="no-ac-drop" style="position:absolute;top:100%;left:0;right:0;display:none" class="ac-drop"></div></div>';
  bh += '<label style="font-size:.82rem;display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer"><input type="checkbox" id="no-save-cli" checked /> Salva in anagrafica clienti</label>';
  bh += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
  bh += '<input class="inp" id="no-cli-via" placeholder="Via cliente" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<input class="inp" id="no-cli-citta" placeholder="Citta cliente" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<input class="inp" id="no-cli-email" placeholder="Email" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<input class="inp" id="no-cli-tel" placeholder="Telefono" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<select class="inp" id="no-cli-tipo" style="font-size:.85rem;padding:8px 12px"><option value="Amministratore">Amministratore</option><option value="Gestore">Gestore</option><option value="Costruttore">Costruttore</option><option value="Progettista">Progettista</option><option value="Condomino">Condomino</option><option value="Rivenditore">Rivenditore</option></select>';
  bh += '<input class="inp" id="no-cli-referente" placeholder="Referente" style="font-size:.85rem;padding:8px 12px" />';
  bh += "</div></div>";

  /* ── SEZIONE 2: Riferimento ── */
  bh += '<div style="border-left:3px solid #639922;padding-left:16px;margin-bottom:20px">';
  bh += '<div style="font-size:.95rem;font-weight:800;margin-bottom:10px;color:var(--text)"><i data-lucide="building-2" style="width:16px;height:16px;vertical-align:-3px;color:#639922"></i> Riferimento / Condominio</div>';
  bh += '<label style="font-size:.85rem;display:flex;align-items:center;gap:6px;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="no-crea-oggetto" checked /> Crea come oggetto/stabile (con foglio costi)</label>';
  bh += '<div style="display:grid;grid-template-columns:1fr auto;gap:10px">';
  bh += '<input class="inp" id="no-rif-nome" placeholder="Nome (es. Cond. Aurora, Palestra X...)" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<select class="inp" id="no-rif-tipo" style="width:150px;font-size:.85rem;padding:8px 12px"><option value="condominio">Condominio</option><option value="ente_pubblico">Ente Pubblico</option><option value="commerciale">Commerciale</option><option value="altro">Altro</option></select>';
  bh += "</div>";
  bh += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:8px">';
  bh += '<input class="inp" id="no-rif-via" placeholder="Via" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<input class="inp" id="no-rif-civico" placeholder="Civico" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<input class="inp" id="no-rif-comune" placeholder="Comune" style="font-size:.85rem;padding:8px 12px" />';
  bh += "</div>";
  bh += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">';
  bh += '<input class="inp" type="number" id="no-n-unita" placeholder="N. unita abitative" style="font-size:.85rem;padding:8px 12px" />';
  bh += '<input class="inp" id="no-rif-prov" placeholder="Provincia" style="font-size:.85rem;padding:8px 12px" />';
  bh += "</div></div>";

  /* ── SEZIONE 3: Tipologia ── */
  bh += '<div style="border-left:3px solid #EF9F27;padding-left:16px;margin-bottom:20px">';
  bh += '<div style="font-size:.95rem;font-weight:800;margin-bottom:10px;color:var(--text)"><i data-lucide="layers" style="width:16px;height:16px;vertical-align:-3px;color:#EF9F27"></i> Tipologia Offerta</div>';
  bh += '<div style="display:flex;flex-wrap:wrap;gap:8px" id="no-tipo-pills">';
  sottotipiDef.forEach(function(st) {
    bh += '<button data-no-tipo="' + st.val + '" style="display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;border:2px solid ' + st.bg + ';background:' + st.bg + ';color:' + st.color + ';font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;min-width:110px">';
    bh += '<i data-lucide="' + st.icon + '" style="width:16px;height:16px"></i>';
    bh += '<span>' + st.label + '</span>';
    bh += "</button>";
  });
  bh += "</div>";
  bh += '<div id="no-tipo-altro" style="display:none;margin-top:10px"><input class="inp" id="no-tipo-custom" placeholder="Tipo personalizzato..." style="font-size:.85rem;padding:8px 12px" /></div>';
  bh += "</div>";

  /* ── SEZIONE 4: Dettagli (dinamica per CK/CL) ── */
  bh += '<div id="no-dettagli" style="border-left:3px solid #854F0B;padding-left:14px;margin-bottom:16px;display:none"></div>';

  /* ── SEZIONE 5: Agente + Natura + Stato ── */
  bh += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Agente *</label><select class="inp" id="no-agente" style="font-size:.85rem;padding:8px 12px">' + agOpts + "</select></div>";
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Natura</label><select class="inp" id="no-natura" style="font-size:.85rem;padding:8px 12px"><option value="nuovo">Nuovo</option><option value="rinnovo">Rinnovo</option><option value="subentro_diretto">Subentro Diretto</option><option value="subentro_intermediario">Subentro Intermediario</option></select></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Stato</label><select class="inp" id="no-stato" style="font-size:.85rem;padding:8px 12px"><option value="richiamato">Richiamato</option><option value="in_attesa_assemblea">In Attesa Assemblea</option><option value="preso_lavoro">Preso Lavoro</option><option value="perso">Perso</option><option value="rimandato">Rimandato</option></select></div>';
  bh += "</div>";

  /* ── SEZIONE 6: Valore + Canone + Note ── */
  bh += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Valore Commessa &euro;</label><input class="inp" type="number" step="0.01" id="no-valore" style="font-size:.9rem;padding:10px 12px" /></div>';
  bh += '<div class="form-field"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Canone Annuo &euro;/anno</label><input class="inp" type="number" step="0.01" id="no-annuo" style="font-size:.9rem;padding:10px 12px" /></div>';
  bh += "</div>";
  bh += '<div class="form-field" style="margin-bottom:14px"><label style="font-size:.82rem;font-weight:700;color:var(--mid)">Note</label><textarea class="inp" id="no-note" rows="2" style="font-size:.85rem;padding:8px 12px"></textarea></div>';

  /* ── Gara ── */
  bh += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:8px 12px;background:var(--bg);border-radius:8px">';
  bh += '<label style="font-size:.78rem;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="no-gara" /> Gara appalto</label>';
  bh += '<input class="inp" id="no-gara-id" placeholder="ID Gara" style="width:140px;font-size:.78rem;display:none" />';
  bh += '<input class="inp" type="number" step="0.01" id="no-gara-val" placeholder="Valore gara" style="width:120px;font-size:.78rem;display:none" />';
  bh += "</div>";

  /* ── Riepilogo live ── */
  bh += '<div id="no-riepilogo" style="background:var(--bg);border-radius:8px;padding:12px;font-size:.82rem;display:none"></div>';

  body.innerHTML = bh;

  var footer = document.createElement("div");
  footer.className = "modal-footer";
  var btnCancel = document.createElement("button");
  btnCancel.className = "btn btn-sec";
  btnCancel.textContent = "Annulla";
  btnCancel.addEventListener("click", closeModal);
  var btnSave = document.createElement("button");
  btnSave.className = "btn btn-primary";
  btnSave.textContent = "Crea Offerta";
  btnSave.id = "no-save-btn";

  footer.appendChild(btnCancel);
  footer.appendChild(btnSave);
  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  icons();

  /* ── Events ── */
  /* uses global _noTipo, _noMacro */

  /* Close X button */
  var closeX = document.getElementById("no-close-x");
  if (closeX) closeX.addEventListener("click", closeModal);

  /* Client autocomplete */
  var studioInp = document.getElementById("no-studio");
  var acDrop = document.getElementById("no-ac-drop");
  var acTimer = null;
  studioInp.addEventListener("input", function() {
    clearTimeout(acTimer);
    var q = this.value;
    if (q.length < 2) { acDrop.style.display = "none"; return; }
    acTimer = setTimeout(function() {
      api("GET", "/api/clienti/search?q=" + encodeURIComponent(q)).then(function(res) {
        var data = res.data || res || [];
        if (!data.length) { acDrop.style.display = "none"; return; }
        _noAcClienti = data;
        var html = "";
        data.forEach(function(c, i) {
          html += '<div class="ac-item" data-no-ac="' + i + '">' + esc(c.nome_studio) + (c.citta ? " \u2014 " + esc(c.citta) : "") + "</div>";
        });
        acDrop.innerHTML = html;
        acDrop.style.display = "block";
        acDrop.querySelectorAll(".ac-item").forEach(function(el) {
          el.addEventListener("click", function() {
            var c = _noAcClienti[parseInt(this.getAttribute("data-no-ac"))];
            if (!c) return;
            studioInp.value = c.nome_studio || "";
            var cliVia = document.getElementById("no-cli-via");
            var cliCitta = document.getElementById("no-cli-citta");
            var cliEmail = document.getElementById("no-cli-email");
            var cliTel = document.getElementById("no-cli-tel");
            if (cliVia) cliVia.value = c.via || "";
            if (cliCitta) cliCitta.value = c.citta || "";
            if (cliEmail) cliEmail.value = c.email || "";
            if (cliTel) cliTel.value = c.telefono || "";
            acDrop.style.display = "none";
          });
        });
      });
    }, 300);
  });
  studioInp.addEventListener("blur", function() { setTimeout(function() { acDrop.style.display = "none"; }, 200); });

  /* Tipologia pills */
  document.querySelectorAll("[data-no-tipo]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      /* Reset all pills to default style */
      document.querySelectorAll("[data-no-tipo]").forEach(function(b) {
        var bVal = b.getAttribute("data-no-tipo");
        var bSt = sottotipiDef.find(function(s) { return s.val === bVal; });
        if (bSt) {
          b.style.background = bSt.bg;
          b.style.color = bSt.color;
          b.style.borderColor = bSt.bg;
          b.style.transform = "scale(1)";
          b.style.boxShadow = "none";
        }
      });
      /* Highlight selected */
      var val = this.getAttribute("data-no-tipo");
      var st = sottotipiDef.find(function(s) { return s.val === val; });
      if (st) {
        this.style.background = st.color;
        this.style.color = "#fff";
        this.style.borderColor = st.color;
        this.style.transform = "scale(1.04)";
        this.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
      }
      _noTipo = val;
      _noMacro = st ? st.macro : "";

      var altroDiv = document.getElementById("no-tipo-altro");
      if (val === "_altro") { altroDiv.style.display = "block"; }
      else { altroDiv.style.display = "none"; }

      /* Show dettagli section for CK */
      var detDiv = document.getElementById("no-dettagli");
      if (val === "CK") {
        detDiv.style.display = "block";
        detDiv.innerHTML = '<div style="font-size:.95rem;font-weight:800;margin-bottom:10px"><i data-lucide="heater" style="width:16px;height:16px;vertical-align:-3px;color:#009FE3"></i> Dettagli CK — Ripartitori</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)"><i data-lucide="heater" style="width:12px;height:12px;color:#EF9F27;vertical-align:-2px"></i> N. Ripartitori</label><input class="inp" type="number" id="no-ck-nrip" style="font-size:.9rem;padding:8px 12px" /></div>' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)">Prezzo Rip. &euro;/cad</label><input class="inp" type="number" step="0.01" id="no-ck-prip" style="font-size:.9rem;padding:8px 12px" /></div>' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)">Modello Rip.</label><select class="inp" id="no-ck-mod" style="font-size:.85rem;padding:8px 12px"><option>E-ITN40</option><option>Q5.5</option></select></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)"><i data-lucide="radio" style="width:12px;height:12px;color:#639922;vertical-align:-2px"></i> Canone Lettura &euro;/app/anno</label><input class="inp" type="number" step="0.01" id="no-ck-lett" style="font-size:.9rem;padding:8px 12px" /></div>' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)"><i data-lucide="shield" style="width:12px;height:12px;color:#22c55e;vertical-align:-2px"></i> Ulteria Care &euro;/app/anno</label><input class="inp" type="number" step="0.01" id="no-ck-care" style="font-size:.9rem;padding:8px 12px" /></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)"><i data-lucide="wifi" style="width:12px;height:12px;color:#534AB7;vertical-align:-2px"></i> Centralizzazione</label><select class="inp" id="no-ck-centr" style="font-size:.85rem;padding:8px 12px"><option value="comodato">Comodato</option><option value="vendita">Vendita</option></select></div>' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)"><i data-lucide="droplets" style="width:12px;height:12px;color:#ef4444;vertical-align:-2px"></i> N. Contatori Acqua</label><input class="inp" type="number" id="no-ck-nacq" placeholder="0 se assenti" style="font-size:.85rem;padding:8px 12px" /></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)">Prezzo Cont. Acqua &euro;/cad</label><input class="inp" type="number" step="0.01" id="no-ck-pacq" style="font-size:.85rem;padding:8px 12px" /></div>' +
          '<div class="form-field"><label style="font-size:.78rem;font-weight:700;color:var(--mid)">Modello Cont. Acqua</label><select class="inp" id="no-ck-macq" style="font-size:.85rem;padding:8px 12px"><option>SMART-WB</option><option>CSU-R</option></select></div>' +
          '</div>' +
          '<div id="no-ck-riepilogo" style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;margin-top:8px;font-size:.78rem"></div>';
        icons();
        /* Live calc */
        function calcCK() {
          var nRip = parseInt(document.getElementById("no-ck-nrip").value) || 0;
          var pRip = parseFloat(document.getElementById("no-ck-prip").value) || 0;
          var lett = parseFloat(document.getElementById("no-ck-lett").value) || 0;
          var care = parseFloat(document.getElementById("no-ck-care").value) || 0;
          var nAcq = parseInt(document.getElementById("no-ck-nacq").value) || 0;
          var pAcq = parseFloat((document.getElementById("no-ck-pacq") || {}).value) || 0;
          var totForn = nRip * pRip + nAcq * pAcq;
          var totAnnuo = (nRip + nAcq) * lett + (nRip + nAcq) * care;
          var rh = '<div style="background:#fff;padding:10px 14px;border-radius:8px;border:1px solid var(--border)">';
          rh += '<strong style="font-size:.88rem">Riepilogo Materiali:</strong><br>';
          rh += '<div style="display:flex;gap:16px;margin-top:6px;font-size:.85rem">';
          rh += '<div><i data-lucide="heater" style="width:12px;height:12px;color:#EF9F27;vertical-align:-2px"></i> <strong>' + nRip + '</strong> rip. x ' + fmtEurDash(pRip) + ' = <strong>' + fmtEurDash(nRip * pRip) + '</strong></div>';
          if (nAcq > 0) rh += '<div><i data-lucide="droplets" style="width:12px;height:12px;color:#ef4444;vertical-align:-2px"></i> <strong>' + nAcq + '</strong> cont. acqua x ' + fmtEurDash(pAcq) + ' = <strong>' + fmtEurDash(nAcq * pAcq) + '</strong></div>';
          rh += '</div>';
          rh += '<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;gap:20px;font-size:.88rem">';
          rh += '<div>Totale fornitura: <strong style="color:#009FE3">' + fmtEurDash(totForn) + '</strong></div>';
          rh += '<div>Canone annuo: <strong style="color:#639922">' + fmtEurDash(totAnnuo) + '/anno</strong></div>';
          rh += '</div></div>';
          document.getElementById("no-ck-riepilogo").innerHTML = rh;
          icons();
          document.getElementById("no-valore").value = totForn || "";
          document.getElementById("no-annuo").value = totAnnuo || "";
        }
        ["no-ck-nrip", "no-ck-prip", "no-ck-lett", "no-ck-care", "no-ck-nacq", "no-ck-pacq"].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.addEventListener("input", calcCK);
        });
      } else if (val === "CL") {
        detDiv.style.display = "block";
        detDiv.innerHTML = '<div style="font-size:.85rem;font-weight:700;margin-bottom:8px"><i data-lucide="wrench" style="width:14px;height:14px;vertical-align:-2px;color:#EF9F27"></i> Dettagli CL</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div class="form-field"><label style="font-size:.7rem;font-weight:700;color:var(--mid)">N. Contatori Calore</label><input class="inp" type="number" id="no-cl-ncc" /></div>' +
          '<div class="form-field"><label style="font-size:.7rem;font-weight:700;color:var(--mid)">N. Contatori Acqua</label><input class="inp" type="number" id="no-cl-nca" /></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">' +
          '<div class="form-field"><label style="font-size:.7rem;font-weight:700;color:var(--mid)">Canone Lettura &euro;/utenza/anno</label><input class="inp" type="number" step="0.01" id="no-cl-lett" /></div>' +
          '<div class="form-field"><label style="font-size:.7rem;font-weight:700;color:var(--mid)">Centralizzazione</label><select class="inp" id="no-cl-centr"><option value="comodato">Comodato</option><option value="vendita">Vendita</option></select></div>' +
          '</div>';
        icons();
      } else {
        detDiv.style.display = "none";
      }
      updateNoRiepilogo();
    });
  });

  /* Gara toggle */
  document.getElementById("no-gara").addEventListener("change", function() {
    document.getElementById("no-gara-id").style.display = this.checked ? "block" : "none";
    document.getElementById("no-gara-val").style.display = this.checked ? "block" : "none";
  });

  /* Live riepilogo */
  function updateNoRiepilogo() {
    var rDiv = document.getElementById("no-riepilogo");
    var studio = studioInp.value;
    var rif = document.getElementById("no-rif-nome").value || document.getElementById("no-rif-via").value;
    if (!studio && !rif) { rDiv.style.display = "none"; return; }
    rDiv.style.display = "block";
    var html = "<strong>Riepilogo:</strong> " + esc(studio);
    if (rif) html += " \u2014 " + esc(rif);
    if (_noTipo && _noTipo !== "_altro") html += " | <span class='badge' style='font-size:.7rem'>" + _noTipo + "</span>";
    rDiv.innerHTML = html;
  }
  studioInp.addEventListener("input", updateNoRiepilogo);
  document.getElementById("no-rif-nome").addEventListener("input", updateNoRiepilogo);

  /* Save */
  btnSave.addEventListener("click", function() {
    var studio = studioInp.value.trim();
    if (!studio) { alert("Studio / Cliente obbligatorio"); return; }

    var tipo = _noTipo === "_altro" ? (document.getElementById("no-tipo-custom").value || "altro") : _noTipo;
    var macro = _noMacro;
    if (tipo === "_altro" || !macro) macro = "";

    var payload = {
      nome_studio: studio,
      nome_condominio: document.getElementById("no-rif-nome").value,
      via: document.getElementById("no-rif-via").value,
      citta: document.getElementById("no-rif-comune").value,
      cap: document.getElementById("no-rif-prov").value,
      agente_id: document.getElementById("no-agente").value ? parseInt(document.getElementById("no-agente").value) : null,
      macro_categoria: macro || null,
      sottotipo: tipo || null,
      natura: document.getElementById("no-natura").value,
      stato: document.getElementById("no-stato").value,
      valore_commessa: parseFloat(document.getElementById("no-valore").value) || null,
      importo: parseFloat(document.getElementById("no-valore").value) || null,
      importo_servizio_annuo: parseFloat(document.getElementById("no-annuo").value) || null,
      email_studio: document.getElementById("no-cli-email").value || null,
      note: document.getElementById("no-note").value || null,
      is_gara_appalto: document.getElementById("no-gara").checked ? 1 : 0,
      gara_id: document.getElementById("no-gara-id").value || null,
      valore_gara: parseFloat(document.getElementById("no-gara-val").value) || null,
      stato_versione: "attiva",
      versione: "A"
    };

    /* Step 1: Save client first (wait for response) */
    var saveCli = document.getElementById("no-save-cli").checked;
    var creaOggetto = document.getElementById("no-crea-oggetto").checked;
    var rifVia = document.getElementById("no-rif-via").value;
    var rifComune = document.getElementById("no-rif-comune").value;

    var clientePromise;
    if (saveCli && studio) {
      clientePromise = api("POST", "/api/clienti", {
        nome_studio: studio,
        via: document.getElementById("no-cli-via").value,
        citta: document.getElementById("no-cli-citta").value,
        email: document.getElementById("no-cli-email").value,
        telefono: document.getElementById("no-cli-tel").value,
        tipo_cliente: document.getElementById("no-cli-tipo").value,
        referente: document.getElementById("no-cli-referente").value
      });
    } else {
      clientePromise = Promise.resolve(null);
    }

    clientePromise.then(function(cliRes) {
      var clienteId = null;
      if (cliRes && cliRes.id) clienteId = cliRes.id;
      else if (cliRes && cliRes.data && cliRes.data.id) clienteId = cliRes.data.id;

      /* Step 2: Create oggetto if needed */
      if (creaOggetto && rifVia && rifComune) {
        return api("POST", "/api/oggetti", {
          cliente_id: clienteId,
          nome: document.getElementById("no-rif-nome").value,
          via: rifVia,
          civico: document.getElementById("no-rif-civico").value,
          comune: rifComune,
          provincia: document.getElementById("no-rif-prov").value,
          tipo_oggetto: document.getElementById("no-rif-tipo").value,
          n_unita: parseInt(document.getElementById("no-n-unita").value) || null,
          agente_id: payload.agente_id
        }).then(function(objRes) {
          if (objRes && objRes.ok && objRes.data) payload.oggetto_id = objRes.data.id;
          return { clienteId: clienteId };
        });
      }
      return { clienteId: clienteId };
    }).then(function() {
      /* Step 3: Create offerta */
      return api("POST", "/api/offerte", payload);
    }).then(function() {
      closeModal();
      toast("Offerta creata", "ok");
      renderDashboard(cont);
    }).catch(function(e) {
      toast("Errore: " + (e.message || "sconosciuto"), "error");
    });
  });
}


/* ─── Actions ─── */

function doGenera(id, cont) {
  api("POST", "/api/genera", { id: id }).then(function(res) {
    if (res.ok) {
      toast("Offerta N. " + res.numero + " generata!", "ok");
      var btns = [{ label: "Chiudi", cls: "btn btn-sec", fn: closeModal }];
      if (res.docx_url) btns.push({ label: "DOCX", cls: "btn btn-primary", fn: function() { window.open(res.docx_url, "_blank"); } });
      if (res.pdf_url) btns.push({ label: "PDF", cls: "btn btn-pdf", fn: function() { window.open(res.pdf_url, "_blank"); } });
      showModal("Generazione Completata", "Offerta N. " + res.numero + " generata" + (res.pdf_error ? " (PDF non disponibile)" : ""), btns);
      renderDashboard(cont || document.getElementById("content"));
    } else {
      toast(res.error || "Errore generazione", "error");
    }
  });
}

function doMail(id) {
  var off = offerte.find(function(o) { return o.id === id; });
  if (!off) return;
  var subj = encodeURIComponent("Proposta N. " + (off.numero || "") + " - Ulteria S.r.l.");
  var body = encodeURIComponent("Gentilissimi,\n\nin allegato la nostra proposta N. " + (off.numero || "") + ".\n\nCordiali saluti,\nUlteria S.r.l.");
  window.location.href = "mailto:" + (off.email_studio || "") + "?subject=" + subj + "&body=" + body;
}

function esportaCsv(list) {
  if (!list) list = offerte;
  var lines = ["Numero;Data;Cliente;Condominio;Template;Agente;Importo;Stato"];
  list.forEach(function(o) {
    var a = getAgente(o.agente_id);
    var an = a ? (a.nome + " " + a.cognome) : "";
    var imp = (o.prezzo_fornitura || 0) + (o.prezzo_care || 0) + (o.canone_lettura || 0);
    lines.push([o.numero, o.data_creazione, o.nome_studio, o.nome_condominio, o.template, an, imp, o.stato].map(function(v) {
      return '"' + String(v || "").replace(/"/g, '""') + '"';
    }).join(";"));
  });
  var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "offerte_ulteria.csv";
  a.click();
  toast("CSV esportato", "info");
}

/* ─── Toast notifications ─── */

function toast(msg, type) {
  var container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:flex-end";
    document.body.appendChild(container);
  }
  var colors = { ok: "#639922", error: "#ef4444", info: "#009FE3" };
  var t = document.createElement("div");
  t.style.cssText = "padding:10px 16px;border-radius:8px;font-size:.82rem;font-weight:600;color:#fff;background:" + (colors[type] || colors.info) + ";box-shadow:0 4px 12px rgba(0,0,0,.15);transform:translateX(100%);transition:transform .3s;max-width:320px;font-family:inherit";
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(function() { t.style.transform = "translateX(0)"; });

  // Max 3 toasts
  while (container.children.length > 3) container.removeChild(container.firstChild);

  setTimeout(function() {
    t.style.transform = "translateX(100%)";
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
  }, 3000);
}


/* ═══════════════════════════════════════════════════════════
   MODAL (safe — no inline onclick)
   ═══════════════════════════════════════════════════════════ */

function showModal(title, body, buttons) {
  closeModal();
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.id = "modal-overlay";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) closeModal(); });

  var modal = document.createElement("div");
  modal.className = "modal";

  var header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = "<h2>" + title + "</h2>";

  var bodyDiv = document.createElement("div");
  bodyDiv.className = "modal-body";
  bodyDiv.innerHTML = "<p>" + body + "</p>";

  var footer = document.createElement("div");
  footer.className = "modal-footer";
  buttons.forEach(function(b) {
    var btn = document.createElement("button");
    btn.className = b.cls;
    btn.textContent = b.label;
    btn.addEventListener("click", b.fn);
    footer.appendChild(btn);
  });

  modal.appendChild(header);
  modal.appendChild(bodyDiv);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function closeModal() {
  var el = document.getElementById("modal-overlay");
  if (el) el.remove();
}


/* ═══════════════════════════════════════════════════════════
   WIZARD — NUOVA OFFERTA
   ═══════════════════════════════════════════════════════════ */

var _agentiLoaded = false;

function renderNuova(c) {
  if (!_agentiLoaded) {
    c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
    api("GET", "/api/agenti").then(function(d) {
      agenti = d;
      _agentiLoaded = true;
      renderNuova(c);
    });
    return;
  }

  var h = '<div class="wiz-wrap">';
  h += '<div class="kicker">Nuova Offerta</div>';
  h += '<div class="page-title mb20">Crea Offerta Accordo Quadro</div>';

  h += '<div class="wiz-steps mb24">';
  h += '<div class="wiz-step ' + (wizardStep === 1 ? "active" : (wizardStep > 1 ? "done" : "")) + '">1. Template</div>';
  h += '<div class="wiz-step ' + (wizardStep === 2 ? "active" : (wizardStep > 2 ? "done" : "")) + '">2. Dati Studio</div>';
  h += '<div class="wiz-step ' + (wizardStep === 3 ? "active" : "") + '">3. Economici</div>';
  h += "</div>";

  if (wizardStep === 1) h += wizStep1Html();
  else if (wizardStep === 2) h += wizStep2Html();
  else if (wizardStep === 3) h += wizStep3Html();

  h += '<div id="wiz-result"></div>';
  h += "</div>";
  c.innerHTML = h;
  icons();

  /* Attach events */
  if (wizardStep === 1) {
    document.getElementById("tmpl-e40").addEventListener("click", function() { wizardData.template = "E40"; wizardStep = 2; renderNuova(c); });
    document.getElementById("tmpl-q55").addEventListener("click", function() { wizardData.template = "Q55"; wizardStep = 2; renderNuova(c); });
  }
  if (wizardStep === 2) attachWizStep2(c);
  if (wizardStep === 3) attachWizStep3(c);
}

function wizStep1Html() {
  var h = '<div class="tmpl-cards">';
  h += '<div class="tmpl-card ' + (wizardData.template === "E40" ? "selected" : "") + '" id="tmpl-e40">';
  h += '<div class="tmpl-card-icon"><i data-lucide="heater" style="width:36px;height:36px;color:var(--blue)"></i></div>';
  h += '<div class="tmpl-card-title">E-ITN40</div>';
  h += '<div class="tmpl-card-sub">Ripartitori E-ITN40</div></div>';
  h += '<div class="tmpl-card ' + (wizardData.template === "Q55" ? "selected" : "") + '" id="tmpl-q55">';
  h += '<div class="tmpl-card-icon"><i data-lucide="gauge" style="width:36px;height:36px;color:var(--blue)"></i></div>';
  h += '<div class="tmpl-card-title">Q5.5</div>';
  h += '<div class="tmpl-card-sub">Ripartitori Q5.5</div></div>';
  h += "</div>";
  return h;
}

function wizStep2Html() {
  var h = "";

  /* ── BOX CLIENTE ── */
  h += '<div class="card mb16">';
  h += '<div class="wiz-section-title"><i data-lucide="user" style="width:14px;height:14px;vertical-align:-2px"></i> Cliente / Amministratore</div>';
  h += '<div class="wiz-field" style="position:relative"><div class="wiz-label">Nome Studio *</div>';
  h += '<input class="wiz-input" id="wiz-studio" value="' + esc(wizardData.nome_studio) + '" placeholder="Digita per cercare in anagrafica..." />';
  h += '<div class="ac-list" id="wiz-ac"></div></div>';
  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Via</div><input class="wiz-input" id="wiz-via" value="' + esc(wizardData.via) + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">CAP</div><input class="wiz-input" id="wiz-cap" value="' + esc(wizardData.cap) + '" /></div>';
  h += "</div>";
  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Citta *</div><input class="wiz-input" id="wiz-citta" value="' + esc(wizardData.citta) + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">Email</div><input class="wiz-input" id="wiz-email" value="' + esc(wizardData.email_studio) + '" /></div>';
  h += "</div>";
  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Telefono</div><input class="wiz-input" id="wiz-telefono" value="' + esc(wizardData.telefono || "") + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">Referente</div><input class="wiz-input" id="wiz-referente" value="' + esc(wizardData.referente || "") + '" /></div>';
  h += "</div>";
  h += '<label style="font-size:.8rem;display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer">';
  h += '<input type="checkbox" id="wiz-save-client" ' + (wizardData.salva_cliente ? "checked" : "") + " /> Salva in Anagrafica Clienti</label>";
  h += "</div>";

  /* ── BOX CONDOMINIO/OGGETTO ── */
  h += '<div class="card mb16">';
  h += '<div class="wiz-section-title"><i data-lucide="building" style="width:14px;height:14px;vertical-align:-2px"></i> Oggetto / Condominio</div>';
  h += '<div class="wiz-field"><div class="wiz-label">Nome Condominio</div><input class="wiz-input" id="wiz-cond" value="' + esc(wizardData.nome_condominio) + '" placeholder="Es. Condominio Aurora" /></div>';
  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Via *</div><input class="wiz-input" id="wiz-cond-via" value="' + esc(wizardData.cond_via || "") + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">Comune *</div><input class="wiz-input" id="wiz-cond-citta" value="' + esc(wizardData.cond_citta || "") + '" /></div>';
  h += "</div>";
  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Natura trattativa *</div><select class="wiz-input" id="wiz-natura">';
  h += '<option value="nuovo"' + (wizardData.natura === "nuovo" ? " selected" : "") + ">Nuovo</option>";
  h += '<option value="rinnovo"' + (wizardData.natura === "rinnovo" ? " selected" : "") + ">Rinnovo</option>";
  h += '<option value="subentro_diretto"' + (wizardData.natura === "subentro_diretto" ? " selected" : "") + ">Subentro Diretto</option>";
  h += '<option value="subentro_intermediario"' + (wizardData.natura === "subentro_intermediario" ? " selected" : "") + ">Subentro Intermediario</option>";
  h += "</select></div>";
  h += '<div class="wiz-field"><div class="wiz-label">Tipo offerta *</div><select class="wiz-input" id="wiz-tipo-offerta">';
  h += '<option value="installazione"' + (wizardData.tipo_offerta === "installazione" ? " selected" : "") + ">Installazione</option>";
  h += '<option value="fornitura"' + (wizardData.tipo_offerta === "fornitura" ? " selected" : "") + ">Fornitura</option>";
  h += '<option value="servizio"' + (wizardData.tipo_offerta === "servizio" ? " selected" : "") + ">Servizio</option>";
  h += "</select></div></div>";
  h += "</div>";

  /* ── AGENTE ── */
  h += '<div class="card mb16">';
  h += '<div class="wiz-section-title"><i data-lucide="briefcase" style="width:14px;height:14px;vertical-align:-2px"></i> Agente</div>';
  h += '<div class="wiz-field"><div class="wiz-label">Agente *</div><select class="wiz-input" id="wiz-agente"><option value="">-- Seleziona agente --</option>';
  agenti.forEach(function(a) {
    h += '<option value="' + a.id + '"' + (wizardData.agente_id == a.id ? " selected" : "") + ">" + esc(a.nome + " " + a.cognome) + "</option>";
  });
  h += "</select></div>";
  h += "</div>";

  h += '<div class="fjb mt16">';
  h += '<button class="btn btn-sec" id="wiz-back2"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> Indietro</button>';
  h += '<button class="btn btn-primary" id="wiz-next3">Avanti <i data-lucide="arrow-right" style="width:14px;height:14px"></i></button>';
  h += "</div>";
  return h;
}

function attachWizStep2(c) {
  var acData = [];
  document.getElementById("wiz-studio").addEventListener("input", function() {
    var q = this.value;
    if (q.length < 2) { document.getElementById("wiz-ac").innerHTML = ""; return; }
    api("GET", "/api/clienti?q=" + encodeURIComponent(q)).then(function(data) {
      acData = data;
      var list = document.getElementById("wiz-ac");
      if (!list || !data.length) { if (list) list.innerHTML = ""; return; }
      var html = "";
      data.forEach(function(cl, idx) {
        html += '<div class="ac-item" data-ac="' + idx + '">';
        html += "<div><strong>" + esc(cl.nome_studio) + "</strong></div>";
        html += '<div class="ac-item-sub">' + esc((cl.via || "") + (cl.citta ? ", " + cl.citta : "")) + "</div>";
        html += "</div>";
      });
      list.innerHTML = html;
      list.querySelectorAll(".ac-item").forEach(function(el) {
        el.addEventListener("click", function() {
          var cl = acData[parseInt(this.getAttribute("data-ac"))];
          if (!cl) return;
          /* Compila automaticamente TUTTI i campi cliente */
          document.getElementById("wiz-studio").value = cl.nome_studio || "";
          document.getElementById("wiz-via").value = cl.via || "";
          document.getElementById("wiz-cap").value = cl.cap || "";
          document.getElementById("wiz-citta").value = cl.citta || "";
          document.getElementById("wiz-email").value = cl.email || "";
          document.getElementById("wiz-telefono").value = cl.telefono || "";
          document.getElementById("wiz-referente").value = cl.referente || "";
          document.getElementById("wiz-ac").innerHTML = "";
        });
      });
    });
  });

  document.getElementById("wiz-back2").addEventListener("click", function() { wizardStep = 1; renderNuova(c); });
  document.getElementById("wiz-next3").addEventListener("click", function() {
    wizardData.nome_studio = document.getElementById("wiz-studio").value;
    wizardData.nome_condominio = document.getElementById("wiz-cond").value;
    wizardData.cond_via = document.getElementById("wiz-cond-via").value;
    wizardData.cond_citta = document.getElementById("wiz-cond-citta").value;
    wizardData.via = document.getElementById("wiz-via").value;
    wizardData.cap = document.getElementById("wiz-cap").value;
    wizardData.citta = document.getElementById("wiz-citta").value;
    wizardData.email_studio = document.getElementById("wiz-email").value;
    wizardData.telefono = document.getElementById("wiz-telefono").value;
    wizardData.referente = document.getElementById("wiz-referente").value;
    wizardData.agente_id = document.getElementById("wiz-agente").value;
    wizardData.natura = document.getElementById("wiz-natura").value;
    wizardData.tipo_offerta = document.getElementById("wiz-tipo-offerta").value;
    wizardData.salva_cliente = document.getElementById("wiz-save-client").checked;

    if (!wizardData.nome_studio) { showModal("Errore", "Nome studio obbligatorio.", [{ label: "Ok", cls: "btn btn-primary", fn: closeModal }]); return; }
    if (!wizardData.agente_id) { showModal("Errore", "Seleziona un agente.", [{ label: "Ok", cls: "btn btn-primary", fn: closeModal }]); return; }
    wizardStep = 3;
    renderNuova(c);
  });
}

function wizStep3Html() {
  var h = '<div class="wiz-section"><div class="wiz-section-title">Dati Economici</div>';

  h += '<div class="wiz-field"><div class="wiz-label">Centralizzazione</div>';
  h += '<div class="pill-toggle">';
  h += '<button class="pill-opt ' + (wizardData.modalita === "vendita" ? "on" : "") + '" id="pill-vendita">Vendita</button>';
  h += '<button class="pill-opt ' + (wizardData.modalita === "comodato" ? "on" : "") + '" id="pill-comodato">Comodato d&#8217;Uso</button>';
  h += "</div></div>";

  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Fornitura cad. &euro; *</div><input class="wiz-input" type="number" step="0.01" id="wiz-pf" value="' + (wizardData.prezzo_fornitura || "") + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">Care cad/anno &euro; *</div><input class="wiz-input" type="number" step="0.01" id="wiz-pc" value="' + (wizardData.prezzo_care || "") + '" /></div>';
  h += "</div>";
  h += '<div class="wiz-field"><div class="wiz-label">Lettura cad/anno &euro; *</div><input class="wiz-input" type="number" step="0.01" id="wiz-cl" value="' + (wizardData.canone_lettura || "") + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">Note</div><textarea class="wiz-input" rows="2" id="wiz-note">' + esc(wizardData.note || "") + "</textarea></div>";
  h += "</div>";

  h += '<div class="card mb20"><div class="sec-ttl">Riepilogo</div><div class="wiz-summary" id="wiz-sum"></div>';
  h += '<div style="font-size:.7rem;color:var(--muted);margin-top:8px;text-align:center">Prezzi unitari &mdash; accordo quadro senza quantita definita</div></div>';

  h += '<div class="fjb">';
  h += '<button class="btn btn-sec" id="wiz-back3"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> Indietro</button>';
  h += '<button class="btn btn-primary" id="wiz-genera" style="padding:10px 28px;font-size:.9rem"><i data-lucide="zap" style="width:16px;height:16px"></i> Genera Offerta</button>';
  h += "</div>";
  return h;
}

function updateWizSummary() {
  var el = document.getElementById("wiz-sum");
  if (!el) return;
  var pf = parseFloat(wizardData.prezzo_fornitura) || 0;
  var pc = parseFloat(wizardData.prezzo_care) || 0;
  var cl = parseFloat(wizardData.canone_lettura) || 0;
  el.innerHTML =
    '<div class="wiz-summary-row"><span class="wiz-summary-label">Template</span><span class="wiz-summary-val">' + (wizardData.template === "E40" ? "E-ITN40" : "Q5.5") + "</span></div>" +
    '<div class="wiz-summary-row"><span class="wiz-summary-label">Studio</span><span class="wiz-summary-val">' + esc(wizardData.nome_studio) + "</span></div>" +
    '<div class="wiz-summary-row"><span class="wiz-summary-label">Fornitura</span><span class="wiz-summary-val">&euro; ' + pf.toFixed(2).replace(".", ",") + "</span></div>" +
    '<div class="wiz-summary-row"><span class="wiz-summary-label">Care</span><span class="wiz-summary-val">&euro; ' + pc.toFixed(2).replace(".", ",") + "</span></div>" +
    '<div class="wiz-summary-row"><span class="wiz-summary-label">Lettura</span><span class="wiz-summary-val">&euro; ' + cl.toFixed(2).replace(".", ",") + "</span></div>";
}

function attachWizStep3(c) {
  updateWizSummary();

  document.getElementById("pill-vendita").addEventListener("click", function() { wizardData.modalita = "vendita"; renderNuova(c); });
  document.getElementById("pill-comodato").addEventListener("click", function() { wizardData.modalita = "comodato"; renderNuova(c); });

  ["wiz-pf", "wiz-pc", "wiz-cl"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", function() {
      var map = { "wiz-pf": "prezzo_fornitura", "wiz-pc": "prezzo_care", "wiz-cl": "canone_lettura" };
      wizardData[map[id]] = this.value;
      updateWizSummary();
    });
  });

  document.getElementById("wiz-back3").addEventListener("click", function() { wizardStep = 2; renderNuova(c); });
  document.getElementById("wiz-genera").addEventListener("click", function() {
    wizardData.note = document.getElementById("wiz-note").value;
    var pf = parseFloat(wizardData.prezzo_fornitura) || 0;
    var pc = parseFloat(wizardData.prezzo_care) || 0;
    var cl = parseFloat(wizardData.canone_lettura) || 0;
    if (!pf || !pc || !cl) { showModal("Errore", "Compila tutti i campi economici.", [{ label: "Ok", cls: "btn btn-primary", fn: closeModal }]); return; }

    if (wizardData.salva_cliente) {
      api("POST", "/api/clienti", {
        nome_studio: wizardData.nome_studio,
        via: wizardData.via, cap: wizardData.cap, citta: wizardData.citta,
        email: wizardData.email_studio, telefono: wizardData.telefono || "",
        referente: wizardData.referente || ""
      });
    }

    api("POST", "/api/offerte", {
      nome_studio: wizardData.nome_studio, nome_condominio: wizardData.nome_condominio,
      via: wizardData.via, cap: wizardData.cap, citta: wizardData.citta, email_studio: wizardData.email_studio,
      template: wizardData.template, riferimento: "Accordo Quadro " + (wizardData.template === "E40" ? "E-ITN40" : "Q5.5"),
      prezzo_fornitura: pf, prezzo_care: pc, canone_lettura: cl,
      modalita: wizardData.modalita, note: wizardData.note,
      agente_id: parseInt(wizardData.agente_id) || null,
      natura: wizardData.natura || "nuovo",
      tipo_offerta: wizardData.tipo_offerta || "installazione"
    }).then(function(off) {
      return api("POST", "/api/genera", { id: off.id });
    }).then(function(res) {
      var rd = document.getElementById("wiz-result");
      if (!rd) return;
      if (res.ok) {
        rd.innerHTML = '<div class="alert a-ok">Offerta N. ' + res.numero + " generata con successo!" + (res.pdf_error ? " (PDF non disponibile)" : "") + "</div>";
        wizardData = { template: "", nome_studio: "", nome_condominio: "", cond_via: "", cond_citta: "", via: "", cap: "", citta: "", email_studio: "", telefono: "", referente: "", modalita: "vendita", prezzo_fornitura: "", prezzo_care: "", canone_lettura: "", note: "", salva_cliente: false, agente_id: "", natura: "nuovo", tipo_offerta: "installazione" };
        wizardStep = 1;
      } else {
        rd.innerHTML = '<div class="alert a-warn">' + (res.error || "Errore") + "</div>";
      }
    });
  });
}


/* ═══════════════════════════════════════════════════════════
   ANAGRAFICA CLIENTI
   ═══════════════════════════════════════════════════════════ */

function renderClienti(c) {
  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
  api("GET", "/api/clienti").then(function(d) { clienti = d; buildClienti(c); }).catch(function(e) { c.innerHTML = '<div class="alert a-warn">' + e.message + "</div>"; });
}

function buildClienti(c) {
  var h = '<div class="fjb mb16"><div><div class="kicker">Gestione</div><div class="page-title">Anagrafica Clienti</div></div>';
  h += '<button class="btn btn-primary" id="btn-new-client"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Cliente</button></div>';
  h += '<div id="new-client-form"></div>';
  h += '<div class="card-0"><div class="scx"><table class="tbl"><thead><tr><th>Nome Studio</th><th>Referente</th><th>Citta</th><th>Email</th><th>Telefono</th></tr></thead><tbody>';
  if (!clienti.length) h += '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted)">Nessun cliente</td></tr>';
  clienti.forEach(function(cl) {
    h += '<tr data-cid="' + cl.id + '" style="cursor:pointer"><td><strong>' + esc(cl.nome_studio) + "</strong></td>";
    h += "<td>" + esc(cl.referente || "") + "</td><td>" + esc(cl.citta || "") + "</td><td>" + esc(cl.email || "") + "</td><td>" + esc(cl.telefono || "") + "</td></tr>";
  });
  h += "</tbody></table></div></div>";
  h += '<div id="client-detail"></div>';
  c.innerHTML = h;
  icons();

  document.getElementById("btn-new-client").addEventListener("click", showNewClientForm);
  c.querySelectorAll("tr[data-cid]").forEach(function(tr) {
    tr.addEventListener("click", function() { loadClientDetail(parseInt(this.getAttribute("data-cid"))); });
  });
}

function showNewClientForm() {
  var area = document.getElementById("new-client-form");
  if (!area) return;
  area.innerHTML = '<div class="card mb16"><div class="fjb mb12"><strong>Nuovo Cliente</strong><button class="btn btn-ghost btn-sm" id="close-new-client"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>' +
    '<div class="form-grid">' +
    '<div class="form-field"><label>Nome Studio *</label><input class="inp" id="nc-nome" /></div>' +
    '<div class="form-field"><label>Referente</label><input class="inp" id="nc-ref" /></div>' +
    '<div class="form-field"><label>Via</label><input class="inp" id="nc-via" /></div>' +
    '<div class="form-field"><label>CAP</label><input class="inp" id="nc-cap" /></div>' +
    '<div class="form-field"><label>Citta</label><input class="inp" id="nc-citta" /></div>' +
    '<div class="form-field"><label>Email</label><input class="inp" id="nc-email" /></div>' +
    '<div class="form-field"><label>Telefono</label><input class="inp" id="nc-tel" /></div>' +
    '<div class="form-field"><label>Tipo Cliente</label><select class="inp" id="nc-tipo"><option value="Amministratore">Amministratore</option><option value="Gestore">Gestore</option><option value="Costruttore">Costruttore</option><option value="Progettista">Progettista</option><option value="Condomino">Condomino</option><option value="Rivenditore">Rivenditore</option></select></div>' +
    '<div class="form-field full"><label>Note</label><textarea class="inp" id="nc-note" rows="2"></textarea></div>' +
    '</div><div class="fac gap8 mt12"><button class="btn btn-primary" id="save-client">Salva</button><button class="btn btn-sec" id="cancel-client">Annulla</button></div></div>';
  icons();
  document.getElementById("close-new-client").addEventListener("click", function() { area.innerHTML = ""; });
  document.getElementById("cancel-client").addEventListener("click", function() { area.innerHTML = ""; });
  document.getElementById("save-client").addEventListener("click", function() {
    var nome = document.getElementById("nc-nome").value;
    if (!nome) { showModal("Errore", "Nome obbligatorio", [{ label: "Ok", cls: "btn btn-primary", fn: closeModal }]); return; }
    api("POST", "/api/clienti", {
      nome_studio: nome, referente: document.getElementById("nc-ref").value,
      via: document.getElementById("nc-via").value, cap: document.getElementById("nc-cap").value,
      citta: document.getElementById("nc-citta").value, email: document.getElementById("nc-email").value,
      telefono: document.getElementById("nc-tel").value, tipo_cliente: document.getElementById("nc-tipo").value,
      note: document.getElementById("nc-note").value
    }).then(function(res) {
      toast("Cliente salvato", "ok");
      renderClienti(document.getElementById("content"));
    }).catch(function(e) {
      toast("Errore: " + e.message, "error");
    });
  });
}

function loadClientDetail(cid) {
  api("GET", "/api/clienti/" + cid).then(function(data) {
    var area = document.getElementById("client-detail");
    if (!area) return;
    var cl = data.cliente;
    var offs = data.offerte;
    var prese = 0, perse = 0, attesa = 0;
    offs.forEach(function(o) {
      if (o.stato === "preso_lavoro") prese++;
      if (o.stato === "perso") perse++;
      if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") attesa++;
    });

    var h = '<div class="client-detail mt16">';
    h += '<div class="fjb mb12"><strong style="font-size:1rem">' + esc(cl.nome_studio) + '</strong><button class="btn btn-ghost btn-sm" id="close-detail"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    h += '<div class="g4 mb16">';
    h += '<div class="kpi"><div class="kpi-l">Offerte</div><div class="kpi-v kv-blue">' + offs.length + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Prese</div><div class="kpi-v kv-green">' + prese + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Perse</div><div class="kpi-v kv-red">' + perse + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">In Attesa</div><div class="kpi-v kv-orange">' + attesa + "</div></div>";
    h += "</div>";

    h += '<div class="sec-ttl">Storico Offerte</div>';
    if (offs.length) {
      h += '<table class="tbl"><thead><tr><th>N.</th><th>Data</th><th>Condominio</th><th>Riferimento</th><th>Stato</th></tr></thead><tbody>';
      offs.forEach(function(o) {
        var si = statoInfo(o.stato);
        h += "<tr><td>" + (o.numero || "\u2014") + "</td><td>" + fmtData(o.data_creazione) + "</td><td>" + esc(o.nome_condominio || "") + "</td><td>" + esc(o.riferimento || "") + '</td><td><span class="stato-badge ' + si.cls + '">' + si.label + "</span></td></tr>";
      });
      h += "</tbody></table>";
    } else {
      h += '<div style="color:var(--muted);font-size:.82rem;padding:12px">Nessuna offerta</div>';
    }
    h += "</div>";
    area.innerHTML = h;
    icons();
    document.getElementById("close-detail").addEventListener("click", function() { area.innerHTML = ""; });
  });
}


/* ═══════════════════════════════════════════════════════════
   AGENTI
   ═══════════════════════════════════════════════════════════ */

function renderAgenti(c) {
  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
  api("GET", "/api/agenti").then(function(d) { agenti = d; buildAgenti(c); }).catch(function(e) { c.innerHTML = '<div class="alert a-warn">' + e.message + "</div>"; });
}

function buildAgenti(c) {
  var h = '<div class="fjb mb16"><div><div class="kicker">Team</div><div class="page-title">Agenti</div></div>';
  h += '<button class="btn btn-primary" id="btn-new-agent"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Agente</button></div>';
  h += '<div id="new-agent-form"></div>';

  if (!agenti.length) {
    h += '<div class="card" style="text-align:center;padding:40px;color:var(--muted)">Nessun agente. Crea il primo!</div>';
  } else {
    h += '<div class="g3 mb20">';
    agenti.forEach(function(a) {
      var col = a.colore || "#009FE3";
      var ini = (a.nome || " ")[0].toUpperCase() + (a.cognome || " ")[0].toUpperCase();
      h += '<div class="card" style="cursor:pointer;border-top:3px solid ' + col + '" data-aid="' + a.id + '">';
      h += '<div class="fac gap10 mb8"><div class="agente-avatar" style="background:' + col + '">' + ini + "</div>";
      h += "<div><div style='font-weight:700'>" + esc(a.nome + " " + a.cognome) + "</div>";
      h += '<div style="font-size:.72rem;color:var(--muted)">' + esc(a.email || "") + "</div></div>";
      h += '<div class="ml-auto fac gap4" id="badges-' + a.id + '"></div>';
      h += "</div></div>";
    });
    h += "</div>";
  }
  h += '<div id="new-agent-form-area"></div>';
  c.innerHTML = h;
  icons();

  document.getElementById("btn-new-agent").addEventListener("click", showNewAgentForm);
  /* Click card navigates to /agenti/<id> */
  c.querySelectorAll("[data-aid]").forEach(function(card) {
    card.addEventListener("click", function() {
      window.location.href = "/agenti/" + this.getAttribute("data-aid");
    });
  });

  /* Load badges for each agent */
  agenti.forEach(function(a) {
    api("GET", "/api/agenti/" + a.id + "/badges").then(function(b) {
      var el = document.getElementById("badges-" + a.id);
      if (!el) return;
      var bh = "";
      if (b.offerte_aperte > 0) bh += '<span class="badge b-blue">' + b.offerte_aperte + " aperte</span>";
      if (b.attivita_urgenti > 0) bh += '<span class="badge b-red">' + b.attivita_urgenti + " urgenti</span>";
      el.innerHTML = bh;
    });
  });
}

function showNewAgentForm() {
  var area = document.getElementById("new-agent-form");
  if (!area) return;
  var defColor = AGENTE_COLORS[agenti.length % AGENTE_COLORS.length];
  area.innerHTML = '<div class="card mb16"><div class="fjb mb12"><strong>Nuovo Agente</strong><button class="btn btn-ghost btn-sm" id="close-new-agent"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>' +
    '<div class="form-grid">' +
    '<div class="form-field"><label>Nome *</label><input class="inp" id="na-nome" /></div>' +
    '<div class="form-field"><label>Cognome *</label><input class="inp" id="na-cognome" /></div>' +
    '<div class="form-field"><label>Email</label><input class="inp" id="na-email" /></div>' +
    '<div class="form-field"><label>Telefono</label><input class="inp" id="na-tel" /></div>' +
    '<div class="form-field"><label>Colore</label><input class="inp" id="na-colore" type="color" value="' + defColor + '" style="height:36px;padding:3px" /></div>' +
    '<div class="form-field full"><label>Note</label><textarea class="inp" id="na-note" rows="2"></textarea></div>' +
    '</div><div class="fac gap8 mt12"><button class="btn btn-primary" id="save-agent">Salva</button><button class="btn btn-sec" id="cancel-agent">Annulla</button></div></div>';
  icons();
  document.getElementById("close-new-agent").addEventListener("click", function() { area.innerHTML = ""; });
  document.getElementById("cancel-agent").addEventListener("click", function() { area.innerHTML = ""; });
  document.getElementById("save-agent").addEventListener("click", function() {
    var nome = document.getElementById("na-nome").value;
    var cognome = document.getElementById("na-cognome").value;
    if (!nome || !cognome) { showModal("Errore", "Nome e cognome obbligatori", [{ label: "Ok", cls: "btn btn-primary", fn: closeModal }]); return; }
    api("POST", "/api/agenti", {
      nome: nome, cognome: cognome,
      email: document.getElementById("na-email").value,
      telefono: document.getElementById("na-tel").value,
      colore: document.getElementById("na-colore").value,
      note: document.getElementById("na-note").value
    }).then(function() { renderAgenti(document.getElementById("content")); });
  });
}

function loadAgentDetail(aid) {
  api("GET", "/api/agenti/" + aid).then(function(data) {
    var area = document.getElementById("agent-detail");
    if (!area) return;
    var a = data.agente;
    var offs = data.offerte;
    var prese = 0, perse = 0, attesa = 0;
    offs.forEach(function(o) {
      if (o.stato === "preso_lavoro") prese++;
      if (o.stato === "perso") perse++;
      if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") attesa++;
    });
    var col = a.colore || "#009FE3";
    var ini = (a.nome || " ")[0].toUpperCase() + (a.cognome || " ")[0].toUpperCase();

    var h = '<div class="client-detail mt16">';
    h += '<div class="fjb mb12"><div class="fac gap10"><div class="agente-avatar" style="background:' + col + '">' + ini + "</div>";
    h += '<strong style="font-size:1rem">' + esc(a.nome + " " + a.cognome) + '</strong></div><button class="btn btn-ghost btn-sm" id="close-agent-detail"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    h += '<div class="g4 mb16">';
    h += '<div class="kpi"><div class="kpi-l">Offerte</div><div class="kpi-v kv-blue">' + offs.length + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Prese</div><div class="kpi-v kv-green">' + prese + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Perse</div><div class="kpi-v kv-red">' + perse + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">In Attesa</div><div class="kpi-v kv-orange">' + attesa + "</div></div>";
    h += "</div>";

    h += '<div class="sec-ttl">Offerte Assegnate</div>';
    if (offs.length) {
      h += '<table class="tbl"><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Condominio</th><th>Stato</th></tr></thead><tbody>';
      offs.forEach(function(o) {
        var si = statoInfo(o.stato);
        h += "<tr><td>" + (o.numero || "\u2014") + "</td><td>" + fmtData(o.data_creazione) + "</td><td>" + esc(o.nome_studio) + "</td><td>" + esc(o.nome_condominio || "") + '</td><td><span class="stato-badge ' + si.cls + '">' + si.label + "</span></td></tr>";
      });
      h += "</tbody></table>";
    } else {
      h += '<div style="color:var(--muted);font-size:.82rem;padding:12px">Nessuna offerta assegnata</div>';
    }
    h += "</div>";
    area.innerHTML = h;
    icons();
    document.getElementById("close-agent-detail").addEventListener("click", function() { area.innerHTML = ""; });
  });
}


/* ═══════════════════════════════════════════════════════════
   IMPOSTAZIONI
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   ADMIN DASHBOARD
   ═══════════════════════════════════════════════════════════ */

function renderAdminDashboard(c) {
  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
  api("GET", "/api/dashboard/admin").then(function(res) {
    if (!res.ok) { c.innerHTML = '<div class="alert a-warn">' + (res.error || "Errore") + "</div>"; return; }
    var d = res.data;
    var h = '<div class="kicker">Panoramica</div><div class="page-title mb20">Dashboard Aziendale</div>';

    /* KPI row 1 */
    h += '<div class="g3 mb12">';
    h += '<div class="kpi"><div class="kpi-l">Offerte YTD</div><div class="kpi-v kv-blue">' + d.totale + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Offerte Aperte</div><div class="kpi-v" style="color:#EF9F27">' + d.aperte + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Lavori Presi</div><div class="kpi-v" style="color:#639922">' + d.prese + "</div></div>";
    h += "</div>";

    h += '<div class="g3 mb20">';
    h += '<div class="kpi"><div class="kpi-l">Valore Fornitura</div><div class="kpi-v" style="color:#639922">' + fmtEurDash(d.val_fornitura) + "</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Valore Servizi Annui</div><div class="kpi-v" style="color:#854F0B">' + fmtEurDash(d.val_servizi) + "/anno</div></div>";
    h += '<div class="kpi"><div class="kpi-l">Tasso Conversione</div><div class="kpi-v kv-blue">' + d.tasso + "%</div></div>";
    h += "</div>";

    /* Natura analysis */
    h += '<div class="g2 mb20">';
    h += '<div class="card"><div class="sec-ttl">Analisi per Natura Trattativa</div>';
    h += '<table class="tbl"><thead><tr><th>Natura</th><th>Offerte</th><th>Valore</th></tr></thead><tbody>';
    var natLabels = { nuovo: "Nuovo", rinnovo: "Rinnovo", subentro_diretto: "Subentro Diretto", subentro_intermediario: "Subentro Intermediario" };
    var natKeys = Object.keys(d.natura || {});
    if (!natKeys.length) h += '<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--muted)">Nessun dato</td></tr>';
    natKeys.forEach(function(k) {
      var n = d.natura[k];
      h += "<tr><td><strong>" + esc(natLabels[k] || k) + "</strong></td><td>" + n.count + "</td><td>" + fmtEurDash(n.valore) + "</td></tr>";
    });
    h += "</tbody></table></div>";

    /* Accordi quadro */
    h += '<div class="card"><div class="sec-ttl">Accordi Quadro</div>';
    h += '<div style="text-align:center;padding:20px"><div class="kpi-v kv-blue" style="font-size:2.2rem">' + d.aq_count + '</div><div style="font-size:.82rem;color:var(--muted);margin-top:4px">Inviati YTD</div></div></div>';
    h += "</div>";

    /* Team performance */
    h += '<div class="section-header" style="margin-top:24px;margin-bottom:12px"><h3 style="font-size:1rem;font-weight:800;margin:0">Performance Team</h3></div>';
    h += '<div class="card-0"><table class="tbl"><thead><tr><th>Agente</th><th>Mese</th><th>YTD</th><th>Valore Preso</th><th>Prospect</th><th>Tasso</th><th>Attivita</th></tr></thead><tbody>';
    if (!d.agenti || !d.agenti.length) h += '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--muted)">Nessun agente</td></tr>';
    (d.agenti || []).forEach(function(a) {
      var ini = ((a.nome || " ")[0] + (a.cognome || " ")[0]).toUpperCase();
      var col = a.colore || "#009FE3";
      h += '<tr style="cursor:pointer" data-ag-link="' + a.id + '">';
      h += '<td><span class="agente-pill"><span class="agente-dot" style="background:' + col + '">' + ini + "</span>" + esc(a.nome + " " + a.cognome) + "</span></td>";
      h += "<td>" + a.offerte_mese + "</td>";
      h += "<td>" + a.offerte_ytd + "</td>";
      h += '<td class="num">' + fmtEurDash(a.valore_preso) + "</td>";
      h += '<td class="num">' + fmtEurDash(a.valore_prospect) + "</td>";
      h += "<td>" + a.tasso + "%</td>";
      h += "<td>" + a.attivita_aperte + "</td></tr>";
    });
    h += "</tbody></table></div>";

    c.innerHTML = h;
    icons();

    /* Agent links */
    c.querySelectorAll("[data-ag-link]").forEach(function(tr) {
      tr.addEventListener("click", function() {
        window.location.href = "/agenti/" + this.getAttribute("data-ag-link");
      });
    });
  }).catch(function(e) {
    c.innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderImpostazioni(c) {
  window.location.href = "/impostazioni";
}


/* ─── Sidebar badge ─── */
function loadSidebarBadges() {
  api("GET", "/api/attivita/scadute-count").then(function(res) {
    var badge = document.getElementById("sidebar-att-badge");
    if (badge && res.count > 0) {
      badge.textContent = res.count;
      badge.style.display = "inline";
    }
  }).catch(function() { /* ignore */ });
}

/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", function() {
  icons();
  renderView();
  loadSidebarBadges();
});
