/* ══════════════════════════════════════════════════════════════
   Ulteria — Scheda Cliente /clienti/<id>
   ══════════════════════════════════════════════════════════════ */

var clData = null;

var STATI_MAP = {
  richiamato: { label: "Richiamato", cls: "stato-richiamato" },
  in_attesa_assemblea: { label: "In Attesa Assemblea", cls: "stato-in_attesa_assemblea" },
  preso_lavoro: { label: "Preso Lavoro", cls: "stato-preso_lavoro" },
  perso: { label: "Perso", cls: "stato-perso" },
  rimandato: { label: "Rimandato", cls: "stato-rimandato" }
};

var TIPO_COLORS = {
  attivo: { bg: "#EAF3DE", color: "#639922" },
  prospect: { bg: "#F1EFE8", color: "#5F5E5A" },
  lead: { bg: "#E6F5FC", color: "#0080B8" }
};

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function fmtData(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("it-IT");
}

function icons() { try { lucide.createIcons(); } catch (e) { /* */ } }

function loadPage() {
  api("GET", "/api/clienti/" + CLIENTE_ID + "/full").then(function(data) {
    clData = data;
    renderPage();
  }).catch(function(e) {
    document.getElementById("client-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderPage() {
  var c = clData.cliente;
  var offs = clData.offerte;
  var note = clData.note;
  var tipo = c.tipo_cliente || "lead";
  var tipoCol = TIPO_COLORS[tipo] || TIPO_COLORS.lead;

  var prese = 0, perse = 0, attesa = 0, valPreso = 0;
  offs.forEach(function(o) {
    var imp = (o.prezzo_fornitura || 0) + (o.prezzo_care || 0) + (o.canone_lettura || 0);
    if (o.stato === "preso_lavoro") { prese++; valPreso += imp; }
    if (o.stato === "perso") perse++;
    if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") attesa++;
  });

  var h = "";

  /* Back + breadcrumb */
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none" id="back-link"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Clienti</a></div>';
  h += '<div class="bc mb12" style="font-size:.75rem;color:var(--muted)"><i data-lucide="home" style="width:12px;height:12px"></i> <span class="bc-sep">/</span> Clienti <span class="bc-sep">/</span> <strong style="color:var(--text)">' + esc(c.nome_studio) + "</strong></div>";

  /* Header */
  h += '<div class="fjb mb20">';
  h += '<div>';
  h += '<div class="kicker">Scheda Cliente</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin:0">' + esc(c.nome_studio) + '</h2>';
  h += '<div style="font-size:.82rem;color:var(--muted);margin-top:4px">';
  h += esc((c.via || "") + (c.citta ? ", " + (c.cap || "") + " " + c.citta : ""));
  h += '</div></div>';
  h += '<div class="fac gap8">';
  h += '<span class="badge tipo-badge" id="tipo-badge" style="background:' + tipoCol.bg + ';color:' + tipoCol.color + ';padding:4px 12px;font-size:.75rem;cursor:pointer">' + tipo.charAt(0).toUpperCase() + tipo.slice(1) + "</span>";
  h += '<button class="btn btn-primary btn-sm" id="btn-new-offer"><i data-lucide="file-plus" style="width:14px;height:14px"></i> Nuova Offerta</button>';
  h += "</div></div>";

  /* KPI */
  h += '<div class="g4 mb20">';
  h += '<div class="kpi"><div class="kpi-l">Offerte Totali</div><div class="kpi-v kv-blue">' + offs.length + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Prese</div><div class="kpi-v" style="color:#639922">' + prese + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Perse</div><div class="kpi-v" style="color:#A32D2D">' + perse + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">In Attesa</div><div class="kpi-v" style="color:#EF9F27">' + attesa + "</div></div>";
  h += "</div>";

  /* Info grid */
  h += '<div class="g2 mb20">';
  h += '<div class="card"><div class="sec-ttl">Dati Anagrafici</div>';
  h += '<div class="form-grid">';
  h += '<div class="form-field"><label>Email</label><input class="inp" value="' + esc(c.email || "") + '" data-upd="email" /></div>';
  h += '<div class="form-field"><label>Telefono</label><input class="inp" value="' + esc(c.telefono || "") + '" data-upd="telefono" /></div>';
  h += '<div class="form-field"><label>Referente</label><input class="inp" value="' + esc(c.referente || "") + '" data-upd="referente" /></div>';
  h += '<div class="form-field"><label>Via</label><input class="inp" value="' + esc(c.via || "") + '" data-upd="via" /></div>';
  h += '<div class="form-field"><label>CAP</label><input class="inp" value="' + esc(c.cap || "") + '" data-upd="cap" /></div>';
  h += '<div class="form-field"><label>Citta</label><input class="inp" value="' + esc(c.citta || "") + '" data-upd="citta" /></div>';
  h += "</div></div>";

  /* Note */
  h += '<div class="card"><div class="fjb mb8"><div class="sec-ttl" style="margin:0">Note</div>';
  h += '<button class="btn btn-sm btn-primary" id="btn-add-note"><i data-lucide="plus" style="width:12px;height:12px"></i></button></div>';
  h += '<div id="note-input" style="display:none" class="mb8"><textarea class="inp" id="note-text" rows="2" placeholder="Scrivi nota..."></textarea>';
  h += '<div class="fac gap6 mt8"><button class="btn btn-sm btn-primary" id="note-save">Salva</button><button class="btn btn-sm btn-sec" id="note-cancel">Annulla</button></div></div>';
  if (note.length === 0) {
    h += '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Nessuna nota</div>';
  }
  note.forEach(function(n) {
    h += '<div class="note-item"><div class="fjb"><div class="note-text">' + esc(n.testo) + "</div>";
    h += '<span class="note-del" data-del-note="' + n.id + '"><i data-lucide="trash-2" style="width:14px;height:14px"></i></span></div>';
    h += '<div class="note-meta">' + fmtData(n.created_at) + (n.autore ? " - " + esc(n.autore) : "") + "</div></div>";
  });
  h += "</div></div>";

  /* Offerte */
  h += '<div class="section-header" style="margin-top:24px;margin-bottom:12px"><h3 style="font-size:1rem;font-weight:800;margin:0">Storico Offerte (' + offs.length + ")</h3></div>";
  h += '<div class="card-0"><table class="tbl"><thead><tr><th>N.</th><th>Data</th><th>Condominio</th><th>Template</th><th>Agente</th><th>Importo</th><th>Stato</th></tr></thead><tbody>';
  if (offs.length === 0) {
    h += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">Nessuna offerta</td></tr>';
  }
  offs.forEach(function(o) {
    var si = STATI_MAP[o.stato] || {};
    var imp = (o.prezzo_fornitura || 0) + (o.prezzo_care || 0) + (o.canone_lettura || 0);
    var agHtml = "\u2014";
    if (o.agente_nome) {
      var ini = (o.agente_nome[0] || "").toUpperCase() + (o.agente_cognome ? o.agente_cognome[0].toUpperCase() : "");
      var col = o.agente_colore || "#009FE3";
      agHtml = '<span class="agente-pill"><span class="agente-dot" style="background:' + col + '">' + ini + "</span>" + esc(o.agente_nome) + "</span>";
      if (o.agente_id) agHtml = '<a href="/agenti/' + o.agente_id + '" style="text-decoration:none">' + agHtml + "</a>";
    }
    h += "<tr>";
    h += '<td class="mono">' + (o.numero || "\u2014") + "</td>";
    h += "<td>" + fmtData(o.data_creazione) + "</td>";
    h += "<td>" + esc(o.nome_condominio || "") + "</td>";
    h += "<td>" + esc(o.template === "E40" ? "E-ITN40" : (o.template === "Q55" ? "Q5.5" : "")) + "</td>";
    h += "<td>" + agHtml + "</td>";
    h += '<td class="num">' + (imp ? "\u20ac " + Math.round(imp).toLocaleString("it-IT") : "\u2014") + "</td>";
    h += '<td><span class="stato-badge ' + (si.cls || "") + '">' + (si.label || o.stato || "") + "</span></td>";
    h += "</tr>";
  });
  h += "</tbody></table></div>";

  document.getElementById("client-page").innerHTML = h;
  icons();
  attachEvents();
}

function attachEvents() {
  /* Back */
  var back = document.getElementById("back-link");
  if (back) back.addEventListener("click", function(e) { e.preventDefault(); window.location.href = "/"; });

  /* Tipo badge click -> cycle */
  var tipoBadge = document.getElementById("tipo-badge");
  if (tipoBadge) {
    tipoBadge.addEventListener("click", function() {
      var types = ["lead", "prospect", "attivo"];
      var cur = clData.cliente.tipo_cliente || "lead";
      var idx = types.indexOf(cur);
      var next = types[(idx + 1) % types.length];
      api("PUT", "/api/clienti/" + CLIENTE_ID, { tipo_cliente: next }).then(function() {
        clData.cliente.tipo_cliente = next;
        renderPage();
      });
    });
  }

  /* Inline field updates */
  document.querySelectorAll("[data-upd]").forEach(function(inp) {
    inp.addEventListener("change", function() {
      var data = {};
      data[this.getAttribute("data-upd")] = this.value;
      api("PUT", "/api/clienti/" + CLIENTE_ID, data);
    });
  });

  /* Notes */
  var btnAddNote = document.getElementById("btn-add-note");
  if (btnAddNote) btnAddNote.addEventListener("click", function() {
    document.getElementById("note-input").style.display = "block";
    document.getElementById("note-text").focus();
  });
  var noteCancel = document.getElementById("note-cancel");
  if (noteCancel) noteCancel.addEventListener("click", function() {
    document.getElementById("note-input").style.display = "none";
    document.getElementById("note-text").value = "";
  });
  var noteSave = document.getElementById("note-save");
  if (noteSave) noteSave.addEventListener("click", function() {
    var testo = document.getElementById("note-text").value;
    if (!testo) return;
    api("POST", "/api/clienti/" + CLIENTE_ID + "/note", { testo: testo }).then(function() { loadPage(); });
  });
  document.querySelectorAll("[data-del-note]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var nid = parseInt(this.getAttribute("data-del-note"));
      if (confirm("Eliminare questa nota?")) {
        api("DELETE", "/api/note/" + nid).then(function() { loadPage(); });
      }
    });
  });

  /* New offer */
  var btnOffer = document.getElementById("btn-new-offer");
  if (btnOffer) btnOffer.addEventListener("click", function() { window.location.href = "/"; });
}

document.addEventListener("DOMContentLoaded", function() { loadPage(); });
