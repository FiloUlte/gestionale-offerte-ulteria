/* ══════════════════════════════════════════════════════════════
   Ulteria — Pagina Oggetto /oggetti/<id> — con Foglio Costi
   ══════════════════════════════════════════════════════════════ */

var objData = null;
var activeTab = "offerte";
var fcData = null;
var fcDirty = false;
var fcAutoSaveTimer = null;

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}
function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function fmtData(d) { if (!d) return "\u2014"; return new Date(d).toLocaleDateString("it-IT"); }
function fmtEur(v) { if (!v && v !== 0) return "\u2014"; return "\u20ac " + parseFloat(v).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
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

var STATI_MAP = {
  prospect: { label: "Prospect", bg: "#E6F5FC", color: "#0080B8" },
  offerta_inviata: { label: "Offerta Inviata", bg: "#FAEEDA", color: "#854F0B" },
  in_attesa_assemblea: { label: "In Attesa Assemblea", bg: "#FFF3E0", color: "#E65100" },
  preso: { label: "Preso", bg: "#EAF3DE", color: "#639922" },
  perso: { label: "Perso", bg: "#FCEBEB", color: "#A32D2D" },
  rimandato: { label: "Rimandato", bg: "#EEEDFE", color: "#534AB7" }
};

var NATURA_MAP = { nuovo: "Nuovo", rinnovo: "Rinnovo", subentro_diretto: "Subentro Diretto", subentro_intermediario: "Subentro Intermediario" };

function loadPage() {
  Promise.all([
    api("GET", "/api/oggetti/" + OGGETTO_ID),
    api("GET", "/api/fogli-costi/by-oggetto/" + OGGETTO_ID)
  ]).then(function(results) {
    if (!results[0].ok) { document.getElementById("obj-page").innerHTML = '<div class="alert a-warn">' + (results[0].error || "Errore") + "</div>"; return; }
    objData = results[0].data;
    fcData = results[1].data || null;
    renderPage();
  }).catch(function(e) {
    document.getElementById("obj-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderPage() {
  var o = objData.oggetto;
  var cl = objData.cliente;
  var st = STATI_MAP[o.stato_pipeline] || STATI_MAP.prospect;
  var nat = NATURA_MAP[o.natura] || "";

  var h = "";

  /* Back + breadcrumb */
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Indietro</a></div>';
  h += '<div class="bc mb12" style="font-size:.75rem;color:var(--muted)"><i data-lucide="home" style="width:12px;height:12px"></i> <span class="bc-sep">/</span> ';
  if (cl) h += '<a href="/clienti/' + cl.id + '" style="color:var(--muted);text-decoration:none">' + esc(cl.nome_studio) + '</a> <span class="bc-sep">/</span> ';
  h += '<strong style="color:var(--text)">' + esc(o.via + (o.civico ? " " + o.civico : "") + " - " + o.comune) + "</strong></div>";

  /* Header */
  h += '<div class="fjb mb20"><div>';
  h += '<div class="kicker">Oggetto</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin:0">' + esc(o.via + (o.civico ? " " + o.civico : "")) + " &mdash; " + esc(o.comune) + "</h2>";
  if (o.nome) h += '<div style="font-size:.85rem;color:var(--muted);margin-top:2px">' + esc(o.nome) + "</div>";
  h += '<div class="fac gap6 mt8">';
  if (nat) h += '<span class="badge" style="background:#F1EFE8;color:#5F5E5A">' + nat + "</span>";
  h += '<span class="badge" style="background:' + st.bg + ";color:" + st.color + '">' + st.label + "</span>";
  if (cl) h += '<a href="/clienti/' + cl.id + '" style="font-size:.78rem;color:var(--blue);text-decoration:none"><i data-lucide="user" style="width:12px;height:12px;vertical-align:-2px"></i> ' + esc(cl.nome_studio) + "</a>";
  h += "</div></div>";
  h += '<button class="btn btn-sm btn-sec" id="btn-change-stato"><i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Cambia Stato</button>';
  h += "</div>";

  /* KPI */
  var offs = objData.offerte;
  var activeOffs = offs.filter(function(of) { return of.stato_versione === "attiva"; });
  var valForn = 0, valServ = 0;
  activeOffs.forEach(function(of) { valForn += (of.importo || 0); valServ += (of.importo_servizio_annuo || 0); });
  var ggStato = o.updated_at ? Math.round((new Date() - new Date(o.updated_at)) / 86400000) : 0;

  h += '<div class="g4 mb20">';
  h += '<div class="kpi"><div class="kpi-l">N. Offerte</div><div class="kpi-v kv-blue">' + offs.length + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Valore Fornitura</div><div class="kpi-v" style="color:#639922">' + (valForn ? fmtEur(valForn) : "\u2014") + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Valore Annuo</div><div class="kpi-v" style="color:#854F0B">' + (valServ ? fmtEur(valServ) + "/anno" : "\u2014") + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Giorni in Stato</div><div class="kpi-v">' + ggStato + "</div></div>";
  h += "</div>";

  /* Tabs */
  var tabs = [
    { id: "offerte", label: "Offerte", icon: "file-text" },
    { id: "note", label: "Note", icon: "message-square" },
    { id: "timeline", label: "Timeline", icon: "clock" },
    { id: "foglio_costi", label: "Foglio Costi", icon: "euro" }
  ];
  h += '<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:16px">';
  tabs.forEach(function(t) {
    h += '<button class="' + (activeTab === t.id ? "tab-btn on" : "tab-btn") + '" data-obj-tab="' + t.id + '" style="padding:8px 16px;font-size:.82rem;font-weight:600;color:' + (activeTab === t.id ? "var(--blue)" : "var(--muted)") + ';cursor:pointer;border:none;background:none;border-bottom:2px solid ' + (activeTab === t.id ? "var(--blue)" : "transparent") + ';margin-bottom:-1px;font-family:inherit"><i data-lucide="' + t.icon + '" style="width:14px;height:14px;vertical-align:-2px"></i> ' + t.label + "</button>";
  });
  h += "</div>";

  /* Tab content */
  if (activeTab === "offerte") h += renderOfferteTab();
  else if (activeTab === "note") h += renderNoteTab();
  else if (activeTab === "timeline") h += renderTimelineTab();
  else if (activeTab === "foglio_costi") h += renderFoglioCostiTab();

  document.getElementById("obj-page").innerHTML = h;
  icons();
  attachEvents();
}

/* ─── OFFERTE TAB ─── */
function renderOfferteTab() {
  var offs = objData.offerte;
  var h = '<div class="card-0 mb20"><table class="tbl"><thead><tr><th>N.</th><th>Ver.</th><th>Data</th><th>Template</th><th>Importo</th><th>Annuo</th><th>Stato</th></tr></thead><tbody>';
  if (!offs.length) h += '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">Nessuna offerta</td></tr>';
  offs.forEach(function(of) {
    var isOld = of.stato_versione !== "attiva";
    h += '<tr style="' + (isOld ? "opacity:.5" : "") + '">';
    h += '<td class="mono">' + (of.numero || "\u2014") + "</td>";
    h += "<td>" + esc(of.versione || "A") + "</td>";
    h += "<td>" + fmtData(of.data_creazione) + "</td>";
    h += "<td>" + esc(of.template === "E40" ? "E-ITN40" : (of.template === "Q55" ? "Q5.5" : (of.template || ""))) + "</td>";
    h += '<td class="num">' + (of.importo ? fmtEur(of.importo) : "\u2014") + "</td>";
    h += '<td class="num">' + (of.importo_servizio_annuo ? fmtEur(of.importo_servizio_annuo) : "\u2014") + "</td>";
    h += "<td>" + esc(of.stato_versione || "") + "</td></tr>";
  });
  h += "</tbody></table></div>";
  return h;
}

/* ─── NOTE TAB ─── */
function renderNoteTab() {
  var notes = objData.note;
  var h = '<div class="card mb20">';
  h += '<div id="note-form" style="display:none" class="mb12"><textarea class="inp" id="note-text" rows="2" placeholder="Scrivi nota..."></textarea>';
  h += '<div class="fac gap6 mt8"><button class="btn btn-sm btn-primary" id="note-save">Salva</button><button class="btn btn-sm btn-sec" id="note-cancel">Annulla</button></div></div>';
  h += '<div style="margin-bottom:8px"><button class="btn btn-sm btn-primary" id="btn-add-note"><i data-lucide="plus" style="width:12px;height:12px"></i> Aggiungi nota</button></div>';
  if (!notes.length) h += '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Nessuna nota</div>';
  notes.forEach(function(n) {
    h += '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem"><div>' + esc(n.testo) + '</div>';
    h += '<div style="font-size:.68rem;color:var(--muted);margin-top:2px">' + fmtData(n.created_at) + ' <span style="cursor:pointer;color:var(--muted)" data-del-note="' + n.id + '"><i data-lucide="trash-2" style="width:12px;height:12px"></i></span></div></div>';
  });
  h += "</div>";
  return h;
}

/* ─── TIMELINE TAB ─── */
function renderTimelineTab() {
  var timeline = objData.timeline;
  var h = '<div class="card mb20">';
  if (!timeline.length) h += '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Nessun evento</div>';
  timeline.forEach(function(t) {
    h += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:.82rem">';
    h += '<div style="width:28px;height:28px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="activity" style="width:14px;height:14px;color:var(--blue)"></i></div>';
    h += '<div style="flex:1"><div>' + esc(t.descrizione) + '</div><div style="font-size:.68rem;color:var(--muted)">' + fmtData(t.created_at) + (t.utente ? " - " + esc(t.utente) : "") + "</div></div></div>";
  });
  h += "</div>";
  return h;
}

/* ─── FOGLIO COSTI TAB (Prompt 3B — Unificato) ─── */
function renderFoglioCostiTab() {
  if (!fcData || !fcData.foglio) {
    return '<div class="card" style="text-align:center;padding:40px"><div style="color:var(--muted);margin-bottom:12px"><i data-lucide="euro" style="width:32px;height:32px"></i></div>' +
      '<div style="font-size:.92rem;font-weight:700;margin-bottom:8px">Nessun foglio costi</div>' +
      '<div style="font-size:.82rem;color:var(--muted);margin-bottom:16px">Crea un foglio costi per analizzare margini e provvigioni.</div>' +
      '<button class="btn btn-primary" id="btn-create-fc"><i data-lucide="plus" style="width:14px;height:14px"></i> Crea Foglio Costi</button></div>';
  }

  var fc = fcData.foglio;
  var righe = fcData.righe_offerta || [];
  var prodotti = fcData.prodotti || [];
  var prezziInst = fcData.prezzi_installazione || [];
  var extras = fcData.extras || [];
  var scenario = fc.scenario || "valvole";
  var nUnita = (objData.oggetto.n_unita || 0);
  var nRad = fc.n_radiatori || 0;

  var h = '<div style="margin-bottom:8px;font-size:.72rem;color:var(--muted)" id="fc-status">Salvato</div>';

  /* HEADER */
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><h3 style="margin:0;font-size:1.1rem;font-weight:800">Foglio Costi Interno</h3><span class="badge" style="background:#FCEBEB;color:#A32D2D;font-size:.6rem">Riservato</span></div>';
  h += '<div style="font-size:.78rem;color:var(--muted);margin-bottom:14px">Documento non visibile al cliente</div>';

  /* Scenario toggle */
  h += '<div class="fac gap8 mb12" style="padding:10px 14px;background:var(--bg);border-radius:8px">';
  h += '<span style="font-size:.78rem;font-weight:700;color:var(--mid)">Scenario:</span>';
  h += '<button class="pill-btn' + (scenario === "valvole" ? " on" : "") + '" data-fc-scenario="valvole" style="font-size:.78rem">Valvole / Ripartitori</button>';
  h += '<button class="pill-btn' + (scenario === "commessa_lavori" ? " on" : "") + '" data-fc-scenario="commessa_lavori" style="font-size:.78rem">Commessa Lavori (CL)</button>';
  if (scenario === "commessa_lavori") {
    h += '<span style="margin-left:auto;font-size:.78rem">Squadra idraulica: </span>';
    h += '<input class="inp" value="' + esc(fc.installatore_idraulico || "") + '" id="fc-installatore" style="width:180px;padding:3px 8px;font-size:.78rem" />';
  }
  h += "</div>";

  /* SEZIONE 0: Dati Base */
  h += '<div class="card mb12" style="background:#f8fafc">';
  h += '<div style="display:flex;gap:16px;font-size:.82rem">';
  h += '<div><strong>Condominio:</strong> ' + esc(objData.oggetto.via || "") + " " + esc(objData.oggetto.comune || "") + "</div>";
  h += '<div><strong>N. Unita:</strong> ' + nUnita + "</div>";
  h += '<div><strong>N. Radiatori:</strong> <input class="inp" type="number" value="' + nRad + '" id="fc-n-rad" style="width:60px;padding:2px 6px;font-size:.78rem;display:inline" /></div>';
  h += "</div></div>";

  /* SEZIONE 1A: Costi Apparecchi (Valvole) */
  if (scenario === "valvole") {
    h += '<div class="card mb16" style="border-left:3px solid #ef4444">';
    h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 12px;color:#A32D2D"><i data-lucide="trending-down" style="width:16px;height:16px;vertical-align:-2px"></i> Costi Apparecchi</h3>';
    h += '<table class="tbl"><thead><tr><th>Voce</th><th>Costo cad</th><th>Q.ta</th><th>Totale</th></tr></thead><tbody>';
    h += '<tr><td>Kit Valvola</td><td><input class="inp" type="number" step="0.01" value="' + (fc.costo_kit_valvola || 0) + '" data-fc-val="costo_kit_valvola" style="width:80px;padding:2px 6px;font-size:.78rem" /></td><td>' + nRad + '</td><td><strong>' + fmtEur((fc.costo_kit_valvola || 0) * nRad) + "</strong></td></tr>";
    h += '<tr><td>Montaggio Valvola</td><td><input class="inp" type="number" step="0.01" value="' + (fc.costo_montaggio_valvola || 0) + '" data-fc-val="costo_montaggio_valvola" style="width:80px;padding:2px 6px;font-size:.78rem" /></td><td>' + nRad + '</td><td><strong>' + fmtEur((fc.costo_montaggio_valvola || 0) * nRad) + "</strong></td></tr>";
    var ripDesc = "";
    righe.forEach(function(r) { if (r.tipo_riga === "fornitura") ripDesc = r.descrizione || "Ripartitore"; });
    var ripPrezzo = fc.costo_apparecchio_ripartitore || 0;
    if (!ripPrezzo) { prodotti.forEach(function(p) { if (ripDesc.indexOf(p.modello || "") >= 0) ripPrezzo = p.prezzo_acquisto || 0; }); }
    h += '<tr><td>' + esc(ripDesc || "Ripartitore") + '</td><td><input class="inp" type="number" step="0.01" value="' + ripPrezzo + '" data-fc-val="costo_apparecchio_ripartitore" style="width:80px;padding:2px 6px;font-size:.78rem" /></td><td>' + nRad + '</td><td><strong>' + fmtEur(ripPrezzo * nRad) + "</strong></td></tr>";
    h += '<tr><td>Costi extra trasporto</td><td colspan="2"></td><td><input class="inp" type="number" step="0.01" value="' + (fc.costo_extra_trasporto || 0) + '" data-fc-val="costo_extra_trasporto" style="width:80px;padding:2px 6px;font-size:.78rem" /></td></tr>';
    var totA = ((fc.costo_kit_valvola || 0) + (fc.costo_montaggio_valvola || 0) + ripPrezzo) * nRad + (fc.costo_extra_trasporto || 0);
    h += '</tbody></table>';
    h += '<div style="background:#0D1F35;color:#fff;padding:8px 14px;border-radius:6px;margin-top:10px;display:flex;justify-content:space-between;font-weight:700;font-size:.85rem"><span>Totale Costi Apparecchi</span><span>' + fmtEur(totA) + "</span></div>";
    h += "</div>";
  }

  /* SEZIONE 1B: Contabilizzazione (CL) */
  if (scenario === "commessa_lavori") {
    h += '<div class="card mb16" style="border-left:3px solid #ef4444">';
    h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 8px;color:#A32D2D"><i data-lucide="trending-down" style="width:16px;height:16px;vertical-align:-2px"></i> Contabilizzazione</h3>';
    h += '<div style="font-size:.72rem;color:var(--muted);margin-bottom:8px">Seleziona i contatori presenti nel modulo utenza</div>';
    h += '<table class="tbl" style="font-size:.78rem"><thead><tr><th>Tipo</th><th>SI</th><th>Trasm.</th><th>DN</th><th>Costo cad</th><th>Tot.</th></tr></thead><tbody>';
    var contTypes = [
      { key: "riscaldamento", label: "Solo riscaldamento", hasTr: true, hasDn: true },
      { key: "hc", label: "HC (risc./raffr.)", hasTr: true, hasDn: true },
      { key: "raffrescamento", label: "Raffrescamento", hasTr: true, hasDn: true },
      { key: "acqua_calda", label: "Acqua calda", hasTr: true, hasDn: true },
      { key: "acqua_fredda", label: "Acqua fredda", hasTr: true, hasDn: true },
      { key: "acqua_ricircolo", label: "Acqua ricircolo", hasTr: false, hasDn: false },
      { key: "acqua_duale", label: "Acqua duale", hasTr: false, hasDn: false }
    ];
    contTypes.forEach(function(ct) {
      var presente = fc["cont_" + ct.key] || 0;
      var costo = fc["cont_" + ct.key + "_costo"] || 0;
      var tot = costo * nUnita;
      h += '<tr style="' + (!presente ? "opacity:.4" : "") + '">';
      h += "<td>" + ct.label + "</td>";
      h += '<td><input type="checkbox" data-fc-cont="' + ct.key + '"' + (presente ? " checked" : "") + " /></td>";
      if (ct.hasTr) {
        h += '<td><select class="inp" style="width:70px;padding:1px 4px;font-size:.72rem" data-fc-cont-tr="' + ct.key + '"><option value="mbus"' + (fc["cont_" + ct.key + "_trasmissione"] === "mbus" ? " selected" : "") + ">MBUS</option><option value="imp"' + (fc["cont_" + ct.key + "_trasmissione"] === "imp" ? " selected" : "") + ">IMP</option></select></td>';
        h += '<td><select class="inp" style="width:50px;padding:1px 4px;font-size:.72rem" data-fc-cont-dn="' + ct.key + '"><option value="15">15</option><option value="20"' + (fc["cont_" + ct.key + "_dn"] == 20 ? " selected" : "") + ">20</option><option value="25"' + (fc["cont_" + ct.key + "_dn"] == 25 ? " selected" : "") + ">25</option><option value="32"' + (fc["cont_" + ct.key + "_dn"] == 32 ? " selected" : "") + ">32</option></select></td>';
      } else {
        h += "<td>\u2014</td><td>\u2014</td>";
      }
      h += '<td><input class="inp" type="number" step="0.01" value="' + costo + '" style="width:70px;padding:1px 4px;font-size:.72rem" data-fc-cont-costo="' + ct.key + '" /></td>';
      h += "<td><strong>" + fmtEur(tot) + "</strong></td></tr>";
    });
    h += "</tbody></table></div>";

    /* SEZIONE 2B: Valvole e Componenti */
    h += '<div class="card mb16" style="border-left:3px solid #f59e0b">';
    h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 8px;color:#854F0B"><i data-lucide="settings" style="width:16px;height:16px;vertical-align:-2px"></i> Valvole e Componenti</h3>';
    h += '<table class="tbl" style="font-size:.78rem"><thead><tr><th>Voce</th><th>Costo cad</th><th>Q.ta</th><th>Totale</th></tr></thead><tbody>';
    var compFields = [
      { key: "costo_valvola_zona", label: "Valvola zona", qty: nUnita },
      { key: "costo_attuatore", label: "Attuatore", qty: nUnita },
      { key: "costo_produzione_modulo", label: "Produzione modulo", qty: nUnita },
      { key: "costo_opere_idrauliche_extra", label: "Opere idrauliche extra", qty: 1 },
      { key: "costo_trasformatore", label: "Trasformatore", qty: 0 },
      { key: "costo_rele", label: "Rele", qty: 0 },
      { key: "costo_elettricista", label: "Elettricista", qty: 1 },
      { key: "costo_collegamenti_elettrici", label: "Collegamenti elettrici", qty: nUnita },
      { key: "costo_valvola_intercettazione", label: "Valvola intercettazione", qty: 0 }
    ];
    compFields.forEach(function(cf) {
      var val = fc[cf.key] || 0;
      h += "<tr><td>" + cf.label + '</td><td><input class="inp" type="number" step="0.01" value="' + val + '" data-fc-val="' + cf.key + '" style="width:70px;padding:1px 4px;font-size:.72rem" /></td>';
      h += "<td>" + (cf.qty || '-') + "</td><td><strong>" + fmtEur(val * (cf.qty || 1)) + "</strong></td></tr>";
    });
    h += "</tbody></table></div>";

    /* SEZIONE 3B: Installazione Idraulica */
    h += '<div class="card mb16" style="border-left:3px solid #f59e0b">';
    h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 8px;color:#854F0B"><i data-lucide="wrench" style="width:16px;height:16px;vertical-align:-2px"></i> Installazione Idraulica</h3>';
    h += '<table class="tbl" style="font-size:.78rem"><thead><tr><th>Tipo</th><th>Costo cad</th><th>Q.ta</th><th>Totale</th></tr></thead><tbody>';
    if (fc.cont_riscaldamento || fc.cont_hc) {
      var instCal = fc.inst_cont_calore || 27;
      h += '<tr><td>Contatore calore</td><td><input class="inp" type="number" step="0.01" value="' + instCal + '" data-fc-val="inst_cont_calore" style="width:70px;padding:1px 4px;font-size:.72rem" /></td><td>' + nUnita + '</td><td><strong>' + fmtEur(instCal * nUnita) + "</strong></td></tr>";
    }
    if (fc.cont_acqua_calda) {
      var instAC = fc.inst_cont_acqua_calda || 22;
      h += '<tr><td>Contatore acqua calda</td><td><input class="inp" type="number" step="0.01" value="' + instAC + '" data-fc-val="inst_cont_acqua_calda" style="width:70px;padding:1px 4px;font-size:.72rem" /></td><td>' + nUnita + '</td><td><strong>' + fmtEur(instAC * nUnita) + "</strong></td></tr>";
    }
    if (fc.cont_acqua_fredda) {
      var instAF = fc.inst_cont_acqua_fredda || 22;
      h += '<tr><td>Contatore acqua fredda</td><td><input class="inp" type="number" step="0.01" value="' + instAF + '" data-fc-val="inst_cont_acqua_fredda" style="width:70px;padding:1px 4px;font-size:.72rem" /></td><td>' + nUnita + '</td><td><strong>' + fmtEur(instAF * nUnita) + "</strong></td></tr>";
    }
    h += '<tr><td>Modifiche idrauliche extra</td><td colspan="2"></td><td><input class="inp" type="number" step="0.01" value="' + (fc.inst_modifiche_idrauliche || 0) + '" data-fc-val="inst_modifiche_idrauliche" style="width:80px;padding:1px 4px;font-size:.72rem" /></td></tr>';
    h += "</tbody></table></div>";
  }

  /* SEZIONE 4: Centralizzazione (entrambi) */
  h += '<div class="card mb16">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 8px"><i data-lucide="wifi" style="width:16px;height:16px;vertical-align:-2px"></i> Centralizzazione</h3>';
  h += '<div style="font-size:.78rem;margin-bottom:8px">Famiglia: ';
  h += '<button class="pill-btn' + (fc.centr_famiglia === "radio" ? " on" : "") + '" data-fc-centr-fam="radio" style="font-size:.72rem">Radio</button> ';
  h += '<button class="pill-btn' + (fc.centr_famiglia === "mbus" ? " on" : "") + '" data-fc-centr-fam="mbus" style="font-size:.72rem">M-Bus</button></div>';
  if (fc.centr_famiglia) {
    h += '<table class="tbl" style="font-size:.78rem"><thead><tr><th>Voce</th><th>Costo</th><th>Pezzi</th><th>Totale</th></tr></thead><tbody>';
    h += '<tr><td>' + esc(fc.centr_modello || "Concentratore") + '</td><td><input class="inp" type="number" step="0.01" value="' + (fc.centr_costo_acquisto || 0) + '" data-fc-val="centr_costo_acquisto" style="width:70px;padding:1px 4px;font-size:.72rem" /></td>';
    h += '<td><input class="inp" type="number" value="' + (fc.centr_pezzi || 1) + '" data-fc-val="centr_pezzi" style="width:50px;padding:1px 4px;font-size:.72rem" /></td>';
    h += '<td><strong>' + fmtEur((fc.centr_costo_acquisto || 0) * (fc.centr_pezzi || 1)) + "</strong></td></tr>";
    if (fc.centr_famiglia === "mbus") {
      h += '<tr><td>PW e Router</td><td><input class="inp" type="number" step="0.01" value="' + (fc.centr_pw_router || 0) + '" data-fc-val="centr_pw_router" style="width:70px;padding:1px 4px;font-size:.72rem" /></td><td>1</td><td><strong>' + fmtEur(fc.centr_pw_router || 0) + "</strong></td></tr>";
    }
    h += '<tr><td>Installazione</td><td><input class="inp" type="number" step="0.01" value="' + (fc.centr_costo_installazione || 0) + '" data-fc-val="centr_costo_installazione" style="width:70px;padding:1px 4px;font-size:.72rem" /></td><td>1</td><td><strong>' + fmtEur(fc.centr_costo_installazione || 0) + "</strong></td></tr>";
    h += "</tbody></table>";
  }
  h += "</div>";

  /* SEZIONE 5: Servizio Lettura */
  var lettTipo = fc.servizio_lettura_tipo || "";
  h += '<div class="card mb16" style="border-left:3px solid #009FE3">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 8px;color:#0080B8"><i data-lucide="radio" style="width:16px;height:16px;vertical-align:-2px"></i> Servizio Lettura</h3>';
  h += '<div class="fac gap12" style="font-size:.82rem">';
  h += '<div>Tipo: <span class="badge b-blue">' + (lettTipo || "N/D") + "</span></div>";
  h += '<div>Prezzo cad: <input class="inp" type="number" step="0.01" value="' + (fc.servizio_lettura_cad || 0) + '" data-fc-val="servizio_lettura_cad" style="width:80px;padding:2px 6px;font-size:.78rem" /></div>';
  h += '<div>N. app: ' + (nRad || nUnita || 0) + "</div>";
  var lettTot = (fc.servizio_lettura_cad || 0) * (nRad || nUnita || 0);
  h += '<div><strong>Totale annuo: ' + fmtEur(lettTot) + "</strong></div>";
  h += "</div></div>";

  /* SEZIONE 6: Riepilogo Costi */
  var totCosti = 0;
  if (scenario === "valvole") {
    totCosti = ((fc.costo_kit_valvola || 0) + (fc.costo_montaggio_valvola || 0) + (fc.costo_apparecchio_ripartitore || 0)) * nRad + (fc.costo_extra_trasporto || 0);
  }
  // Add centralizzazione
  totCosti += (fc.centr_costo_acquisto || 0) * (fc.centr_pezzi || 1) + (fc.centr_pw_router || 0) + (fc.centr_costo_installazione || 0);

  h += '<div style="background:#0D1F35;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px">';
  h += '<div style="font-size:.85rem;font-weight:800;display:flex;justify-content:space-between"><span>Totale Costi</span><span>' + fmtEur(totCosti) + "</span></div></div>";

  /* SEZIONE 7: K + Offerta + GM */
  var kVal = fc.k_moltiplicatore || 1.0;
  var costiK = totCosti * kVal;
  var ricForn = fc.ricavo_fornitura || 0;
  var gm = ricForn - costiK;
  var gmPct = ricForn > 0 ? (gm / ricForn * 100) : 0;
  var gmCol = gm >= 0 ? "#639922" : "#A32D2D";
  var barCol = gmPct > 30 ? "#639922" : (gmPct > 15 ? "#f59e0b" : "#ef4444");

  h += '<div class="card mb16" style="background:var(--bg)">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 10px"><i data-lucide="calculator" style="width:16px;height:16px;vertical-align:-2px"></i> Analisi Economica</h3>';
  h += '<div class="fac gap12 mb8"><span style="font-size:.78rem;font-weight:700">K:</span><input class="inp" type="number" step="0.05" min="1" max="3" value="' + kVal + '" id="fc-k" style="width:70px;padding:2px 6px;font-size:.78rem" />';
  h += '<input type="range" min="1" max="3" step="0.05" value="' + kVal + '" id="fc-k-slider" style="flex:1" /></div>';
  h += '<div style="font-size:.82rem;margin-bottom:4px">Costi x K: <strong>' + fmtEur(costiK) + "</strong></div>";
  h += '<div style="font-size:.82rem;margin-bottom:4px">Offerta fornitura: <strong>' + fmtEur(ricForn) + '</strong> <input class="inp" type="number" step="0.01" value="' + ricForn + '" data-fc-val="ricavo_fornitura" style="width:90px;padding:2px 6px;font-size:.72rem;margin-left:8px" /></div>';
  h += '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">';
  h += '<div style="font-size:1rem;font-weight:800;color:' + gmCol + '">GM: ' + fmtEur(gm) + " (" + gmPct.toFixed(1) + "%)</div>";
  h += '<div style="height:6px;background:var(--border);border-radius:4px;margin-top:6px;overflow:hidden"><div style="height:100%;width:' + Math.min(Math.max(gmPct, 0), 100) + "%;background:" + barCol + ';border-radius:4px"></div></div>';
  h += "</div>";
  h += '<div style="font-size:.78rem;color:var(--muted);margin-top:10px">Canone lettura annuo: ' + fmtEur(lettTot) + "/anno | 3 anni: " + fmtEur(lettTot * 3) + " | 5 anni: " + fmtEur(lettTot * 5) + "</div>";
  h += "</div>";

  /* SEZIONE 8: Provvigioni */
  h += '<div class="card mb16">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 10px"><i data-lucide="users" style="width:16px;height:16px;vertical-align:-2px"></i> Provvigioni</h3>';
  var totProv = 0;
  for (var p = 1; p <= 3; p++) {
    var pn = fc["provvigione" + p + "_nome"] || "";
    var pp = fc["provvigione" + p + "_percentuale"] || 0;
    var pe = gm * pp / 100;
    totProv += pe;
    h += '<div class="fac gap6 mb6">';
    h += '<input class="inp" value="' + esc(pn) + '" placeholder="Nome" style="flex:1;padding:3px 6px;font-size:.78rem" data-fc-prov-name="' + p + '" />';
    h += '<input class="inp" type="number" step="0.5" value="' + pp + '" style="width:60px;padding:3px 6px;font-size:.78rem" data-fc-prov-pct="' + p + '" />%';
    h += '<span style="min-width:70px;text-align:right;font-weight:700;font-size:.78rem">' + fmtEur(pe) + "</span></div>";
  }
  h += '<div style="text-align:right;font-size:.82rem;font-weight:700">Totale provvigioni: ' + fmtEur(totProv) + "</div></div>";

  /* SEZIONE 9: Netto Finale */
  var netto = gm - totProv;
  var nettoPct = ricForn > 0 ? (netto / ricForn * 100) : 0;
  var nettoCol = netto >= 0 ? "#639922" : "#A32D2D";
  h += '<div class="card mb16" style="background:linear-gradient(135deg,#f8fffe,#f4f9fd);border:2px solid ' + nettoCol + '">';
  h += '<div style="font-size:.82rem">GM lordo: ' + fmtEur(gm) + "</div>";
  h += '<div style="font-size:.82rem">Provvigioni: -' + fmtEur(totProv) + "</div>";
  h += '<div style="border-top:2px solid ' + nettoCol + ';padding-top:8px;margin-top:8px">';
  h += '<div style="font-size:1.75rem;font-weight:900;color:' + nettoCol + '">Netto: ' + fmtEur(netto) + "</div>";
  h += '<div style="font-size:1rem;font-weight:700;color:' + nettoCol + '">' + nettoPct.toFixed(1) + "%</div></div>";
  h += '<div style="font-size:.72rem;color:var(--muted);font-style:italic;margin-top:8px">Calcolato su ricavo anno 1</div></div>';

  /* SEZIONE 10: Costi per unita */
  if (nUnita > 0) {
    h += '<div class="card mb16"><h3 style="font-size:.85rem;font-weight:700;margin:0 0 8px">Costi per Unita Abitativa</h3>';
    h += '<div style="display:flex;gap:20px;font-size:.82rem">';
    h += '<div>Costo cad: <strong>' + fmtEur(totCosti / nUnita) + "</strong></div>";
    h += '<div>Offerta cad: <strong>' + fmtEur(ricForn / nUnita) + "</strong></div>";
    h += '<div>GM cad: <strong style="color:' + gmCol + '">' + fmtEur(gm / nUnita) + "</strong></div>";
    h += "</div></div>";
  }

  /* Azioni */
  h += '<div class="fac gap8"><button class="btn btn-primary" id="btn-save-fc"><i data-lucide="save" style="width:14px;height:14px"></i> Salva</button></div>';

  return h;
}


/* ─── EVENTS ─── */

function attachEvents() {
  /* Tabs */
  document.querySelectorAll("[data-obj-tab]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      activeTab = this.getAttribute("data-obj-tab");
      renderPage();
    });
  });

  /* Note */
  var btnAddNote = document.getElementById("btn-add-note");
  if (btnAddNote) btnAddNote.addEventListener("click", function() {
    document.getElementById("note-form").style.display = "block";
    document.getElementById("note-text").focus();
  });
  var noteCancel = document.getElementById("note-cancel");
  if (noteCancel) noteCancel.addEventListener("click", function() { document.getElementById("note-form").style.display = "none"; });
  var noteSave = document.getElementById("note-save");
  if (noteSave) noteSave.addEventListener("click", function() {
    var testo = document.getElementById("note-text").value;
    if (!testo) return;
    api("POST", "/api/oggetti/" + OGGETTO_ID + "/note", { testo: testo }).then(function() { loadPage(); });
  });
  document.querySelectorAll("[data-del-note]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (confirm("Eliminare nota?")) api("DELETE", "/api/note/" + parseInt(this.getAttribute("data-del-note"))).then(function() { loadPage(); });
    });
  });

  /* Change stato */
  var btnStato = document.getElementById("btn-change-stato");
  if (btnStato) btnStato.addEventListener("click", function() {
    var stati = Object.keys(STATI_MAP);
    var overlay = document.createElement("div"); overlay.className = "modal-overlay show"; overlay.id = "modal-overlay";
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
    var modal = document.createElement("div"); modal.className = "modal"; modal.style.width = "400px";
    var mh = '<div class="modal-header"><h2>Cambia Stato</h2></div><div class="modal-body"><select class="inp" id="new-stato">';
    stati.forEach(function(s) { mh += '<option value="' + s + '">' + STATI_MAP[s].label + "</option>"; });
    mh += '</select></div><div class="modal-footer"></div>';
    modal.innerHTML = mh;
    var footer = modal.querySelector(".modal-footer");
    var bc = document.createElement("button"); bc.className = "btn btn-sec"; bc.textContent = "Annulla"; bc.addEventListener("click", function() { overlay.remove(); });
    var bs = document.createElement("button"); bs.className = "btn btn-primary"; bs.textContent = "Salva";
    bs.addEventListener("click", function() { api("PATCH", "/api/oggetti/" + OGGETTO_ID, { stato_pipeline: modal.querySelector("#new-stato").value }).then(function() { overlay.remove(); loadPage(); }); });
    footer.appendChild(bc); footer.appendChild(bs);
    overlay.appendChild(modal); document.body.appendChild(overlay); icons();
  });

  /* Create FC */
  var btnCreateFc = document.getElementById("btn-create-fc");
  if (btnCreateFc) btnCreateFc.addEventListener("click", function() {
    api("POST", "/api/fogli-costi", { oggetto_id: OGGETTO_ID }).then(function() { loadPage(); });
  });

  /* Save FC */
  var btnSaveFc = document.getElementById("btn-save-fc");
  if (btnSaveFc && fcData && fcData.foglio) {
    btnSaveFc.addEventListener("click", function() {
      saveFoglioCosti();
    });
  }

  /* Scenario toggle */
  document.querySelectorAll("[data-fc-scenario]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (!fcData || !fcData.foglio) return;
      var newScenario = this.getAttribute("data-fc-scenario");
      api("PATCH", "/api/fogli-costi/" + fcData.foglio.id, { scenario: newScenario }).then(function() { loadPage(); });
    });
  });

  /* Centralizzazione famiglia */
  document.querySelectorAll("[data-fc-centr-fam]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (!fcData || !fcData.foglio) return;
      api("PATCH", "/api/fogli-costi/" + fcData.foglio.id, { centr_famiglia: this.getAttribute("data-fc-centr-fam") }).then(function() { loadPage(); });
    });
  });

  /* K slider sync */
  var kInput = document.getElementById("fc-k");
  var kSlider = document.getElementById("fc-k-slider");
  if (kInput && kSlider) {
    kInput.addEventListener("input", function() { kSlider.value = this.value; fcDirty = true; });
    kSlider.addEventListener("input", function() { kInput.value = this.value; fcDirty = true; });
  }

  /* Add extra material */
  var btnExtra = document.getElementById("btn-add-extra");
  if (btnExtra && fcData && fcData.foglio) {
    btnExtra.addEventListener("click", function() {
      api("POST", "/api/fogli-costi/" + fcData.foglio.id + "/extra", { descrizione: "Materiale", quantita: 1, prezzo_unitario: 0, totale: 0 }).then(function() { loadPage(); });
    });
  }

  /* Delete extra */
  document.querySelectorAll("[data-del-extra]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      api("DELETE", "/api/fogli-costi/extra/" + parseInt(this.getAttribute("data-del-extra"))).then(function() { loadPage(); });
    });
  });
}

function saveFoglioCosti() {
  if (!fcData || !fcData.foglio) return;
  var payload = {};

  // K
  var kEl = document.getElementById("fc-k");
  if (kEl) payload.k_moltiplicatore = parseFloat(kEl.value) || 1;

  // N radiatori
  var nRadEl = document.getElementById("fc-n-rad");
  if (nRadEl) payload.n_radiatori = parseInt(nRadEl.value) || 0;

  // Installatore
  var instEl = document.getElementById("fc-installatore");
  if (instEl) payload.installatore_idraulico = instEl.value;

  // All data-fc-val inputs
  document.querySelectorAll("[data-fc-val]").forEach(function(inp) {
    payload[inp.getAttribute("data-fc-val")] = parseFloat(inp.value) || 0;
  });

  // Contatore checkboxes
  document.querySelectorAll("[data-fc-cont]").forEach(function(cb) {
    payload["cont_" + cb.getAttribute("data-fc-cont")] = cb.checked ? 1 : 0;
  });
  document.querySelectorAll("[data-fc-cont-tr]").forEach(function(sel) {
    payload["cont_" + sel.getAttribute("data-fc-cont-tr") + "_trasmissione"] = sel.value;
  });
  document.querySelectorAll("[data-fc-cont-dn]").forEach(function(sel) {
    payload["cont_" + sel.getAttribute("data-fc-cont-dn") + "_dn"] = parseInt(sel.value) || 15;
  });
  document.querySelectorAll("[data-fc-cont-costo]").forEach(function(inp) {
    payload["cont_" + inp.getAttribute("data-fc-cont-costo") + "_costo"] = parseFloat(inp.value) || 0;
  });

  // Provvigioni
  for (var i = 1; i <= 3; i++) {
    var nameEl = document.querySelector("[data-fc-prov-name='" + i + "']");
    var pctEl = document.querySelector("[data-fc-prov-pct='" + i + "']");
    if (nameEl) payload["provvigione" + i + "_nome"] = nameEl.value;
    if (pctEl) payload["provvigione" + i + "_percentuale"] = parseFloat(pctEl.value) || 0;
  }

  api("PATCH", "/api/fogli-costi/" + fcData.foglio.id, payload).then(function() {
    toast("Foglio costi salvato", "ok");
    fcDirty = false;
    var st = document.getElementById("fc-status");
    if (st) st.textContent = "Salvato";
    loadPage();
  });
}

document.addEventListener("DOMContentLoaded", function() { loadPage(); });
