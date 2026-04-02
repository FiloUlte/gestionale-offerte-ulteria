/* ══════════════════════════════════════════════════════════════
   Ulteria — Generatore Offerte IA /generatore
   ══════════════════════════════════════════════════════════════ */

var agenti = [];
var modelli = [];
var etichetteTipoCliente = [];
var templates = [];
var acClienti = [];

var gen = {
  /* Cliente */
  cliente_id: null, nome_studio: "", cliente_via: "", cliente_civico: "",
  cliente_cap: "", cliente_citta: "", cliente_email: "", cliente_telefono: "",
  cliente_referente: "", tipo_cliente: "Amministratore", salva_anagrafica: true,
  /* Condominio */
  oggetto_id: null, cond_nome: "", cond_via: "", cond_civico: "",
  cond_comune: "", cond_provincia: "", cond_cap: "",
  n_unita: "", n_scale: "",
  /* Agente */
  agente_id: "",
  /* Natura */
  natura: "",
  /* Tipo offerta */
  tipo_offerta: "",
  /* Apparecchi */
  rip_on: false, rip_modello: "", rip_qty: "", rip_stimata: false,
  ca_on: false, ca_modello: "", ca_trasm: "radio", ca_dn: "", ca_qty: "", ca_stimata: false,
  cc_on: false, cc_modello: "", cc_trasm: "radio", cc_qty: "", cc_stimata: false,
  /* Centralizzazione */
  centr_on: false, centr_tipo: "comodato", centr_modello: "", centr_prezzo: "", centr_qty: "1",
  /* Servizi */
  lettura_prezzo: "", lettura_qty: "",
  care_on: false, care_prezzo: "", care_qty: "",
  /* Template */
  template: "",
  /* Generating */
  generating: false
};

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}
function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
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

function fmtEur(v) {
  if (!v && v !== 0) return "\u2014";
  return "\u20ac " + parseFloat(v).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTipoLettura() {
  if (gen.cc_on) return "RD";
  if (gen.rip_on || gen.ca_on) return "RK";
  return "";
}

function getTotaleApparecchi() {
  var tot = 0;
  if (gen.rip_on) tot += parseInt(gen.rip_qty) || 0;
  if (gen.ca_on) tot += parseInt(gen.ca_qty) || 0;
  if (gen.cc_on) tot += parseInt(gen.cc_qty) || 0;
  return tot;
}


/* ─── LOAD ─── */

function loadPage() {
  Promise.all([
    api("GET", "/api/agenti"),
    api("GET", "/api/modelli"),
    api("GET", "/api/etichette?categoria=tipo_cliente"),
    api("GET", "/api/templates")
  ]).then(function(r) {
    agenti = r[0] || [];
    if (r[0] && r[0].data) agenti = r[0].data;
    if (Array.isArray(r[0]) && !r[0].data) agenti = r[0];
    modelli = (r[1] && r[1].data) || [];
    etichetteTipoCliente = (r[2] && r[2].data) || [];
    templates = (r[3] && r[3].data) || [];
    restoreBozza();
    render();
  }).catch(function(e) {
    document.getElementById("gen-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}


/* ─── RENDER ─── */

function render() {
  var h = "";

  /* Back + Header */
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Home</a></div>';
  h += '<div class="gen-header"><div class="kicker">Strumenti</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin:0">Generatore Offerte IA <span class="gen-badge-ai">Powered by Claude</span></h2>';
  h += '<div class="gen-sub">Crea offerte standard in pochi minuti. Compila i campi e genera automaticamente Word e PDF.</div></div>';

  h += '<div class="gen-cols">';

  /* ── LEFT COLUMN ── */
  h += '<div class="gen-left">';
  h += renderSection1();
  h += renderSection2();
  if (gen.tipo_offerta === "installazione" || gen.tipo_offerta === "fornitura") h += renderSection3();
  if (gen.tipo_offerta === "installazione" || gen.tipo_offerta === "fornitura") h += renderSection4();
  if (gen.rip_on || gen.ca_on || gen.cc_on) h += renderSection5();
  h += renderSection6();
  h += renderGenButton();
  h += "</div>";

  /* ── RIGHT COLUMN ── */
  h += '<div class="gen-right">';
  h += renderRiepilogo();
  h += "</div>";

  h += "</div>";

  document.getElementById("gen-page").innerHTML = h;
  icons();
  attachAllEvents();
}


/* ─── SECTION 1: Cliente + Condominio ─── */

function renderSection1() {
  var h = '<div class="gen-card gen-card-blue">';
  h += '<div class="gen-card-hdr"><i data-lucide="building-2" style="width:18px;height:18px"></i> Cliente e Condominio</div>';
  h += '<div class="gen-card-body">';

  /* Cliente */
  h += '<div class="gen-label">Studio / Amministratore *</div>';
  h += '<div class="ac-wrap"><input class="inp" id="inp-studio" value="' + esc(gen.nome_studio) + '" placeholder="Digita per cercare in anagrafica..." style="width:100%" />';
  h += '<div class="ac-drop" id="ac-drop" style="display:none"></div></div>';

  h += '<div class="gen-row" style="margin-top:10px">';
  h += '<div class="gen-field"><div class="gen-label">Via</div><input class="inp" id="inp-cli-via" value="' + esc(gen.cliente_via) + '" /></div>';
  h += '<div class="gen-field" style="flex:0 0 30%"><div class="gen-label">Civico</div><input class="inp" id="inp-cli-civico" value="' + esc(gen.cliente_civico) + '" /></div>';
  h += "</div>";
  h += '<div class="gen-row">';
  h += '<div class="gen-field" style="flex:0 0 30%"><div class="gen-label">CAP</div><input class="inp" id="inp-cli-cap" value="' + esc(gen.cliente_cap) + '" /></div>';
  h += '<div class="gen-field"><div class="gen-label">Citta</div><input class="inp" id="inp-cli-citta" value="' + esc(gen.cliente_citta) + '" /></div>';
  h += "</div>";
  h += '<div class="gen-row">';
  h += '<div class="gen-field"><div class="gen-label">Email</div><input class="inp" id="inp-cli-email" value="' + esc(gen.cliente_email) + '" /></div>';
  h += '<div class="gen-field"><div class="gen-label">Telefono</div><input class="inp" id="inp-cli-tel" value="' + esc(gen.cliente_telefono) + '" /></div>';
  h += "</div>";

  h += '<hr class="gen-sep" />';

  /* Condominio */
  h += '<div class="gen-label">Condominio / Oggetto</div>';
  h += '<div class="gen-field"><input class="inp" id="inp-cond-nome" value="' + esc(gen.cond_nome) + '" placeholder="Nome condominio (opzionale)" /></div>';
  h += '<div class="gen-row">';
  h += '<div class="gen-field"><div class="gen-label">Via *</div><input class="inp" id="inp-cond-via" value="' + esc(gen.cond_via) + '" /></div>';
  h += '<div class="gen-field" style="flex:0 0 25%"><div class="gen-label">Civico</div><input class="inp" id="inp-cond-civico" value="' + esc(gen.cond_civico) + '" /></div>';
  h += "</div>";
  h += '<div class="gen-row">';
  h += '<div class="gen-field"><div class="gen-label">Comune *</div><input class="inp" id="inp-cond-comune" value="' + esc(gen.cond_comune) + '" /></div>';
  h += '<div class="gen-field" style="flex:0 0 25%"><div class="gen-label">Prov.</div><input class="inp" id="inp-cond-prov" value="' + esc(gen.cond_provincia) + '" /></div>';
  h += "</div>";
  h += '<div class="gen-row">';
  h += '<div class="gen-field"><div class="gen-label">N. Unita</div><input class="inp" type="number" id="inp-n-unita" value="' + esc(gen.n_unita) + '" /></div>';
  h += '<div class="gen-field"><div class="gen-label">N. Scale</div><input class="inp" type="number" id="inp-n-scale" value="' + esc(gen.n_scale) + '" /></div>';
  h += "</div>";

  h += '<hr class="gen-sep" />';

  /* Agente */
  h += '<div class="gen-label">Agente *</div>';
  h += '<select class="inp" id="inp-agente" style="width:100%"><option value="">-- Seleziona agente --</option>';
  agenti.forEach(function(a) {
    h += '<option value="' + a.id + '"' + (gen.agente_id == a.id ? " selected" : "") + ">" + esc(a.nome + " " + a.cognome) + "</option>";
  });
  h += "</select>";

  h += '<hr class="gen-sep" />';

  /* Natura */
  h += '<div class="gen-label">Natura Trattativa *</div>';
  h += '<div class="natura-group">';
  var nature = [
    { val: "nuovo", label: "Nuovo", icon: "\u2795" },
    { val: "rinnovo", label: "Rinnovo", icon: "\ud83d\udd04" },
    { val: "subentro_diretto", label: "Subentro Diretto", icon: "\u2197" },
    { val: "subentro_intermediario", label: "Subentro Intermediario", icon: "\u2197" }
  ];
  nature.forEach(function(n) {
    h += '<div class="natura-btn' + (gen.natura === n.val ? " on" : "") + '" data-natura="' + n.val + '">';
    h += '<div class="natura-btn-icon">' + n.icon + '</div>';
    h += '<div class="natura-btn-label">' + n.label + "</div></div>";
  });
  h += "</div>";

  h += "</div></div>";
  return h;
}


/* ─── SECTION 2: Tipo Offerta ─── */

function renderSection2() {
  var h = '<div class="gen-card">';
  h += '<div class="gen-card-hdr"><i data-lucide="layers" style="width:18px;height:18px"></i> Tipo Offerta</div>';
  h += '<div class="tipo-cards">';
  var tipi = [
    { val: "installazione", icon: "wrench", title: "Installazione", sub: "Fornitura + installazione apparecchi" },
    { val: "fornitura", icon: "package", title: "Sola Fornitura", sub: "Solo materiale senza installazione" },
    { val: "servizio", icon: "clipboard-list", title: "Servizio", sub: "Contratto RK/RD senza fornitura" }
  ];
  tipi.forEach(function(t) {
    h += '<div class="tipo-card' + (gen.tipo_offerta === t.val ? " on" : "") + '" data-tipo="' + t.val + '">';
    h += '<div class="tipo-card-icon"><i data-lucide="' + t.icon + '" style="width:28px;height:28px"></i></div>';
    h += '<div class="tipo-card-title">' + t.title + "</div>";
    h += '<div class="tipo-card-sub">' + t.sub + "</div></div>";
  });
  h += "</div></div>";
  return h;
}


/* ─── SECTION 3: Apparecchi ─── */

function renderSection3() {
  var h = '<div class="gen-card">';
  h += '<div class="gen-card-hdr"><i data-lucide="cpu" style="width:18px;height:18px"></i> Apparecchi</div>';
  h += '<div class="gen-card-body">';

  /* Ripartitori */
  h += '<div class="gen-toggle' + (gen.rip_on ? " active" : "") + '" data-toggle="rip">';
  h += '<div class="gen-toggle-sw"></div>';
  h += '<i data-lucide="thermometer" style="width:16px;height:16px;color:#f59e0b" class="gen-toggle-icon"></i>';
  h += '<div class="gen-toggle-label">Ripartitori di Calore</div></div>';
  if (gen.rip_on) {
    h += '<div style="padding:0 8px 12px">';
    h += '<div class="gen-label">Modello</div><div class="pill-group">';
    modelli.filter(function(m) { return m.categoria === "ripartitore" && m.attivo; }).forEach(function(m) {
      h += '<button class="pill-btn' + (gen.rip_modello === m.nome ? " on" : "") + '" data-rip-mod="' + esc(m.nome) + '">' + esc(m.nome) + "</button>";
    });
    h += "</div>";
    h += '<div class="gen-row"><div class="gen-field"><div class="gen-label">Quantita</div><input class="inp" type="number" min="1" id="inp-rip-qty" value="' + esc(gen.rip_qty) + '" /></div>';
    h += '<div class="gen-field" style="display:flex;align-items:flex-end;padding-bottom:6px"><label style="font-size:.78rem;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="chk-rip-stima"' + (gen.rip_stimata ? " checked" : "") + " /> Stimata</label></div></div>";
    h += '<div class="badge-servizio"><i data-lucide="radio" style="width:12px;height:12px"></i> Servizio: RK</div>';
    h += "</div>";
  }

  h += '<hr class="gen-sep" />';

  /* Contatori Acqua */
  h += '<div class="gen-toggle' + (gen.ca_on ? " active" : "") + '" data-toggle="ca">';
  h += '<div class="gen-toggle-sw"></div>';
  h += '<i data-lucide="droplets" style="width:16px;height:16px;color:#009FE3" class="gen-toggle-icon"></i>';
  h += '<div class="gen-toggle-label">Contatori Acqua</div></div>';
  if (gen.ca_on) {
    h += '<div style="padding:0 8px 12px">';
    h += '<div class="gen-label">Modello</div><div class="pill-group">';
    modelli.filter(function(m) { return m.categoria === "contatore_acqua" && m.attivo; }).forEach(function(m) {
      h += '<button class="pill-btn' + (gen.ca_modello === m.nome ? " on" : "") + '" data-ca-mod="' + esc(m.nome) + '">' + esc(m.nome) + "</button>";
    });
    h += "</div>";
    h += '<div class="gen-label">Trasmissione</div><div class="pill-group">';
    h += '<button class="pill-btn' + (gen.ca_trasm === "radio" ? " on" : "") + '" data-ca-trasm="radio">Radio</button>';
    h += '<button class="pill-btn' + (gen.ca_trasm === "mbus" ? " on" : "") + '" data-ca-trasm="mbus">M-Bus</button></div>';
    h += '<div class="gen-label">Dimensione DN</div><div class="pill-group">';
    ["DN15", "DN20", "DN25", "DN32"].forEach(function(d) {
      h += '<button class="pill-btn' + (gen.ca_dn === d ? " on" : "") + '" data-ca-dn="' + d + '">' + d + "</button>";
    });
    h += "</div>";
    h += '<div class="gen-row"><div class="gen-field"><div class="gen-label">Quantita</div><input class="inp" type="number" min="1" id="inp-ca-qty" value="' + esc(gen.ca_qty) + '" /></div>';
    h += '<div class="gen-field" style="display:flex;align-items:flex-end;padding-bottom:6px"><label style="font-size:.78rem;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="chk-ca-stima"' + (gen.ca_stimata ? " checked" : "") + " /> Stimata</label></div></div>";
    h += '<div class="badge-servizio"><i data-lucide="radio" style="width:12px;height:12px"></i> Servizio: RK</div>';
    h += "</div>";
  }

  h += '<hr class="gen-sep" />';

  /* Contatori Calore */
  h += '<div class="gen-toggle' + (gen.cc_on ? " active" : "") + '" data-toggle="cc">';
  h += '<div class="gen-toggle-sw"></div>';
  h += '<i data-lucide="flame" style="width:16px;height:16px;color:#ef4444" class="gen-toggle-icon"></i>';
  h += '<div class="gen-toggle-label">Contatori di Calore</div></div>';
  if (gen.cc_on) {
    h += '<div style="padding:0 8px 12px">';
    h += '<div class="gen-label">Modello</div><div class="pill-group">';
    modelli.filter(function(m) { return m.categoria === "contatore_calore" && m.attivo; }).forEach(function(m) {
      h += '<button class="pill-btn' + (gen.cc_modello === m.nome ? " on" : "") + '" data-cc-mod="' + esc(m.nome) + '">' + esc(m.nome) + "</button>";
    });
    h += "</div>";
    h += '<div class="gen-label">Trasmissione</div><div class="pill-group">';
    h += '<button class="pill-btn' + (gen.cc_trasm === "radio" ? " on" : "") + '" data-cc-trasm="radio">Radio</button>';
    h += '<button class="pill-btn' + (gen.cc_trasm === "mbus" ? " on" : "") + '" data-cc-trasm="mbus">M-Bus</button></div>';
    h += '<div class="gen-row"><div class="gen-field"><div class="gen-label">Quantita</div><input class="inp" type="number" min="1" id="inp-cc-qty" value="' + esc(gen.cc_qty) + '" /></div>';
    h += '<div class="gen-field" style="display:flex;align-items:flex-end;padding-bottom:6px"><label style="font-size:.78rem;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="chk-cc-stima"' + (gen.cc_stimata ? " checked" : "") + " /> Stimata</label></div></div>";
    h += '<div class="badge-servizio" style="background:#FCEBEB;color:#A32D2D"><i data-lucide="radio" style="width:12px;height:12px"></i> Servizio: RD</div>';
    h += "</div>";
  }

  var tl = getTipoLettura();
  if (tl) {
    h += '<div style="margin-top:10px;padding:8px 12px;background:#EAF3DE;border-radius:8px;font-size:.82rem;font-weight:700;color:#639922"><i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:-2px"></i> Tipo lettura risultante: ' + tl + "</div>";
  }

  h += "</div></div>";
  return h;
}


/* ─── SECTION 4: Centralizzazione ─── */

function renderSection4() {
  var h = '<div class="gen-card">';
  h += '<div class="gen-card-hdr"><i data-lucide="wifi" style="width:18px;height:18px"></i> Centralizzazione Consumi</div>';
  h += '<div class="gen-toggle' + (gen.centr_on ? " active" : "") + '" data-toggle="centr">';
  h += '<div class="gen-toggle-sw"></div>';
  h += '<div class="gen-toggle-label">Centralizzazione prevista</div></div>';

  if (gen.centr_on) {
    h += '<div style="padding:0 8px 12px">';
    h += '<div class="gen-label">Tipo fornitura</div><div class="pill-group">';
    h += '<button class="pill-btn' + (gen.centr_tipo === "comodato" ? " on" : "") + '" data-centr-tipo="comodato">Comodato d&#8217;uso</button>';
    h += '<button class="pill-btn' + (gen.centr_tipo === "vendita" ? " on" : "") + '" data-centr-tipo="vendita">Vendita</button></div>';
    if (gen.centr_tipo === "vendita") {
      h += '<div class="gen-field"><div class="gen-label">Prezzo unitario &euro;</div><input class="inp" type="number" step="0.01" id="inp-centr-prezzo" value="' + esc(gen.centr_prezzo) + '" /></div>';
    }
    h += '<div class="gen-label">Modello concentratore</div><div class="pill-group">';
    modelli.filter(function(m) { return m.categoria === "concentratore" && m.attivo; }).forEach(function(m) {
      h += '<button class="pill-btn' + (gen.centr_modello === m.nome ? " on" : "") + '" data-centr-mod="' + esc(m.nome) + '">' + esc(m.nome) + "</button>";
    });
    h += "</div>";
    h += '<div class="gen-field"><div class="gen-label">Quantita</div><input class="inp" type="number" min="1" id="inp-centr-qty" value="' + esc(gen.centr_qty) + '" style="width:100px" /></div>';
    h += "</div>";
  }
  h += "</div>";
  return h;
}


/* ─── SECTION 5: Servizi ─── */

function renderSection5() {
  var tl = getTipoLettura();
  var totApp = getTotaleApparecchi();
  var h = '<div class="gen-card">';
  h += '<div class="gen-card-hdr"><i data-lucide="settings" style="width:18px;height:18px"></i> Servizi</div>';
  h += '<div class="gen-card-body">';

  /* Lettura */
  h += '<div class="gen-label">Lettura Consumi</div>';
  h += '<div style="margin-bottom:8px"><span class="badge-servizio">' + tl + "</span></div>";
  h += '<div class="gen-row">';
  h += '<div class="gen-field"><div class="gen-label">Prezzo &euro;/app/anno</div><input class="inp" type="number" step="0.01" id="inp-lettura-prezzo" value="' + esc(gen.lettura_prezzo) + '" /></div>';
  h += '<div class="gen-field"><div class="gen-label">N. utenze/apparecchi</div><input class="inp" type="number" id="inp-lettura-qty" value="' + (gen.lettura_qty || totApp) + '" /></div>';
  h += "</div>";
  var lettTot = (parseFloat(gen.lettura_prezzo) || 0) * (parseInt(gen.lettura_qty || totApp) || 0);
  if (lettTot > 0) h += '<div style="font-size:.82rem;color:var(--mid);margin-bottom:12px">Totale annuo lettura: <strong>' + fmtEur(lettTot) + "</strong></div>";

  h += '<div style="margin-bottom:12px"><label style="font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:4px"><input type="checkbox" checked disabled /> Ripartizione spese inclusa nel canone lettura</label></div>';

  h += '<hr class="gen-sep" />';

  /* Care */
  h += '<div class="gen-toggle' + (gen.care_on ? " active" : "") + '" data-toggle="care">';
  h += '<div class="gen-toggle-sw"></div>';
  h += '<i data-lucide="shield" style="width:16px;height:16px;color:#22c55e" class="gen-toggle-icon"></i>';
  h += '<div class="gen-toggle-label">Ulteria Care &mdash; Estensione Garanzia</div></div>';
  if (gen.care_on) {
    h += '<div style="padding:0 8px 12px">';
    h += '<div class="gen-row">';
    h += '<div class="gen-field"><div class="gen-label">Prezzo &euro;/app/anno</div><input class="inp" type="number" step="0.01" id="inp-care-prezzo" value="' + esc(gen.care_prezzo) + '" /></div>';
    h += '<div class="gen-field"><div class="gen-label">Quantita</div><input class="inp" type="number" id="inp-care-qty" value="' + (gen.care_qty || totApp) + '" /></div>';
    h += "</div>";
    var careTot = (parseFloat(gen.care_prezzo) || 0) * (parseInt(gen.care_qty || totApp) || 0);
    if (careTot > 0) h += '<div style="font-size:.82rem;color:var(--mid)">Totale annuo Care: <strong>' + fmtEur(careTot) + "</strong></div>";
    h += '<div style="font-size:.72rem;color:var(--muted);font-style:italic;margin-top:6px">Servizio opzionale &mdash; non tutti i clienti accettano</div>';
    h += "</div>";
  }

  h += "</div></div>";
  return h;
}


/* ─── SECTION 6: Template ─── */

function renderSection6() {
  var h = '<div class="gen-card">';
  h += '<div class="gen-card-hdr"><i data-lucide="file-text" style="width:18px;height:18px"></i> Template Documento</div>';
  if (templates.length === 0) {
    h += '<div style="padding:16px;text-align:center;color:var(--muted);font-size:.82rem">Carica i template nella cartella uploads/ per abilitare la generazione.</div>';
  } else {
    h += '<div class="pill-group">';
    templates.forEach(function(t) {
      var label = t.filename.length > 40 ? t.filename.substring(0, 37) + "..." : t.filename;
      h += '<button class="pill-btn' + (gen.template === t.filename ? " on" : "") + '" data-tmpl="' + esc(t.filename) + '" title="' + esc(t.filename) + '">' + esc(label) + "</button>";
    });
    h += "</div>";
  }
  h += "</div>";
  return h;
}


/* ─── GENERATE BUTTON + CHECKLIST ─── */

function renderGenButton() {
  var checks = getValidation();
  var allOk = checks.every(function(c) { return c.ok; });

  var h = '<div class="gen-btn-wrap">';
  h += '<button class="gen-btn" id="btn-genera"' + (!allOk || gen.generating ? " disabled" : "") + ">";
  if (gen.generating) {
    h += '<span class="spinner"></span> Generazione in corso...';
  } else {
    h += '<i data-lucide="zap" style="width:18px;height:18px"></i> Genera Offerta';
  }
  h += "</button>";

  h += '<div class="checklist">';
  checks.forEach(function(c) {
    h += '<div class="check-item ' + (c.ok ? "check-ok" : "check-warn") + '">';
    h += '<i data-lucide="' + (c.ok ? "check-circle" : "alert-circle") + '" style="width:14px;height:14px"></i> ';
    h += c.label + "</div>";
  });
  h += "</div></div>";
  return h;
}

function getValidation() {
  var needsApp = gen.tipo_offerta === "installazione" || gen.tipo_offerta === "fornitura";
  return [
    { ok: !!gen.nome_studio, label: "Cliente selezionato" },
    { ok: !!gen.cond_via && !!gen.cond_comune, label: "Condominio inserito" },
    { ok: !!gen.natura, label: "Natura trattativa selezionata" },
    { ok: !!gen.tipo_offerta, label: "Tipo offerta selezionato" },
    { ok: !needsApp || gen.rip_on || gen.ca_on || gen.cc_on, label: "Apparecchi selezionati" },
    { ok: !!gen.agente_id, label: "Agente assegnato" },
    { ok: !!gen.template, label: "Template documento selezionato" }
  ];
}


/* ─── RIEPILOGO LIVE ─── */

function renderRiepilogo() {
  var h = '<div class="riepilogo">';
  h += '<div class="riep-hdr"><i data-lucide="clipboard-list" style="width:16px;height:16px;vertical-align:-2px"></i> Riepilogo Offerta</div>';
  h += '<div class="riep-sub">Si aggiorna mentre compili</div>';

  var hasData = gen.nome_studio || gen.cond_via || gen.rip_on || gen.ca_on || gen.cc_on;
  if (!hasData) {
    h += '<div class="riep-empty"><i data-lucide="file-edit" style="width:32px;height:32px;margin-bottom:8px;display:block;margin:0 auto 8px;color:var(--border)"></i>Compila la maschera per vedere il riepilogo</div>';
    h += "</div>";
    return h;
  }

  /* Cliente */
  if (gen.nome_studio) {
    h += '<div class="riep-section"><div class="riep-section-title">Cliente</div>';
    h += '<div class="riep-line"><strong>' + esc(gen.nome_studio) + "</strong></div>";
    if (gen.cliente_via || gen.cliente_citta) h += '<div class="riep-line-sub">' + esc(gen.cliente_via) + (gen.cliente_citta ? ", " + gen.cliente_citta : "") + "</div>";
    h += "</div>";
  }

  /* Condominio */
  if (gen.cond_via) {
    h += '<div class="riep-section"><div class="riep-section-title">Condominio</div>';
    h += '<div class="riep-line">' + esc(gen.cond_via + (gen.cond_civico ? " " + gen.cond_civico : "")) + " &mdash; " + esc(gen.cond_comune) + "</div>";
    if (gen.n_unita) h += '<div class="riep-line-sub">' + gen.n_unita + " unita</div>";
    if (gen.natura) {
      var natLabels = { nuovo: "Nuovo", rinnovo: "Rinnovo", subentro_diretto: "Subentro Dir.", subentro_intermediario: "Subentro Int." };
      h += '<div style="margin-top:4px"><span class="badge b-blue" style="font-size:.6rem">' + (natLabels[gen.natura] || gen.natura) + "</span></div>";
    }
    h += "</div>";
  }

  /* Apparecchi */
  if (gen.rip_on || gen.ca_on || gen.cc_on) {
    h += '<div class="riep-section"><div class="riep-section-title">Apparecchi</div>';
    if (gen.rip_on && gen.rip_qty) {
      h += '<div class="riep-line">N.' + gen.rip_qty + " " + esc(gen.rip_modello || "Ripartitore");
      if (gen.rip_stimata) h += '<span class="badge-stima">STIMA</span>';
      h += "</div>";
    }
    if (gen.ca_on && gen.ca_qty) {
      h += '<div class="riep-line">N.' + gen.ca_qty + " " + esc(gen.ca_modello || "Cont. Acqua");
      if (gen.ca_trasm) h += " &mdash; " + esc(gen.ca_trasm === "mbus" ? "M-Bus" : "Radio");
      if (gen.ca_dn) h += " &mdash; " + esc(gen.ca_dn);
      if (gen.ca_stimata) h += '<span class="badge-stima">STIMA</span>';
      h += "</div>";
    }
    if (gen.cc_on && gen.cc_qty) {
      h += '<div class="riep-line">N.' + gen.cc_qty + " " + esc(gen.cc_modello || "Cont. Calore");
      if (gen.cc_trasm) h += " &mdash; " + esc(gen.cc_trasm === "mbus" ? "M-Bus" : "Radio");
      if (gen.cc_stimata) h += '<span class="badge-stima">STIMA</span>';
      h += "</div>";
    }
    h += "</div>";
  }

  /* Centralizzazione */
  if (gen.centr_on && gen.centr_modello) {
    h += '<div class="riep-section"><div class="riep-section-title">Centralizzazione</div>';
    h += '<div class="riep-line">N.' + (gen.centr_qty || 1) + " " + esc(gen.centr_modello);
    h += " &mdash; " + (gen.centr_tipo === "vendita" ? fmtEur(gen.centr_prezzo) : "Comodato d&#8217;uso");
    h += "</div></div>";
  }

  /* Servizi */
  var tl = getTipoLettura();
  if (tl && gen.lettura_prezzo) {
    h += '<div class="riep-section"><div class="riep-section-title">Servizi</div>';
    var lQty = parseInt(gen.lettura_qty || getTotaleApparecchi()) || 0;
    var lTot = (parseFloat(gen.lettura_prezzo) || 0) * lQty;
    h += '<div class="riep-line">Lettura ' + tl + " &mdash; " + fmtEur(gen.lettura_prezzo) + "/app/anno</div>";
    h += '<div class="riep-line-sub">Totale annuo: ' + fmtEur(lTot) + "</div>";
    h += '<div class="riep-line" style="color:var(--muted)">Ripartizione spese (inclusa)</div>';
    if (gen.care_on && gen.care_prezzo) {
      var cQty = parseInt(gen.care_qty || getTotaleApparecchi()) || 0;
      var cTot = (parseFloat(gen.care_prezzo) || 0) * cQty;
      h += '<div class="riep-line">Ulteria Care &mdash; ' + fmtEur(gen.care_prezzo) + "/app/anno</div>";
      h += '<div class="riep-line-sub">Totale annuo: ' + fmtEur(cTot) + "</div>";
    }
    h += "</div>";
  }

  /* Totali */
  h += '<hr class="riep-sep" />';
  h += '<div class="riep-totals">';
  var valForn = calcValoreFornitura();
  var valAnnuo = calcValoreAnnuo();
  h += '<div class="riep-total-row"><span class="riep-total-label">Valore fornitura</span><span class="riep-total-val-big">' + fmtEur(valForn) + "</span></div>";
  h += '<div class="riep-total-row"><span class="riep-total-label">Canone annuo servizi</span><span class="riep-total-val">' + fmtEur(valAnnuo) + "</span></div>";
  if (gen.agente_id) {
    var ag = agenti.find(function(a) { return a.id == gen.agente_id; });
    if (ag) h += '<div class="riep-total-row"><span class="riep-total-label">Agente</span><span class="riep-total-val">' + esc(ag.nome + " " + ag.cognome) + "</span></div>";
  }
  if (gen.template) h += '<div class="riep-total-row"><span class="riep-total-label">Template</span><span class="riep-total-val" style="font-size:.72rem">' + esc(gen.template.substring(0, 30)) + "</span></div>";

  if (gen.rip_stimata || gen.ca_stimata || gen.cc_stimata) {
    h += '<div style="margin-top:8px"><span class="badge-stima">Contiene stime</span></div>';
  }
  h += "</div>";

  /* Bozza */
  h += '<div style="margin-top:12px;text-align:center"><button class="btn btn-sec btn-sm" id="btn-bozza">Salva come bozza</button></div>';

  h += "</div>";
  return h;
}

function calcValoreFornitura() {
  /* Placeholder — in real app would use product prices */
  return 0;
}

function calcValoreAnnuo() {
  var tot = 0;
  var lQty = parseInt(gen.lettura_qty || getTotaleApparecchi()) || 0;
  tot += (parseFloat(gen.lettura_prezzo) || 0) * lQty;
  if (gen.care_on) {
    var cQty = parseInt(gen.care_qty || getTotaleApparecchi()) || 0;
    tot += (parseFloat(gen.care_prezzo) || 0) * cQty;
  }
  return tot;
}


/* ─── EVENTS ─── */

function attachAllEvents() {
  /* Autocomplete cliente */
  var studioInp = document.getElementById("inp-studio");
  var acDrop = document.getElementById("ac-drop");
  var searchTimer = null;
  if (studioInp) {
    studioInp.addEventListener("input", function() {
      gen.nome_studio = this.value;
      gen.cliente_id = null;
      clearTimeout(searchTimer);
      if (this.value.length < 2) { acDrop.style.display = "none"; return; }
      searchTimer = setTimeout(function() {
        api("GET", "/api/clienti/search?q=" + encodeURIComponent(gen.nome_studio)).then(function(res) {
          var data = res.data || res || [];
          if (!data.length) { acDrop.style.display = "none"; return; }
          acClienti = data;
          var html = "";
          data.forEach(function(c, i) {
            html += '<div class="ac-item" data-ac-idx="' + i + '">';
            html += '<span class="ac-item-badge" style="background:#E6F5FC;color:#0080B8">' + esc(c.tipo_cliente || "Cliente") + "</span>";
            html += esc(c.nome_studio) + (c.citta ? " &mdash; " + esc(c.citta) : "");
            html += "</div>";
          });
          acDrop.innerHTML = html;
          acDrop.style.display = "block";
          acDrop.querySelectorAll(".ac-item").forEach(function(el) {
            el.addEventListener("click", function() {
              var c = acClienti[parseInt(this.getAttribute("data-ac-idx"))];
              if (!c) return;
              gen.cliente_id = c.id;
              gen.nome_studio = c.nome_studio || "";
              gen.cliente_via = c.via || "";
              gen.cliente_cap = c.cap || "";
              gen.cliente_citta = c.citta || "";
              gen.cliente_email = c.email || "";
              gen.cliente_telefono = c.telefono || "";
              gen.cliente_referente = c.referente || "";
              gen.tipo_cliente = c.tipo_cliente || "Amministratore";
              acDrop.style.display = "none";
              render();
            });
          });
        });
      }, 300);
    });
    studioInp.addEventListener("blur", function() {
      setTimeout(function() { acDrop.style.display = "none"; }, 200);
    });
  }

  /* Read all input fields on change */
  bindInput("inp-cli-via", "cliente_via");
  bindInput("inp-cli-civico", "cliente_civico");
  bindInput("inp-cli-cap", "cliente_cap");
  bindInput("inp-cli-citta", "cliente_citta");
  bindInput("inp-cli-email", "cliente_email");
  bindInput("inp-cli-tel", "cliente_telefono");
  bindInput("inp-cond-nome", "cond_nome");
  bindInput("inp-cond-via", "cond_via");
  bindInput("inp-cond-civico", "cond_civico");
  bindInput("inp-cond-comune", "cond_comune");
  bindInput("inp-cond-prov", "cond_provincia");
  bindInput("inp-n-unita", "n_unita");
  bindInput("inp-n-scale", "n_scale");
  bindInput("inp-rip-qty", "rip_qty");
  bindInput("inp-ca-qty", "ca_qty");
  bindInput("inp-cc-qty", "cc_qty");
  bindInput("inp-centr-prezzo", "centr_prezzo");
  bindInput("inp-centr-qty", "centr_qty");
  bindInput("inp-lettura-prezzo", "lettura_prezzo");
  bindInput("inp-lettura-qty", "lettura_qty");
  bindInput("inp-care-prezzo", "care_prezzo");
  bindInput("inp-care-qty", "care_qty");

  bindCheckbox("chk-rip-stima", "rip_stimata");
  bindCheckbox("chk-ca-stima", "ca_stimata");
  bindCheckbox("chk-cc-stima", "cc_stimata");

  /* Agente */
  var agSel = document.getElementById("inp-agente");
  if (agSel) agSel.addEventListener("change", function() { gen.agente_id = this.value; render(); });

  /* Natura buttons */
  document.querySelectorAll("[data-natura]").forEach(function(btn) {
    btn.addEventListener("click", function() { gen.natura = this.getAttribute("data-natura"); render(); });
  });

  /* Tipo offerta */
  document.querySelectorAll("[data-tipo]").forEach(function(btn) {
    btn.addEventListener("click", function() { gen.tipo_offerta = this.getAttribute("data-tipo"); render(); });
  });

  /* Toggles */
  document.querySelectorAll("[data-toggle]").forEach(function(el) {
    el.addEventListener("click", function() {
      var key = this.getAttribute("data-toggle");
      if (key === "rip") gen.rip_on = !gen.rip_on;
      if (key === "ca") gen.ca_on = !gen.ca_on;
      if (key === "cc") gen.cc_on = !gen.cc_on;
      if (key === "centr") gen.centr_on = !gen.centr_on;
      if (key === "care") gen.care_on = !gen.care_on;
      render();
    });
  });

  /* Pill selections */
  document.querySelectorAll("[data-rip-mod]").forEach(function(b) { b.addEventListener("click", function() { gen.rip_modello = this.getAttribute("data-rip-mod"); render(); }); });
  document.querySelectorAll("[data-ca-mod]").forEach(function(b) { b.addEventListener("click", function() { gen.ca_modello = this.getAttribute("data-ca-mod"); render(); }); });
  document.querySelectorAll("[data-ca-trasm]").forEach(function(b) { b.addEventListener("click", function() { gen.ca_trasm = this.getAttribute("data-ca-trasm"); render(); }); });
  document.querySelectorAll("[data-ca-dn]").forEach(function(b) { b.addEventListener("click", function() { gen.ca_dn = this.getAttribute("data-ca-dn"); render(); }); });
  document.querySelectorAll("[data-cc-mod]").forEach(function(b) { b.addEventListener("click", function() { gen.cc_modello = this.getAttribute("data-cc-mod"); render(); }); });
  document.querySelectorAll("[data-cc-trasm]").forEach(function(b) { b.addEventListener("click", function() { gen.cc_trasm = this.getAttribute("data-cc-trasm"); render(); }); });
  document.querySelectorAll("[data-centr-tipo]").forEach(function(b) { b.addEventListener("click", function() { gen.centr_tipo = this.getAttribute("data-centr-tipo"); render(); }); });
  document.querySelectorAll("[data-centr-mod]").forEach(function(b) { b.addEventListener("click", function() { gen.centr_modello = this.getAttribute("data-centr-mod"); render(); }); });
  document.querySelectorAll("[data-tmpl]").forEach(function(b) { b.addEventListener("click", function() { gen.template = this.getAttribute("data-tmpl"); render(); }); });

  /* Generate */
  var btnGen = document.getElementById("btn-genera");
  if (btnGen) btnGen.addEventListener("click", doGenerate);

  /* Bozza */
  var btnBozza = document.getElementById("btn-bozza");
  if (btnBozza) btnBozza.addEventListener("click", saveBozza);
}

function bindInput(id, key) {
  var el = document.getElementById(id);
  if (el) el.addEventListener("input", function() { gen[key] = this.value; updateRiepilogoOnly(); });
}

function bindCheckbox(id, key) {
  var el = document.getElementById(id);
  if (el) el.addEventListener("change", function() { gen[key] = this.checked; updateRiepilogoOnly(); });
}

function updateRiepilogoOnly() {
  var riepEl = document.querySelector(".gen-right");
  if (riepEl) riepEl.innerHTML = renderRiepilogo();
  icons();
  /* Re-attach bozza button */
  var btnBozza = document.getElementById("btn-bozza");
  if (btnBozza) btnBozza.addEventListener("click", saveBozza);
}


/* ─── GENERATE ─── */

function doGenerate() {
  gen.generating = true;
  render();

  var apparecchi = [];
  if (gen.rip_on) apparecchi.push({ categoria: "ripartitore", modello: gen.rip_modello, quantita: parseInt(gen.rip_qty) || 0, stimata: gen.rip_stimata, prezzo_vendita: 0 });
  if (gen.ca_on) apparecchi.push({ categoria: "contatore_acqua", modello: gen.ca_modello, trasmissione: gen.ca_trasm, dn: gen.ca_dn, quantita: parseInt(gen.ca_qty) || 0, stimata: gen.ca_stimata, prezzo_vendita: 0 });
  if (gen.cc_on) apparecchi.push({ categoria: "contatore_calore", modello: gen.cc_modello, trasmissione: gen.cc_trasm, quantita: parseInt(gen.cc_qty) || 0, stimata: gen.cc_stimata, prezzo_vendita: 0 });

  var payload = {
    nome_studio: gen.nome_studio, cliente_id: gen.cliente_id,
    cliente_via: gen.cliente_via, cliente_cap: gen.cliente_cap,
    cliente_citta: gen.cliente_citta, cliente_email: gen.cliente_email,
    cliente_telefono: gen.cliente_telefono, cliente_referente: gen.cliente_referente,
    tipo_cliente: gen.tipo_cliente, salva_anagrafica: gen.salva_anagrafica,
    oggetto_id: gen.oggetto_id,
    cond_nome: gen.cond_nome, cond_via: gen.cond_via, cond_civico: gen.cond_civico,
    cond_comune: gen.cond_comune, cond_provincia: gen.cond_provincia, cond_cap: gen.cond_cap,
    n_unita: parseInt(gen.n_unita) || null, n_scale: parseInt(gen.n_scale) || null,
    agente_id: gen.agente_id, natura: gen.natura, tipo_offerta: gen.tipo_offerta,
    apparecchi: apparecchi,
    centralizzazione: {
      attiva: gen.centr_on, tipo_fornitura: gen.centr_tipo,
      modello: gen.centr_modello, prezzo_unitario: parseFloat(gen.centr_prezzo) || 0,
      quantita: parseInt(gen.centr_qty) || 1
    },
    servizi: {
      lettura: { tipo: getTipoLettura(), prezzo: parseFloat(gen.lettura_prezzo) || 0, quantita: parseInt(gen.lettura_qty || getTotaleApparecchi()) || 0 },
      care: { attivo: gen.care_on, prezzo: parseFloat(gen.care_prezzo) || 0, quantita: parseInt(gen.care_qty || getTotaleApparecchi()) || 0 }
    },
    template: gen.template
  };

  api("POST", "/api/generatore/crea", payload).then(function(res) {
    gen.generating = false;
    if (res.ok) {
      showSuccessModal(res);
      clearBozza();
    } else {
      toast(res.error || "Errore nella generazione", "error");
      render();
    }
  }).catch(function(e) {
    gen.generating = false;
    toast("Errore: " + e.message, "error");
    render();
  });
}

function showSuccessModal(res) {
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.id = "modal-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });

  var modal = document.createElement("div");
  modal.style.cssText = "background:#fff;border-radius:14px;padding:32px;width:420px;max-width:94vw;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)";

  var h = '<div style="font-size:2.5rem;margin-bottom:12px">&#9989;</div>';
  h += '<h2 style="font-size:1.2rem;font-weight:800;margin:0 0 8px">Offerta Generata!</h2>';
  h += '<div style="font-size:.92rem;color:var(--mid);margin-bottom:20px">N. ' + esc(res.numero_offerta) + " &mdash; " + esc(gen.nome_studio) + "</div>";
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  if (res.path_docx) h += '<a href="' + res.path_docx + '" target="_blank" class="btn btn-primary" style="text-decoration:none;justify-content:center"><i data-lucide="file-text" style="width:16px;height:16px"></i> Scarica DOCX</a>';
  if (res.path_pdf) h += '<a href="' + res.path_pdf + '" target="_blank" class="btn btn-pdf" style="text-decoration:none;justify-content:center;background:#dc2626;color:#fff;padding:10px;border-radius:8px;font-weight:600;font-size:.85rem;display:flex;align-items:center;gap:6px"><i data-lucide="file" style="width:16px;height:16px"></i> Scarica PDF</a>';
  h += '<a href="/" class="btn btn-sec" style="text-decoration:none;justify-content:center">Vai al Riepilogo</a>';
  h += '<button class="btn btn-ghost" id="btn-new-gen" style="justify-content:center">+ Crea nuova offerta</button>';
  h += "</div>";

  modal.innerHTML = h;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  icons();

  var btnNew = document.getElementById("btn-new-gen");
  if (btnNew) btnNew.addEventListener("click", function() {
    overlay.remove();
    resetGen();
    render();
  });
}

function resetGen() {
  var keys = Object.keys(gen);
  keys.forEach(function(k) {
    if (typeof gen[k] === "boolean") gen[k] = false;
    else if (typeof gen[k] === "number") gen[k] = 0;
    else gen[k] = "";
  });
  gen.salva_anagrafica = true;
  gen.centr_tipo = "comodato";
  gen.centr_qty = "1";
  gen.ca_trasm = "radio";
  gen.cc_trasm = "radio";
}


/* ─── BOZZA ─── */

function saveBozza() {
  try { localStorage.setItem("ulteria_generatore_bozza", JSON.stringify(gen)); } catch (e) { /* */ }
  toast("Bozza salvata", "ok");
}

function restoreBozza() {
  try {
    var saved = localStorage.getItem("ulteria_generatore_bozza");
    if (saved) {
      var parsed = JSON.parse(saved);
      var keys = Object.keys(parsed);
      keys.forEach(function(k) { if (k in gen) gen[k] = parsed[k]; });
    }
  } catch (e) { /* */ }
}

function clearBozza() {
  try { localStorage.removeItem("ulteria_generatore_bozza"); } catch (e) { /* */ }
}


/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", function() { loadPage(); });
