/* ══════════════════════════════════════════════════════════════
   Ulteria — Impostazioni (5 tab)
   ══════════════════════════════════════════════════════════════ */

var settTab = "generale";
var etichette = [];
var users = [];

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function icons() { try { lucide.createIcons(); } catch (e) { /* */ } }

var modelliApp = [];
var prezziInst = [];

function loadPage() {
  Promise.all([
    api("GET", "/api/config"),
    api("GET", "/api/etichette"),
    api("GET", "/api/users"),
    api("GET", "/api/agenti"),
    api("GET", "/api/modelli"),
    api("GET", "/api/prezzi-installazione")
  ]).then(function(results) {
    var config = results[0];
    etichette = results[1].data || [];
    users = results[2].data || [];
    modelliApp = results[4].data || [];
    prezziInst = results[5].data || [];
    var agenti = results[3] || [];
    renderPage(config, agenti);
  }).catch(function(e) {
    document.getElementById("sett-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}

function renderPage(config, agenti) {
  var tabs = [
    { id: "generale", label: "Generale", icon: "settings" },
    { id: "etichette", label: "Etichette", icon: "tag" },
    { id: "modelli", label: "Modelli Apparecchio", icon: "thermometer" },
    { id: "prezzi_inst", label: "Prezzi Installazione", icon: "wrench" },
    { id: "utenti", label: "Utenti", icon: "users" },
    { id: "email", label: "Email", icon: "mail" },
    { id: "prezzi", label: "Prezzi Base", icon: "euro" },
    { id: "importexport", label: "Import / Export", icon: "upload" }
  ];

  var h = '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Home</a></div>';
  h += '<div class="kicker">Sistema</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;margin:0 0 20px">Impostazioni</h2>';

  h += '<div class="sett-tabs">';
  tabs.forEach(function(t) {
    h += '<button class="sett-tab' + (settTab === t.id ? " on" : "") + '" data-sett-tab="' + t.id + '"><i data-lucide="' + t.icon + '" style="width:14px;height:14px;vertical-align:-2px"></i> ' + t.label + "</button>";
  });
  h += "</div>";

  /* Tab 1: Generale */
  h += '<div class="sett-panel' + (settTab === "generale" ? " active" : "") + '" id="pan-generale">';
  h += '<div class="g2">';
  h += '<div class="card"><div class="sec-ttl">Prossimo Numero Offerta</div>';
  h += '<div class="fac gap8"><input class="inp" type="number" id="cfg-num" value="' + (config.prossimo_numero || 26000) + '" style="width:140px" />';
  h += '<button class="btn btn-primary btn-sm" id="save-num">Salva</button></div></div>';
  h += '<div class="card"><div class="sec-ttl">Info Applicazione</div>';
  h += '<div style="font-size:.82rem;color:var(--mid)">';
  h += '<div class="mb8"><strong>Versione:</strong> 2.0.0</div>';
  h += "<div><strong>Offerte:</strong> " + (config.totale_offerte_generate || 0) + "</div>";
  h += "</div></div></div></div>";

  /* Tab 2: Etichette */
  h += '<div class="sett-panel' + (settTab === "etichette" ? " active" : "") + '" id="pan-etichette">';
  var categorie = ["tipo_cliente", "stato_pipeline", "tipo_attivita", "motivo_perdita", "tipo_offerta", "tipo_servizio", "settore"];
  var catLabels = {
    tipo_cliente: "Tipo Cliente", stato_pipeline: "Stato Pipeline",
    tipo_attivita: "Tipo Attivita", motivo_perdita: "Motivo Perdita",
    tipo_offerta: "Tipo Offerta", tipo_servizio: "Tipo Servizio", settore: "Settore"
  };
  categorie.forEach(function(cat) {
    var items = etichette.filter(function(e) { return e.categoria === cat; });
    h += '<div class="card mb12"><div class="fjb mb8"><div class="sec-ttl" style="margin:0">' + (catLabels[cat] || cat) + " (" + items.length + ")</div>";
    h += '<button class="btn btn-sm btn-primary" data-add-et="' + cat + '"><i data-lucide="plus" style="width:12px;height:12px"></i></button></div>';
    items.forEach(function(e) {
      h += '<div class="et-row" data-et-id="' + e.id + '">';
      h += '<div class="et-swatch" style="background:' + (e.colore_bg || "#F4F9FD") + '" data-color-et="' + e.id + '"></div>';
      h += '<div class="et-val">' + esc(e.valore) + "</div>";
      h += '<span style="font-size:.68rem;color:var(--muted)">ord: ' + (e.ordine || 0) + "</span>";
      h += '<button class="btn btn-ghost btn-sm" data-del-et="' + e.id + '" style="color:var(--muted)"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>';
      h += "</div>";
    });
    h += "</div>";
  });
  h += "</div>";

  /* Tab: Modelli Apparecchio */
  h += '<div class="sett-panel' + (settTab === "modelli" ? " active" : "") + '" id="pan-modelli">';
  var modCats = [
    { cat: "ripartitore", label: "Ripartitori", icon: "thermometer" },
    { cat: "contatore_acqua", label: "Contatori Acqua", icon: "droplets" },
    { cat: "contatore_calore", label: "Contatori Calore", icon: "flame" },
    { cat: "concentratore", label: "Concentratori", icon: "wifi" }
  ];
  modCats.forEach(function(mc) {
    var items = modelliApp.filter(function(m) { return m.categoria === mc.cat; });
    h += '<div class="card mb12"><div class="fjb mb8"><div class="sec-ttl" style="margin:0"><i data-lucide="' + mc.icon + '" style="width:14px;height:14px;vertical-align:-2px"></i> ' + mc.label + " (" + items.length + ")</div>";
    h += '<button class="btn btn-sm btn-primary" data-add-mod="' + mc.cat + '"><i data-lucide="plus" style="width:12px;height:12px"></i></button></div>';
    h += '<table class="tbl"><thead><tr><th>Nome</th><th>Icona</th><th>Trasm.</th><th>DN</th><th>Lettura</th><th>Attivo</th><th></th></tr></thead><tbody>';
    if (!items.length) h += '<tr><td colspan="7" style="text-align:center;padding:12px;color:var(--muted)">Nessun modello</td></tr>';
    items.forEach(function(m) {
      h += "<tr>";
      h += "<td><strong>" + esc(m.nome) + "</strong></td>";
      h += "<td><i data-lucide='" + (m.icona || "thermometer") + "' style='width:14px;height:14px'></i></td>";
      h += "<td>" + (m.trasmissione_disponibile ? "Si" : "No") + "</td>";
      h += "<td>" + (m.dn_disponibile ? "Si" : "No") + "</td>";
      h += "<td>" + esc(m.tipo_lettura || "\u2014") + "</td>";
      h += '<td><span class="badge ' + (m.attivo ? "b-green" : "b-red") + '">' + (m.attivo ? "Attivo" : "Off") + "</span></td>";
      h += '<td><button class="btn btn-ghost btn-sm" data-del-mod="' + m.id + '" style="color:var(--muted)"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button></td>';
      h += "</tr>";
    });
    h += "</tbody></table></div>";
  });
  h += "</div>";

  /* Tab: Prezzi Installazione */
  h += '<div class="sett-panel' + (settTab === "prezzi_inst" ? " active" : "") + '" id="pan-prezzi-inst">';
  h += '<div class="card"><div class="sec-ttl">Prezzi Installazione Base</div>';
  h += '<table class="tbl"><thead><tr><th>Tipo</th><th>Descrizione</th><th>Prezzo &euro;</th><th>Unita</th></tr></thead><tbody>';
  prezziInst.forEach(function(pi) {
    h += "<tr>";
    h += "<td><strong>" + esc(pi.tipo) + "</strong></td>";
    h += "<td>" + esc(pi.descrizione) + "</td>";
    h += '<td><input class="inp" type="number" step="0.01" value="' + (pi.prezzo_base || 0) + '" data-pi-id="' + pi.id + '" style="width:100px;padding:4px 8px;font-size:.82rem" /></td>';
    h += "<td>" + esc(pi.unita || "cad") + "</td>";
    h += "</tr>";
  });
  h += "</tbody></table>";
  h += '<div class="mt12"><button class="btn btn-primary btn-sm" id="save-prezzi-inst">Salva Prezzi Installazione</button></div>';
  h += "</div></div>";

  /* Tab 5: Utenti */
  h += '<div class="sett-panel' + (settTab === "utenti" ? " active" : "") + '" id="pan-utenti">';
  h += '<div class="fjb mb12"><div class="sec-ttl" style="margin:0">Utenti</div>';
  h += '<button class="btn btn-sm btn-primary" id="btn-new-user"><i data-lucide="plus" style="width:12px;height:12px"></i> Nuovo Utente</button></div>';
  h += '<div id="new-user-form"></div>';
  h += '<div class="card-0"><table class="tbl"><thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Ultimo Accesso</th><th>Stato</th></tr></thead><tbody>';
  if (!users.length) h += '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Nessun utente</td></tr>';
  users.forEach(function(u) {
    h += "<tr><td><strong>" + esc(u.nome + " " + u.cognome) + "</strong></td>";
    h += "<td>" + esc(u.email) + "</td>";
    h += '<td><span class="badge b-blue">' + esc(u.ruolo) + "</span></td>";
    h += "<td>" + (u.last_login ? new Date(u.last_login).toLocaleDateString("it-IT") : "\u2014") + "</td>";
    h += '<td><span class="badge ' + (u.is_active ? "b-green" : "b-red") + '">' + (u.is_active ? "Attivo" : "Disattivato") + "</span></td></tr>";
  });
  h += "</tbody></table></div></div>";

  /* Tab 4: Email */
  h += '<div class="sett-panel' + (settTab === "email" ? " active" : "") + '" id="pan-email">';
  h += '<div class="card"><div class="sec-ttl">Template Email</div>';
  h += '<div style="color:var(--muted);font-size:.85rem;padding:20px 0;text-align:center">';
  h += '<i data-lucide="mail" style="width:24px;height:24px;margin-bottom:8px;display:block;margin:0 auto 8px"></i>';
  h += 'I template email verranno configurati in una fase successiva.<br>Placeholder disponibili: {{nome_cliente}} {{numero_offerta}} {{importo}} {{data}}';
  h += "</div></div></div>";

  /* Tab 5: Prezzi base */
  h += '<div class="sett-panel' + (settTab === "prezzi" ? " active" : "") + '" id="pan-prezzi">';
  h += '<div class="card"><div class="sec-ttl">Prezzi Unitari Default</div>';
  var prezzi = [
    { key: "ripartitore_calore", label: "Ripartitore calore", unit: "\u20ac/cad" },
    { key: "contatore_acqua_radio", label: "Contatore acqua radio", unit: "\u20ac/cad" },
    { key: "contatore_acqua_impulsi", label: "Contatore acqua impulsi", unit: "\u20ac/cad" },
    { key: "contatore_calore_mbus", label: "Contatore calore M-Bus", unit: "\u20ac/cad" },
    { key: "canone_lettura_rk", label: "Canone lettura RK", unit: "\u20ac/app/anno" },
    { key: "canone_lettura_rd", label: "Canone lettura RD", unit: "\u20ac/app/anno" },
    { key: "canone_care", label: "Canone Care", unit: "\u20ac/app/anno" }
  ];
  prezzi.forEach(function(p) {
    var val = config["prezzo_" + p.key] || "";
    h += '<div class="price-row"><div class="price-label">' + esc(p.label) + "</div>";
    h += '<input class="inp" type="number" step="0.01" value="' + val + '" data-prezzo="' + p.key + '" style="width:120px" />';
    h += '<span style="font-size:.72rem;color:var(--muted)">' + p.unit + "</span></div>";
  });
  h += '<div class="mt12"><button class="btn btn-primary btn-sm" id="save-prezzi">Salva Prezzi</button></div>';
  h += "</div></div>";

  /* Tab 8: Import / Export */
  h += '<div class="sett-panel' + (settTab === "importexport" ? " active" : "") + '" id="pan-importexport">';

  h += '<div class="g2 mb20">';
  h += '<div class="card" style="text-align:center"><div class="sec-ttl">Esporta Offerte</div>';
  h += '<div style="font-size:.82rem;color:var(--muted);margin-bottom:12px">Scarica CSV con tutte le offerte attive</div>';
  h += '<a href="/api/export/offerte" class="btn btn-primary btn-sm" style="text-decoration:none"><i data-lucide="download" style="width:14px;height:14px"></i> Scarica CSV Offerte</a></div>';
  h += '<div class="card" style="text-align:center"><div class="sec-ttl">Esporta Clienti</div>';
  h += '<div style="font-size:.82rem;color:var(--muted);margin-bottom:12px">Scarica CSV con tutti i clienti in anagrafica</div>';
  h += '<a href="/api/export/clienti" class="btn btn-primary btn-sm" style="text-decoration:none"><i data-lucide="download" style="width:14px;height:14px"></i> Scarica CSV Clienti</a></div>';
  h += "</div>";

  h += '<div class="g2 mb20">';
  h += '<div class="card"><div class="sec-ttl">Importa Offerte</div>';
  h += '<div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">Carica un file CSV con il tracciato standard</div>';
  h += '<a href="/api/import/template/offerte" style="font-size:.72rem;color:var(--blue)">Scarica template CSV offerte</a>';
  h += '<div class="mt12"><input type="file" accept=".csv" id="import-offerte-file" style="font-size:.78rem" /></div>';
  h += '<button class="btn btn-sm btn-primary mt8" id="btn-import-offerte" disabled>Importa Offerte</button>';
  h += '<div id="import-offerte-result" class="mt8" style="font-size:.78rem"></div>';
  h += "</div>";

  h += '<div class="card"><div class="sec-ttl">Importa Clienti</div>';
  h += '<div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">Carica un file CSV con il tracciato standard</div>';
  h += '<a href="/api/import/template/clienti" style="font-size:.72rem;color:var(--blue)">Scarica template CSV clienti</a>';
  h += '<div class="mt12"><input type="file" accept=".csv" id="import-clienti-file" style="font-size:.78rem" /></div>';
  h += '<button class="btn btn-sm btn-primary mt8" id="btn-import-clienti" disabled>Importa Clienti</button>';
  h += '<div id="import-clienti-result" class="mt8" style="font-size:.78rem"></div>';
  h += "</div></div></div>";

  document.getElementById("sett-page").innerHTML = h;
  icons();
  attachEvents(config, agenti);
}

function attachEvents(config, agenti) {
  /* Tab switching */
  document.querySelectorAll("[data-sett-tab]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      settTab = this.getAttribute("data-sett-tab");
      loadPage();
    });
  });

  /* Save numero */
  var saveNum = document.getElementById("save-num");
  if (saveNum) saveNum.addEventListener("click", function() {
    var val = document.getElementById("cfg-num").value;
    api("POST", "/api/config", { prossimo_numero: parseInt(val) }).then(function() {
      alert("Salvato: " + val);
    });
  });

  /* Delete etichetta */
  document.querySelectorAll("[data-del-et]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var eid = parseInt(this.getAttribute("data-del-et"));
      if (confirm("Eliminare etichetta?")) {
        api("DELETE", "/api/etichette/" + eid).then(function() { loadPage(); });
      }
    });
  });

  /* Add etichetta */
  document.querySelectorAll("[data-add-et]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var cat = this.getAttribute("data-add-et");
      var val = prompt("Nuovo valore per " + cat + ":");
      if (val) {
        api("POST", "/api/etichette", { categoria: cat, valore: val }).then(function() { loadPage(); });
      }
    });
  });

  /* Add modello */
  document.querySelectorAll("[data-add-mod]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var cat = this.getAttribute("data-add-mod");
      var nome = prompt("Nome modello per " + cat + ":");
      if (nome) {
        api("POST", "/api/modelli", { categoria: cat, nome: nome }).then(function() { loadPage(); });
      }
    });
  });

  /* Delete modello */
  document.querySelectorAll("[data-del-mod]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var mid = parseInt(this.getAttribute("data-del-mod"));
      if (confirm("Eliminare modello?")) {
        api("DELETE", "/api/modelli/" + mid).then(function() { loadPage(); });
      }
    });
  });

  /* Save prezzi installazione */
  var savePrezziInst = document.getElementById("save-prezzi-inst");
  if (savePrezziInst) savePrezziInst.addEventListener("click", function() {
    var inputs = document.querySelectorAll("[data-pi-id]");
    var promises = [];
    inputs.forEach(function(inp) {
      var pid = parseInt(inp.getAttribute("data-pi-id"));
      promises.push(api("PATCH", "/api/prezzi-installazione/" + pid, { prezzo_base: parseFloat(inp.value) || 0 }));
    });
    Promise.all(promises).then(function() { alert("Prezzi installazione salvati"); });
  });

  /* New user */
  var btnUser = document.getElementById("btn-new-user");
  if (btnUser) btnUser.addEventListener("click", function() {
    var area = document.getElementById("new-user-form");
    area.innerHTML = '<div class="card mb12"><div class="form-grid">' +
      '<div class="form-field"><label>Nome *</label><input class="inp" id="nu-nome" /></div>' +
      '<div class="form-field"><label>Cognome *</label><input class="inp" id="nu-cognome" /></div>' +
      '<div class="form-field"><label>Email *</label><input class="inp" id="nu-email" type="email" /></div>' +
      '<div class="form-field"><label>Password</label><input class="inp" id="nu-pw" value="ulteria2026" /></div>' +
      '<div class="form-field"><label>Ruolo</label><select class="inp" id="nu-ruolo"><option value="admin">Admin</option><option value="staff">Staff</option><option value="agente" selected>Agente</option></select></div>' +
      '<div class="form-field"><label>Agente collegato</label><select class="inp" id="nu-agente"><option value="">-- Nessuno --</option>' +
      (agenti || []).map(function(a) { return '<option value="' + a.id + '">' + esc(a.nome + " " + a.cognome) + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="fac gap6 mt8"><button class="btn btn-primary btn-sm" id="save-user">Salva</button><button class="btn btn-sec btn-sm" id="cancel-user">Annulla</button></div></div>';
    icons();
    document.getElementById("cancel-user").addEventListener("click", function() { area.innerHTML = ""; });
    document.getElementById("save-user").addEventListener("click", function() {
      var nome = document.getElementById("nu-nome").value;
      var cognome = document.getElementById("nu-cognome").value;
      var email = document.getElementById("nu-email").value;
      if (!nome || !cognome || !email) { alert("Compila tutti i campi obbligatori"); return; }
      api("POST", "/api/users", {
        nome: nome, cognome: cognome, email: email,
        password: document.getElementById("nu-pw").value,
        ruolo: document.getElementById("nu-ruolo").value,
        agente_id: document.getElementById("nu-agente").value || null
      }).then(function(res) {
        if (res.ok) { area.innerHTML = ""; loadPage(); }
        else alert(res.error || "Errore");
      });
    });
  });

  /* Save prezzi */
  var savePrezzi = document.getElementById("save-prezzi");
  if (savePrezzi) savePrezzi.addEventListener("click", function() {
    var data = {};
    document.querySelectorAll("[data-prezzo]").forEach(function(inp) {
      data["prezzo_" + inp.getAttribute("data-prezzo")] = parseFloat(inp.value) || 0;
    });
    api("POST", "/api/config", data).then(function() { alert("Prezzi salvati"); });
  });

  /* Import offerte */
  var impOffFile = document.getElementById("import-offerte-file");
  var btnImpOff = document.getElementById("btn-import-offerte");
  if (impOffFile && btnImpOff) {
    impOffFile.addEventListener("change", function() { btnImpOff.disabled = !this.files.length; });
    btnImpOff.addEventListener("click", function() {
      var formData = new FormData();
      formData.append("file", impOffFile.files[0]);
      fetch("/api/import/offerte", { method: "POST", body: formData })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          var area = document.getElementById("import-offerte-result");
          if (res.ok) {
            var d = res.data;
            area.innerHTML = '<div style="color:#639922">Importate: ' + d.imported + " | Saltate: " + d.skipped + (d.errors && d.errors.length ? " | Errori: " + d.errors.length : "") + "</div>";
          } else {
            area.innerHTML = '<div style="color:#ef4444">' + (res.error || "Errore") + "</div>";
          }
        });
    });
  }

  /* Import clienti */
  var impCliFile = document.getElementById("import-clienti-file");
  var btnImpCli = document.getElementById("btn-import-clienti");
  if (impCliFile && btnImpCli) {
    impCliFile.addEventListener("change", function() { btnImpCli.disabled = !this.files.length; });
    btnImpCli.addEventListener("click", function() {
      var formData = new FormData();
      formData.append("file", impCliFile.files[0]);
      fetch("/api/import/clienti", { method: "POST", body: formData })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          var area = document.getElementById("import-clienti-result");
          if (res.ok) {
            var d = res.data;
            area.innerHTML = '<div style="color:#639922">Importati: ' + d.imported + " | Aggiornati: " + d.updated + " | Saltati: " + d.skipped + "</div>";
          } else {
            area.innerHTML = '<div style="color:#ef4444">' + (res.error || "Errore") + "</div>";
          }
        });
    });
  }
}

document.addEventListener("DOMContentLoaded", function() { loadPage(); });
