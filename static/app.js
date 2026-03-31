/* ══════════════════════════════════════════════════════════════
   Ulteria Gestionale Offerte — Frontend JS v3
   ══════════════════════════════════════════════════════════════ */

var currentView = "dashboard";
var offerte = [];
var clienti = [];
var agenti = [];
var sortCol = null;
var sortDir = "desc";
var searchTerm = "";
var wizardStep = 1;
var wizardData = { template: "", nome_studio: "", nome_condominio: "", via: "", cap: "", citta: "", email_studio: "", modalita: "vendita", prezzo_fornitura: "", prezzo_care: "", canone_lettura: "", note: "", salva_cliente: false, agente_id: "" };

var AGENTE_COLORS = ["#009FE3","#22c55e","#f59e0b","#ef4444","#7c3aed","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

var STATI = [
  { value: "richiamato", label: "Richiamato", color: "#f59e0b", cls: "stato-richiamato" },
  { value: "in_attesa_assemblea", label: "In Attesa Assemblea", color: "#0ea5e9", cls: "stato-in_attesa_assemblea" },
  { value: "preso_lavoro", label: "Preso Lavoro", color: "#22c55e", cls: "stato-preso_lavoro" },
  { value: "perso", label: "Perso", color: "#ef4444", cls: "stato-perso" },
  { value: "rimandato", label: "Rimandato", color: "#7c3aed", cls: "stato-rimandato" }
];

function statoInfo(val) {
  for (var i = 0; i < STATI.length; i++) { if (STATI[i].value === val) return STATI[i]; }
  return STATI[0];
}

// ─── NAV ───
function navigate(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(function(el) {
    el.classList.toggle("active", el.getAttribute("data-view") === view);
  });
  var titles = { dashboard: "Riepilogo Offerte", nuova: "Nuova Offerta", clienti: "Anagrafica Clienti", agenti: "Agenti", impostazioni: "Impostazioni" };
  document.getElementById("bc-title").textContent = titles[view] || "";
  renderView();
}

function renderView() {
  console.log("[renderView] currentView =", currentView);
  var c = document.getElementById("content");
  if (currentView === "dashboard") renderDashboard(c);
  else if (currentView === "nuova") renderNuova(c);
  else if (currentView === "clienti") renderClienti(c);
  else if (currentView === "agenti") renderAgenti(c);
  else if (currentView === "impostazioni") renderImpostazioni(c);
  try { lucide.createIcons(); } catch(e) { console.error("lucide error:", e); }
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
  return new Date(d).toLocaleDateString("it-IT");
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
  return fetch(url, opts).then(function(r) {
    if (!r.ok) {
      return r.text().then(function(t) { throw new Error("HTTP " + r.status + ": " + t.substring(0, 200)); });
    }
    return r.json();
  });
}

function getAgente(id) {
  if (!id) return null;
  for (var i = 0; i < agenti.length; i++) { if (agenti[i].id === id) return agenti[i]; }
  return null;
}

function agenteInitials(a) {
  if (!a) return "";
  return ((a.nome || "")[0] || "").toUpperCase() + ((a.cognome || "")[0] || "").toUpperCase();
}

function agenteBadgeHtml(agente_id) {
  var a = getAgente(agente_id);
  if (!a) return '<span style="color:var(--muted);font-size:.75rem">\u2014</span>';
  var col = a.colore || "#009FE3";
  var ini = agenteInitials(a);
  return '<span class="agente-pill" style="--ag-color:' + col + '"><span class="agente-dot" style="background:' + col + '">' + ini + '</span>' + escHtml(a.nome) + '</span>';
}


// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

function renderDashboard(container) {
  Promise.all([api("GET", "/api/offerte"), api("GET", "/api/agenti")]).then(function(r) {
    offerte = r[0]; agenti = r[1];
    buildDashboard(container);
    lucide.createIcons();
  }).catch(function(e) {
    container.innerHTML = '<div class="alert a-warn">Errore caricamento dashboard: ' + e.message + '</div>';
    console.error("renderDashboard error:", e);
  });
}

function buildDashboard(container) {
  var total = offerte.length, valTot = 0, aperte = 0, presi = 0;
  offerte.forEach(function(o) {
    if (o.totale) valTot += o.totale;
    if (o.stato === "richiamato" || o.stato === "in_attesa_assemblea" || o.stato === "rimandato") aperte++;
    if (o.stato === "preso_lavoro") presi++;
  });
  var filtered = filterAndSort(offerte);
  var html = '';

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
  html += '<button class="btn btn-sec" onclick="creaRigaVuota()"><i data-lucide="rows-3" style="width:14px;height:14px"></i> Crea Riga</button>';
  html += '<button class="btn btn-sec" onclick="esportaCsv()"><i data-lucide="download" style="width:14px;height:14px"></i> Esporta Csv</button>';
  html += '</div></div>';

  // Table
  html += '<div class="card-0"><div class="scx"><table class="tbl"><thead><tr>';
  var cols = [
    {key:"numero",label:"N\u00b0"},{key:"data_creazione",label:"Data"},{key:"nome_studio",label:"Cliente"},
    {key:"nome_condominio",label:"Condominio"},{key:"via",label:"Via e Citt\u00e0"},{key:"riferimento",label:"Riferimento"},
    {key:"agente_id",label:"Agente"},{key:"prezzo_fornitura",label:"Fornitura \u20ac",cls:"r"},
    {key:"prezzo_care",label:"Care \u20ac",cls:"r"},{key:"canone_lettura",label:"Lettura \u20ac",cls:"r"},
    {key:"stato",label:"Stato"},{key:"_actions",label:"Azioni"}
  ];
  cols.forEach(function(c) {
    var sorted = sortCol === c.key;
    var arrow = sorted ? (sortDir === "asc" ? " \u25b2" : " \u25bc") : " \u25b4";
    html += c.key === "_actions" ? '<th>' + c.label + '</th>' : '<th class="' + (c.cls||"") + (sorted?" sorted":"") + '" onclick="toggleSort(\'' + c.key + '\')">' + c.label + '<span class="sort-arrow">' + arrow + '</span></th>';
  });
  html += '</tr></thead><tbody>';

  if (filtered.length === 0) html += '<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--muted)">Nessuna offerta trovata</td></tr>';

  filtered.forEach(function(o) {
    var viaCitta = (o.via || "");
    if (o.cap || o.citta) { if (viaCitta) viaCitta += ", "; if (o.cap) viaCitta += o.cap + " "; if (o.citta) viaCitta += o.citta; }
    var si = statoInfo(o.stato);
    var hasDocx = !!o.path_docx, hasPdf = !!o.path_pdf;
    var canGen = o.nome_studio && o.template && (o.prezzo_fornitura||o.prezzo_fornitura===0) && (o.prezzo_care||o.prezzo_care===0) && (o.canone_lettura||o.canone_lettura===0);

    html += '<tr data-id="' + o.id + '">';
    html += '<td class="mono">' + (o.numero||"\u2014") + '</td>';
    html += '<td>' + fmtData(o.data_creazione) + '</td>';
    html += '<td class="editable" ondblclick="startEdit(this,' + o.id + ',\'nome_studio\')">' + escHtml(o.nome_studio) + '</td>';
    html += '<td class="editable" ondblclick="startEdit(this,' + o.id + ',\'nome_condominio\')">' + escHtml(o.nome_condominio||"") + '</td>';
    html += '<td class="editable" ondblclick="startEditVia(this,' + o.id + ')">' + escHtml(viaCitta) + '</td>';
    html += '<td class="editable" ondblclick="startEditRif(this,' + o.id + ',\'riferimento\')">' + escHtml(o.riferimento) + '</td>';
    html += '<td class="editable" ondblclick="startEditAgente(this,' + o.id + ')">' + agenteBadgeHtml(o.agente_id) + '</td>';
    html += '<td class="num editable" ondblclick="startEdit(this,' + o.id + ',\'prezzo_fornitura\')">' + fmt(o.prezzo_fornitura) + '</td>';
    html += '<td class="num editable" ondblclick="startEdit(this,' + o.id + ',\'prezzo_care\')">' + fmt(o.prezzo_care) + '</td>';
    html += '<td class="num editable" ondblclick="startEdit(this,' + o.id + ',\'canone_lettura\')">' + fmt(o.canone_lettura) + '</td>';
    html += '<td style="position:relative"><button class="stato-badge ' + si.cls + '" onclick="toggleStatoDropdown(event,' + o.id + ')">' + si.label + '</button></td>';
    html += '<td><div class="act-btns">';
    if (hasDocx) { html += '<button class="act-btn act-gen done" title="Generata">&#9989;</button>'; }
    else { html += '<button class="act-btn act-gen" onclick="generaOfferta(' + o.id + ')" ' + (canGen?"":"disabled") + ' title="Genera"><i data-lucide="zap" style="width:12px;height:12px"></i></button>'; }
    html += '<button class="act-btn act-docx" onclick="apriFile(\'' + escHtml(o.path_docx||"") + '\')" ' + (hasDocx?"":"disabled") + '><i data-lucide="file-text" style="width:12px;height:12px"></i></button>';
    html += '<button class="act-btn act-pdf" onclick="apriFile(\'' + escHtml(o.path_pdf||"") + '\')" ' + (hasPdf?"":"disabled") + '><i data-lucide="file" style="width:12px;height:12px"></i></button>';
    html += '<button class="act-btn act-mail" onclick="preparaMail(' + o.id + ')"><i data-lucide="mail" style="width:12px;height:12px"></i></button>';
    html += '<button class="act-btn act-del" onclick="eliminaOfferta(' + o.id + ',' + (o.numero||0) + ')"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>';
    html += '</div></td></tr>';
  });

  html += '</tbody></table></div></div>';
  container.innerHTML = html;
  lucide.createIcons();
}

// ─── CREA RIGA VUOTA ───
function creaRigaVuota() {
  api("POST", "/api/offerte", { nome_studio: "", template: "E40", stato: "richiamato" }).then(function() {
    renderDashboard(document.getElementById("content"));
  });
}

function filterAndSort(list) {
  var result = list.slice();
  if (searchTerm) {
    var q = searchTerm.toLowerCase();
    result = result.filter(function(o) {
      return [o.numero,o.nome_studio,o.nome_condominio,o.via,o.citta,o.riferimento,o.stato].join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }
  if (sortCol) {
    result.sort(function(a,b) {
      var va=a[sortCol],vb=b[sortCol];
      if(va===null||va===undefined)va="";if(vb===null||vb===undefined)vb="";
      if(typeof va==="number"&&typeof vb==="number")return sortDir==="asc"?va-vb:vb-va;
      va=String(va).toLowerCase();vb=String(vb).toLowerCase();
      return va<vb?(sortDir==="asc"?-1:1):va>vb?(sortDir==="asc"?1:-1):0;
    });
  }
  return result;
}

function toggleSort(col) {
  if(sortCol===col){sortDir=sortDir==="asc"?"desc":"asc";}else{sortCol=col;sortDir="asc";}
  buildDashboard(document.getElementById("content"));
}

// ─── INLINE EDITING ───
function startEdit(td,id,field) {
  if(td.querySelector("input"))return;
  var old="";
  for(var i=0;i<offerte.length;i++){if(offerte[i].id===id){old=offerte[i][field];break;}}
  if(old===null||old===undefined)old="";
  var inp=document.createElement("input");inp.className="cell-edit";inp.value=old;
  td.textContent="";td.appendChild(inp);inp.focus();inp.select();
  function save(){
    var val=inp.value,data={};
    if(field==="prezzo_fornitura"||field==="prezzo_care"||field==="canone_lettura"){
      data[field]=parseFloat(val.replace(",","."))||null;
    }else{data[field]=val;}
    api("PUT","/api/offerte/"+id,data).then(function(){renderDashboard(document.getElementById("content"));});
  }
  inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();save();}if(e.key==="Escape"){renderDashboard(document.getElementById("content"));}});
  inp.addEventListener("blur",save);
}

function startEditVia(td,id) {
  if(td.querySelector("input"))return;
  var off=null;for(var i=0;i<offerte.length;i++){if(offerte[i].id===id){off=offerte[i];break;}}if(!off)return;
  td.innerHTML='<div style="display:flex;gap:4px;flex-direction:column"><input class="cell-edit" placeholder="Via" value="'+escHtml(off.via||"")+'" data-f="via" /><div style="display:flex;gap:4px"><input class="cell-edit" placeholder="CAP" value="'+escHtml(off.cap||"")+'" data-f="cap" style="width:70px" /><input class="cell-edit" placeholder="Citt\u00e0" value="'+escHtml(off.citta||"")+'" data-f="citta" /></div></div>';
  td.querySelector("input").focus();
  function save(){var inputs=td.querySelectorAll("input"),data={};inputs.forEach(function(i){data[i.getAttribute("data-f")]=i.value;});api("PUT","/api/offerte/"+id,data).then(function(){renderDashboard(document.getElementById("content"));});}
  td.querySelectorAll("input").forEach(function(inp){
    inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();save();}if(e.key==="Escape"){renderDashboard(document.getElementById("content"));}});
    inp.addEventListener("blur",function(){setTimeout(function(){if(!td.contains(document.activeElement))save();},100);});
  });
}

function startEditRif(td,id) {
  if(td.querySelector("input"))return;
  var old="";for(var i=0;i<offerte.length;i++){if(offerte[i].id===id){old=offerte[i].riferimento||"";break;}}
  td.innerHTML='<input class="cell-edit" value="'+escHtml(old)+'" /><div class="chips"><span class="chip" onclick="setField('+id+',\'riferimento\',\'Accordo Quadro E-ITN40\')">Accordo Quadro E-ITN40</span><span class="chip" onclick="setField('+id+',\'riferimento\',\'Accordo Quadro Q5.5\')">Accordo Quadro Q5.5</span></div>';
  var inp=td.querySelector("input");inp.focus();
  function save(){api("PUT","/api/offerte/"+id,{riferimento:inp.value}).then(function(){renderDashboard(document.getElementById("content"));});}
  inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();save();}if(e.key==="Escape"){renderDashboard(document.getElementById("content"));}});
  inp.addEventListener("blur",function(){setTimeout(function(){if(!td.contains(document.activeElement))save();},150);});
}

function setField(id,field,val) {
  var data={};data[field]=val;
  api("PUT","/api/offerte/"+id,data).then(function(){renderDashboard(document.getElementById("content"));});
}

function startEditAgente(td,id) {
  if(td.querySelector("select"))return;
  var off=null;for(var i=0;i<offerte.length;i++){if(offerte[i].id===id){off=offerte[i];break;}}
  var sel=document.createElement("select");sel.className="cell-edit";
  sel.innerHTML='<option value="">\u2014 Nessuno</option>';
  agenti.forEach(function(a){sel.innerHTML+='<option value="'+a.id+'"'+(off&&off.agente_id===a.id?' selected':'')+'>'+escHtml(a.nome+" "+a.cognome)+'</option>';});
  td.textContent="";td.appendChild(sel);sel.focus();
  function save(){api("PUT","/api/offerte/"+id,{agente_id:sel.value?parseInt(sel.value):null}).then(function(){renderDashboard(document.getElementById("content"));});}
  sel.addEventListener("change",save);sel.addEventListener("blur",save);
}

// ─── STATO DROPDOWN ───
function toggleStatoDropdown(e,id) {
  e.stopPropagation();closeStatoDropdown();
  var dd=document.createElement("div");dd.className="stato-dropdown";dd.id="stato-dd";
  STATI.forEach(function(s){dd.innerHTML+='<div class="stato-option" onclick="setField('+id+',\'stato\',\''+s.value+'\')"><span class="stato-dot" style="background:'+s.color+'"></span>'+s.label+'</div>';});
  e.currentTarget.parentElement.appendChild(dd);
  setTimeout(function(){document.addEventListener("click",closeStatoDropdown,{once:true});},10);
}

function closeStatoDropdown(){var dd=document.getElementById("stato-dd");if(dd)dd.remove();}

// ─── GENERA / ELIMINA / FILE / MAIL ───
function generaOfferta(id) {
  var off=null;for(var i=0;i<offerte.length;i++){if(offerte[i].id===id){off=offerte[i];break;}}
  if(off&&off.path_docx){showModal("Offerta Gi\u00e0 Generata","Vuoi rigenerarla?",[{label:"Annulla",cls:"btn btn-sec",action:"closeModal()"},{label:"Rigenera",cls:"btn btn-danger",action:"doGenera("+id+")"}]);return;}
  doGenera(id);
}

function doGenera(id) {
  closeModalNow();
  var row=document.querySelector('tr[data-id="'+id+'"]');
  var btn=row?row.querySelector(".act-gen"):null;
  if(btn){btn.innerHTML='<span class="spinner"></span>';btn.disabled=true;}
  api("POST","/api/genera",{id:id}).then(function(res){
    if(res.ok){
      var msg='\u2705 Offerta N\u00b0 '+res.numero+' generata con successo';
      if(res.pdf_error)msg+='<br><span class="badge b-orange">Pdf non disponibile</span>';
      showModal("Generazione Completata",msg,[
        {label:"Chiudi",cls:"btn btn-sec",action:"closeModal()"},
        {label:"Apri Docx",cls:"btn btn-primary",action:"apriFile('"+res.docx_url+"');closeModal()"},
        res.pdf_url?{label:"Apri Pdf",cls:"btn btn-pdf",action:"apriFile('"+res.pdf_url+"');closeModal()"}:null
      ].filter(Boolean));
      renderDashboard(document.getElementById("content"));
    }else{showModal("Errore",res.error||"Errore",[{label:"Chiudi",cls:"btn btn-sec",action:"closeModal()"}]);}
  }).catch(function(e){showModal("Errore","Errore: "+e.message,[{label:"Chiudi",cls:"btn btn-sec",action:"closeModal()"}]);});
}

function eliminaOfferta(id,numero) {
  showModal("Conferma Eliminazione","Sei sicuro? L\u2019offerta N\u00b0"+(numero||id)+" verr\u00e0 eliminata definitivamente.",[
    {label:"Annulla",cls:"btn btn-sec",action:"closeModal()"},
    {label:"Elimina",cls:"btn btn-danger",action:"doElimina("+id+")"}
  ]);
}

function doElimina(id){closeModalNow();api("DELETE","/api/offerte/"+id).then(function(){renderDashboard(document.getElementById("content"));});}

function apriFile(path){if(path)window.open(path,"_blank");}

function preparaMail(id) {
  var off=null;for(var i=0;i<offerte.length;i++){if(offerte[i].id===id){off=offerte[i];break;}}
  if(!off)return;
  var subj=encodeURIComponent("Proposta N\u00b0 "+(off.numero||"")+" \u2014 Ulteria S.r.l.");
  var body=encodeURIComponent("Gentilissimi,\n\nin allegato la nostra proposta N\u00b0 "+(off.numero||"")+" relativa alla fornitura e installazione di ripartitori di calore.\n\nRestiamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nUlteria S.r.l.");
  window.location.href="mailto:"+(off.email_studio||"")+"?subject="+subj+"&body="+body;
}

function esportaCsv() {
  var header="Numero;Data;Cliente;Condominio;Via;CAP;Citta;Riferimento;Agente;Fornitura;Care;Lettura;Stato;Email\n";
  var rows=offerte.map(function(o){var a=getAgente(o.agente_id);return[o.numero,o.data_creazione,o.nome_studio,o.nome_condominio,o.via,o.cap,o.citta,o.riferimento,a?(a.nome+" "+a.cognome):"",o.prezzo_fornitura,o.prezzo_care,o.canone_lettura,o.stato,o.email_studio].map(function(v){return'"'+String(v||"").replace(/"/g,'""')+'"';}).join(";");}).join("\n");
  var blob=new Blob(["\uFEFF"+header+rows],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="offerte_ulteria.csv";a.click();
}

// ─── MODAL ───
function showModal(title,body,buttons) {
  closeModalNow();
  var html='<div class="modal-overlay show" id="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-header"><h2>'+title+'</h2><button class="btn btn-ghost btn-sm" onclick="closeModal()"><i data-lucide="x" style="width:16px;height:16px"></i></button></div><div class="modal-body">'+body+'</div><div class="modal-footer">';
  buttons.forEach(function(b){html+='<button class="'+b.cls+'" onclick="'+b.action+'">'+b.label+'</button>';});
  html+='</div></div></div>';
  document.body.insertAdjacentHTML("beforeend",html);lucide.createIcons();
}
function closeModal(){var el=document.getElementById("modal-overlay");if(el){el.classList.remove("show");setTimeout(function(){el.remove();},200);}}
function closeModalNow(){var el=document.getElementById("modal-overlay");if(el)el.remove();}


// ═══════════════════════════════════════════════════════════
// WIZARD — NUOVA OFFERTA
// ═══════════════════════════════════════════════════════════

function renderNuova(container) {
  if (!agenti.length) {
    api("GET", "/api/agenti").then(function(d) { agenti = d; renderNuova(container); });
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Caricamento...</div>';
    return;
  }
  var html='<div class="wiz-wrap"><div class="kicker">Nuova Offerta</div><div class="page-title mb20">Crea Offerta Accordo Quadro</div>';
  html+='<div class="wiz-steps mb24">';
  html+='<div class="wiz-step '+(wizardStep===1?"active":(wizardStep>1?"done":""))+'">1. Template</div>';
  html+='<div class="wiz-step '+(wizardStep===2?"active":(wizardStep>2?"done":""))+'">2. Dati Studio</div>';
  html+='<div class="wiz-step '+(wizardStep===3?"active":"")+'">3. Dati Economici</div></div>';
  if(wizardStep===1)html+=renderWizStep1();
  else if(wizardStep===2)html+=renderWizStep2();
  else if(wizardStep===3)html+=renderWizStep3();
  html+='</div>';
  container.innerHTML=html;lucide.createIcons();
  if(wizardStep===2)setupWizAutocomplete();
}

function renderWizStep1() {
  return '<div class="wiz-section"><div class="wiz-section-title">Seleziona il Template</div><div class="tmpl-cards">'+
    '<div class="tmpl-card '+(wizardData.template==="E40"?"selected":"")+'" onclick="wizSelectTemplate(\'E40\')"><div class="tmpl-card-icon"><i data-lucide="thermometer" style="width:36px;height:36px;color:var(--blue)"></i></div><div class="tmpl-card-title">E-ITN40</div><div class="tmpl-card-sub">Accordo Quadro \u2014 Ripartitori E-ITN40</div></div>'+
    '<div class="tmpl-card '+(wizardData.template==="Q55"?"selected":"")+'" onclick="wizSelectTemplate(\'Q55\')"><div class="tmpl-card-icon"><i data-lucide="gauge" style="width:36px;height:36px;color:var(--blue)"></i></div><div class="tmpl-card-title">Q5.5</div><div class="tmpl-card-sub">Accordo Quadro \u2014 Ripartitori Q5.5</div></div>'+
    '</div></div>';
}

function wizSelectTemplate(t){wizardData.template=t;wizardStep=2;renderView();}

function renderWizStep2() {
  var h='<div class="wiz-section"><div class="wiz-section-title">Dati Studio / Amministratore</div>';
  h+='<div class="wiz-field" style="position:relative"><div class="wiz-label">Nome Studio *</div><input class="wiz-input" id="wiz-search-studio" placeholder="Cerca o inserisci..." value="'+escHtml(wizardData.nome_studio)+'" /><div class="ac-list" id="wiz-ac-list"></div></div>';
  h+='<div class="wiz-field"><div class="wiz-label">Nome Condominio</div><input class="wiz-input" id="wiz-condominio" value="'+escHtml(wizardData.nome_condominio)+'" /></div>';
  h+='<div class="wiz-row"><div class="wiz-field"><div class="wiz-label">Via</div><input class="wiz-input" id="wiz-via" value="'+escHtml(wizardData.via)+'" /></div><div class="wiz-field"><div class="wiz-label">Cap</div><input class="wiz-input" id="wiz-cap" value="'+escHtml(wizardData.cap)+'" /></div></div>';
  h+='<div class="wiz-row"><div class="wiz-field"><div class="wiz-label">Citt\u00e0 *</div><input class="wiz-input" id="wiz-citta" value="'+escHtml(wizardData.citta)+'" /></div><div class="wiz-field"><div class="wiz-label">Email</div><input class="wiz-input" id="wiz-email" value="'+escHtml(wizardData.email_studio)+'" /></div></div>';
  // Agente selector
  h+='<div class="wiz-field"><div class="wiz-label">Agente *</div><select class="wiz-input" id="wiz-agente"><option value="">-- Seleziona agente --</option>';
  agenti.forEach(function(a){h+='<option value="'+a.id+'"'+(wizardData.agente_id==a.id?' selected':'')+'>'+escHtml(a.nome+' '+a.cognome)+'</option>';});
  h+='</select></div>';
  h+='<label style="font-size:.8rem;display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer"><input type="checkbox" '+(wizardData.salva_cliente?"checked":"")+' onchange="wizardData.salva_cliente=this.checked" /> Salva in Anagrafica Clienti</label></div>';
  h+='<div class="fjb mt16"><button class="btn btn-sec" onclick="wizardStep=1;renderView()"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> Indietro</button><button class="btn btn-primary" onclick="wizGoStep3()">Avanti <i data-lucide="arrow-right" style="width:14px;height:14px"></i></button></div>';
  return h;
}

var _acClienti = [];

function setupWizAutocomplete() {
  var inp = document.getElementById("wiz-search-studio");
  if (!inp) return;
  inp.addEventListener("input", function() {
    wizardData.nome_studio = this.value;
    if (this.value.length < 2) {
      document.getElementById("wiz-ac-list").innerHTML = "";
      return;
    }
    api("GET", "/api/clienti?q=" + encodeURIComponent(this.value)).then(function(data) {
      var list = document.getElementById("wiz-ac-list");
      if (!list) return;
      if (!data.length) { list.innerHTML = ""; return; }
      _acClienti = data;
      var html = "";
      for (var i = 0; i < data.length; i++) {
        html += '<div class="ac-item" data-ac-idx="' + i + '">';
        html += '<div>' + escHtml(data[i].nome_studio) + '</div>';
        html += '<div class="ac-item-sub">' + escHtml(data[i].citta || "") + '</div></div>';
      }
      list.innerHTML = html;
      list.querySelectorAll(".ac-item").forEach(function(el) {
        el.addEventListener("click", function() {
          var idx = parseInt(this.getAttribute("data-ac-idx"));
          var c = _acClienti[idx];
          if (c) wizSelectCliente(c.nome_studio, c.via || "", c.cap || "", c.citta || "", c.email || "");
        });
      });
    });
  });
}

function wizSelectCliente(nome,via,cap,citta,email){wizardData.nome_studio=nome;wizardData.via=via;wizardData.cap=cap;wizardData.citta=citta;wizardData.email_studio=email;renderView();}

function wizGoStep3() {
  var fields={"wiz-search-studio":"nome_studio","wiz-condominio":"nome_condominio","wiz-via":"via","wiz-cap":"cap","wiz-citta":"citta","wiz-email":"email_studio","wiz-agente":"agente_id"};
  for(var id in fields){var el=document.getElementById(id);if(el)wizardData[fields[id]]=el.value;}
  if(!wizardData.nome_studio){showModal("Errore","Nome studio obbligatorio.",[{label:"Ok",cls:"btn btn-primary",action:"closeModal()"}]);return;}
  if(!wizardData.agente_id){showModal("Errore","Seleziona un agente.",[{label:"Ok",cls:"btn btn-primary",action:"closeModal()"}]);return;}
  wizardStep=3;renderView();
}

function renderWizStep3() {
  var h='<div class="wiz-section"><div class="wiz-section-title">Dati Economici</div>';
  h+='<div class="wiz-field"><div class="wiz-label">Centralizzazione</div><div class="pill-toggle"><button class="pill-opt '+(wizardData.modalita==="vendita"?"on":"")+'" onclick="wizardData.modalita=\'vendita\';renderView()">Vendita</button><button class="pill-opt '+(wizardData.modalita==="comodato"?"on":"")+'" onclick="wizardData.modalita=\'comodato\';renderView()">Comodato d\u2019Uso</button></div></div>';
  h+='<div class="wiz-row"><div class="wiz-field"><div class="wiz-label">Fornitura cad. \u20ac *</div><input class="wiz-input" type="number" step="0.01" id="wiz-pf" value="'+(wizardData.prezzo_fornitura||"")+'" oninput="wizardData.prezzo_fornitura=this.value;wizUpdateSummary()" /></div>';
  h+='<div class="wiz-field"><div class="wiz-label">Care cad/anno \u20ac *</div><input class="wiz-input" type="number" step="0.01" id="wiz-pc" value="'+(wizardData.prezzo_care||"")+'" oninput="wizardData.prezzo_care=this.value;wizUpdateSummary()" /></div></div>';
  h+='<div class="wiz-field"><div class="wiz-label">Lettura cad/anno \u20ac *</div><input class="wiz-input" type="number" step="0.01" id="wiz-cl" value="'+(wizardData.canone_lettura||"")+'" oninput="wizardData.canone_lettura=this.value;wizUpdateSummary()" /></div>';
  h+='<div class="wiz-field"><div class="wiz-label">Note</div><textarea class="wiz-input" rows="2" oninput="wizardData.note=this.value">'+escHtml(wizardData.note||"")+'</textarea></div></div>';
  h+='<div class="card mb20" id="wiz-summary"><div class="sec-ttl">Riepilogo</div><div class="wiz-summary" id="wiz-summary-inner">'+wizSummaryHtml()+'</div><div style="font-size:.7rem;color:var(--muted);margin-top:8px;text-align:center">Prezzi unitari \u2014 accordo quadro senza quantit\u00e0 definita</div></div>';
  h+='<div class="fjb"><button class="btn btn-sec" onclick="wizardStep=2;renderView()"><i data-lucide="arrow-left" style="width:14px;height:14px"></i> Indietro</button><button class="btn btn-primary" style="padding:10px 28px;font-size:.9rem" onclick="wizGenera()"><i data-lucide="zap" style="width:16px;height:16px"></i> Genera Offerta</button></div>';
  h+='<div id="wiz-result" class="mt16"></div>';
  return h;
}

function wizSummaryHtml() {
  var pf=parseFloat(wizardData.prezzo_fornitura)||0,pc=parseFloat(wizardData.prezzo_care)||0,cl=parseFloat(wizardData.canone_lettura)||0;
  var a=getAgente(wizardData.agente_id);
  var h='';
  h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Template</span><span class="wiz-summary-val">'+(wizardData.template==="E40"?"E-ITN40":"Q5.5")+'</span></div>';
  h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Studio</span><span class="wiz-summary-val">'+escHtml(wizardData.nome_studio)+'</span></div>';
  if(wizardData.nome_condominio)h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Condominio</span><span class="wiz-summary-val">'+escHtml(wizardData.nome_condominio)+'</span></div>';
  if(a)h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Agente</span><span class="wiz-summary-val">'+escHtml(a.nome+' '+a.cognome)+'</span></div>';
  h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Fornitura cad.</span><span class="wiz-summary-val">\u20ac '+pf.toFixed(2).replace(".",",")+'</span></div>';
  h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Care cad/anno</span><span class="wiz-summary-val">\u20ac '+pc.toFixed(2).replace(".",",")+'</span></div>';
  h+='<div class="wiz-summary-row"><span class="wiz-summary-label">Lettura cad/anno</span><span class="wiz-summary-val">\u20ac '+cl.toFixed(2).replace(".",",")+'</span></div>';
  return h;
}

function wizUpdateSummary(){var el=document.getElementById("wiz-summary-inner");if(el)el.innerHTML=wizSummaryHtml();}

function wizGenera() {
  if(!wizardData.prezzo_fornitura||!wizardData.prezzo_care||!wizardData.canone_lettura){showModal("Errore","Compila tutti i campi economici.",[{label:"Ok",cls:"btn btn-primary",action:"closeModal()"}]);return;}
  var pf=parseFloat(wizardData.prezzo_fornitura)||0,pc=parseFloat(wizardData.prezzo_care)||0,cl=parseFloat(wizardData.canone_lettura)||0;
  if(wizardData.salva_cliente)api("POST","/api/clienti",{nome_studio:wizardData.nome_studio,via:wizardData.via,cap:wizardData.cap,citta:wizardData.citta,email:wizardData.email_studio});
  api("POST","/api/offerte",{
    nome_studio:wizardData.nome_studio,nome_condominio:wizardData.nome_condominio,via:wizardData.via,cap:wizardData.cap,citta:wizardData.citta,email_studio:wizardData.email_studio,
    template:wizardData.template,riferimento:"Accordo Quadro "+(wizardData.template==="E40"?"E-ITN40":"Q5.5"),
    prezzo_fornitura:pf,prezzo_care:pc,canone_lettura:cl,modalita:wizardData.modalita,note:wizardData.note,agente_id:parseInt(wizardData.agente_id)||null
  }).then(function(off){return api("POST","/api/genera",{id:off.id});}).then(function(res){
    var rd=document.getElementById("wiz-result");if(!rd)return;
    if(res.ok){
      var h='<div class="alert a-ok mb12"><i data-lucide="check-circle" style="width:18px;height:18px;flex-shrink:0"></i><div><strong>Offerta N\u00b0 '+res.numero+' generata</strong>';
      if(res.pdf_error)h+='<br><span class="badge b-orange">Pdf non disponibile</span>';
      h+='</div></div><div class="fac gap8">';
      h+='<button class="btn btn-primary" onclick="apriFile(\''+res.docx_url+'\')"><i data-lucide="file-text" style="width:14px;height:14px"></i> Docx</button>';
      if(res.pdf_url)h+='<button class="btn btn-pdf" onclick="apriFile(\''+res.pdf_url+'\')"><i data-lucide="file" style="width:14px;height:14px"></i> Pdf</button>';
      var email=wizardData.email_studio||"",subj=encodeURIComponent("Proposta N\u00b0 "+res.numero+" \u2014 Ulteria S.r.l."),body=encodeURIComponent("Gentilissimi,\n\nin allegato la nostra proposta N\u00b0 "+res.numero+".\n\nCordiali saluti,\nUlteria S.r.l.");
      h+='<a class="btn btn-sec" href="mailto:'+email+'?subject='+subj+'&body='+body+'"><i data-lucide="mail" style="width:14px;height:14px"></i> Email</a></div>';
      rd.innerHTML=h;lucide.createIcons();
      wizardData={template:"",nome_studio:"",nome_condominio:"",via:"",cap:"",citta:"",email_studio:"",modalita:"vendita",prezzo_fornitura:"",prezzo_care:"",canone_lettura:"",note:"",salva_cliente:false,agente_id:""};wizardStep=1;
    }else{rd.innerHTML='<div class="alert a-warn">'+(res.error||"Errore")+'</div>';}
  }).catch(function(e){var rd=document.getElementById("wiz-result");if(rd)rd.innerHTML='<div class="alert a-warn">'+e.message+'</div>';});
}


// ═══════════════════════════════════════════════════════════
// ANAGRAFICA CLIENTI
// ═══════════════════════════════════════════════════════════

function renderClienti(c){api("GET","/api/clienti").then(function(d){clienti=d;buildClienti(c);lucide.createIcons();}).catch(function(e){c.innerHTML='<div class="alert a-warn">Errore: '+e.message+'</div>';console.error(e);});}

function buildClienti(container) {
  var html = '';
  html += '<div class="fjb mb16"><div><div class="kicker">Gestione</div><div class="page-title">Anagrafica Clienti</div></div>';
  html += '<button class="btn btn-primary" onclick="showNuovoCliente()"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Cliente</button></div>';
  html += '<div id="nuovo-cliente-form"></div>';
  html += '<div class="card-0"><div class="scx"><table class="tbl"><thead><tr>';
  html += '<th>Nome Studio</th><th>Referente</th><th>Citt\u00e0</th><th>Email</th><th>Telefono</th><th>Azioni</th>';
  html += '</tr></thead><tbody>';
  if (!clienti.length) {
    html += '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">Nessun cliente</td></tr>';
  }
  clienti.forEach(function(c) {
    html += '<tr style="cursor:pointer" data-cid="' + c.id + '">';
    html += '<td><strong>' + escHtml(c.nome_studio) + '</strong></td>';
    html += '<td>' + escHtml(c.referente || "") + '</td>';
    html += '<td>' + escHtml(c.citta || "") + '</td>';
    html += '<td>' + escHtml(c.email || "") + '</td>';
    html += '<td>' + escHtml(c.telefono || "") + '</td>';
    html += '<td><button class="btn btn-sm btn-sec btn-new-off-for-client" data-cid="' + c.id + '"><i data-lucide="file-plus" style="width:12px;height:12px"></i></button></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div></div><div id="cliente-detail-area"></div>';
  container.innerHTML = html;

  // Attach events via delegation
  container.querySelectorAll("tr[data-cid]").forEach(function(tr) {
    tr.addEventListener("click", function() {
      loadClienteDetail(parseInt(this.getAttribute("data-cid")));
    });
  });
  container.querySelectorAll(".btn-new-off-for-client").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var cid = parseInt(this.getAttribute("data-cid"));
      for (var i = 0; i < clienti.length; i++) {
        if (clienti[i].id === cid) {
          var c = clienti[i];
          nuovaOffertaPerCliente(c.nome_studio, c.via || "", c.cap || "", c.citta || "", c.email || "");
          break;
        }
      }
    });
  });
  lucide.createIcons();
}

function showNuovoCliente(){
  var area=document.getElementById("nuovo-cliente-form");if(!area)return;
  area.innerHTML='<div class="card mb16"><div class="fjb mb12"><strong>Nuovo Cliente</strong><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'nuovo-cliente-form\').innerHTML=\'\'"><i data-lucide="x" style="width:14px;height:14px"></i></button></div><div class="form-grid"><div class="form-field"><label>Nome Studio *</label><input class="inp" id="nc-nome" /></div><div class="form-field"><label>Referente</label><input class="inp" id="nc-ref" /></div><div class="form-field"><label>Via</label><input class="inp" id="nc-via" /></div><div class="form-field"><label>Cap</label><input class="inp" id="nc-cap" /></div><div class="form-field"><label>Citt\u00e0</label><input class="inp" id="nc-citta" /></div><div class="form-field"><label>Email</label><input class="inp" id="nc-email" /></div><div class="form-field"><label>Telefono</label><input class="inp" id="nc-tel" /></div><div class="form-field full"><label>Note</label><textarea class="inp" id="nc-note" rows="2"></textarea></div></div><div class="fac gap8 mt12"><button class="btn btn-primary" onclick="salvaCliente()">Salva</button><button class="btn btn-sec" onclick="document.getElementById(\'nuovo-cliente-form\').innerHTML=\'\'">Annulla</button></div></div>';
  lucide.createIcons();
}

function salvaCliente(){
  var nome=document.getElementById("nc-nome").value;if(!nome){showModal("Errore","Nome obbligatorio",[{label:"Ok",cls:"btn btn-primary",action:"closeModal()"}]);return;}
  api("POST","/api/clienti",{nome_studio:nome,referente:document.getElementById("nc-ref").value,via:document.getElementById("nc-via").value,cap:document.getElementById("nc-cap").value,citta:document.getElementById("nc-citta").value,email:document.getElementById("nc-email").value,telefono:document.getElementById("nc-tel").value,note:document.getElementById("nc-note").value}).then(function(){renderClienti(document.getElementById("content"));});
}

function loadClienteDetail(cid) {
  api("GET","/api/clienti/"+cid).then(function(data){
    var area=document.getElementById("cliente-detail-area");if(!area)return;
    var c=data.cliente,offs=data.offerte;
    var tot=offs.length,prese=0,perse=0,attesa=0;
    offs.forEach(function(o){if(o.stato==="preso_lavoro")prese++;if(o.stato==="perso")perse++;if(o.stato==="richiamato"||o.stato==="in_attesa_assemblea"||o.stato==="rimandato")attesa++;});
    var h='<div class="client-detail mt16"><div class="fjb mb12"><strong style="font-size:1rem">'+escHtml(c.nome_studio)+'</strong><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'cliente-detail-area\').innerHTML=\'\'"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    h+='<div class="g4 mb16"><div class="kpi"><div class="kpi-l">Totale Offerte</div><div class="kpi-v kv-blue">'+tot+'</div></div><div class="kpi"><div class="kpi-l">Prese</div><div class="kpi-v kv-green">'+prese+'</div></div><div class="kpi"><div class="kpi-l">Perse</div><div class="kpi-v kv-red">'+perse+'</div></div><div class="kpi"><div class="kpi-l">In Attesa</div><div class="kpi-v kv-orange">'+attesa+'</div></div></div>';
    h+='<div class="form-grid mb16"><div class="form-field"><label>Via</label><input class="inp" value="'+escHtml(c.via||"")+'" onchange="updateCliente('+cid+',\'via\',this.value)" /></div><div class="form-field"><label>Cap</label><input class="inp" value="'+escHtml(c.cap||"")+'" onchange="updateCliente('+cid+',\'cap\',this.value)" /></div><div class="form-field"><label>Citt\u00e0</label><input class="inp" value="'+escHtml(c.citta||"")+'" onchange="updateCliente('+cid+',\'citta\',this.value)" /></div><div class="form-field"><label>Email</label><input class="inp" value="'+escHtml(c.email||"")+'" onchange="updateCliente('+cid+',\'email\',this.value)" /></div><div class="form-field"><label>Telefono</label><input class="inp" value="'+escHtml(c.telefono||"")+'" onchange="updateCliente('+cid+',\'telefono\',this.value)" /></div><div class="form-field"><label>Referente</label><input class="inp" value="'+escHtml(c.referente||"")+'" onchange="updateCliente('+cid+',\'referente\',this.value)" /></div></div>';
    h+='<div class="sec-ttl">Storico Offerte</div>';
    if(offs.length){
      h+='<table class="tbl"><thead><tr><th>N\u00b0</th><th>Data</th><th>Condominio</th><th>Riferimento</th><th>Fornitura</th><th>Care</th><th>Lettura</th><th>Stato</th></tr></thead><tbody>';
      offs.forEach(function(o){var si=statoInfo(o.stato);h+='<tr><td class="mono">'+(o.numero||"\u2014")+'</td><td>'+fmtData(o.data_creazione)+'</td><td>'+escHtml(o.nome_condominio||"")+'</td><td>'+escHtml(o.riferimento||"")+'</td><td class="num">'+fmt(o.prezzo_fornitura)+'</td><td class="num">'+fmt(o.prezzo_care)+'</td><td class="num">'+fmt(o.canone_lettura)+'</td><td><span class="stato-badge '+si.cls+'">'+si.label+'</span></td></tr>';});
      h+='</tbody></table>';
    }else{h+='<div style="color:var(--muted);font-size:.82rem;padding:12px 0">Nessuna offerta</div>';}
    h+='</div>';area.innerHTML=h;lucide.createIcons();
  });
}

function updateCliente(cid,f,v){var d={};d[f]=v;api("PUT","/api/clienti/"+cid,d);}
function nuovaOffertaPerCliente(n,v,cap,c,e){wizardData.nome_studio=n;wizardData.via=v;wizardData.cap=cap;wizardData.citta=c;wizardData.email_studio=e;wizardStep=1;navigate("nuova");}


// ═══════════════════════════════════════════════════════════
// AGENTI
// ═══════════════════════════════════════════════════════════

function renderAgenti(c){api("GET","/api/agenti").then(function(d){agenti=d;buildAgenti(c);lucide.createIcons();}).catch(function(e){c.innerHTML='<div class="alert a-warn">Errore: '+e.message+'</div>';console.error(e);});}

function buildAgenti(container) {
  var html='<div class="fjb mb16"><div><div class="kicker">Team</div><div class="page-title">Agenti</div></div><button class="btn btn-primary" onclick="showNuovoAgente()"><i data-lucide="plus" style="width:14px;height:14px"></i> Nuovo Agente</button></div>';
  html+='<div id="nuovo-agente-form"></div>';

  if(!agenti.length){html+='<div class="card" style="text-align:center;padding:40px;color:var(--muted)">Nessun agente registrato</div>';container.innerHTML=html;return;}

  html+='<div class="g3 mb20">';
  agenti.forEach(function(a){
    var col=a.colore||"#009FE3";var ini=agenteInitials(a);
    html+='<div class="card" style="cursor:pointer;border-top:3px solid '+col+'" onclick="loadAgenteDetail('+a.id+')">';
    html+='<div class="fac gap10 mb8"><div class="agente-avatar" style="background:'+col+'">'+ini+'</div><div><div style="font-weight:700;font-size:.9rem">'+escHtml(a.nome+' '+a.cognome)+'</div><div style="font-size:.72rem;color:var(--muted)">'+escHtml(a.email||"")+'</div></div></div>';
    html+='</div>';
  });
  html+='</div>';

  html+='<div id="agente-detail-area"></div>';
  container.innerHTML=html;lucide.createIcons();
}

function showNuovoAgente(){
  var area=document.getElementById("nuovo-agente-form");if(!area)return;
  var defColor=AGENTE_COLORS[agenti.length%AGENTE_COLORS.length];
  area.innerHTML='<div class="card mb16"><div class="fjb mb12"><strong>Nuovo Agente</strong><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'nuovo-agente-form\').innerHTML=\'\'"><i data-lucide="x" style="width:14px;height:14px"></i></button></div><div class="form-grid"><div class="form-field"><label>Nome *</label><input class="inp" id="na-nome" /></div><div class="form-field"><label>Cognome *</label><input class="inp" id="na-cognome" /></div><div class="form-field"><label>Email</label><input class="inp" id="na-email" /></div><div class="form-field"><label>Telefono</label><input class="inp" id="na-tel" /></div><div class="form-field"><label>Colore</label><input class="inp" id="na-colore" type="color" value="'+defColor+'" style="height:36px;padding:3px" /></div><div class="form-field full"><label>Note</label><textarea class="inp" id="na-note" rows="2"></textarea></div></div><div class="fac gap8 mt12"><button class="btn btn-primary" onclick="salvaAgente()">Salva</button><button class="btn btn-sec" onclick="document.getElementById(\'nuovo-agente-form\').innerHTML=\'\'">Annulla</button></div></div>';
  lucide.createIcons();
}

function salvaAgente(){
  var nome=document.getElementById("na-nome").value,cognome=document.getElementById("na-cognome").value;
  if(!nome||!cognome){showModal("Errore","Nome e cognome obbligatori",[{label:"Ok",cls:"btn btn-primary",action:"closeModal()"}]);return;}
  api("POST","/api/agenti",{nome:nome,cognome:cognome,email:document.getElementById("na-email").value,telefono:document.getElementById("na-tel").value,colore:document.getElementById("na-colore").value,note:document.getElementById("na-note").value}).then(function(){renderAgenti(document.getElementById("content"));});
}

function loadAgenteDetail(aid) {
  api("GET","/api/agenti/"+aid).then(function(data){
    var area=document.getElementById("agente-detail-area");if(!area)return;
    var a=data.agente,offs=data.offerte;
    var tot=offs.length,prese=0,perse=0,attesa=0;
    offs.forEach(function(o){if(o.stato==="preso_lavoro")prese++;if(o.stato==="perso")perse++;if(o.stato==="richiamato"||o.stato==="in_attesa_assemblea"||o.stato==="rimandato")attesa++;});
    var col=a.colore||"#009FE3";
    var h='<div class="client-detail mt16"><div class="fjb mb12"><div class="fac gap10"><div class="agente-avatar" style="background:'+col+'">'+agenteInitials(a)+'</div><strong style="font-size:1rem">'+escHtml(a.nome+' '+a.cognome)+'</strong></div><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'agente-detail-area\').innerHTML=\'\'"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    h+='<div class="g4 mb16"><div class="kpi"><div class="kpi-l">Totale Offerte</div><div class="kpi-v kv-blue">'+tot+'</div></div><div class="kpi"><div class="kpi-l">Prese</div><div class="kpi-v kv-green">'+prese+'</div></div><div class="kpi"><div class="kpi-l">Perse</div><div class="kpi-v kv-red">'+perse+'</div></div><div class="kpi"><div class="kpi-l">In Attesa</div><div class="kpi-v kv-orange">'+attesa+'</div></div></div>';
    h+='<div class="form-grid mb16"><div class="form-field"><label>Email</label><input class="inp" value="'+escHtml(a.email||"")+'" onchange="updateAgente('+aid+',\'email\',this.value)" /></div><div class="form-field"><label>Telefono</label><input class="inp" value="'+escHtml(a.telefono||"")+'" onchange="updateAgente('+aid+',\'telefono\',this.value)" /></div><div class="form-field"><label>Colore</label><input class="inp" type="color" value="'+(a.colore||"#009FE3")+'" onchange="updateAgente('+aid+',\'colore\',this.value)" style="height:36px;padding:3px" /></div></div>';
    h+='<div class="sec-ttl">Offerte Assegnate</div>';
    if(offs.length){
      h+='<table class="tbl"><thead><tr><th>N\u00b0</th><th>Data</th><th>Cliente</th><th>Condominio</th><th>Riferimento</th><th>Stato</th></tr></thead><tbody>';
      offs.forEach(function(o){var si=statoInfo(o.stato);h+='<tr><td class="mono">'+(o.numero||"\u2014")+'</td><td>'+fmtData(o.data_creazione)+'</td><td>'+escHtml(o.nome_studio)+'</td><td>'+escHtml(o.nome_condominio||"")+'</td><td>'+escHtml(o.riferimento||"")+'</td><td><span class="stato-badge '+si.cls+'">'+si.label+'</span></td></tr>';});
      h+='</tbody></table>';
    }else{h+='<div style="color:var(--muted);font-size:.82rem;padding:12px 0">Nessuna offerta assegnata</div>';}
    h+='</div>';area.innerHTML=h;lucide.createIcons();
  });
}

function updateAgente(aid,f,v){var d={};d[f]=v;api("PUT","/api/agenti/"+aid,d).then(function(){if(f==="colore")renderAgenti(document.getElementById("content"));});}


// ═══════════════════════════════════════════════════════════
// IMPOSTAZIONI
// ═══════════════════════════════════════════════════════════

function renderImpostazioni(container) {
  api("GET","/api/config").then(function(cfg){
    container.innerHTML='<div class="kicker">Sistema</div><div class="page-title mb20">Impostazioni</div><div class="g2"><div class="card"><div class="sec-ttl">Prossimo Numero Offerta</div><div class="fac gap8"><input class="inp" type="number" id="cfg-num" value="'+cfg.prossimo_numero+'" style="width:140px" /><button class="btn btn-primary btn-sm" onclick="salvaProssimoNumero()">Salva</button></div></div><div class="card"><div class="sec-ttl">Info Applicazione</div><div style="font-size:.82rem;color:var(--mid)"><div class="mb8"><strong>Versione:</strong> 1.0.0</div><div><strong>Offerte generate:</strong> '+(cfg.totale_offerte_generate||0)+'</div></div></div></div>';
    lucide.createIcons();
  }).catch(function(e){container.innerHTML='<div class="alert a-warn">Errore: '+e.message+'</div>';console.error(e);});
}

function salvaProssimoNumero(){
  api("POST","/api/config",{prossimo_numero:parseInt(document.getElementById("cfg-num").value)}).then(function(){showModal("Salvato","Numero aggiornato.",[{label:"Ok",cls:"btn btn-primary",action:"closeModal()"}]);});
}

// ─── INIT ───
document.addEventListener("DOMContentLoaded",function(){lucide.createIcons();renderView();});
