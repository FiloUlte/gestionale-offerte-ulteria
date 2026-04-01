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
  canone_lettura: "", note: "", salva_cliente: false, agente_id: ""
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
    impostazioni: "Impostazioni"
  };
  document.getElementById("bc-title").textContent = map[view] || "";
  renderView();
}

function renderView() {
  var c = document.getElementById("content");
  switch (currentView) {
    case "dashboard": renderDashboard(c); break;
    case "nuova": renderNuova(c); break;
    case "clienti": renderClienti(c); break;
    case "agenti": renderAgenti(c); break;
    case "impostazioni": renderImpostazioni(c); break;
  }
}


/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */

function renderDashboard(c) {
  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
  Promise.all([api("GET", "/api/offerte"), api("GET", "/api/agenti")]).then(function(r) {
    offerte = r[0];
    agenti = r[1];
    buildDashboard(c);
  }).catch(function(e) {
    c.innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function buildDashboard(c) {
  var total = offerte.length;
  var aperte = 0;
  var presi = 0;
  offerte.forEach(function(o) {
    if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") aperte++;
    if (o.stato === "preso_lavoro") presi++;
  });
  var filtered = filterOfferte();

  var h = "";

  /* KPI */
  h += '<div class="g4 mb20">';
  h += '<div class="kpi"><div class="kpi-l">Totale Offerte</div><div class="kpi-v kv-blue">' + total + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Offerte Aperte</div><div class="kpi-v kv-orange">' + aperte + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Lavori Presi</div><div class="kpi-v kv-green">' + presi + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Agenti</div><div class="kpi-v">' + agenti.length + "</div></div>";
  h += "</div>";

  /* Toolbar */
  h += '<div class="fjb mb12">';
  h += '<div class="search-bar" style="flex:1;max-width:400px">';
  h += '<i data-lucide="search" style="width:14px;height:14px" class="search-icon"></i>';
  h += '<input type="text" placeholder="Cerca offerte..." id="dash-search" /></div>';
  h += '<div class="fac gap8">';
  h += '<button class="btn btn-primary" id="btn-nuova"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuova Offerta</button>';
  h += '<button class="btn btn-sec" id="btn-riga"><i data-lucide="rows-3" style="width:14px;height:14px"></i> Crea Riga</button>';
  h += '<button class="btn btn-sec" id="btn-csv"><i data-lucide="download" style="width:14px;height:14px"></i> Csv</button>';
  h += "</div></div>";

  /* Table */
  h += '<div class="card-0"><div class="scx"><table class="tbl" id="dash-tbl"><thead><tr>';
  var cols = ["N.", "Data", "Cliente", "Condominio", "Via", "Riferimento", "Agente", "Fornitura", "Care", "Lettura", "Stato", "Azioni"];
  cols.forEach(function(label) {
    h += "<th>" + label + "</th>";
  });
  h += "</tr></thead><tbody>";

  if (filtered.length === 0) {
    h += '<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--muted)">Nessuna offerta</td></tr>';
  }

  filtered.forEach(function(o) {
    var via = o.via || "";
    if (o.citta) via += (via ? ", " : "") + (o.cap ? o.cap + " " : "") + o.citta;
    var si = statoInfo(o.stato);
    var hasDocx = !!o.path_docx;
    var hasPdf = !!o.path_pdf;

    h += '<tr data-oid="' + o.id + '">';
    h += '<td class="mono">' + (o.numero || "\u2014") + "</td>";
    h += "<td>" + fmtData(o.data_creazione) + "</td>";
    h += '<td class="editable" data-field="nome_studio">' + esc(o.nome_studio) + "</td>";
    h += '<td class="editable" data-field="nome_condominio">' + esc(o.nome_condominio || "") + "</td>";
    h += '<td class="editable" data-field="via">' + esc(via) + "</td>";
    h += '<td class="editable" data-field="riferimento">' + esc(o.riferimento || "") + "</td>";
    h += '<td class="editable" data-field="agente_id">' + agenteHtml(o.agente_id) + "</td>";
    h += '<td class="num editable" data-field="prezzo_fornitura">' + fmt(o.prezzo_fornitura) + "</td>";
    h += '<td class="num editable" data-field="prezzo_care">' + fmt(o.prezzo_care) + "</td>";
    h += '<td class="num editable" data-field="canone_lettura">' + fmt(o.canone_lettura) + "</td>";
    h += '<td><span class="stato-badge ' + si.cls + '" data-stato-id="' + o.id + '">' + si.label + "</span></td>";
    h += "<td><div class='act-btns'>";

    if (hasDocx) {
      h += '<button class="act-btn act-gen done">&#9989;</button>';
    } else {
      h += '<button class="act-btn act-gen" data-gen-id="' + o.id + '"><i data-lucide="zap" style="width:12px;height:12px"></i></button>';
    }
    h += '<button class="act-btn act-docx" data-open="' + esc(o.path_docx || "") + '" ' + (hasDocx ? "" : "disabled") + '><i data-lucide="file-text" style="width:12px;height:12px"></i></button>';
    h += '<button class="act-btn act-pdf" data-open="' + esc(o.path_pdf || "") + '" ' + (hasPdf ? "" : "disabled") + '><i data-lucide="file" style="width:12px;height:12px"></i></button>';
    h += '<button class="act-btn act-mail" data-mail-id="' + o.id + '"><i data-lucide="mail" style="width:12px;height:12px"></i></button>';
    h += '<button class="act-btn act-del" data-del-id="' + o.id + '" data-del-num="' + (o.numero || "") + '"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>';

    h += "</div></td></tr>";
  });

  h += "</tbody></table></div></div>";
  c.innerHTML = h;
  icons();
  attachDashboardEvents(c);
}

function attachDashboardEvents(c) {
  /* Search */
  var searchInp = document.getElementById("dash-search");
  if (searchInp) {
    searchInp.value = searchTerm;
    searchInp.addEventListener("input", function() {
      searchTerm = this.value;
      buildDashboard(c);
    });
  }

  /* Toolbar buttons */
  var btnNuova = document.getElementById("btn-nuova");
  if (btnNuova) btnNuova.addEventListener("click", function() { navigate("nuova"); });

  var btnRiga = document.getElementById("btn-riga");
  if (btnRiga) btnRiga.addEventListener("click", function() {
    api("POST", "/api/offerte", { nome_studio: "", template: "E40", stato: "richiamato" }).then(function() {
      renderDashboard(c);
    });
  });

  var btnCsv = document.getElementById("btn-csv");
  if (btnCsv) btnCsv.addEventListener("click", esportaCsv);

  /* Inline editing on double click */
  c.querySelectorAll("td.editable").forEach(function(td) {
    td.addEventListener("dblclick", function() {
      var oid = parseInt(td.parentElement.getAttribute("data-oid"));
      var field = td.getAttribute("data-field");
      if (field === "agente_id") {
        editAgente(td, oid);
      } else {
        editCell(td, oid, field);
      }
    });
  });

  /* Stato badges */
  c.querySelectorAll("[data-stato-id]").forEach(function(badge) {
    badge.addEventListener("click", function(e) {
      e.stopPropagation();
      showStatoDropdown(badge, parseInt(badge.getAttribute("data-stato-id")));
    });
  });

  /* Action buttons */
  c.querySelectorAll("[data-gen-id]").forEach(function(btn) {
    btn.addEventListener("click", function() { doGenera(parseInt(btn.getAttribute("data-gen-id"))); });
  });
  c.querySelectorAll("[data-open]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var p = btn.getAttribute("data-open");
      if (p) window.open(p, "_blank");
    });
  });
  c.querySelectorAll("[data-mail-id]").forEach(function(btn) {
    btn.addEventListener("click", function() { doMail(parseInt(btn.getAttribute("data-mail-id"))); });
  });
  c.querySelectorAll("[data-del-id]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = parseInt(btn.getAttribute("data-del-id"));
      var num = btn.getAttribute("data-del-num") || id;
      showModal("Conferma", "Eliminare offerta N. " + num + "?", [
        { label: "Annulla", cls: "btn btn-sec", fn: closeModal },
        { label: "Elimina", cls: "btn btn-danger", fn: function() { closeModal(); api("DELETE", "/api/offerte/" + id).then(function() { renderDashboard(c); }); } }
      ]);
    });
  });
}

function filterOfferte() {
  var list = offerte.slice();
  if (searchTerm) {
    var q = searchTerm.toLowerCase();
    list = list.filter(function(o) {
      return [o.numero, o.nome_studio, o.nome_condominio, o.via, o.citta, o.riferimento, o.stato].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  return list;
}

/* ─── Inline editing ─── */

function editCell(td, oid, field) {
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
    var v = inp.value;
    var data = {};
    if (field === "prezzo_fornitura" || field === "prezzo_care" || field === "canone_lettura") {
      data[field] = parseFloat(v.replace(",", ".")) || null;
    } else {
      data[field] = v;
    }
    api("PUT", "/api/offerte/" + oid, data).then(function() {
      renderDashboard(document.getElementById("content"));
    });
  }
  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") renderDashboard(document.getElementById("content"));
  });
  inp.addEventListener("blur", save);
}

function editAgente(td, oid) {
  if (td.querySelector("select")) return;
  var off = offerte.find(function(o) { return o.id === oid; });

  var sel = document.createElement("select");
  sel.className = "cell-edit";
  var optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "\u2014 Nessuno";
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
    var v = sel.value ? parseInt(sel.value) : null;
    api("PUT", "/api/offerte/" + oid, { agente_id: v }).then(function() {
      renderDashboard(document.getElementById("content"));
    });
  }
  sel.addEventListener("change", save);
  sel.addEventListener("blur", save);
}

/* ─── Stato dropdown ─── */

function showStatoDropdown(badge, oid) {
  closeStatoDropdown();
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
      api("PUT", "/api/offerte/" + oid, { stato: s.value }).then(function() {
        renderDashboard(document.getElementById("content"));
      });
    });
    dd.appendChild(row);
  });

  badge.parentElement.appendChild(dd);
  setTimeout(function() {
    document.addEventListener("click", closeStatoDropdown, { once: true });
  }, 10);
}

function closeStatoDropdown() {
  var dd = document.getElementById("stato-dd");
  if (dd) dd.remove();
}

/* ─── Actions ─── */

function doGenera(id) {
  closeModal();
  api("POST", "/api/genera", { id: id }).then(function(res) {
    if (res.ok) {
      var msg = "Offerta N. " + res.numero + " generata!";
      if (res.pdf_error) msg += " (PDF non disponibile)";
      var btns = [{ label: "Chiudi", cls: "btn btn-sec", fn: closeModal }];
      if (res.docx_url) btns.push({ label: "Apri DOCX", cls: "btn btn-primary", fn: function() { window.open(res.docx_url, "_blank"); } });
      if (res.pdf_url) btns.push({ label: "Apri PDF", cls: "btn btn-pdf", fn: function() { window.open(res.pdf_url, "_blank"); } });
      showModal("Generazione Completata", msg, btns);
      renderDashboard(document.getElementById("content"));
    } else {
      showModal("Errore", res.error || "Errore", [{ label: "Ok", cls: "btn btn-sec", fn: closeModal }]);
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

function esportaCsv() {
  var lines = ["Numero;Data;Cliente;Condominio;Via;Riferimento;Agente;Fornitura;Care;Lettura;Stato"];
  offerte.forEach(function(o) {
    var a = getAgente(o.agente_id);
    var an = a ? (a.nome + " " + a.cognome) : "";
    lines.push([o.numero, o.data_creazione, o.nome_studio, o.nome_condominio, o.via, o.riferimento, an, o.prezzo_fornitura, o.prezzo_care, o.canone_lettura, o.stato].map(function(v) {
      return '"' + String(v || "").replace(/"/g, '""') + '"';
    }).join(";"));
  });
  var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "offerte_ulteria.csv";
  a.click();
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
  h += '<div class="tmpl-card-icon"><i data-lucide="thermometer" style="width:36px;height:36px;color:var(--blue)"></i></div>';
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

  /* ── BOX CONDOMINIO ── */
  h += '<div class="card mb16">';
  h += '<div class="wiz-section-title"><i data-lucide="building" style="width:14px;height:14px;vertical-align:-2px"></i> Condominio</div>';
  h += '<div class="wiz-field"><div class="wiz-label">Nome Condominio</div><input class="wiz-input" id="wiz-cond" value="' + esc(wizardData.nome_condominio) + '" placeholder="Es. Condominio Aurora" /></div>';
  h += '<div class="wiz-row">';
  h += '<div class="wiz-field"><div class="wiz-label">Via Condominio</div><input class="wiz-input" id="wiz-cond-via" value="' + esc(wizardData.cond_via || "") + '" /></div>';
  h += '<div class="wiz-field"><div class="wiz-label">Citta Condominio</div><input class="wiz-input" id="wiz-cond-citta" value="' + esc(wizardData.cond_citta || "") + '" /></div>';
  h += "</div>";
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
      agente_id: parseInt(wizardData.agente_id) || null
    }).then(function(off) {
      return api("POST", "/api/genera", { id: off.id });
    }).then(function(res) {
      var rd = document.getElementById("wiz-result");
      if (!rd) return;
      if (res.ok) {
        rd.innerHTML = '<div class="alert a-ok">Offerta N. ' + res.numero + " generata con successo!" + (res.pdf_error ? " (PDF non disponibile)" : "") + "</div>";
        wizardData = { template: "", nome_studio: "", nome_condominio: "", cond_via: "", cond_citta: "", via: "", cap: "", citta: "", email_studio: "", telefono: "", referente: "", modalita: "vendita", prezzo_fornitura: "", prezzo_care: "", canone_lettura: "", note: "", salva_cliente: false, agente_id: "" };
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
      telefono: document.getElementById("nc-tel").value, note: document.getElementById("nc-note").value
    }).then(function() { renderClienti(document.getElementById("content")); });
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

function renderImpostazioni(c) {
  c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Caricamento...</div>';
  api("GET", "/api/config").then(function(cfg) {
    var h = '<div class="kicker">Sistema</div><div class="page-title mb20">Impostazioni</div>';
    h += '<div class="g2">';
    h += '<div class="card"><div class="sec-ttl">Prossimo Numero Offerta</div>';
    h += '<div class="fac gap8"><input class="inp" type="number" id="cfg-num" value="' + cfg.prossimo_numero + '" style="width:140px" />';
    h += '<button class="btn btn-primary btn-sm" id="save-num">Salva</button></div></div>';
    h += '<div class="card"><div class="sec-ttl">Info</div>';
    h += '<div style="font-size:.82rem;color:var(--mid)">';
    h += "<div class='mb8'><strong>Versione:</strong> 1.0.0</div>";
    h += "<div><strong>Offerte:</strong> " + (cfg.totale_offerte_generate || 0) + "</div>";
    h += "</div></div></div>";
    c.innerHTML = h;
    icons();
    document.getElementById("save-num").addEventListener("click", function() {
      var val = document.getElementById("cfg-num").value;
      api("POST", "/api/config", { prossimo_numero: parseInt(val) }).then(function() {
        showModal("Salvato", "Numero aggiornato a " + val, [{ label: "Ok", cls: "btn btn-primary", fn: closeModal }]);
      });
    });
  }).catch(function(e) { c.innerHTML = '<div class="alert a-warn">' + e.message + "</div>"; });
}


/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", function() {
  icons();
  renderView();
});
