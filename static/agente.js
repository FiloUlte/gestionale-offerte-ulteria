/* ══════════════════════════════════════════════════════════════
   Ulteria — Pagina Dashboard Agente /agenti/<id>
   ══════════════════════════════════════════════════════════════ */

var agData = null; // { agente, offerte, attivita, clienti, stats }
var pipelineFilter = "tutte";
var attivitaFilter = "aperte";

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

function esc(s) {
  if (!s) return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function fmtData(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("it-IT");
}

function fmtDataShort(d) {
  if (!d) return "";
  var dt = new Date(d);
  var mesi = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  return dt.getDate() + " " + mesi[dt.getMonth()];
}

function fmtEur(val) {
  if (val === null || val === undefined) return "\u2014";
  var n = parseFloat(val);
  if (isNaN(n)) return "\u2014";
  return "\u20ac " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMese(ym) {
  if (!ym) return "";
  var parts = ym.split("-");
  var mesi = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  return mesi[parseInt(parts[1]) - 1] + " " + parts[0];
}

function icons() {
  try { lucide.createIcons(); } catch (e) { /* */ }
}

function daysDiff(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((now - d) / 86400000);
}

var TIPO_ICONS = {
  chiamata: "phone",
  email: "mail",
  visita: "building-2",
  assemblea: "users",
  todo: "check-square",
  altro: "clipboard-list"
};

var TIPO_LABELS = {
  chiamata: "Chiamata",
  email: "Email",
  visita: "Visita",
  assemblea: "Assemblea",
  todo: "To-Do",
  altro: "Altro"
};

var STATI_MAP = {
  richiamato: { label: "Richiamato", cls: "stato-richiamato" },
  in_attesa_assemblea: { label: "In Attesa Assemblea", cls: "stato-in_attesa_assemblea" },
  preso_lavoro: { label: "Preso Lavoro", cls: "stato-preso_lavoro" },
  perso: { label: "Perso", cls: "stato-perso" },
  rimandato: { label: "Rimandato", cls: "stato-rimandato" }
};

function statoLabel(val) {
  var s = STATI_MAP[val];
  return s ? s.label : val;
}

function statoCls(val) {
  var s = STATI_MAP[val];
  return s ? s.cls : "";
}


/* ─── LOAD ─── */

function loadPage() {
  api("GET", "/api/agenti/" + AGENTE_ID + "/dashboard").then(function(data) {
    agData = data;
    renderPage();
  }).catch(function(e) {
    document.getElementById("agent-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderPage() {
  var a = agData.agente;
  var col = a.colore || "#009FE3";
  var ini = (a.nome || " ")[0].toUpperCase() + (a.cognome || " ")[0].toUpperCase();
  var h = "";

  /* Header */
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none" id="back-link"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Agenti</a></div>';
  h += '<div class="bc mb12" style="font-size:.75rem;color:var(--muted)"><i data-lucide="home" style="width:12px;height:12px"></i> <span class="bc-sep">/</span> Agenti <span class="bc-sep">/</span> <strong style="color:var(--text)">' + esc(a.nome + " " + a.cognome) + "</strong></div>";
  h += '<div class="agent-header">';
  h += '<div class="agent-avatar-lg" style="background:' + col + '">' + ini + "</div>";
  h += '<div class="agent-meta"><h2>' + esc(a.nome + " " + a.cognome) + "</h2>";
  h += '<div class="agent-meta-sub">' + esc(a.email || "Nessuna email") + ' &middot; <span class="badge b-blue">Agente</span></div></div>';
  h += '<button class="btn btn-sec btn-sm" id="btn-edit-profile"><i data-lucide="edit" style="width:14px;height:14px"></i> Modifica Profilo</button>';
  h += "</div>";

  /* KPI */
  h += renderKpi();

  /* Pipeline */
  h += renderPipeline();

  /* Attivita */
  h += renderAttivita();

  /* Clienti affidati */
  h += renderClienti();

  /* Stats */
  h += renderStats();

  document.getElementById("agent-page").innerHTML = h;
  icons();
  attachEvents();
}


/* ─── KPI ─── */

function renderKpi() {
  var offs = agData.offerte;
  var totali = offs.length;
  var prese = 0, perse = 0, valPreso = 0, valProspect = 0;
  offs.forEach(function(o) {
    var imp = (o.prezzo_fornitura || 0) + (o.prezzo_care || 0) + (o.canone_lettura || 0);
    if (o.stato === "preso_lavoro") { prese++; valPreso += imp; }
    if (o.stato === "perso") perse++;
    if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") valProspect += imp;
  });
  var tasso = totali > 0 ? (prese / totali * 100).toFixed(1) + "%" : "\u2014";

  var h = '<div class="g3 mb12">';
  h += '<div class="kpi"><div class="kpi-l">Offerte Totali</div><div class="kpi-v kv-blue">' + totali + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Lavori Presi</div><div class="kpi-v" style="color:#639922">' + prese + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Offerte Perse</div><div class="kpi-v" style="color:#E24B4A">' + perse + "</div></div>";
  h += "</div>";
  h += '<div class="g3 mb20">';
  h += '<div class="kpi"><div class="kpi-l">Valore Preso</div><div class="kpi-v" style="color:#639922">' + fmtEur(valPreso) + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Valore Prospect</div><div class="kpi-v kv-orange">' + fmtEur(valProspect) + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Tasso Conversione</div><div class="kpi-v kv-blue">' + tasso + "</div></div>";
  h += "</div>";
  return h;
}


/* ─── PIPELINE ─── */

function renderPipeline() {
  var tabs = ["tutte", "in_attesa_assemblea", "richiamato", "preso_lavoro", "perso", "rimandato"];
  var labels = ["Tutte", "In Attesa Assemblea", "Richiamato", "Preso", "Perso", "Rimandato"];

  var h = '<div class="section-header"><h3>La mia Pipeline</h3></div>';
  h += '<div class="card-0">';
  h += '<div class="tabs-bar">';
  for (var i = 0; i < tabs.length; i++) {
    h += '<button class="tab-btn' + (pipelineFilter === tabs[i] ? " on" : "") + '" data-pipe-tab="' + tabs[i] + '">' + labels[i] + "</button>";
  }
  h += "</div>";

  var filtered = agData.offerte.filter(function(o) {
    return pipelineFilter === "tutte" || o.stato === pipelineFilter;
  });

  h += '<table class="tbl"><thead><tr><th>N.</th><th>Cliente / Condominio</th><th>Template</th><th>Importo</th><th>Stato</th><th>Giorni</th><th></th></tr></thead><tbody>';
  if (filtered.length === 0) {
    h += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">Nessuna offerta</td></tr>';
  }
  var valTot = 0;
  filtered.forEach(function(o) {
    var imp = (o.prezzo_fornitura || 0) + (o.prezzo_care || 0) + (o.canone_lettura || 0);
    valTot += imp;
    var si = STATI_MAP[o.stato] || {};
    var isOpen = o.stato !== "preso_lavoro" && o.stato !== "perso";
    var giorni = "";
    if (isOpen && o.data_creazione) {
      var gg = daysDiff(o.data_creazione);
      var gcls = gg < 14 ? "giorni-verde" : (gg <= 30 ? "giorni-arancione" : "giorni-rosso");
      giorni = '<span class="giorni-badge ' + gcls + '">' + gg + " gg</span>";
    } else {
      giorni = "\u2014";
    }

    h += "<tr>";
    h += '<td class="mono">' + (o.numero || "\u2014") + "</td>";
    h += "<td><strong>" + esc(o.nome_studio || "") + "</strong>";
    if (o.nome_condominio) h += '<br><span style="font-size:.72rem;color:var(--muted)">' + esc(o.nome_condominio) + "</span>";
    h += "</td>";
    h += "<td>" + esc(o.template === "E40" ? "E-ITN40" : (o.template === "Q55" ? "Q5.5" : (o.template || ""))) + "</td>";
    h += '<td class="num">' + fmtEur(imp) + "</td>";
    h += '<td><span class="stato-badge ' + (si.cls || "") + '">' + (si.label || o.stato) + "</span></td>";
    h += "<td>" + giorni + "</td>";
    h += '<td><a href="/" style="color:var(--blue)"><i data-lucide="eye" style="width:14px;height:14px"></i></a></td>';
    h += "</tr>";
  });
  h += "</tbody></table>";
  h += '<div class="pipeline-total">Valore pipeline visualizzata: ' + fmtEur(valTot) + "</div>";
  h += "</div>";
  return h;
}


/* ─── ATTIVITA ─── */

function renderAttivita() {
  var tabs = ["aperte", "completate", "tutte"];
  var labels = ["Aperte", "Completate", "Tutte"];

  var h = '<div class="section-header"><h3>Attivit&agrave; e To-Do</h3>';
  h += '<button class="btn btn-primary btn-sm" id="btn-new-att"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuova Attivit&agrave;</button></div>';
  h += '<div class="card-0">';
  h += '<div class="tabs-bar">';
  for (var i = 0; i < tabs.length; i++) {
    h += '<button class="tab-btn' + (attivitaFilter === tabs[i] ? " on" : "") + '" data-att-tab="' + tabs[i] + '">' + labels[i] + "</button>";
  }
  h += "</div>";

  var filtered = agData.attivita.filter(function(a) {
    if (attivitaFilter === "aperte") return a.stato === "aperta";
    if (attivitaFilter === "completate") return a.stato === "completata";
    return true;
  });

  if (filtered.length === 0) {
    h += '<div style="padding:24px;text-align:center;color:var(--muted)">Nessuna attivit&agrave;</div>';
  }

  filtered.forEach(function(att) {
    var isComp = att.stato === "completata";
    var iconName = TIPO_ICONS[att.tipo] || "clipboard-list";
    var prioCls = "att-prio-" + (att.priorita || "media");

    // Due date badge
    var dueBadge = "";
    if (att.data_scadenza && !isComp) {
      var gg = daysDiff(att.data_scadenza);
      if (gg > 0) dueBadge = '<span class="att-due att-due-scaduta">Scaduta da ' + gg + " gg</span>";
      else if (gg === 0) dueBadge = '<span class="att-due att-due-oggi">Oggi</span>';
      else if (gg === -1) dueBadge = '<span class="att-due att-due-domani">Domani</span>';
      else dueBadge = '<span class="att-due att-due-futura">' + fmtDataShort(att.data_scadenza) + "</span>";
    }

    h += '<div class="att-row' + (isComp ? " att-completed" : "") + '" data-att-id="' + att.id + '">';
    h += '<div class="att-prio ' + prioCls + '"></div>';
    h += '<div class="att-icon"><i data-lucide="' + iconName + '" style="width:16px;height:16px"></i></div>';
    h += '<div class="att-body"><div class="att-title">' + esc(att.titolo) + "</div>";
    if (att.cliente_nome) h += '<div class="att-link">' + esc(att.cliente_nome) + "</div>";
    h += "</div>";
    h += dueBadge;
    h += '<div class="att-actions">';
    if (!isComp) h += '<button class="att-btn att-btn-ok" data-complete-att="' + att.id + '">&#10003;</button>';
    h += '<button class="att-btn att-btn-edit" data-edit-att="' + att.id + '"><i data-lucide="edit-2" style="width:12px;height:12px"></i></button>';
    h += '<button class="att-btn att-btn-del" data-del-att="' + att.id + '"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>';
    h += "</div></div>";
  });

  h += "</div>";
  return h;
}


/* ─── CLIENTI AFFIDATI ─── */

function renderClienti() {
  var cls = agData.clienti;
  var attivi = 0, prospect = 0;
  cls.forEach(function() { prospect++; }); // Simple count for now

  var h = '<div class="section-header"><h3>Clienti Affidati</h3></div>';
  h += '<div class="counter-text">' + cls.length + " clienti affidati</div>";
  h += '<div class="card-0"><table class="tbl"><thead><tr><th>Nome Studio</th><th>Citta</th><th>N. Offerte</th><th>Ultimo Contatto</th><th></th></tr></thead><tbody>';

  if (cls.length === 0) {
    h += '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted)">Nessun cliente</td></tr>';
  }
  cls.forEach(function(c) {
    h += "<tr>";
    h += "<td><strong>" + esc(c.nome_studio) + "</strong></td>";
    h += "<td>" + esc(c.citta || "") + "</td>";
    h += "<td>" + (c.num_offerte || 0) + "</td>";
    h += "<td>" + fmtData(c.ultimo_contatto) + "</td>";
    h += '<td><a href="/" style="color:var(--blue);font-size:.78rem">Apri scheda &rarr;</a></td>';
    h += "</tr>";
  });

  h += "</tbody></table></div>";
  return h;
}


/* ─── STATS MENSILI ─── */

function renderStats() {
  var stats = agData.stats;
  var h = '<div class="section-header"><h3>Andamento ultimi 6 mesi</h3></div>';
  h += '<div class="card-0"><table class="tbl"><thead><tr><th>Mese</th><th>Inviate</th><th>Prese</th><th>Perse</th><th>Tasso %</th></tr></thead><tbody>';

  if (stats.length === 0) {
    h += '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted)">Nessun dato</td></tr>';
  }
  stats.forEach(function(s) {
    var tasso = s.inviate > 0 ? (s.prese / s.inviate * 100).toFixed(0) + "%" : "\u2014";
    h += "<tr>";
    h += "<td><strong>" + fmtMese(s.mese) + "</strong></td>";
    h += "<td>" + s.inviate + "</td>";
    h += '<td style="color:#639922;font-weight:700">' + s.prese + "</td>";
    h += '<td style="color:#E24B4A;font-weight:700">' + s.perse + "</td>";
    h += "<td>" + tasso + "</td>";
    h += "</tr>";
  });

  h += "</tbody></table></div>";
  return h;
}


/* ─── EVENTS ─── */

function attachEvents() {
  /* Back link */
  var backLink = document.getElementById("back-link");
  if (backLink) {
    backLink.addEventListener("click", function(e) {
      e.preventDefault();
      window.location.href = "/";
    });
  }

  /* Pipeline tabs */
  document.querySelectorAll("[data-pipe-tab]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      pipelineFilter = this.getAttribute("data-pipe-tab");
      renderPage();
    });
  });

  /* Attivita tabs */
  document.querySelectorAll("[data-att-tab]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      attivitaFilter = this.getAttribute("data-att-tab");
      renderPage();
    });
  });

  /* Complete attivita */
  document.querySelectorAll("[data-complete-att]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = parseInt(this.getAttribute("data-complete-att"));
      api("PATCH", "/api/attivita/" + id + "/completa").then(function() { loadPage(); });
    });
  });

  /* Delete attivita */
  document.querySelectorAll("[data-del-att]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = parseInt(this.getAttribute("data-del-att"));
      if (confirm("Eliminare questa attivit\u00e0?")) {
        api("DELETE", "/api/attivita/" + id).then(function() { loadPage(); });
      }
    });
  });

  /* Edit attivita */
  document.querySelectorAll("[data-edit-att]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var id = parseInt(this.getAttribute("data-edit-att"));
      var att = null;
      for (var i = 0; i < agData.attivita.length; i++) {
        if (agData.attivita[i].id === id) { att = agData.attivita[i]; break; }
      }
      if (att) showAttModal(att);
    });
  });

  /* New attivita */
  var btnNew = document.getElementById("btn-new-att");
  if (btnNew) {
    btnNew.addEventListener("click", function() {
      showAttModal(null);
    });
  }
}


/* ─── ATTIVITA MODAL ─── */

function showAttModal(existing) {
  closeAttModal();
  var isEdit = !!existing;

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.id = "att-modal-overlay";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) closeAttModal(); });

  var modal = document.createElement("div");
  modal.className = "modal";
  modal.style.width = "560px";

  var header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = "<h2>" + (isEdit ? "Modifica Attivit\u00e0" : "Nuova Attivit\u00e0") + "</h2>";
  var closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-ghost btn-sm";
  closeBtn.innerHTML = '<i data-lucide="x" style="width:16px;height:16px"></i>';
  closeBtn.addEventListener("click", closeAttModal);
  header.appendChild(closeBtn);

  var body = document.createElement("div");
  body.className = "modal-body";
  var bh = "";
  bh += '<div class="form-grid">';
  bh += '<div class="form-field"><label>Tipo</label><select class="inp" id="att-tipo">';
  var tipi = ["chiamata", "email", "visita", "assemblea", "todo", "altro"];
  tipi.forEach(function(t) {
    bh += '<option value="' + t + '"' + (existing && existing.tipo === t ? " selected" : "") + ">" + (TIPO_LABELS[t] || t) + "</option>";
  });
  bh += "</select></div>";
  bh += '<div class="form-field"><label>Priorita</label><select class="inp" id="att-prio">';
  bh += '<option value="alta"' + (existing && existing.priorita === "alta" ? " selected" : "") + ">Alta</option>";
  bh += '<option value="media"' + (!existing || existing.priorita === "media" ? " selected" : "") + ">Media</option>";
  bh += '<option value="bassa"' + (existing && existing.priorita === "bassa" ? " selected" : "") + ">Bassa</option>";
  bh += "</select></div>";
  bh += '<div class="form-field full"><label>Titolo *</label><input class="inp" id="att-titolo" value="' + esc(existing ? existing.titolo : "") + '" /></div>';
  bh += '<div class="form-field full"><label>Descrizione</label><textarea class="inp" id="att-desc" rows="2">' + esc(existing ? existing.descrizione || "" : "") + "</textarea></div>";
  bh += '<div class="form-field"><label>Scadenza</label><input class="inp" type="datetime-local" id="att-scadenza" value="' + (existing && existing.data_scadenza ? existing.data_scadenza.replace(" ", "T").substring(0, 16) : "") + '" /></div>';
  bh += '<div class="form-field"><label>Cliente (cerca)</label><input class="inp" id="att-cliente-search" placeholder="Cerca cliente..." value="" /><input type="hidden" id="att-cliente-id" value="' + (existing && existing.cliente_id ? existing.cliente_id : "") + '" /><div class="ac-list" id="att-ac" style="position:relative"></div></div>';
  bh += "</div>";
  body.innerHTML = bh;

  var footer = document.createElement("div");
  footer.className = "modal-footer";
  var cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-sec";
  cancelBtn.textContent = "Annulla";
  cancelBtn.addEventListener("click", closeAttModal);
  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = isEdit ? "Salva" : "Crea";
  saveBtn.addEventListener("click", function() {
    var titolo = document.getElementById("att-titolo").value;
    if (!titolo) { alert("Titolo obbligatorio"); return; }
    var payload = {
      agente_id: AGENTE_ID,
      tipo: document.getElementById("att-tipo").value,
      titolo: titolo,
      descrizione: document.getElementById("att-desc").value,
      data_scadenza: document.getElementById("att-scadenza").value ? document.getElementById("att-scadenza").value.replace("T", " ") + ":00" : null,
      priorita: document.getElementById("att-prio").value,
      cliente_id: document.getElementById("att-cliente-id").value ? parseInt(document.getElementById("att-cliente-id").value) : null
    };
    var method = isEdit ? "PATCH" : "POST";
    var url = isEdit ? "/api/attivita/" + existing.id : "/api/attivita";
    api(method, url, payload).then(function() {
      closeAttModal();
      loadPage();
    });
  });
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  icons();

  /* Cliente autocomplete */
  var searchInp = document.getElementById("att-cliente-search");
  if (searchInp) {
    if (existing && existing.cliente_nome) searchInp.value = existing.cliente_nome;
    searchInp.addEventListener("input", function() {
      var q = this.value;
      if (q.length < 1) { document.getElementById("att-ac").innerHTML = ""; return; }
      api("GET", "/api/clienti/search?q=" + encodeURIComponent(q)).then(function(data) {
        var list = document.getElementById("att-ac");
        if (!list || !data.length) { if (list) list.innerHTML = ""; return; }
        var html = "";
        data.forEach(function(c, idx) {
          html += '<div class="ac-item" data-acl="' + idx + '" data-cid="' + c.id + '">' + esc(c.nome_studio) + "</div>";
        });
        list.innerHTML = html;
        list.querySelectorAll(".ac-item").forEach(function(el) {
          el.addEventListener("click", function() {
            document.getElementById("att-cliente-id").value = this.getAttribute("data-cid");
            searchInp.value = this.textContent;
            list.innerHTML = "";
          });
        });
      });
    });
  }
}

function closeAttModal() {
  var el = document.getElementById("att-modal-overlay");
  if (el) el.remove();
}


/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", function() {
  loadPage();
});
