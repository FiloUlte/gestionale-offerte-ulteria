/* ══════════════════════════════════════════════════════════════
   Ulteria — Pagina Oggetto /oggetti/<id>
   ══════════════════════════════════════════════════════════════ */

var objData = null;

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function fmtData(d) { if (!d) return "\u2014"; return new Date(d).toLocaleDateString("it-IT"); }
function icons() { try { lucide.createIcons(); } catch (e) { /* */ } }

var STATI_MAP = {
  prospect: { label: "Prospect", bg: "#E6F5FC", color: "#0080B8" },
  offerta_inviata: { label: "Offerta Inviata", bg: "#FAEEDA", color: "#854F0B" },
  in_attesa_assemblea: { label: "In Attesa Assemblea", bg: "#FFF3E0", color: "#E65100" },
  preso: { label: "Preso", bg: "#EAF3DE", color: "#639922" },
  perso: { label: "Perso", bg: "#FCEBEB", color: "#A32D2D" },
  rimandato: { label: "Rimandato", bg: "#EEEDFE", color: "#534AB7" }
};

var NATURA_MAP = {
  nuovo: "Nuovo", rinnovo: "Rinnovo",
  subentro_diretto: "Subentro Diretto", subentro_intermediario: "Subentro Intermediario"
};

var TIPO_EVENTO_ICONS = {
  offerta_creata: { icon: "file-plus", bg: "#EAF3DE", color: "#639922" },
  offerta_aggiornata: { icon: "refresh-cw", bg: "#E6F5FC", color: "#0080B8" },
  stato_cambiato: { icon: "arrow-right", bg: "#FAEEDA", color: "#854F0B" },
  nota_aggiunta: { icon: "message-square", bg: "#F1EFE8", color: "#5F5E5A" },
  attivita_completata: { icon: "check-circle", bg: "#EAF3DE", color: "#639922" },
  intestazione_cambiata: { icon: "user", bg: "#EEEDFE", color: "#534AB7" },
  email_inviata: { icon: "mail", bg: "#E6F5FC", color: "#0080B8" }
};

function loadPage() {
  api("GET", "/api/oggetti/" + OGGETTO_ID).then(function(res) {
    if (!res.ok) { document.getElementById("obj-page").innerHTML = '<div class="alert a-warn">' + (res.error || "Errore") + "</div>"; return; }
    objData = res.data;
    renderPage();
  }).catch(function(e) {
    document.getElementById("obj-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderPage() {
  var o = objData.oggetto;
  var cl = objData.cliente;
  var offs = objData.offerte;
  var notes = objData.note;
  var timeline = objData.timeline;
  var atts = objData.attivita;

  var st = STATI_MAP[o.stato_pipeline] || STATI_MAP.prospect;
  var nat = NATURA_MAP[o.natura] || "";

  var h = "";

  /* Back + breadcrumb */
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Indietro</a></div>';
  h += '<div class="bc mb12" style="font-size:.75rem;color:var(--muted)">';
  h += '<i data-lucide="home" style="width:12px;height:12px"></i> <span class="bc-sep">/</span> ';
  if (cl) h += '<a href="/clienti/' + cl.id + '" style="color:var(--muted);text-decoration:none">' + esc(cl.nome_studio) + '</a> <span class="bc-sep">/</span> ';
  h += '<strong style="color:var(--text)">' + esc(o.via + (o.civico ? " " + o.civico : "") + " - " + o.comune) + "</strong></div>";

  /* Header */
  h += '<div class="fjb mb20">';
  h += "<div>";
  h += '<div class="kicker">Oggetto</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin:0">' + esc(o.via + (o.civico ? " " + o.civico : "")) + " &mdash; " + esc(o.comune) + "</h2>";
  if (o.nome) h += '<div style="font-size:.85rem;color:var(--muted);margin-top:2px">' + esc(o.nome) + "</div>";
  h += '<div class="fac gap6 mt8">';
  if (nat) h += '<span class="badge" style="background:#F1EFE8;color:#5F5E5A">' + nat + "</span>";
  h += '<span class="badge" style="background:' + st.bg + ";color:" + st.color + '">' + st.label + "</span>";
  if (cl) h += '<a href="/clienti/' + cl.id + '" style="font-size:.78rem;color:var(--blue);text-decoration:none"><i data-lucide="user" style="width:12px;height:12px;vertical-align:-2px"></i> ' + esc(cl.nome_studio) + "</a>";
  h += "</div></div>";
  h += '<div class="fac gap6">';
  h += '<button class="btn btn-sm btn-sec" id="btn-change-stato"><i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Cambia Stato</button>';
  h += "</div></div>";

  /* KPI */
  var activeOffs = offs.filter(function(of) { return of.stato_versione === "attiva"; });
  var valForn = 0, valServ = 0;
  activeOffs.forEach(function(of) { valForn += (of.importo || 0); valServ += (of.importo_servizio_annuo || 0); });
  var ggStato = o.updated_at ? Math.round((new Date() - new Date(o.updated_at)) / 86400000) : 0;

  h += '<div class="g4 mb20">';
  h += '<div class="kpi"><div class="kpi-l">N. Offerte</div><div class="kpi-v kv-blue">' + offs.length + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Valore Fornitura</div><div class="kpi-v" style="color:#639922">' + (valForn ? "\u20ac " + Math.round(valForn).toLocaleString("it-IT") : "\u2014") + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Valore Annuo</div><div class="kpi-v" style="color:#854F0B">' + (valServ ? "\u20ac " + Math.round(valServ).toLocaleString("it-IT") + "/anno" : "\u2014") + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Giorni in Stato</div><div class="kpi-v">' + ggStato + "</div></div>";
  h += "</div>";

  /* Offerte */
  h += '<div class="section-header" style="margin-bottom:12px"><h3 style="font-size:1rem;font-weight:800;margin:0">Offerte</h3>';
  h += '<button class="btn btn-sm btn-primary" id="btn-new-off"><i data-lucide="plus" style="width:12px;height:12px"></i> Nuova Offerta</button></div>';
  h += '<div class="card-0 mb20"><table class="tbl"><thead><tr><th>N.</th><th>Ver.</th><th>Data</th><th>Template</th><th>Importo</th><th>Annuo</th><th>Stato Ver.</th></tr></thead><tbody>';
  if (!offs.length) h += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">Nessuna offerta</td></tr>';
  offs.forEach(function(of) {
    var isOld = of.stato_versione !== "attiva";
    h += '<tr style="' + (isOld ? "opacity:.5" : "") + '">';
    h += '<td class="mono">' + (of.numero || "\u2014") + "</td>";
    h += "<td>" + esc(of.versione || "A") + "</td>";
    h += "<td>" + fmtData(of.data_creazione) + "</td>";
    h += "<td>" + esc(of.template === "E40" ? "E-ITN40" : (of.template === "Q55" ? "Q5.5" : (of.template || ""))) + "</td>";
    h += '<td class="num">' + (of.importo ? "\u20ac " + Math.round(of.importo).toLocaleString("it-IT") : "\u2014") + "</td>";
    h += '<td class="num">' + (of.importo_servizio_annuo ? "\u20ac " + Math.round(of.importo_servizio_annuo).toLocaleString("it-IT") : "\u2014") + "</td>";
    h += "<td>" + esc(of.stato_versione || "") + "</td>";
    h += "</tr>";
  });
  h += "</tbody></table></div>";

  /* Note */
  h += '<div class="section-header" style="margin-bottom:12px"><h3 style="font-size:1rem;font-weight:800;margin:0">Note</h3>';
  h += '<button class="btn btn-sm btn-primary" id="btn-add-note"><i data-lucide="plus" style="width:12px;height:12px"></i></button></div>';
  h += '<div class="card mb20">';
  h += '<div id="note-form" style="display:none" class="mb12"><textarea class="inp" id="note-text" rows="2" placeholder="Scrivi nota..."></textarea>';
  h += '<div class="fac gap6 mt8"><button class="btn btn-sm btn-primary" id="note-save">Salva</button><button class="btn btn-sm btn-sec" id="note-cancel">Annulla</button></div></div>';
  if (!notes.length) h += '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Nessuna nota</div>';
  notes.forEach(function(n) {
    h += '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem">';
    h += "<div>" + esc(n.testo) + "</div>";
    h += '<div style="font-size:.68rem;color:var(--muted);margin-top:2px">' + fmtData(n.created_at) + (n.autore ? " - " + esc(n.autore) : "");
    h += ' <span style="cursor:pointer;color:var(--muted)" data-del-note="' + n.id + '"><i data-lucide="trash-2" style="width:12px;height:12px"></i></span></div></div>';
  });
  h += "</div>";

  /* Timeline */
  h += '<div class="section-header" style="margin-bottom:12px"><h3 style="font-size:1rem;font-weight:800;margin:0">Timeline</h3></div>';
  h += '<div class="card mb20">';
  if (!timeline.length) h += '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Nessun evento</div>';
  timeline.forEach(function(t) {
    var te = TIPO_EVENTO_ICONS[t.tipo_evento] || { icon: "circle", bg: "#F4F9FD", color: "#0D1F35" };
    h += '<div class="timeline-item">';
    h += '<div class="tl-icon" style="background:' + te.bg + ";color:" + te.color + '"><i data-lucide="' + te.icon + '" style="width:14px;height:14px"></i></div>';
    h += '<div class="tl-body"><div>' + esc(t.descrizione) + "</div>";
    h += '<div class="tl-date">' + fmtData(t.created_at) + (t.utente ? " - " + esc(t.utente) : "") + "</div></div></div>";
  });
  h += "</div>";

  document.getElementById("obj-page").innerHTML = h;
  icons();
  attachEvents();
}

function attachEvents() {
  /* Note */
  var btnAdd = document.getElementById("btn-add-note");
  if (btnAdd) btnAdd.addEventListener("click", function() {
    document.getElementById("note-form").style.display = "block";
    document.getElementById("note-text").focus();
  });
  var noteCancel = document.getElementById("note-cancel");
  if (noteCancel) noteCancel.addEventListener("click", function() {
    document.getElementById("note-form").style.display = "none";
    document.getElementById("note-text").value = "";
  });
  var noteSave = document.getElementById("note-save");
  if (noteSave) noteSave.addEventListener("click", function() {
    var testo = document.getElementById("note-text").value;
    if (!testo) return;
    api("POST", "/api/oggetti/" + OGGETTO_ID + "/note", { testo: testo }).then(function() { loadPage(); });
  });
  document.querySelectorAll("[data-del-note]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var nid = parseInt(this.getAttribute("data-del-note"));
      if (confirm("Eliminare nota?")) {
        api("DELETE", "/api/note/" + nid).then(function() { loadPage(); });
      }
    });
  });

  /* Change stato */
  var btnStato = document.getElementById("btn-change-stato");
  if (btnStato) btnStato.addEventListener("click", function() {
    var stati = Object.keys(STATI_MAP);
    var h = '<div class="form-field"><label>Nuovo stato</label><select class="inp" id="new-stato">';
    stati.forEach(function(s) { h += '<option value="' + s + '">' + STATI_MAP[s].label + "</option>"; });
    h += "</select></div>";

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay show";
    overlay.id = "modal-overlay";
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.style.width = "400px";
    modal.innerHTML = '<div class="modal-header"><h2>Cambia Stato Pipeline</h2></div><div class="modal-body">' + h + '</div><div class="modal-footer"></div>';
    var footer = modal.querySelector(".modal-footer");
    var btnCancel = document.createElement("button");
    btnCancel.className = "btn btn-sec";
    btnCancel.textContent = "Annulla";
    btnCancel.addEventListener("click", function() { overlay.remove(); });
    var btnSave = document.createElement("button");
    btnSave.className = "btn btn-primary";
    btnSave.textContent = "Salva";
    btnSave.addEventListener("click", function() {
      var newStato = modal.querySelector("#new-stato").value;
      api("PATCH", "/api/oggetti/" + OGGETTO_ID, { stato_pipeline: newStato }).then(function() {
        overlay.remove();
        loadPage();
      });
    });
    footer.appendChild(btnCancel);
    footer.appendChild(btnSave);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    icons();
  });

  /* New offerta */
  var btnOff = document.getElementById("btn-new-off");
  if (btnOff) btnOff.addEventListener("click", function() { window.location.href = "/"; });
}

document.addEventListener("DOMContentLoaded", function() { loadPage(); });
