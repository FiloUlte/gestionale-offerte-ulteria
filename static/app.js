/* ══════════════════════════════════════════════════════════════
   Ulteria Gestionale Offerte — Frontend JS
   ══════════════════════════════════════════════════════════════ */

var currentView = "dashboard";
var offerte = [];
var clienti = [];
var sortCol = null;
var sortDir = "desc";
var searchTerm = "";
var wizardStep = 1;
var wizardData = { template: "", nome_studio: "", via: "", cap: "", citta: "", email_studio: "", modalita: "vendita", prezzo_fornitura: "", prezzo_care: "", canone_lettura: "", note: "", salva_cliente: false };
var clientDetail = null;
var statoDropdownId = null;

// ─── STATO CONFIG ───
var STATI = [
  { value: "richiamato", label: "Richiamato", color: "#f59e0b", cls: "stato-richiamato" },
  { value: "in_attesa_assemblea", label: "In Attesa Assemblea", color: "#0ea5e9", cls: "stato-in_attesa_assemblea" },
  { value: "preso_lavoro", label: "Preso Lavoro", color: "#22c55e", cls: "stato-preso_lavoro" },
  { value: "perso", label: "Perso", color: "#ef4444", cls: "stato-perso" },
  { value: "rimandato", label: "Rimandato", color: "#7c3aed", cls: "stato-rimandato" }
];

function statoInfo(val) {
  for (var i = 0; i < STATI.length; i++) {
    if (STATI[i].value === val) return STATI[i];
  }
  return STATI[0];
}

// ─── NAV ───
function navigate(view) {
  currentView = view;
  var items = document.querySelectorAll(".nav-item");
  items.forEach(function(el) {
    el.classList.toggle("active", el.getAttribute("data-view") === view);
  });
  var titles = { dashboard: "Dashboard Offerte", nuova: "Nuova Offerta", clienti: "Anagrafica Clienti", impostazioni: "Impostazioni" };
  document.getElementById("bc-title").textContent = titles[view] || "";
  renderView();
}

function renderView() {
  var c = document.getElementById("content");
  if (currentView === "dashboard") renderDashboard(c);
  else if (currentView === "nuova") renderNuova(c);
  else if (currentView === "clienti") renderClienti(c);
  else if (currentView === "impostazioni") renderImpostazioni(c);
  lucide.createIcons();
}

// ─── UTILS ───
function fmt(val) {
  if (val === null || val === undefined || val === "") return "\u2014";
  var n = parseFloat(val);
  if (isNaN(n)) return "\u2014";
  return n.toFixed(2).replace(".", ",");
}

function fmtTotale(val) {
  if (val === null || val === undefined || val === "") return "\u2014";
  var n = parseFloat(val);
  if (isNaN(n)) return "\u2014";
  return "\u20ac " + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(".", "X").replace(".", ",").replace("X", ".");
}

function fmtData(d) {
  if (!d) return "\u2014";
  var dt = new Date(d);
  return dt.toLocaleDateString("it-IT");
}

function escHtml(s) {
  if (!s) return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function api(method, url, data) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (data) opts.body = JSON.stringify(data);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

// ─── DASHBOARD ───
function renderDashboard(container) {
  api("GET", "/api/offerte").then(function(data) {
    offerte = data;
    buildDashboard(container);
    lucide.createIcons();
  });
}

function buildDashboard(container) {
  var total = offerte.length;
  var valTot = 0;
  var aperte = 0;
  var presi = 0;
  offerte.forEach(function(o) {
    if (o.totale) valTot += o.totale;
    if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") aperte++;
    if (o.stato === "preso_lavoro") presi++;
  });

  var filtered = filterAndSort(offerte);

  var html = "";
  // KPI
  html += '<div class="g4 mb20">';
  html += '<div class="kpi"><div class="kpi-l">Totale Offerte</div><div class="kpi-v kv-blue">' + total + '</div></div>';
  html += '<div class="kpi"><div class="kpi-l">Valore Totale</div><div class="kpi-v">' + fmtTotale(valTot) + '</div></div>';
  html += '<div class="kpi"><div class="kpi-l">Offerte Aperte</div><div class="kpi-v kv-orange">' + aperte + '</div></div>';
  html += '<div class="kpi"><div class="kpi-l">Lavori Presi</div><div class="kpi-v kv-green">' + presi + '</div></div>';
  html += '</div>';

  // Search + buttons
  html += '<div class="fjb mb12">';
  html += '<div class="search-bar" style="flex:1;max-width:400px"><i data-lucide="search" style="width:14px;height:14px" class="search-icon"></i><input type="text" placeholder="Cerca offerte..." value="' + escHtml(searchTerm) + '" oninput="searchTerm=this.value;buildDashboard(document.getElementById(\'content\'))" /></div>';
  html += '<div class="fac gap8">';
  html += '<button class="btn btn-primary" onclick="navigate(\'nuova\')"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuova Offerta</button>';
  html += '<button class="btn btn-sec" onclick="esportaCsv()"><i data-lucide="download" style="width:14px;height:14px"></i> Esporta Csv</button>';
  html += '</div></div>';

  // Table
  html += '<div class="card-0"><div class="scx"><table class="tbl"><thead><tr>';
  var cols = [
    { key: "numero", label: "N\u00b0", cls: "" },
    { key: "nome_studio", label: "Cliente", cls: "" },
    { key: "nome_condominio", label: "Condominio", cls: "" },
    { key: "via", label: "Via e Citt\u00e0", cls: "" },
    { key: "riferimento", label: "Riferimento", cls: "" },
    { key: "prezzo_fornitura", label: "Fornitura \u20ac", cls: "r" },
    { key: "prezzo_care", label: "Care \u20ac", cls: "r" },
    { key: "canone_lettura", label: "Lettura \u20ac", cls: "r" },
    { key: "totale", label: "Totale \u20ac", cls: "r" },
    { key: "stato", label: "Stato", cls: "" },
    { key: "_actions", label: "Azioni", cls: "" }
  ];
  cols.forEach(function(c) {
    var sorted = sortCol === c.key;
    var arrow = sorted ? (sortDir === "asc" ? " \u25b2" : " \u25bc") : " \u25b4";
    if (c.key === "_actions") {
      html += '<th>' + c.label + '</th>';
    } else {
      html += '<th class="' + c.cls + (sorted ? " sorted" : "") + '" onclick="toggleSort(\'' + c.key + '\')">' + c.label + '<span class="sort-arrow">' + arrow + '</span></th>';
    }
  });
  html += '</tr></thead><tbody>';

  if (filtered.length === 0) {
    html += '<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--muted)">Nessuna offerta trovata</td></tr>';
  }

  filtered.forEach(function(o) {
    var viaCitta = "";
    if (o.via) viaCitta += o.via;
    if (o.cap || o.citta) {
      if (viaCitta) viaCitta += ", ";
      if (o.cap) viaCitta += o.cap + " ";
      if (o.citta) viaCitta += o.citta;
    }
    var si = statoInfo(o.stato);
    var hasDocx = !!o.path_docx;
    var hasPdf = !!o.path_pdf;
    var canGen = o.nome_studio && o.template && (o.prezzo_fornitura || o.prezzo_fornitura === 0) && (o.prezzo_care || o.prezzo_care === 0) && (o.canone_lettura || o.canone_lettura === 0);

    html += '<tr data-id="' + o.id + '">';
    html += '<td class="mono">' + (o.numero || "\u2014") + '</td>';
    html += '<td class="editable" data-field="nome_studio" ondblclick="startEdit(this,' + o.id + ',\'nome_studio\')">' + escHtml(o.nome_studio) + '</td>';
    html += '<td class="editable" data-field="nome_condominio" ondblclick="startEdit(this,' + o.id + ',\'nome_condominio\')">' + escHtml(o.nome_condominio) + '</td>';
    html += '<td class="editable" data-field="via" ondblclick="startEditVia(this,' + o.id + ')">' + escHtml(viaCitta) + '</td>';
    html += '<td class="editable" data-field="riferimento" ondblclick="startEditRif(this,' + o.id + ',\'riferimento\')">' + escHtml(o.riferimento) + '</td>';
    html += '<td class="num editable" ondblclick="startEdit(this,' + o.id + ',\'prezzo_fornitura\')">' + fmt(o.prezzo_fornitura) + '</td>';
    html += '<td class="num editable" ondblclick="startEdit(this,' + o.id + ',\'prezzo_care\')">' + fmt(o.prezzo_care) + '</td>';
    html += '<td class="num editable" ondblclick="startEdit(this,' + o.id + ',\'canone_lettura\')">' + fmt(o.canone_lettura) + '</td>';
    html += '<td class="num num-b">' + fmt(o.totale) + '</td>';
    html += '<td style="position:relative"><button class="stato-badge ' + si.cls + '" onclick="toggleStatoDropdown(event,' + o.id + ')">' + si.label + '</button></td>';
    html += '<td><div class="act-btns">';
    if (hasDocx) {
      html += '<button class="act-btn act-gen done" title="Generata">&#9989;</button>';
    } else {
      html += '<button class="act-btn act-gen" onclick="generaOfferta(' + o.id + ',this)" ' + (canGen ? "" : "disabled") + ' title="Genera"><i data-lucide="zap" style="width:12px;height:12px"></i></button>';
    }
    html += '<button class="act-btn act-docx" onclick="apriFile(\'' + escHtml(o.path_docx) + '\')" ' + (hasDocx ? "" : "disabled") + ' title="Docx"><i data-lucide="file-text" style="width:12px;height:12px"></i></button>';
    html += '<button class="act-btn act-pdf" onclick="apriFile(\'' + escHtml(o.path_pdf) + '\')" ' + (hasPdf ? "" : "disabled") + ' title="Pdf"><i data-lucide="file" style="width:12px;height:12px"></i></button>';
    html += '<button class="act-btn act-mail" onclick="preparaMail(' + o.id + ')" title="Mail"><i data-lucide="mail" style="width:12px;height:12px"></i></button>';
    html += '<button class="act-btn act-del" onclick="eliminaOfferta(' + o.id + ',' + (o.numero || 0) + ')" title="Elimina"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>';
    html += '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div></div>';
  container.innerHTML = html;
  lucide.createIcons();
}

function filterAndSort(list) {
  var result = list.slice();
  if (searchTerm) {
    var q = searchTerm.toLowerCase();
    result = result.filter(function(o) {
      var haystack = [o.numero, o.nome_studio, o.nome_condominio, o.via, o.citta, o.riferimento, o.stato, o.email_studio, o.note].join(" ").toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }
  if (sortCol) {
    result.sort(function(a, b) {
      var va = a[sortCol], vb = b[sortCol];
      if (va === null || va === undefined) va = "";
      if (vb === null || vb === undefined) vb = "";
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }
  return result;
}

function toggleSort(col) {
  if (sortCol === col) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortCol = col;
    sortDir = "asc";
  }
  buildDashboard(document.getElementById("content"));
}

// ─── INLINE EDITING ───
function startEdit(td, id, field) {
  if (td.querySelector("input")) return;
  var old = "";
  for (var i = 0; i < offerte.length; i++) {
    if (offerte[i].id === id) { old = offerte[i][field]; break; }
  }
  if (old === null || old === undefined) old = "";
  var inp = document.createElement("input");
  inp.className = "cell-edit";
  inp.value = old;
  td.textContent = "";
  td.appendChild(inp);
  inp.focus();
  inp.select();

  function save() {
    var val = inp.value;
    var data = {};
    if (field === "prezzo_fornitura" || field === "prezzo_care" || field === "canone_lettura") {
      val = parseFloat(val.replace(",", ".")) || null;
      data[field] = val;
      // Recalc totale
      var off = null;
      for (var i = 0; i < offerte.length; i++) { if (offerte[i].id === id) { off = offerte[i]; break; } }
      if (off) {
        var upd = {};
        upd[field] = val;
        var pf = field === "prezzo_fornitura" ? val : off.prezzo_fornitura;
        var pc = field === "prezzo_care" ? val : off.prezzo_care;
        var cl = field === "canone_lettura" ? val : off.canone_lettura;
        data.totale = (pf || 0) + (pc || 0) + (cl || 0);
      }
    } else {
      data[field] = val;
    }
    api("PUT", "/api/offerte/" + id, data).then(function() {
      renderDashboard(document.getElementById("content"));
    });
  }

  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { renderDashboard(document.getElementById("content")); }
  });
  inp.addEventListener("blur", save);
}

function startEditVia(td, id) {
  if (td.querySelector("input")) return;
  var off = null;
  for (var i = 0; i < offerte.length; i++) { if (offerte[i].id === id) { off = offerte[i]; break; } }
  if (!off) return;

  td.innerHTML = '<div style="display:flex;gap:4px;flex-direction:column">' +
    '<input class="cell-edit" placeholder="Via" value="' + escHtml(off.via || "") + '" data-f="via" />' +
    '<div style="display:flex;gap:4px"><input class="cell-edit" placeholder="CAP" value="' + escHtml(off.cap || "") + '" data-f="cap" style="width:70px" />' +
    '<input class="cell-edit" placeholder="Citt\u00e0" value="' + escHtml(off.citta || "") + '" data-f="citta" /></div></div>';
  td.querySelector("input").focus();

  function save() {
    var inputs = td.querySelectorAll("input");
    var data = {};
    inputs.forEach(function(i) { data[i.getAttribute("data-f")] = i.value; });
    api("PUT", "/api/offerte/" + id, data).then(function() {
      renderDashboard(document.getElementById("content"));
    });
  }

  td.querySelectorAll("input").forEach(function(inp) {
    inp.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { renderDashboard(document.getElementById("content")); }
    });
    inp.addEventListener("blur", function() {
      setTimeout(function() {
        if (!td.contains(document.activeElement)) save();
      }, 100);
    });
  });
}

function startEditRif(td, id, field) {
  if (td.querySelector("input")) return;
  var old = "";
  for (var i = 0; i < offerte.length; i++) {
    if (offerte[i].id === id) { old = offerte[i][field] || ""; break; }
  }
  td.innerHTML = '<input class="cell-edit" value="' + escHtml(old) + '" />' +
    '<div class="chips">' +
    '<span class="chip" onclick="setRif(this,\'' + id + '\',\'Accordo Quadro E-ITN40\')">Accordo Quadro E-ITN40</span>' +
    '<span class="chip" onclick="setRif(this,\'' + id + '\',\'Accordo Quadro Q5.5\')">Accordo Quadro Q5.5</span>' +
    '</div>';
  td.querySelector("input").focus();

  var inp = td.querySelector("input");
  function save() {
    api("PUT", "/api/offerte/" + id, { riferimento: inp.value }).then(function() {
      renderDashboard(document.getElementById("content"));
    });
  }
  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { renderDashboard(document.getElementById("content")); }
  });
  inp.addEventListener("blur", function() {
    setTimeout(function() {
      if (!td.contains(document.activeElement)) save();
    }, 150);
  });
}

function setRif(chip, id, val) {
  api("PUT", "/api/offerte/" + id, { riferimento: val }).then(function() {
    renderDashboard(document.getElementById("content"));
  });
}

// ─── STATO DROPDOWN ───
function toggleStatoDropdown(e, id) {
  e.stopPropagation();
  closeStatoDropdown();
  var btn = e.currentTarget;
  var td = btn.parentElement;
  var dd = document.createElement("div");
  dd.className = "stato-dropdown";
  dd.id = "stato-dd";
  STATI.forEach(function(s) {
    dd.innerHTML += '<div class="stato-option" onclick="setStato(' + id + ',\'' + s.value + '\')"><span class="stato-dot" style="background:' + s.color + '"></span>' + s.label + '</div>';
  });
  td.appendChild(dd);
  statoDropdownId = id;

  setTimeout(function() {
    document.addEventListener("click", closeStatoDropdown, { once: true });
  }, 10);
}

function closeStatoDropdown() {
  var dd = document.getElementById("stato-dd");
  if (dd) dd.remove();
  statoDropdownId = null;
}

function setStato(id, val) {
  closeStatoDropdown();
  api("PUT", "/api/offerte/" + id + "/stato", { stato: val }).then(function() {
    renderDashboard(document.getElementById("content"));
  });
}

// ─── GENERA ───
function generaOfferta(id, btn) {
  var off = null;
  for (var i = 0; i < offerte.length; i++) { if (offerte[i].id === id) { off = offerte[i]; break; } }
  if (off && off.path_docx) {
    showModal("Offerta Gi\u00e0 Generata", "Offerta N\u00b0" + (off.numero || "") + " gi\u00e0 generata. Vuoi rigenerarla?", [
      { label: "Annulla", cls: "btn btn-sec", action: "closeModal()" },
      { label: "Rigenera", cls: "btn btn-danger", action: "doGenera(" + id + ")" }
    ]);
    return;
  }
  doGenera(id);
}

function doGenera(id) {
  closeModal();
  // Find the generate button for this row
  var row = document.querySelector('tr[data-id="' + id + '"]');
  var genBtn = row ? row.querySelector(".act-gen") : null;
  if (genBtn) {
    genBtn.innerHTML = '<span class="spinner"></span>';
    genBtn.disabled = true;
  }

  api("POST", "/api/genera", { id: id }).then(function(res) {
    if (res.ok) {
      var msg = '\u2705 Offerta N\u00b0 ' + res.numero + ' generata con successo';
      if (res.pdf_error) msg += '<br><span class="badge b-orange">Pdf non disponibile</span>';
      showModal("Generazione Completata", msg, [
        { label: "Chiudi", cls: "btn btn-sec", action: "closeModal()" },
        { label: "Apri Docx", cls: "btn btn-primary", action: "apriFile('" + res.docx_url + "');closeModal()" },
        res.pdf_url ? { label: "Apri Pdf", cls: "btn btn-pdf", action: "apriFile('" + res.pdf_url + "');closeModal()" } : null
      ].filter(Boolean));
      renderDashboard(document.getElementById("content"));
    } else {
      showModal("Errore", res.error || "Errore sconosciuto", [
        { label: "Chiudi", cls: "btn btn-sec", action: "closeModal()" }
      ]);
      if (genBtn) { genBtn.innerHTML = '<i data-lucide="zap" style="width:12px;height:12px"></i>'; genBtn.disabled = false; lucide.createIcons(); }
    }
  }).catch(function(err) {
    showModal("Errore", "Errore di rete: " + err.message, [{ label: "Chiudi", cls: "btn btn-sec", action: "closeModal()" }]);
  });
}

// ─── ELIMINA ───
function eliminaOfferta(id, numero) {
  showModal("Conferma Eliminazione", "Sei sicuro? L'offerta N\u00b0" + (numero || id) + " verr\u00e0 eliminata definitivamente.", [
    { label: "Annulla", cls: "btn btn-sec", action: "closeModal()" },
    { label: "Elimina", cls: "btn btn-danger", action: "doElimina(" + id + ")" }
  ]);
}

function doElimina(id) {
  closeModal();
  api("DELETE", "/api/offerte/" + id).then(function() {
    renderDashboard(document.getElementById("content"));
  });
}

// ─── FILE / MAIL ───
function apriFile(path) {
  if (!path) return;
  window.open(path, "_blank");
}

function preparaMail(id) {
  var off = null;
  for (var i = 0; i < offerte.length; i++) { if (offerte[i].id === id) { off = offerte[i]; break; } }
  if (!off) return;
  var subj = encodeURIComponent("Proposta N\u00b0 " + (off.numero || "") + " \u2014 Ulteria S.r.l.");
  var body = encodeURIComponent(
    "Gentilissimi,\n\n" +
    "in allegato la nostra proposta N\u00b0 " + (off.numero || "") + " relativa alla fornitura e installazione di ripartitori di calore.\n\n" +
    "Restiamo a disposizione per qualsiasi chiarimento.\n\n" +
    "Cordiali saluti,\nUlteria S.r.l."
  );
  var email = off.email_studio || "";
  window.location.href = "mailto:" + email + "?subject=" + subj + "&body=" + body;
}

// ─── ESPORTA CSV ───
function esportaCsv() {
  var header = "Numero;Cliente;Condominio;Via;CAP;Citta;Riferimento;Fornitura;Care;Lettura;Totale;Stato;Email;Data\n";
  var rows = offerte.map(function(o) {
    return [o.numero, o.nome_studio, o.nome_condominio, o.via, o.cap, o.citta, o.riferimento, o.prezzo_fornitura, o.prezzo_care, o.canone_lettura, o.totale, o.stato, o.email_studio, o.data_creazione].map(function(v) {
      return '"' + String(v || "").replace(/"/g, '""') + '"';
    }).join(";");
  }).join("\n");
  var blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "offerte_ulteria.csv";
  a.click();
}

// ─── MODAL ───
function showModal(title, body, buttons) {
  var existing = document.getElementById("modal-overlay");
  if (existing) existing.remove();

  var html = '<div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal">' +
    '<div class="modal-header"><h2>' + title + '</h2><button class="btn btn-ghost btn-sm" onclick="closeModal()"><i data-lucide="x" style="width:16px;height:16px"></i></button></div>' +
    '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-footer">';
  buttons.forEach(function(b) {
    html += '<button class="' + b.cls + '" onclick="' + b.action + '">' + b.label + '</button>';
  });
  html += '</div></div></div>';

  document.body.insertAdjacentHTML("beforeend", html);
  requestAnimationFrame(function() {
    document.getElementById("modal-overlay").classList.add("show");
    lucide.createIcons();
  });
}

function closeModal() {
  var el = document.getElementById("modal-overlay");
  if (el) {
    el.classList.remove("show");
    setTimeout(function() { el.remove(); }, 200);
  }
}

// ═══════════════════════════════════════════════════════════
// NUOVA OFFERTA — WIZARD
// ═══════════════════════════════════════════════════════════

function renderNuova(container) {
  var html = '<div class="wiz-wrap">';
  html += '<div class="kicker">Nuova Offerta</div>';
  html += '<div class="page-title mb20">Crea Offerta Accordo Quadro</div>';

  // Steps bar
  html += '<div class="wiz-steps mb24">';
  html += '<div class="wiz-step ' + (wizardStep === 1 ? "active" : (wizardStep > 1 ? "done" : "")) + '">1. Tipo Template</div>';
  html += '<div class="wiz-step ' + (wizardStep === 2 ? "active" : (wizardStep > 2 ? "done" : "")) + '">2. Dati Studio</div>';
  html += '<div class="wiz-step ' + (wizardStep === 3 ? "active" : "") + '">3. Dati Economici</div>';
  html += '</div>';

  if (wizardStep === 1) html += renderWizStep1();
  else if (wizardStep === 2) html += renderWizStep2();
  else if (wizardStep === 3) html += renderWizStep3();

  html += '</div>';
  container.innerHTML = html;
  lucide.createIcons();

  if (wizardStep === 2) {
    var searchInp = document.getElementById("wiz-search-studio");
    if (searchInp) {
      searchInp.addEventListener("input", function() {
        var q = this.value;
        wizardData.nome_studio = q;
        if (q.length < 2) {
          document.getElementById("wiz-ac-list").innerHTML = "";
          return;
        }
        api("GET", "/api/clienti?q=" + encodeURIComponent(q)).then(function(data) {
          var list = document.getElementById("wiz-ac-list");
          if (!list) return;
          if (data.length === 0) { list.innerHTML = ""; return; }
          list.innerHTML = data.map(function(c) {
            return '<div class="ac-item" onclick="wizSelectCliente(' + c.id + ',\'' + escHtml(c.nome_studio).replace(/'/g, "\\'") + '\',\'' + escHtml(c.via || "").replace(/'/g, "\\'") + '\',\'' + escHtml(c.cap || "").replace(/'/g, "\\'") + '\',\'' + escHtml(c.citta || "").replace(/'/g, "\\'") + '\',\'' + escHtml(c.email || "").replace(/'/g, "\\'") + '\')">' +
              '<div>' + escHtml(c.nome_studio) + '</div>' +
              '<div class="ac-item-sub">' + escHtml(c.citta || "") + (c.email ? " \u2014 " + escHtml(c.email) : "") + '</div></div>';
          }).join("");
        });
      });
    }
  }
}

function renderWizStep1() {
  var html = '<div class="wiz-section"><div class="wiz-section-title">Seleziona il Template</div>';
  html += '<div class="tmpl-cards">';
  html += '<div class="tmpl-card ' + (wizardData.template === "E40" ? "selected" : "") + '" onclick="wizSelectTemplate(\'E40\')">';
  html += '<div class="tmpl-card-icon"><i data-lucide="thermometer" style="width:36px;height:36px;color:var(--blue)"></i></div>';
  html += '<div class="tmpl-card-title">E-ITN40</div>';
  html += '<div class="tmpl-card-sub">Accordo Quadro \u2014 Ripartitori E-ITN40</div></div>';
  html += '<div class="tmpl-card ' + (wizardData.template === "Q55" ? "selected" : "") + '" onclick="wizSelectTemplate(\'Q55\')">';
  html += '<div class="tmpl-card-icon"><i data-lucide="gauge" style="width:36px;height:36px;color:var(--blue)"></i></div>';
  html += '<div class="tmpl-card-title">Q5.5</div>';
  html += '<div class="tmpl-card-sub">Accordo Quadro \u2014 Ripartitori Q5.5</div></div>';
  html += '</div></div>';
  return html;
}

function wizSelectTemplate(t) {
  wizardData.template = t;
  wizardStep = 2;
  renderView();
}

function renderWizStep2() {
  var html = '<div class="wiz-section"><div class="wiz-section-title">Dati Studio / Amministratore</div>';
  html += '<div class="wiz-field" style="position:relative"><div class="wiz-label">Nome Studio *</div>';
  html += '<input class="wiz-input" id="wiz-search-studio" placeholder="Cerca o inserisci nome studio..." value="' + escHtml(wizardData.nome_studio) + '" />';
  html += '<div class="ac-list" id="wiz-ac-list"></div></div>';
  html += '<div class="wiz-row">';
  html += '<div class="wiz-field"><div class="wiz-label">Via</div><input class="wiz-input" value="' + escHtml(wizardData.via) + '" onchange="wizardData.via=this.value" /></div>';
  html += '<div class="wiz-field"><div class="wiz-label">Cap</div><input class="wiz-input" value="' + escHtml(wizardData.cap) + '" onchange="wizardData.cap=this.value" /></div>';
  html += '</div>';
  html += '<div class="wiz-row">';
  html += '<div class="wiz-field"><div class="wiz-label">Citt\u00e0 *</div><input class="wiz-input" value="' + escHtml(wizardData.citta) + '" onchange="wizardData.citta=this.value" /></div>';
  html += '<div class="wiz-field"><div class="wiz-label">Email</div><input class="wiz-input" type="email" value="' + escHtml(wizardData.email_studio) + '" onchange="wizardData.email_studio=this.value" /></div>';
  html += '</div>';
  html += '<label style="font-size:.8rem;display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer"><input type="checkbox" ' + (wizardData.salva_cliente ? "checked" : "") + ' onchange="wizardData.salva_cliente=this.checked" /> Salva in Anagrafica Clienti</label>';
  html += '</div>';
  html += '<div class="fjb mt16">';
  html += '<button class="btn btn-sec" onclick="wizardStep=1;renderView()"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> Indietro</button>';
  html += '<button class="btn btn-primary" onclick="wizGoStep3()">Avanti <i data-lucide="arrow-right" style="width:14px;height:14px"></i></button>';
  html += '</div>';
  return html;
}

function wizSelectCliente(cid, nome, via, cap, citta, email) {
  wizardData.nome_studio = nome;
  wizardData.via = via;
  wizardData.cap = cap;
  wizardData.citta = citta;
  wizardData.email_studio = email;
  wizardStep = 2;
  renderView();
}

function wizGoStep3() {
  // read current inputs
  var inputs = document.querySelectorAll(".wiz-input");
  if (inputs.length >= 1) wizardData.nome_studio = inputs[0].value;
  if (inputs.length >= 2) wizardData.via = inputs[1].value;
  if (inputs.length >= 3) wizardData.cap = inputs[2].value;
  if (inputs.length >= 4) wizardData.citta = inputs[3].value;
  if (inputs.length >= 5) wizardData.email_studio = inputs[4].value;
  if (!wizardData.nome_studio) {
    showModal("Campo Obbligatorio", "Il nome studio \u00e8 obbligatorio.", [{ label: "Ok", cls: "btn btn-primary", action: "closeModal()" }]);
    return;
  }
  wizardStep = 3;
  renderView();
}

function renderWizStep3() {
  var html = '<div class="wiz-section"><div class="wiz-section-title">Dati Economici</div>';
  html += '<div class="wiz-field"><div class="wiz-label">Centralizzazione</div>';
  html += '<div class="pill-toggle">';
  html += '<button class="pill-opt ' + (wizardData.modalita === "vendita" ? "on" : "") + '" onclick="wizardData.modalita=\'vendita\';renderView()">Vendita</button>';
  html += '<button class="pill-opt ' + (wizardData.modalita === "comodato" ? "on" : "") + '" onclick="wizardData.modalita=\'comodato\';renderView()">Comodato d\'Uso</button>';
  html += '</div></div>';
  html += '<div class="wiz-row">';
  html += '<div class="wiz-field"><div class="wiz-label">Prezzo Fornitura cad. \u20ac *</div><input class="wiz-input" type="number" step="0.01" id="wiz-pf" value="' + (wizardData.prezzo_fornitura || "") + '" oninput="wizardData.prezzo_fornitura=this.value;wizUpdateSummary()" /></div>';
  html += '<div class="wiz-field"><div class="wiz-label">Ulteria Care cad/anno \u20ac *</div><input class="wiz-input" type="number" step="0.01" id="wiz-pc" value="' + (wizardData.prezzo_care || "") + '" oninput="wizardData.prezzo_care=this.value;wizUpdateSummary()" /></div>';
  html += '</div>';
  html += '<div class="wiz-field"><div class="wiz-label">Canone Lettura cad/anno \u20ac *</div><input class="wiz-input" type="number" step="0.01" id="wiz-cl" value="' + (wizardData.canone_lettura || "") + '" oninput="wizardData.canone_lettura=this.value;wizUpdateSummary()" /></div>';
  html += '<div class="wiz-field"><div class="wiz-label">Note</div><textarea class="wiz-input" rows="3" oninput="wizardData.note=this.value">' + escHtml(wizardData.note || "") + '</textarea></div>';
  html += '</div>';

  // Summary card
  html += '<div class="card mb20" id="wiz-summary">';
  html += '<div class="sec-ttl">Riepilogo Offerta</div>';
  html += '<div class="wiz-summary">';
  html += '<div class="wiz-summary-row"><span class="wiz-summary-label">Template</span><span class="wiz-summary-val">' + (wizardData.template === "E40" ? "E-ITN40" : "Q5.5") + '</span></div>';
  html += '<div class="wiz-summary-row"><span class="wiz-summary-label">Studio</span><span class="wiz-summary-val">' + escHtml(wizardData.nome_studio) + '</span></div>';
  html += '<div class="wiz-summary-row"><span class="wiz-summary-label">Modalit\u00e0</span><span class="wiz-summary-val">' + (wizardData.modalita === "comodato" ? "Comodato d'Uso" : "Vendita") + '</span></div>';
  html += wizSummaryPrices();
  html += '</div>';
  html += '<div style="font-size:.7rem;color:var(--muted);margin-top:8px;text-align:center">Prezzi unitari \u2014 offerta accordo quadro senza quantit\u00e0 definita</div>';
  html += '</div>';

  html += '<div class="fjb">';
  html += '<button class="btn btn-sec" onclick="wizardStep=2;renderView()"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> Indietro</button>';
  html += '<button class="btn btn-primary" style="padding:10px 28px;font-size:.9rem" onclick="wizGenera()"><i data-lucide="zap" style="width:16px;height:16px"></i> Genera Offerta</button>';
  html += '</div>';

  // Result area
  html += '<div id="wiz-result" class="mt16"></div>';
  return html;
}

function wizSummaryPrices() {
  var pf = parseFloat(wizardData.prezzo_fornitura) || 0;
  var pc = parseFloat(wizardData.prezzo_care) || 0;
  var cl = parseFloat(wizardData.canone_lettura) || 0;
  var tot = pf + pc + cl;
  var html = '';
  html += '<div class="wiz-summary-row"><span class="wiz-summary-label">Fornitura cad.</span><span class="wiz-summary-val">\u20ac ' + pf.toFixed(2).replace(".", ",") + '</span></div>';
  html += '<div class="wiz-summary-row"><span class="wiz-summary-label">Ulteria Care cad/anno</span><span class="wiz-summary-val">\u20ac ' + pc.toFixed(2).replace(".", ",") + '</span></div>';
  html += '<div class="wiz-summary-row"><span class="wiz-summary-label">Canone Lettura cad/anno</span><span class="wiz-summary-val">\u20ac ' + cl.toFixed(2).replace(".", ",") + '</span></div>';
  html += '<div class="wiz-summary-row" style="border-top:2px solid var(--border);margin-top:4px;padding-top:6px"><span class="wiz-summary-label" style="font-weight:700">Totale Unitario</span><span class="wiz-summary-val" style="color:var(--blue);font-size:1rem">\u20ac ' + tot.toFixed(2).replace(".", ",") + '</span></div>';
  return html;
}

function wizUpdateSummary() {
  var container = document.getElementById("wiz-summary");
  if (!container) return;
  var inner = container.querySelector(".wiz-summary");
  if (!inner) return;
  // update only price rows
  var rows = inner.querySelectorAll(".wiz-summary-row");
  // rebuild from template row onward
  var pf = parseFloat(wizardData.prezzo_fornitura) || 0;
  var pc = parseFloat(wizardData.prezzo_care) || 0;
  var cl = parseFloat(wizardData.canone_lettura) || 0;
  var tot = pf + pc + cl;
  // Quick update by finding val spans
  var vals = inner.querySelectorAll(".wiz-summary-val");
  if (vals.length >= 7) {
    vals[3].textContent = "\u20ac " + pf.toFixed(2).replace(".", ",");
    vals[4].textContent = "\u20ac " + pc.toFixed(2).replace(".", ",");
    vals[5].textContent = "\u20ac " + cl.toFixed(2).replace(".", ",");
    vals[6].textContent = "\u20ac " + tot.toFixed(2).replace(".", ",");
  }
}

function wizGenera() {
  if (!wizardData.prezzo_fornitura || !wizardData.prezzo_care || !wizardData.canone_lettura) {
    showModal("Campi Obbligatori", "Compila tutti i campi economici obbligatori.", [{ label: "Ok", cls: "btn btn-primary", action: "closeModal()" }]);
    return;
  }

  var pf = parseFloat(wizardData.prezzo_fornitura) || 0;
  var pc = parseFloat(wizardData.prezzo_care) || 0;
  var cl = parseFloat(wizardData.canone_lettura) || 0;
  var tot = pf + pc + cl;

  // Save client if requested
  if (wizardData.salva_cliente) {
    api("POST", "/api/clienti", {
      nome_studio: wizardData.nome_studio,
      via: wizardData.via,
      cap: wizardData.cap,
      citta: wizardData.citta,
      email: wizardData.email_studio
    });
  }

  // Create offerta then genera
  api("POST", "/api/offerte", {
    nome_studio: wizardData.nome_studio,
    via: wizardData.via,
    cap: wizardData.cap,
    citta: wizardData.citta,
    email_studio: wizardData.email_studio,
    template: wizardData.template,
    riferimento: "Accordo Quadro " + (wizardData.template === "E40" ? "E-ITN40" : "Q5.5"),
    prezzo_fornitura: pf,
    prezzo_care: pc,
    canone_lettura: cl,
    modalita: wizardData.modalita,
    totale: tot,
    note: wizardData.note
  }).then(function(offerta) {
    return api("POST", "/api/genera", { id: offerta.id });
  }).then(function(res) {
    var rd = document.getElementById("wiz-result");
    if (!rd) return;
    if (res.ok) {
      var h = '<div class="alert a-ok mb12"><i data-lucide="check-circle" style="width:18px;height:18px;flex-shrink:0"></i><div>';
      h += '<strong>Offerta N\u00b0 ' + res.numero + ' generata con successo</strong>';
      if (res.pdf_error) h += '<br><span class="badge b-orange" style="margin-top:4px">Pdf non disponibile \u2014 Word non installato</span>';
      h += '</div></div>';
      h += '<div class="fac gap8">';
      h += '<button class="btn btn-primary" onclick="apriFile(\'' + res.docx_url + '\')"><i data-lucide="file-text" style="width:14px;height:14px"></i> Apri Docx</button>';
      if (res.pdf_url) h += '<button class="btn btn-pdf" onclick="apriFile(\'' + res.pdf_url + '\')"><i data-lucide="file" style="width:14px;height:14px"></i> Apri Pdf</button>';

      var email = wizardData.email_studio || "";
      var subj = encodeURIComponent("Proposta N\u00b0 " + res.numero + " \u2014 Ulteria S.r.l.");
      var body = encodeURIComponent("Gentilissimi,\n\nin allegato la nostra proposta N\u00b0 " + res.numero + " relativa alla fornitura e installazione di ripartitori di calore.\n\nRestiamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nUlteria S.r.l.");
      h += '<a class="btn btn-sec" href="mailto:' + email + '?subject=' + subj + '&body=' + body + '"><i data-lucide="mail" style="width:14px;height:14px"></i> Prepara Email Outlook</a>';
      h += '</div>';
      rd.innerHTML = h;
      lucide.createIcons();

      // Reset wizard
      wizardData = { template: "", nome_studio: "", via: "", cap: "", citta: "", email_studio: "", modalita: "vendita", prezzo_fornitura: "", prezzo_care: "", canone_lettura: "", note: "", salva_cliente: false };
      wizardStep = 1;
    } else {
      rd.innerHTML = '<div class="alert a-warn">' + (res.error || "Errore") + '</div>';
    }
  }).catch(function(err) {
    var rd = document.getElementById("wiz-result");
    if (rd) rd.innerHTML = '<div class="alert a-warn">Errore: ' + err.message + '</div>';
  });
}


// ═══════════════════════════════════════════════════════════
// ANAGRAFICA CLIENTI
// ═══════════════════════════════════════════════════════════

function renderClienti(container) {
  clientDetail = null;
  api("GET", "/api/clienti").then(function(data) {
    clienti = data;
    buildClienti(container);
    lucide.createIcons();
  });
}

function buildClienti(container) {
  var html = '<div class="fjb mb16">';
  html += '<div><div class="kicker">Gestione</div><div class="page-title">Anagrafica Clienti</div></div>';
  html += '<button class="btn btn-primary" onclick="showNuovoCliente()"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Cliente</button>';
  html += '</div>';

  html += '<div id="nuovo-cliente-form"></div>';

  html += '<div class="card-0"><div class="scx"><table class="tbl"><thead><tr>';
  html += '<th>Nome Studio</th><th>Referente</th><th>Citt\u00e0</th><th>Email</th><th>Telefono</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';

  if (clienti.length === 0) {
    html += '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">Nessun cliente in anagrafica</td></tr>';
  }

  clienti.forEach(function(c) {
    html += '<tr style="cursor:pointer" onclick="loadClienteDetail(' + c.id + ')">';
    html += '<td><strong>' + escHtml(c.nome_studio) + '</strong></td>';
    html += '<td>' + escHtml(c.referente || "") + '</td>';
    html += '<td>' + escHtml(c.citta || "") + '</td>';
    html += '<td>' + escHtml(c.email || "") + '</td>';
    html += '<td>' + escHtml(c.telefono || "") + '</td>';
    html += '<td><button class="btn btn-sm btn-sec" onclick="event.stopPropagation();nuovaOffertaPerCliente(' + c.id + ',\'' + escHtml(c.nome_studio).replace(/'/g, "\\'") + '\',\'' + escHtml(c.via || "").replace(/'/g, "\\'") + '\',\'' + escHtml(c.cap || "").replace(/'/g, "\\'") + '\',\'' + escHtml(c.citta || "").replace(/'/g, "\\'") + '\',\'' + escHtml(c.email || "").replace(/'/g, "\\'") + '\')"><i data-lucide="file-plus" style="width:12px;height:12px"></i> Nuova Offerta</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div></div>';
  html += '<div id="cliente-detail-area"></div>';
  container.innerHTML = html;
  lucide.createIcons();
}

function showNuovoCliente() {
  var area = document.getElementById("nuovo-cliente-form");
  if (!area) return;
  area.innerHTML = '<div class="card mb16">' +
    '<div class="fjb mb12"><strong style="font-size:.9rem">Nuovo Cliente</strong><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'nuovo-cliente-form\').innerHTML=\'\'"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>' +
    '<div class="form-grid">' +
    '<div class="form-field"><label>Nome Studio *</label><input class="inp" id="nc-nome" /></div>' +
    '<div class="form-field"><label>Referente</label><input class="inp" id="nc-ref" /></div>' +
    '<div class="form-field"><label>Via</label><input class="inp" id="nc-via" /></div>' +
    '<div class="form-field"><label>Cap</label><input class="inp" id="nc-cap" /></div>' +
    '<div class="form-field"><label>Citt\u00e0 *</label><input class="inp" id="nc-citta" /></div>' +
    '<div class="form-field"><label>Email *</label><input class="inp" id="nc-email" type="email" /></div>' +
    '<div class="form-field"><label>Telefono</label><input class="inp" id="nc-tel" /></div>' +
    '<div class="form-field full"><label>Note</label><textarea class="inp" id="nc-note" rows="2"></textarea></div>' +
    '</div>' +
    '<div class="fac gap8 mt12"><button class="btn btn-primary" onclick="salvaCliente()">Salva</button><button class="btn btn-sec" onclick="document.getElementById(\'nuovo-cliente-form\').innerHTML=\'\'">Annulla</button></div>' +
    '</div>';
  lucide.createIcons();
}

function salvaCliente() {
  var nome = document.getElementById("nc-nome").value;
  if (!nome) { showModal("Errore", "Nome studio obbligatorio", [{ label: "Ok", cls: "btn btn-primary", action: "closeModal()" }]); return; }
  api("POST", "/api/clienti", {
    nome_studio: nome,
    referente: document.getElementById("nc-ref").value,
    via: document.getElementById("nc-via").value,
    cap: document.getElementById("nc-cap").value,
    citta: document.getElementById("nc-citta").value,
    email: document.getElementById("nc-email").value,
    telefono: document.getElementById("nc-tel").value,
    note: document.getElementById("nc-note").value
  }).then(function() {
    renderClienti(document.getElementById("content"));
  });
}

function loadClienteDetail(cid) {
  api("GET", "/api/clienti/" + cid).then(function(data) {
    var area = document.getElementById("cliente-detail-area");
    if (!area) return;
    var c = data.cliente;
    var offs = data.offerte;
    var html = '<div class="client-detail mt16">';
    html += '<div class="fjb mb12"><strong style="font-size:1rem">' + escHtml(c.nome_studio) + '</strong><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'cliente-detail-area\').innerHTML=\'\'"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    html += '<div class="form-grid mb16">';
    html += '<div class="form-field"><label>Via</label><input class="inp" value="' + escHtml(c.via || "") + '" onchange="updateCliente(' + cid + ',\'via\',this.value)" /></div>';
    html += '<div class="form-field"><label>Cap</label><input class="inp" value="' + escHtml(c.cap || "") + '" onchange="updateCliente(' + cid + ',\'cap\',this.value)" /></div>';
    html += '<div class="form-field"><label>Citt\u00e0</label><input class="inp" value="' + escHtml(c.citta || "") + '" onchange="updateCliente(' + cid + ',\'citta\',this.value)" /></div>';
    html += '<div class="form-field"><label>Email</label><input class="inp" value="' + escHtml(c.email || "") + '" onchange="updateCliente(' + cid + ',\'email\',this.value)" /></div>';
    html += '<div class="form-field"><label>Telefono</label><input class="inp" value="' + escHtml(c.telefono || "") + '" onchange="updateCliente(' + cid + ',\'telefono\',this.value)" /></div>';
    html += '<div class="form-field"><label>Referente</label><input class="inp" value="' + escHtml(c.referente || "") + '" onchange="updateCliente(' + cid + ',\'referente\',this.value)" /></div>';
    html += '</div>';

    html += '<div class="sec-ttl">Storico Offerte (' + offs.length + ')</div>';
    if (offs.length > 0) {
      html += '<table class="tbl"><thead><tr><th>N\u00b0</th><th>Riferimento</th><th>Totale</th><th>Stato</th><th>Data</th></tr></thead><tbody>';
      offs.forEach(function(o) {
        var si = statoInfo(o.stato);
        html += '<tr><td class="mono">' + (o.numero || "\u2014") + '</td><td>' + escHtml(o.riferimento || "") + '</td><td class="num">' + fmt(o.totale) + '</td><td><span class="stato-badge ' + si.cls + '">' + si.label + '</span></td><td>' + fmtData(o.data_creazione) + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div style="color:var(--muted);font-size:.82rem;padding:12px 0">Nessuna offerta per questo cliente</div>';
    }
    html += '</div>';
    area.innerHTML = html;
    lucide.createIcons();
  });
}

function updateCliente(cid, field, val) {
  var data = {};
  data[field] = val;
  api("PUT", "/api/clienti/" + cid, data);
}

function nuovaOffertaPerCliente(cid, nome, via, cap, citta, email) {
  wizardData.nome_studio = nome;
  wizardData.via = via;
  wizardData.cap = cap;
  wizardData.citta = citta;
  wizardData.email_studio = email;
  wizardStep = 1;
  navigate("nuova");
}


// ═══════════════════════════════════════════════════════════
// IMPOSTAZIONI
// ═══════════════════════════════════════════════════════════

function renderImpostazioni(container) {
  api("GET", "/api/config").then(function(cfg) {
    var html = '<div class="kicker">Sistema</div><div class="page-title mb20">Impostazioni</div>';
    html += '<div class="g2">';

    html += '<div class="card"><div class="sec-ttl">Prossimo Numero Offerta</div>';
    html += '<div class="fac gap8"><input class="inp" type="number" id="cfg-num" value="' + cfg.prossimo_numero + '" style="width:140px" />';
    html += '<button class="btn btn-primary btn-sm" onclick="salvaProssimoNumero()">Salva</button></div></div>';

    html += '<div class="card"><div class="sec-ttl">Info Applicazione</div>';
    html += '<div style="font-size:.82rem;color:var(--mid)">';
    html += '<div class="mb8"><strong>Versione:</strong> 1.0.0</div>';
    html += '<div><strong>Offerte generate:</strong> ' + (cfg.totale_offerte_generate || 0) + '</div>';
    html += '</div></div>';

    html += '</div>';
    container.innerHTML = html;
    lucide.createIcons();
  });
}

function salvaProssimoNumero() {
  var val = document.getElementById("cfg-num").value;
  api("POST", "/api/config", { prossimo_numero: parseInt(val) }).then(function() {
    showModal("Salvato", "Prossimo numero aggiornato a " + val, [{ label: "Ok", cls: "btn btn-primary", action: "closeModal()" }]);
  });
}


// ─── INIT ───
document.addEventListener("DOMContentLoaded", function() {
  lucide.createIcons();
  renderView();
});
