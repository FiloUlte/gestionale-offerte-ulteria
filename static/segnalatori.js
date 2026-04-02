/* ══════════════════════════════════════════════════════════════
   Ulteria — Segnalatori /segnalatori
   ══════════════════════════════════════════════════════════════ */

var segnalatori = [];
var expandedSeg = null;

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}
function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function fmtEur(v) { if (!v && v !== 0) return "\u2014"; return "\u20ac " + parseFloat(v).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtData(d) { if (!d) return "\u2014"; return new Date(d).toLocaleDateString("it-IT"); }
function icons() { try { lucide.createIcons(); } catch (e) { /* */ } }

function toast(msg, type) {
  var c = document.getElementById("toast-c");
  if (!c) { c = document.createElement("div"); c.id = "toast-c"; c.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:flex-end"; document.body.appendChild(c); }
  var colors = { ok: "#639922", error: "#ef4444", info: "#009FE3" };
  var t = document.createElement("div");
  t.style.cssText = "padding:10px 16px;border-radius:8px;font-size:.82rem;font-weight:600;color:#fff;background:" + (colors[type] || colors.info) + ";box-shadow:0 4px 12px rgba(0,0,0,.15);transform:translateX(100%);transition:transform .3s;max-width:320px;font-family:inherit";
  t.textContent = msg; c.appendChild(t);
  requestAnimationFrame(function() { t.style.transform = "translateX(0)"; });
  while (c.children.length > 3) c.removeChild(c.firstChild);
  setTimeout(function() { t.style.transform = "translateX(100%)"; setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300); }, 3000);
}

function loadPage() {
  api("GET", "/api/segnalatori").then(function(res) {
    segnalatori = res.data || [];
    renderPage();
  }).catch(function(e) {
    document.getElementById("segn-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderPage() {
  var attivi = segnalatori.filter(function(s) { return s.attivo; }).length;
  var conOfferte = segnalatori.filter(function(s) { return s.n_offerte > 0; }).length;
  var daPagare = 0;
  segnalatori.forEach(function(s) { daPagare += (s.da_pagare || 0); });

  var h = "";
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Home</a></div>';
  h += '<div class="fjb mb20"><div><div class="kicker">Commerciale</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin:0">Segnalatori e Collaboratori</h2>';
  h += '<div style="font-size:.82rem;color:var(--muted);margin-top:4px">Manutentori, segnalatori e collaboratori esterni</div></div>';
  h += '<button class="btn btn-primary" id="btn-new-seg"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Segnalatore</button></div>';

  /* KPI */
  h += '<div class="g3 mb20">';
  h += '<div class="kpi"><div class="kpi-l">Segnalatori Attivi</div><div class="kpi-v kv-blue">' + attivi + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Con Offerte</div><div class="kpi-v">' + conOfferte + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Da Pagare</div><div class="kpi-v" style="color:#EF9F27">' + fmtEur(daPagare) + "</div></div>";
  h += "</div>";

  /* Form area */
  h += '<div id="new-seg-form"></div>';

  /* Table */
  h += '<div class="card-0"><table class="tbl"><thead><tr><th>Nome</th><th>Tipo</th><th>Azienda</th><th>Telefono</th><th>Provv. %</th><th>Offerte</th><th>Da Pagare</th><th>Azioni</th></tr></thead><tbody>';
  if (!segnalatori.length) h += '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted)">Nessun segnalatore</td></tr>';
  segnalatori.forEach(function(s) {
    var tipoCls = "tipo-" + (s.tipo || "segnalatore");
    h += '<tr data-seg-id="' + s.id + '" style="cursor:pointer">';
    h += "<td><strong>" + esc(s.nome) + "</strong></td>";
    h += '<td><span class="tipo-segn ' + tipoCls + '">' + esc(s.tipo || "segnalatore") + "</span></td>";
    h += "<td>" + esc(s.azienda || "") + "</td>";
    h += "<td>" + esc(s.telefono || "") + "</td>";
    h += "<td>" + (s.provvigione_default_pct || 0) + "%</td>";
    h += "<td>" + (s.n_offerte || 0) + "</td>";
    h += "<td><strong>" + fmtEur(s.da_pagare || 0) + "</strong></td>";
    h += '<td><button class="btn btn-sm btn-sec" data-edit-seg="' + s.id + '"><i data-lucide="edit" style="width:12px;height:12px"></i></button></td>';
    h += "</tr>";
    if (expandedSeg === s.id) {
      h += '<tr><td colspan="8" id="seg-detail-' + s.id + '" style="padding:14px;background:var(--bg)"><div style="color:var(--muted);font-size:.82rem">Caricamento dettagli...</div></td></tr>';
    }
  });
  h += "</tbody></table></div>";

  document.getElementById("segn-page").innerHTML = h;
  icons();
  attachEvents();

  if (expandedSeg) loadSegDetail(expandedSeg);
}

function loadSegDetail(sid) {
  api("GET", "/api/segnalatori/" + sid).then(function(res) {
    var area = document.getElementById("seg-detail-" + sid);
    if (!area) return;
    var offs = res.data.offerte || [];
    var h = '<div style="font-size:.85rem;font-weight:700;margin-bottom:8px">Storico Offerte</div>';
    if (!offs.length) { h += '<div style="color:var(--muted);font-size:.82rem">Nessuna offerta collegata</div>'; }
    else {
      h += '<table class="tbl" style="font-size:.78rem"><thead><tr><th>N.</th><th>Cliente</th><th>Condominio</th><th>Importo</th><th>%</th><th>Provv.</th><th>Stato Pag.</th><th></th></tr></thead><tbody>';
      offs.forEach(function(o) {
        var pagCls = "pag-" + (o.stato_pagamento || "da_pagare");
        h += "<tr>";
        h += "<td>" + (o.numero || "\u2014") + "</td>";
        h += "<td>" + esc(o.nome_studio || "") + "</td>";
        h += "<td>" + esc(o.nome_condominio || "") + "</td>";
        h += '<td class="num">' + fmtEur(o.importo_base || o.importo) + "</td>";
        h += "<td>" + (o.provvigione_pct || 0) + "%</td>";
        h += '<td class="num"><strong>' + fmtEur(o.provvigione_euro) + "</strong></td>";
        h += '<td><span class="tipo-segn ' + pagCls + '">' + esc(o.stato_pagamento || "da_pagare") + "</span></td>";
        if (o.stato_pagamento === "da_pagare") {
          h += '<td><button class="btn btn-sm btn-green" data-paga-os="' + o.id + '">Paga</button></td>';
        } else { h += "<td></td>"; }
        h += "</tr>";
      });
      h += "</tbody></table>";
    }
    area.innerHTML = h;
    icons();
    area.querySelectorAll("[data-paga-os]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (confirm("Segnare come pagato?")) {
          api("PATCH", "/api/offerte-segnalatori/" + btn.getAttribute("data-paga-os") + "/paga", {}).then(function() {
            toast("Pagamento registrato", "ok");
            loadPage();
          });
        }
      });
    });
  });
}

function attachEvents() {
  /* Row expand */
  document.querySelectorAll("tr[data-seg-id]").forEach(function(tr) {
    tr.addEventListener("click", function() {
      var sid = parseInt(this.getAttribute("data-seg-id"));
      expandedSeg = expandedSeg === sid ? null : sid;
      renderPage();
    });
  });

  /* Edit */
  document.querySelectorAll("[data-edit-seg]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var sid = parseInt(this.getAttribute("data-edit-seg"));
      var s = segnalatori.find(function(x) { return x.id === sid; });
      if (s) showSegForm(s);
    });
  });

  /* New */
  var btnNew = document.getElementById("btn-new-seg");
  if (btnNew) btnNew.addEventListener("click", function() { showSegForm(null); });
}

function showSegForm(existing) {
  var area = document.getElementById("new-seg-form");
  if (!area) return;
  var isEdit = !!existing;
  area.innerHTML = '<div class="card mb16"><div class="fjb mb12"><strong>' + (isEdit ? "Modifica" : "Nuovo") + ' Segnalatore</strong><button class="btn btn-ghost btn-sm" id="seg-form-close"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>' +
    '<div class="form-grid">' +
    '<div class="form-field"><label>Nome *</label><input class="inp" id="sf-nome" value="' + esc(existing ? existing.nome : "") + '" /></div>' +
    '<div class="form-field"><label>Tipo</label><select class="inp" id="sf-tipo"><option value="segnalatore"' + (existing && existing.tipo === "segnalatore" ? " selected" : "") + '>Segnalatore</option><option value="manutentore"' + (existing && existing.tipo === "manutentore" ? " selected" : "") + '>Manutentore</option><option value="collaboratore"' + (existing && existing.tipo === "collaboratore" ? " selected" : "") + ">Collaboratore</option></select></div>" +
    '<div class="form-field"><label>Azienda</label><input class="inp" id="sf-azienda" value="' + esc(existing ? existing.azienda || "" : "") + '" /></div>' +
    '<div class="form-field"><label>Telefono</label><input class="inp" id="sf-tel" value="' + esc(existing ? existing.telefono || "" : "") + '" /></div>' +
    '<div class="form-field"><label>Email</label><input class="inp" id="sf-email" value="' + esc(existing ? existing.email || "" : "") + '" /></div>' +
    '<div class="form-field"><label>Provvigione default %</label><input class="inp" type="number" step="0.5" id="sf-pct" value="' + (existing ? existing.provvigione_default_pct || 0 : 0) + '" /></div>' +
    '<div class="form-field full"><label>Note</label><textarea class="inp" id="sf-note" rows="2">' + esc(existing ? existing.note || "" : "") + "</textarea></div>" +
    '</div><div class="fac gap8 mt12"><button class="btn btn-primary" id="sf-save">Salva</button><button class="btn btn-sec" id="sf-cancel">Annulla</button></div></div>';
  icons();
  document.getElementById("seg-form-close").addEventListener("click", function() { area.innerHTML = ""; });
  document.getElementById("sf-cancel").addEventListener("click", function() { area.innerHTML = ""; });
  document.getElementById("sf-save").addEventListener("click", function() {
    var nome = document.getElementById("sf-nome").value;
    if (!nome) { alert("Nome obbligatorio"); return; }
    var payload = {
      nome: nome, tipo: document.getElementById("sf-tipo").value,
      azienda: document.getElementById("sf-azienda").value,
      telefono: document.getElementById("sf-tel").value,
      email: document.getElementById("sf-email").value,
      provvigione_default_pct: parseFloat(document.getElementById("sf-pct").value) || 0,
      note: document.getElementById("sf-note").value
    };
    var method = isEdit ? "PATCH" : "POST";
    var url = isEdit ? "/api/segnalatori/" + existing.id : "/api/segnalatori";
    api(method, url, payload).then(function(res) {
      if (res.ok) { area.innerHTML = ""; toast(isEdit ? "Aggiornato" : "Creato", "ok"); loadPage(); }
      else alert(res.error || "Errore");
    });
  });
}

document.addEventListener("DOMContentLoaded", function() { loadPage(); });
