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

/* ─── FOGLIO COSTI TAB ─── */
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

  var costoApp = 0;
  var h = '<div style="margin-bottom:8px;font-size:.72rem;color:var(--muted)" id="fc-status">Salvato</div>';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><h3 style="margin:0;font-size:1.1rem;font-weight:800">Foglio Costi</h3><span class="badge" style="background:#FCEBEB;color:#A32D2D;font-size:.6rem">Riservato</span></div>';

  /* BLOCCO 1: Costi */
  h += '<div class="card mb16" style="border-left:3px solid #ef4444">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 12px;color:#A32D2D"><i data-lucide="trending-down" style="width:16px;height:16px;vertical-align:-2px"></i> Costi</h3>';

  /* Apparecchi */
  h += '<div class="sec-ttl">Costi Apparecchi</div>';
  h += '<table class="tbl"><thead><tr><th>Apparecchio</th><th>Q.ta</th><th>Prezzo Acq.</th><th>Totale</th></tr></thead><tbody>';
  righe.forEach(function(r) {
    if (r.tipo_riga !== "fornitura") return;
    var desc = r.descrizione || "";
    var pAcq = 0;
    prodotti.forEach(function(p) { if (desc.indexOf(p.modello) >= 0 || desc.indexOf(p.nome) >= 0) pAcq = p.prezzo_acquisto || 0; });
    var tot = pAcq * (r.quantita || 0);
    costoApp += tot;
    h += "<tr><td>" + esc(desc) + "</td><td>" + (r.quantita || 0) + "</td>";
    h += "<td>" + (pAcq ? fmtEur(pAcq) : '<span style="color:#dc2626;font-size:.72rem">Non in listino</span>') + "</td>";
    h += "<td><strong>" + fmtEur(tot) + "</strong></td></tr>";
  });
  if (!righe.filter(function(r) { return r.tipo_riga === "fornitura"; }).length) {
    h += '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:12px">Nessun apparecchio</td></tr>';
  }
  h += '</tbody></table>';

  /* Installazione */
  h += '<div class="sec-ttl mt12">Costi Installazione</div>';
  h += '<table class="tbl"><thead><tr><th>Tipo</th><th>Q.ta</th><th>Base</th><th>Extra</th><th>Totale</th></tr></thead><tbody>';
  var costoInst = fc.costo_installazione_idraulica || 0;
  prezziInst.forEach(function(pi) {
    h += "<tr><td>" + esc(pi.descrizione) + "</td><td>-</td><td>" + fmtEur(pi.prezzo_base) + "</td>";
    h += '<td><input class="inp" type="number" step="0.01" value="0" style="width:80px;padding:3px 6px;font-size:.78rem" data-fc-field="inst_extra_' + pi.tipo + '" /></td>';
    h += "<td>" + fmtEur(pi.prezzo_base) + "</td></tr>";
  });
  h += "</tbody></table>";

  /* Materiali Extra */
  h += '<div class="sec-ttl mt12">Materiali Extra</div>';
  h += '<div id="fc-extras">';
  extras.forEach(function(ex) {
    h += '<div class="fac gap8 mb8" data-extra-id="' + ex.id + '">';
    h += '<input class="inp" value="' + esc(ex.descrizione) + '" style="flex:1;padding:4px 8px;font-size:.78rem" />';
    h += '<input class="inp" type="number" value="' + (ex.quantita || 1) + '" style="width:60px;padding:4px 8px;font-size:.78rem" />';
    h += '<input class="inp" type="number" step="0.01" value="' + (ex.prezzo_unitario || 0) + '" style="width:80px;padding:4px 8px;font-size:.78rem" />';
    h += '<span style="font-weight:700;font-size:.82rem;min-width:70px;text-align:right">' + fmtEur(ex.totale || 0) + "</span>";
    h += '<button class="btn btn-ghost btn-sm" data-del-extra="' + ex.id + '" style="color:var(--muted)"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button></div>';
  });
  h += '</div><button class="btn btn-sm btn-sec mt8" id="btn-add-extra"><i data-lucide="plus" style="width:12px;height:12px"></i> Aggiungi materiale</button>';

  /* Totale Costi */
  var totCosti = costoApp + (fc.costo_installazione_idraulica || 0) + (fc.costo_installazione_elettrica || 0) + (fc.costo_concentratori || 0) + (fc.costo_materiali_extra || 0);
  h += '<div style="background:#0D1F35;color:#fff;padding:10px 14px;border-radius:8px;margin-top:12px;display:flex;justify-content:space-between;font-weight:700">';
  h += '<span>Totale Costi</span><span>' + fmtEur(totCosti) + "</span></div>";
  h += "</div>";

  /* BLOCCO 2: Moltiplicatore K */
  var kVal = fc.k_moltiplicatore || 1.0;
  h += '<div class="card mb16" style="background:var(--bg)">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 8px"><i data-lucide="x-circle" style="width:16px;height:16px;vertical-align:-2px"></i> Moltiplicatore K</h3>';
  h += '<div style="font-size:.78rem;color:var(--muted);margin-bottom:10px">Il moltiplicatore K copre costi fissi, overhead e margine operativo.</div>';
  h += '<div class="fac gap12"><input class="inp" type="number" step="0.05" min="1" max="3" value="' + kVal + '" id="fc-k" style="width:80px" />';
  h += '<input type="range" min="1" max="3" step="0.05" value="' + kVal + '" id="fc-k-slider" style="flex:1" /></div>';
  h += '<div class="fac gap16 mt8" style="font-size:.85rem">';
  h += '<div>Costi base: ' + fmtEur(totCosti) + "</div>";
  h += '<div><strong>Costi x K: ' + fmtEur(totCosti * kVal) + "</strong></div>";
  h += '<div style="color:#639922">+' + fmtEur(totCosti * kVal - totCosti) + "</div></div>";
  h += "</div>";

  /* BLOCCO 3: Ricavi */
  var ricForn = fc.ricavo_fornitura || 0;
  var ricServ = fc.ricavo_servizio_annuo || 0;
  h += '<div class="card mb16" style="border-left:3px solid #639922">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 12px;color:#639922"><i data-lucide="trending-up" style="width:16px;height:16px;vertical-align:-2px"></i> Ricavi</h3>';
  h += '<table class="tbl"><tbody>';
  h += '<tr><td>Fornitura/Installazione</td><td class="num"><strong>' + fmtEur(ricForn) + "</strong></td></tr>";
  h += '<tr><td>Canone lettura annuo</td><td class="num">' + fmtEur(ricServ) + "/anno</td></tr>";
  h += '<tr><td><strong>Totale ricavo anno 1</strong></td><td class="num"><strong>' + fmtEur(ricForn + ricServ) + "</strong></td></tr>";
  h += '<tr><td>Totale ricavo anno 5</td><td class="num">' + fmtEur(ricForn + ricServ * 5) + "</td></tr>";
  h += "</tbody></table></div>";

  /* BLOCCO 4: Margine */
  var costiK = totCosti * kVal;
  var margineLordo = ricForn - costiK;
  var marginePct = ricForn > 0 ? (margineLordo / ricForn * 100) : 0;
  var borderCol = margineLordo >= 0 ? "#639922" : "#A32D2D";
  var barCol = marginePct > 30 ? "#639922" : (marginePct > 15 ? "#f59e0b" : "#ef4444");

  h += '<div class="card mb16" style="border-left:3px solid ' + borderCol + '">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 12px"><i data-lucide="percent" style="width:16px;height:16px;vertical-align:-2px"></i> Margine</h3>';
  h += '<div style="font-size:.85rem;margin-bottom:4px">Ricavo fornitura: ' + fmtEur(ricForn) + "</div>";
  h += '<div style="font-size:.85rem;margin-bottom:4px">Costi x K: -' + fmtEur(costiK) + "</div>";
  h += '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">';
  h += '<div style="font-size:1rem;font-weight:800;color:' + borderCol + '">Margine lordo: ' + fmtEur(margineLordo) + " (" + marginePct.toFixed(1) + "%)</div>";
  h += '<div style="height:8px;background:var(--border);border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:100%;width:' + Math.min(Math.max(marginePct, 0), 100) + "%;background:" + barCol + ';border-radius:4px"></div></div>';
  h += "</div></div>";

  /* BLOCCO 5: Provvigioni */
  h += '<div class="card mb16">';
  h += '<h3 style="font-size:.92rem;font-weight:700;margin:0 0 12px"><i data-lucide="users" style="width:16px;height:16px;vertical-align:-2px"></i> Provvigioni</h3>';
  for (var p = 1; p <= 3; p++) {
    var pn = fc["provvigione" + p + "_nome"] || "";
    var pp = fc["provvigione" + p + "_percentuale"] || 0;
    var pe = margineLordo * pp / 100;
    h += '<div class="fac gap8 mb8">';
    h += '<input class="inp" value="' + esc(pn) + '" placeholder="Nome provvigione" style="flex:1;padding:4px 8px;font-size:.78rem" data-fc-prov-name="' + p + '" />';
    h += '<input class="inp" type="number" step="0.5" value="' + pp + '" style="width:70px;padding:4px 8px;font-size:.78rem" data-fc-prov-pct="' + p + '" />%';
    h += '<span style="min-width:80px;text-align:right;font-weight:700;font-size:.82rem">' + fmtEur(pe) + "</span></div>";
  }
  var totProv = 0;
  for (var p2 = 1; p2 <= 3; p2++) { totProv += margineLordo * (fc["provvigione" + p2 + "_percentuale"] || 0) / 100; }
  h += '<div style="text-align:right;font-size:.85rem;font-weight:700;color:var(--mid)">Totale provvigioni: ' + fmtEur(totProv) + "</div>";
  h += "</div>";

  /* BLOCCO 6: Netto Finale */
  var netto = margineLordo - totProv;
  var nettoPct = ricForn > 0 ? (netto / ricForn * 100) : 0;
  var nettoCol = netto >= 0 ? "#639922" : "#A32D2D";
  h += '<div class="card mb16" style="background:linear-gradient(135deg,#f8fffe,#f4f9fd);border:2px solid ' + nettoCol + '">';
  h += '<div style="font-size:.85rem;margin-bottom:4px">Margine lordo: ' + fmtEur(margineLordo) + "</div>";
  h += '<div style="font-size:.85rem;margin-bottom:8px">Provvigioni: -' + fmtEur(totProv) + "</div>";
  h += '<div style="border-top:2px solid ' + nettoCol + ';padding-top:10px">';
  h += '<div style="font-size:1.5rem;font-weight:900;color:' + nettoCol + '">Netto Finale: ' + fmtEur(netto) + "</div>";
  h += '<div style="font-size:1rem;font-weight:700;color:' + nettoCol + '">' + nettoPct.toFixed(1) + "%</div>";
  h += '</div><div style="font-size:.72rem;color:var(--muted);font-style:italic;margin-top:8px">Calcolato su ricavo anno 1. Il canone annuo genera ulteriore margine.</div>';
  h += "</div>";

  /* Azioni */
  h += '<div class="fac gap8"><button class="btn btn-primary" id="btn-save-fc"><i data-lucide="save" style="width:14px;height:14px"></i> Salva Foglio Costi</button></div>';

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
  var kEl = document.getElementById("fc-k");
  var payload = {
    k_moltiplicatore: parseFloat(kEl ? kEl.value : 1),
  };
  // Read provvigioni
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
