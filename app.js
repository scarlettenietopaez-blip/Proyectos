const $ = (s) => document.querySelector(s);

const els = {
  total: $("#kpiTotal"), pac: $("#kpiPac"), otros: $("#kpiOtros"), oopp: $("#kpiOopp"),
  categoryBars: $("#categoryBars"), statusBars: $("#statusBars"),
  body: $("#projectsBody"), count: $("#resultCount"),
  search: $("#search"), category: $("#categoryFilter"), parish: $("#parishFilter"),
  status: $("#statusFilter"), clear: $("#clearFilters"),
  modal: $("#modal"), modalContent: $("#modalContent"), modalClose: $("#modalClose")
};

let projects = [];

function parseCSV(text){
  const rows=[]; let row=[]; let field=""; let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c === '"'){
      if(quoted && n === '"'){ field+='"'; i++; }
      else quoted=!quoted;
    } else if(c === "," && !quoted){ row.push(field); field=""; }
    else if((c === "\n" || c === "\r") && !quoted){
      if(c === "\r" && n === "\n") i++;
      row.push(field); field="";
      if(row.some(v => v !== "")) rows.push(row);
      row=[];
    } else field+=c;
  }
  if(field || row.length){ row.push(field); rows.push(row); }
  const headers=rows.shift().map((h,i)=>i===0?h.replace(/^\uFEFF/,""):h);
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? ""])));
}

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function money(p){
  if(p.monto_num !== "" && p.monto_num != null && !Number.isNaN(Number(p.monto_num))){
    return new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(p.monto_num));
  }
  return p.monto || "Sin información";
}
function unique(field){ return [...new Set(projects.map(p=>p[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")); }
function fillSelect(el, values){
  values.forEach(v=>{ const o=document.createElement("option");o.value=v;o.textContent=v;el.appendChild(o); });
}
function counts(field){
  return projects.reduce((a,p)=>{ const k=p[field]||"Sin información"; a[k]=(a[k]||0)+1; return a; },{});
}
function renderBars(el, data, limit=99){
  const entries=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,limit);
  const max=Math.max(...entries.map(x=>x[1]),1);
  el.innerHTML=entries.map(([label,value])=>`
    <div class="bar-row" title="${esc(label)}: ${value}">
      <div class="bar-label">${esc(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(value/max)*100}%"></div></div>
      <div class="bar-value">${value}</div>
    </div>`).join("");
}
function renderSummary(){
  els.total.textContent=projects.length;
  els.pac.textContent=projects.filter(p=>p.categoria==="PAC").length;
  els.otros.textContent=projects.filter(p=>p.categoria==="Otros").length;
  els.oopp.textContent=projects.filter(p=>p.estado_dashboard==="Entregado a OOPP").length;
  renderBars(els.categoryBars, counts("categoria"));
  renderBars(els.statusBars, counts("estado_dashboard"), 8);
}
function filtered(){
  const q=els.search.value.trim().toLocaleLowerCase("es");
  return projects.filter(p=>{
    const hay=[p.proyecto,p.tramite,p.parroquia,p.estado_original].join(" ").toLocaleLowerCase("es");
    return (!q || hay.includes(q)) &&
      (!els.category.value || p.categoria===els.category.value) &&
      (!els.parish.value || p.parroquia===els.parish.value) &&
      (!els.status.value || p.estado_dashboard===els.status.value);
  });
}
function renderTable(){
  const list=filtered();
  els.count.textContent=`${list.length} de ${projects.length} proyectos`;
  if(!list.length){
    els.body.innerHTML=`<tr><td colspan="7" class="empty">No existen proyectos con los filtros seleccionados.</td></tr>`;
    return;
  }
  els.body.innerHTML=list.map(p=>`
    <tr>
      <td class="num">${esc(p.item)}</td>
      <td><div class="project-name">${esc(p.proyecto)}</div></td>
      <td>${esc(p.parroquia || "—")}</td>
      <td><span class="badge">${esc(p.categoria)}</span></td>
      <td class="money">${esc(money(p))}</td>
      <td><span class="badge" data-status="${esc(p.estado_dashboard)}">${esc(p.estado_dashboard)}</span></td>
      <td><button class="row-action" type="button" data-item="${esc(p.item)}">Ver detalle</button></td>
    </tr>`).join("");
  els.body.querySelectorAll("[data-item]").forEach(btn=>btn.addEventListener("click",()=>openModal(btn.dataset.item)));
}
function detail(label,value,full=false){
  return `<div class="detail ${full?"full":""}"><span>${esc(label)}</span><strong>${esc(value || "Sin información registrada")}</strong></div>`;
}
function openModal(item){
  const p=projects.find(x=>String(x.item)===String(item)); if(!p) return;
  els.modalContent.innerHTML=`
    <p class="modal-kicker">Proyecto ${esc(p.item)} · ${esc(p.categoria)}</p>
    <h3 id="modalTitle">${esc(p.proyecto)}</h3>
    <div class="detail-grid">
      ${detail("Parroquia",p.parroquia)}
      ${detail("Monto",money(p))}
      ${detail("Número de trámite",p.tramite)}
      ${detail("Situación",p.estado_dashboard)}
      ${detail("Fecha de entrega / previsión",p.fecha_entrega)}
      ${detail("Responsables",p.responsables,true)}
      ${detail("Estado actual registrado",p.estado_original,true)}
    </div>`;
  els.modal.classList.add("open"); els.modal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function closeModal(){
  els.modal.classList.remove("open"); els.modal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}
function bind(){
  [els.search,els.category,els.parish,els.status].forEach(el=>el.addEventListener("input",renderTable));
  els.clear.addEventListener("click",()=>{
    els.search.value="";els.category.value="";els.parish.value="";els.status.value="";renderTable();
  });
  els.modalClose.addEventListener("click",closeModal);
  els.modal.addEventListener("click",e=>{if(e.target.dataset.close)closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
}
async function init(){
  try{
    const res=await fetch("./data/proyectos.csv",{cache:"no-store"});
    if(!res.ok) throw new Error("No se pudo cargar el CSV");
    projects=parseCSV(await res.text()).map(p=>({...p,item:Number(p.item)}));
    fillSelect(els.category,unique("categoria"));
    fillSelect(els.parish,unique("parroquia"));
    fillSelect(els.status,unique("estado_dashboard"));
    renderSummary();renderTable();bind();
  }catch(err){
    console.error(err);
    els.count.textContent="No se pudo cargar la información.";
    els.body.innerHTML=`<tr><td colspan="7" class="empty">Verifica que el sitio se esté abriendo desde GitHub Pages o un servidor web.</td></tr>`;
  }
}
init();
