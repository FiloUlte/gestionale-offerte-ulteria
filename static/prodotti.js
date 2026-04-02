/* ══════════════════════════════════════════════════════════════
   Ulteria — Pagina Prodotti e Listino /prodotti
   ══════════════════════════════════════════════════════════════ */

var prodotti = [];
var modelli = [];
var catFilter = "";
var searchQ = "";
var showDaAggiornare = false;

function api(method, url, body) {
  var opts = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) { return r.json(); });
}

function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function icons() { try { lucide.createIcons(); } catch (e) { /* */ } }

function fmtEur(v) {
  if (v === null || v === undefined) return "\u2014";
  return "\u20ac " + parseFloat(v).toFixed(2).replace(".", ",");
}

function fmtDataIt(d) {
  if (!d) return "";
  var dt = new Date(d);
  var mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  return dt.getDate() + " " + mesi[dt.getMonth()] + " " + dt.getFullYear();
}

function calcMargine(acq, ven) {
  if (!acq || !ven || acq === 0) return null;
  return ((ven - acq) / acq * 100);
}

function margineBadge(m) {
  if (m === null || m === undefined) return '<span class="price-null">N/D</span>';
  var cls = m < 20 ? "margine-low" : (m < 35 ? "margine-mid" : (m < 50 ? "margine-good" : "margine-great"));
  return '<span class="margine-badge ' + cls + '">' + m.toFixed(1) + "%</span>";
}

function isPriceOld(d) {
  if (!d) return true;
  var dt = new Date(d);
  var sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() - 6);
  return dt < sixMonths;
}

var CAT_LABELS = {
  ripartitore: "Ripartitore",
  contatore_acqua: "Contatore Acqua",
  contatore_calore: "Contatore Calore",
  concentratore: "Concentratore",
  materiale: "Materiale",
  servizio: "Servizio"
};

function toast(msg, type) {
  var container = document.getElementById("toast-c");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-c";
    container.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:flex-end";
    document.body.appendChild(container);
  }
  var colors = { ok: "#639922", error: "#ef4444", info: "#009FE3" };
  var t = document.createElement("div");
  t.style.cssText = "padding:10px 16px;border-radius:8px;font-size:.82rem;font-weight:600;color:#fff;background:" + (colors[type] || colors.info) + ";box-shadow:0 4px 12px rgba(0,0,0,.15);transform:translateX(100%);transition:transform .3s;max-width:320px;font-family:inherit";
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(function() { t.style.transform = "translateX(0)"; });
  while (container.children.length > 3) container.removeChild(container.firstChild);
  setTimeout(function() {
    t.style.transform = "translateX(100%)";
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
  }, 3000);
}


/* ─── LOAD ─── */

function loadPage() {
  Promise.all([
    api("GET", "/api/prodotti"),
    api("GET", "/api/modelli")
  ]).then(function(r) {
    prodotti = r[0].data || [];
    modelli = r[1].data || [];
    renderPage();
  }).catch(function(e) {
    document.getElementById("prod-page").innerHTML = '<div class="alert a-warn">Errore: ' + e.message + "</div>";
  });
}


/* ─── RENDER ─── */

function renderPage() {
  var filtered = filterProdotti();

  /* KPI */
  var totAttivi = prodotti.filter(function(p) { return p.attivo; }).length;
  var cats = {};
  prodotti.forEach(function(p) { cats[p.categoria] = true; });
  var numCats = Object.keys(cats).length;
  var margini = [];
  prodotti.forEach(function(p) {
    var m = calcMargine(p.prezzo_acquisto, p.prezzo_vendita);
    if (m !== null) margini.push(m);
  });
  var avgMargine = margini.length > 0 ? (margini.reduce(function(a, b) { return a + b; }, 0) / margini.length) : 0;
  var daAgg = prodotti.filter(function(p) { return p.attivo && isPriceOld(p.data_ultimo_prezzo); }).length;

  var h = "";

  /* Back */
  h += '<div style="margin-bottom:12px"><a href="/" style="font-size:.82rem;color:var(--muted);text-decoration:none"><i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:-2px"></i> Home</a></div>';

  /* Header */
  h += '<div class="fjb prod-header">';
  h += "<div>";
  h += '<div class="kicker">Gestione</div>';
  h += '<h2 style="font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin:0">Prodotti e Listino Prezzi</h2>';
  h += '<div class="prod-sub">Catalogo apparecchi con prezzi acquisto, vendita e margini. Aggiorna i prezzi quando ricevi nuovi listini dai fornitori.</div>';
  h += "</div>";
  h += '<button class="btn btn-primary" id="btn-new-prod"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Prodotto</button>';
  h += "</div>";

  /* KPI */
  h += '<div class="g4 mb20">';
  h += '<div class="kpi"><div class="kpi-l">Prodotti Attivi</div><div class="kpi-v kv-blue">' + totAttivi + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Categorie</div><div class="kpi-v">' + numCats + "</div></div>";
  h += '<div class="kpi"><div class="kpi-l">Margine Medio</div><div class="kpi-v">' + avgMargine.toFixed(1) + "%</div></div>";
  h += '<div class="kpi' + (daAgg > 0 ? " kpi-warn" : "") + '"><div class="kpi-l">Da Aggiornare</div><div class="kpi-v" style="color:' + (daAgg > 0 ? "#f59e0b" : "var(--text)") + '">' + daAgg + "</div></div>";
  h += "</div>";

  /* Filters */
  h += '<div class="filter-tabs">';
  var tabCats = [
    { val: "", label: "Tutti" },
    { val: "ripartitore", label: "Ripartitori" },
    { val: "contatore_acqua", label: "Contatori Acqua" },
    { val: "contatore_calore", label: "Contatori Calore" },
    { val: "concentratore", label: "Concentratori" },
    { val: "materiale", label: "Materiali" },
    { val: "servizio", label: "Servizi" }
  ];
  tabCats.forEach(function(t) {
    h += '<button class="filter-tab' + (catFilter === t.val ? " on" : "") + '" data-cat-filter="' + t.val + '">' + t.label + "</button>";
  });
  h += "</div>";

  h += '<div class="fac gap8 mb16">';
  h += '<input class="inp" id="prod-search" placeholder="Cerca per nome o codice..." value="' + esc(searchQ) + '" style="width:250px;padding:6px 10px;font-size:.78rem" />';
  h += '<label style="font-size:.78rem;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--mid)"><input type="checkbox" id="chk-da-agg"' + (showDaAggiornare ? " checked" : "") + ' /> Solo da aggiornare</label>';
  h += "</div>";

  /* Table */
  h += '<div class="card-0"><div class="scx"><table class="tbl" id="prod-tbl"><thead><tr>';
  h += "<th>Codice</th><th>Nome / Modello</th><th>Categoria</th><th>Acquisto</th><th>Vendita</th><th>Margine</th><th>Ultimo prezzo</th><th>Fornitore</th><th>Azioni</th>";
  h += "</tr></thead><tbody>";

  if (filtered.length === 0) {
    h += '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted)">Nessun prodotto</td></tr>';
  }

  filtered.forEach(function(p) {
    var m = calcMargine(p.prezzo_acquisto, p.prezzo_vendita);
    var old = isPriceOld(p.data_ultimo_prezzo);
    var catCls = "cat-" + (p.categoria || "materiale");

    h += '<tr data-pid="' + p.id + '">';
    h += '<td class="mono" style="font-weight:700">' + esc(p.codice) + "</td>";
    h += '<td><strong>' + esc(p.nome) + "</strong>";
    if (p.modello) h += '<br><span style="font-size:.72rem;color:var(--muted)">' + esc(p.modello) + "</span>";
    h += "</td>";
    h += '<td><span class="cat-badge ' + catCls + '">' + esc(CAT_LABELS[p.categoria] || p.categoria) + "</span></td>";
    h += '<td class="num" data-field="prezzo_acquisto">' + (p.prezzo_acquisto != null ? fmtEur(p.prezzo_acquisto) : "\u2014") + "</td>";
    h += '<td class="num" data-field="prezzo_vendita">' + (p.prezzo_vendita != null ? fmtEur(p.prezzo_vendita) : "\u2014") + "</td>";
    h += "<td>" + margineBadge(m) + "</td>";
    h += "<td>";
    if (!p.data_ultimo_prezzo) {
      h += '<span class="price-null">Mai aggiornato</span>';
    } else if (old) {
      h += '<span class="price-warn"><i data-lucide="alert-triangle" style="width:12px;height:12px;vertical-align:-2px"></i> ' + fmtDataIt(p.data_ultimo_prezzo) + "</span>";
    } else {
      h += fmtDataIt(p.data_ultimo_prezzo);
    }
    h += "</td>";
    h += "<td>" + esc(p.fornitore || "") + "</td>";
    h += '<td><div class="act-btns">';
    h += '<button class="act-btn act-docx" data-edit-prod="' + p.id + '" title="Modifica"><i data-lucide="edit" style="width:12px;height:12px"></i></button>';
    h += '<button class="act-btn act-mail" data-storico-prod="' + p.id + '" title="Storico"><i data-lucide="clock" style="width:12px;height:12px"></i></button>';
    h += '<button class="act-btn act-del" data-del-prod="' + p.id + '" title="Elimina"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>';
    h += "</div></td></tr>";
  });

  h += "</tbody></table></div></div>";

  document.getElementById("prod-page").innerHTML = h;
  icons();
  attachEvents();
}


/* ─── FILTER ─── */

function filterProdotti() {
  var list = prodotti.slice();
  if (catFilter) {
    list = list.filter(function(p) { return p.categoria === catFilter; });
  }
  if (searchQ) {
    var q = searchQ.toLowerCase();
    list = list.filter(function(p) {
      return (p.nome || "").toLowerCase().indexOf(q) >= 0 || (p.codice || "").toLowerCase().indexOf(q) >= 0;
    });
  }
  if (showDaAggiornare) {
    list = list.filter(function(p) { return isPriceOld(p.data_ultimo_prezzo); });
  }
  return list;
}


/* ─── EVENTS ─── */

function attachEvents() {
  /* Back */
  /* Category filters */
  document.querySelectorAll("[data-cat-filter]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      catFilter = this.getAttribute("data-cat-filter");
      renderPage();
    });
  });

  /* Search */
  var searchInp = document.getElementById("prod-search");
  var searchTimer = null;
  if (searchInp) {
    searchInp.addEventListener("input", function() {
      var val = this.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function() { searchQ = val; renderPage(); }, 300);
    });
  }

  /* Da aggiornare toggle */
  var chkAgg = document.getElementById("chk-da-agg");
  if (chkAgg) {
    chkAgg.addEventListener("change", function() { showDaAggiornare = this.checked; renderPage(); });
  }

  /* New product */
  var btnNew = document.getElementById("btn-new-prod");
  if (btnNew) btnNew.addEventListener("click", function() { showProdModal(null); });

  /* Edit */
  document.querySelectorAll("[data-edit-prod]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var pid = parseInt(this.getAttribute("data-edit-prod"));
      var p = prodotti.find(function(x) { return x.id === pid; });
      if (p) showProdModal(p);
    });
  });

  /* Storico */
  document.querySelectorAll("[data-storico-prod]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      showStorico(parseInt(this.getAttribute("data-storico-prod")));
    });
  });

  /* Delete */
  document.querySelectorAll("[data-del-prod]").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var pid = parseInt(this.getAttribute("data-del-prod"));
      if (confirm("Eliminare questo prodotto?")) {
        api("DELETE", "/api/prodotti/" + pid).then(function() {
          toast("Prodotto eliminato", "ok");
          loadPage();
        });
      }
    });
  });

  /* Inline editing on double click for price cells */
  document.querySelectorAll("td[data-field]").forEach(function(td) {
    td.addEventListener("dblclick", function() {
      var pid = parseInt(td.parentElement.getAttribute("data-pid"));
      var field = td.getAttribute("data-field");
      editPriceCell(td, pid, field);
    });
  });
}


/* ─── INLINE PRICE EDIT ─── */

function editPriceCell(td, pid, field) {
  if (td.querySelector("input")) return;
  var p = prodotti.find(function(x) { return x.id === pid; });
  var val = p ? p[field] : "";

  var inp = document.createElement("input");
  inp.className = "cell-edit";
  inp.type = "number";
  inp.step = "0.01";
  inp.value = val || "";
  td.textContent = "";
  td.appendChild(inp);
  inp.focus();
  inp.select();

  function save() {
    var data = {};
    data[field] = parseFloat(inp.value) || null;
    api("PATCH", "/api/prodotti/" + pid, data).then(function() {
      toast("Prezzo salvato", "ok");
      loadPage();
    });
  }
  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") renderPage();
  });
  inp.addEventListener("blur", save);
}


/* ─── MODAL PRODOTTO ─── */

function showProdModal(existing) {
  closeModal();
  var isEdit = !!existing;

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.id = "modal-overlay";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) closeModal(); });

  var modal = document.createElement("div");
  modal.className = "modal";
  modal.style.width = "620px";

  /* Header */
  var header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = "<h2>" + (isEdit ? "Modifica Prodotto" : "Nuovo Prodotto") + "</h2>";
  var closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-ghost btn-sm";
  closeBtn.innerHTML = '<i data-lucide="x" style="width:16px;height:16px"></i>';
  closeBtn.addEventListener("click", closeModal);
  header.appendChild(closeBtn);

  /* Body */
  var body = document.createElement("div");
  body.className = "modal-body";

  var catOpts = '<option value="">-- Seleziona --</option>';
  var cats = ["ripartitore", "contatore_acqua", "contatore_calore", "concentratore", "materiale", "servizio"];
  cats.forEach(function(c) {
    catOpts += '<option value="' + c + '"' + (existing && existing.categoria === c ? " selected" : "") + ">" + (CAT_LABELS[c] || c) + "</option>";
  });

  var modOpts = '<option value="">-- Nessuno --</option>';
  modelli.forEach(function(m) {
    modOpts += '<option value="' + esc(m.nome) + '"' + (existing && existing.modello === m.nome ? " selected" : "") + ">" + esc(m.nome) + " (" + esc(CAT_LABELS[m.categoria] || m.categoria) + ")</option>";
  });

  var bh = "";
  bh += '<div class="sec-ttl">Identificazione</div>';
  bh += '<div class="form-grid mb16">';
  bh += '<div class="form-field"><label>Codice *</label><input class="inp" id="mp-codice" value="' + esc(existing ? existing.codice : "") + '" style="text-transform:uppercase"' + (isEdit ? " readonly" : "") + " /></div>";
  bh += '<div class="form-field"><label>Nome *</label><input class="inp" id="mp-nome" value="' + esc(existing ? existing.nome : "") + '" /></div>';
  bh += '<div class="form-field"><label>Categoria *</label><select class="inp" id="mp-cat">' + catOpts + "</select></div>";
  bh += '<div class="form-field"><label>Modello</label><select class="inp" id="mp-modello">' + modOpts + "</select></div>";
  bh += '<div class="form-field"><label>Fornitore</label><input class="inp" id="mp-fornitore" value="' + esc(existing ? existing.fornitore || "" : "") + '" /></div>';
  bh += "</div>";

  bh += '<div class="sec-ttl">Specifiche Tecniche</div>';
  bh += '<div class="form-grid mb16">';
  bh += '<div class="form-field"><label>Trasmissione</label><select class="inp" id="mp-trasm"><option value="">N/A</option><option value="radio"' + (existing && existing.trasmissione === "radio" ? " selected" : "") + ">Radio</option><option value='mbus'" + (existing && existing.trasmissione === "mbus" ? " selected" : "") + ">M-Bus</option></select></div>";
  bh += '<div class="form-field"><label>DN</label><select class="inp" id="mp-dn"><option value="">N/A</option><option value="DN15"' + (existing && existing.dn === "DN15" ? " selected" : "") + ">DN15</option><option value='DN20'" + (existing && existing.dn === "DN20" ? " selected" : "") + ">DN20</option><option value='DN25'" + (existing && existing.dn === "DN25" ? " selected" : "") + ">DN25</option><option value='DN32'" + (existing && existing.dn === "DN32" ? " selected" : "") + ">DN32</option></select></div>";
  bh += "</div>";

  bh += '<div class="sec-ttl">Prezzi</div>';
  bh += '<div class="form-grid mb16">';
  bh += '<div class="form-field"><label>Prezzo Acquisto &euro;</label><input class="inp" type="number" step="0.01" id="mp-acq" value="' + (existing && existing.prezzo_acquisto != null ? existing.prezzo_acquisto : "") + '" /></div>';
  bh += '<div class="form-field"><label>Prezzo Vendita &euro;</label><input class="inp" type="number" step="0.01" id="mp-ven" value="' + (existing && existing.prezzo_vendita != null ? existing.prezzo_vendita : "") + '" /></div>';
  bh += '<div class="form-field"><label>Margine</label><div id="mp-margine-live" style="padding:8px 0;font-size:.9rem;font-weight:700">\u2014</div></div>';
  bh += '<div class="form-field"><label>Data aggiornamento</label><input class="inp" type="date" id="mp-data" value="' + (existing && existing.data_ultimo_prezzo ? existing.data_ultimo_prezzo : new Date().toISOString().substring(0, 10)) + '" /></div>';
  bh += '</div>';
  bh += '<div class="form-field"><label>Note</label><textarea class="inp" id="mp-note" rows="2">' + esc(existing ? existing.note || "" : "") + "</textarea></div>";

  body.innerHTML = bh;

  /* Footer */
  var footer = document.createElement("div");
  footer.className = "modal-footer";
  var btnCancel = document.createElement("button");
  btnCancel.className = "btn btn-sec";
  btnCancel.textContent = "Annulla";
  btnCancel.addEventListener("click", closeModal);
  var btnSave = document.createElement("button");
  btnSave.className = "btn btn-primary";
  btnSave.textContent = isEdit ? "Salva" : "Crea";
  btnSave.addEventListener("click", function() {
    var codice = document.getElementById("mp-codice").value.trim().toUpperCase();
    var nome = document.getElementById("mp-nome").value.trim();
    var cat = document.getElementById("mp-cat").value;
    if (!codice || !nome || !cat) { alert("Codice, nome e categoria obbligatori"); return; }

    var payload = {
      codice: codice, nome: nome, categoria: cat,
      modello: document.getElementById("mp-modello").value || null,
      trasmissione: document.getElementById("mp-trasm").value || null,
      dn: document.getElementById("mp-dn").value || null,
      prezzo_acquisto: parseFloat(document.getElementById("mp-acq").value) || null,
      prezzo_vendita: parseFloat(document.getElementById("mp-ven").value) || null,
      data_ultimo_prezzo: document.getElementById("mp-data").value || null,
      fornitore: document.getElementById("mp-fornitore").value || null,
      note: document.getElementById("mp-note").value || null
    };

    var method = isEdit ? "PATCH" : "POST";
    var url = isEdit ? "/api/prodotti/" + existing.id : "/api/prodotti";
    api(method, url, payload).then(function(res) {
      if (res.ok) {
        closeModal();
        toast(isEdit ? "Prodotto aggiornato" : "Prodotto creato", "ok");
        loadPage();
      } else {
        alert(res.error || "Errore");
      }
    });
  });
  footer.appendChild(btnCancel);
  footer.appendChild(btnSave);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  icons();

  /* Live margine update */
  function updateMargine() {
    var acq = parseFloat(document.getElementById("mp-acq").value) || 0;
    var ven = parseFloat(document.getElementById("mp-ven").value) || 0;
    var m = calcMargine(acq, ven);
    document.getElementById("mp-margine-live").innerHTML = margineBadge(m);
  }
  updateMargine();
  var acqInp = document.getElementById("mp-acq");
  var venInp = document.getElementById("mp-ven");
  if (acqInp) acqInp.addEventListener("input", updateMargine);
  if (venInp) venInp.addEventListener("input", updateMargine);
}


/* ─── STORICO MODAL ─── */

function showStorico(pid) {
  var p = prodotti.find(function(x) { return x.id === pid; });
  api("GET", "/api/prodotti/" + pid + "/storico").then(function(res) {
    closeModal();
    var data = res.data || [];

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay show";
    overlay.id = "modal-overlay";
    overlay.addEventListener("click", function(e) { if (e.target === overlay) closeModal(); });

    var modal = document.createElement("div");
    modal.className = "modal";
    modal.style.width = "500px";

    var header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = "<h2>Storico Prezzi" + (p ? " &mdash; " + esc(p.nome) : "") + "</h2>";
    var closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-ghost btn-sm";
    closeBtn.innerHTML = '<i data-lucide="x" style="width:16px;height:16px"></i>';
    closeBtn.addEventListener("click", closeModal);
    header.appendChild(closeBtn);

    var body = document.createElement("div");
    body.className = "modal-body";

    if (data.length === 0) {
      body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)"><i data-lucide="clock" style="width:24px;height:24px;margin-bottom:8px;display:block;margin:0 auto 8px"></i>Nessun aggiornamento registrato</div>';
    } else {
      var bh = "";
      data.forEach(function(s) {
        bh += '<div class="storico-item">';
        bh += '<div class="storico-date">' + fmtDataIt(s.created_at) + (s.aggiornato_da ? " &mdash; " + esc(s.aggiornato_da) : "") + "</div>";
        bh += '<div class="storico-detail">';
        bh += "Acquisto: " + fmtEur(s.prezzo_acquisto_precedente) + ' <span class="storico-arrow">&rarr;</span> ' + fmtEur(s.prezzo_acquisto_nuovo);
        bh += "<br>Vendita: " + fmtEur(s.prezzo_vendita_precedente) + ' <span class="storico-arrow">&rarr;</span> ' + fmtEur(s.prezzo_vendita_nuovo);
        var mOld = calcMargine(s.prezzo_acquisto_precedente, s.prezzo_vendita_precedente);
        var mNew = calcMargine(s.prezzo_acquisto_nuovo, s.prezzo_vendita_nuovo);
        if (mOld !== null && mNew !== null) {
          var diff = mNew - mOld;
          bh += '<br>Margine: ' + (diff >= 0 ? "+" : "") + diff.toFixed(1) + " pp";
        }
        bh += "</div></div>";
      });
      body.innerHTML = bh;
    }

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    icons();
  });
}


function closeModal() {
  var el = document.getElementById("modal-overlay");
  if (el) el.remove();
}


/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", function() { loadPage(); });
