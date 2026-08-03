const $ = s => document.querySelector(s);
const COLORS = {navy:"#0d2a5b", blue:"#1e63d5", red:"#ef2b31", green:"#07964d", cyan:"#28a9df", gray:"#dfe5ee"};

let projects=[], currentPage=1, pageSize=10;
let categoryChart, statusChart, parishChart;

const els={
  total:$("#kpiTotal"), pac:$("#kpiPac"), otros:$("#kpiOtros"), oopp:$("#kpiOopp"),
  pctPac:$("#pctPac"), pctOtros:$("#pctOtros"), pctOopp:$("#pctOopp"),
  body:$("#projectsBody"), category:$("#categoryFilter"), parish:$("#parishFilter"),
  status:$("#statusFilter"), search:$("#search"), clear:$("#clearFilters"), searchBtn:$("#searchBtn"),
  pageSize:$("#pageSize"), pagination:$("#pagination"), range:$("#rangeLabel"), totalLabel:$("#projectTotalLabel"),
  modal:$("#modal"), modalContent:$("#modalContent"), modalClose:$("#modalClose")
};

function parseCSV(text){
  const rows=[]; let row=[], field="", quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){ if(quoted&&n==='"'){field+='"';i++;} else quoted=!quoted; }
    else if(c===","&&!quoted){row.push(field);field="";}
    else if((c==="\n"||c==="\r")&&!quoted){
      if(c==="\r"&&n==="\n")i++;
      row.push(field);field="";
      if(row.some(v=>v!==""))rows.push(row);
      row=[];
    } else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=rows.shift().map((h,i)=>i===0?h.replace(/^\uFEFF/,""):h);
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function money(p){
  if(p.monto_num!=="" && p.monto_num!=null && !Number.isNaN(Number(p.monto_num))){
    return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(p.monto_num));
  }
  return p.monto||"—";
}
function pct(n,total){return total?`${(n/total*100).toFixed(1)}% del total`:"—";}
function counts(field){
  return projects.reduce((a,p)=>{const k=p[field]||"Sin información";a[k]=(a[k]||0)+1;return a;},{});
}
function unique(field){return [...new Set(projects.map(p=>p[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));}
function fillSelect(el,vals){vals.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;el.appendChild(o);});}

function renderKpis(){
  const total=projects.length, pac=projects.filter(p=>p.categoria==="PAC").length,
        otros=projects.filter(p=>p.categoria==="Otros").length,
        oopp=projects.filter(p=>p.estado_dashboard==="Entregado a OOPP").length;
  els.total.textContent=total; els.pac.textContent=pac; els.otros.textContent=otros; els.oopp.textContent=oopp;
  els.pctPac.textContent=pct(pac,total); els.pctOtros.textContent=pct(otros,total); els.pctOopp.textContent=pct(oopp,total);
  els.totalLabel.textContent=`(${total})`;
}

function chartDefaults(){
  Chart.defaults.font.family='Arial, "Helvetica Neue", sans-serif';
  Chart.defaults.color="#344054";
  Chart.defaults.font.size=10;
}
function renderCharts(){
  chartDefaults();
  const cat=counts("categoria");
  categoryChart?.destroy();
  categoryChart=new Chart($("#categoryChart"),{
    type:"doughnut",
    data:{labels:["PAC","Otros"],datasets:[{data:[cat.PAC||0,cat.Otros||0],backgroundColor:[COLORS.blue,COLORS.red],borderColor:"#fff",borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"52%",plugins:{legend:{position:"right",labels:{boxWidth:12,padding:18}},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw} (${(c.raw/projects.length*100).toFixed(1)}%)`}}}}
  });

  const s=counts("estado_dashboard");
  const order=["En desarrollo","Entregado a OOPP","Remitido a otra dirección","Por entregar","Entregado / SERCOP","Gestión externa","No iniciado","Sin estado registrado"];
  const labels=order.filter(k=>s[k]);
  statusChart?.destroy();
  statusChart=new Chart($("#statusChart"),{
    type:"bar",
    data:{labels,datasets:[{data:labels.map(k=>s[k]),backgroundColor:labels.map(k=>k==="Entregado a OOPP"?COLORS.green:(k==="Por entregar"||k==="Gestión externa"||k==="Sin estado registrado"?COLORS.red:COLORS.navy)),borderRadius:2,barThickness:10}]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:"#edf1f6"},ticks:{stepSize:5}},y:{grid:{display:false}}}}
  });

  const p=counts("parroquia");
  const par=Object.entries(p).sort((a,b)=>b[1]-a[1]);
  parishChart?.destroy();
  parishChart=new Chart($("#parishChart"),{
    type:"bar",
    data:{labels:par.map(x=>x[0]),datasets:[{data:par.map(x=>x[1]),backgroundColor:COLORS.navy,borderRadius:1,barPercentage:.62}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"#edf1f6"},ticks:{stepSize:3}},x:{grid:{display:false},ticks:{maxRotation:0,minRotation:0}}}}
  });
}
function filtered(){
  const q=els.search.value.trim().toLocaleLowerCase("es");
  return projects.filter(p=>{
    const hay=[p.proyecto,p.tramite,p.parroquia,p.estado_original,p.responsables].join(" ").toLocaleLowerCase("es");
    return (!q||hay.includes(q)) &&
      (!els.category.value||p.categoria===els.category.value) &&
      (!els.parish.value||p.parroquia===els.parish.value) &&
      (!els.status.value||p.estado_dashboard===els.status.value);
  });
}
function renderTable(){
  const list=filtered(), totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(currentPage>totalPages)currentPage=totalPages;
  const start=(currentPage-1)*pageSize, end=Math.min(start+pageSize,list.length), page=list.slice(start,end);
  els.range.textContent=list.length?`Mostrando ${start+1} a ${end} de ${list.length} proyectos`:"No hay proyectos para mostrar";
  els.body.innerHTML=page.length?page.map(p=>`
    <tr>
      <td>${String(p.item).padStart(2,"0")}</td>
      <td><div class="project-title">${esc(p.proyecto)}</div></td>
      <td>${esc(p.parroquia||"—")}</td>
      <td><span class="tag">${esc(p.categoria)}</span></td>
      <td>${esc(money(p))}</td>
      <td>${esc(p.tramite||"—")}</td>
      <td><span class="status-pill" data-status="${esc(p.estado_dashboard)}">${esc(p.estado_dashboard)}</span></td>
      <td>${esc(p.fecha_entrega||"—")}</td>
      <td><button class="detail-btn" data-item="${esc(p.item)}">◉ &nbsp;Ver detalle</button></td>
    </tr>`).join(""):`<tr><td colspan="9" style="text-align:center;padding:28px;color:#667085">No existen proyectos con los filtros seleccionados.</td></tr>`;
  els.body.querySelectorAll("[data-item]").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.item)));
  renderPagination(totalPages);
}
function renderPagination(totalPages){
  const buttons=[];
  buttons.push(`<button class="page-btn" data-page="${Math.max(1,currentPage-1)}">«</button>`);
  for(let i=1;i<=totalPages;i++)buttons.push(`<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`);
  buttons.push(`<button class="page-btn" data-page="${Math.min(totalPages,currentPage+1)}">»</button>`);
  els.pagination.innerHTML=buttons.join("");
  els.pagination.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{currentPage=Number(b.dataset.page);renderTable();}));
}
function detail(label,value,full=false){return `<div class="detail ${full?"full":""}"><span>${esc(label)}</span><strong>${esc(value||"Sin información registrada")}</strong></div>`;}
function openModal(item){
  const p=projects.find(x=>String(x.item)===String(item));if(!p)return;
  els.modalContent.innerHTML=`<p class="modal-kicker">Proyecto ${esc(p.item)} · ${esc(p.categoria)}</p><h3 id="modalTitle">${esc(p.proyecto)}</h3><div class="detail-grid">
    ${detail("Parroquia",p.parroquia)}${detail("Monto",money(p))}${detail("Número de trámite",p.tramite)}${detail("Situación",p.estado_dashboard)}
    ${detail("Fecha prevista / entrega",p.fecha_entrega)}${detail("Responsables",p.responsables,true)}${detail("Estado actual registrado",p.estado_original,true)}
  </div>`;
  els.modal.classList.add("open");els.modal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
}
function closeModal(){els.modal.classList.remove("open");els.modal.setAttribute("aria-hidden","true");document.body.style.overflow="";}
function resetPageAndRender(){currentPage=1;renderTable();}
function bind(){
  [els.category,els.parish,els.status].forEach(el=>el.addEventListener("change",resetPageAndRender));
  els.search.addEventListener("input",resetPageAndRender);
  els.searchBtn.addEventListener("click",resetPageAndRender);
  els.clear.addEventListener("click",()=>{els.search.value="";els.category.value="";els.parish.value="";els.status.value="";currentPage=1;renderTable();});
  els.pageSize.addEventListener("change",()=>{pageSize=els.pageSize.value==="37"?37:Number(els.pageSize.value);currentPage=1;renderTable();});
  els.modalClose.addEventListener("click",closeModal);els.modal.addEventListener("click",e=>{if(e.target.dataset.close)closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
}
async function init(){
  const res=await fetch("./data/proyectos.csv",{cache:"no-store"});
  if(!res.ok)throw new Error("No se pudo cargar data/proyectos.csv");
  projects=parseCSV(await res.text()).map(p=>({...p,item:Number(p.item)}));
  fillSelect(els.category,unique("categoria"));fillSelect(els.parish,unique("parroquia"));fillSelect(els.status,unique("estado_dashboard"));
  renderKpis();renderCharts();renderTable();bind();
}
init().catch(err=>{console.error(err);els.body.innerHTML=`<tr><td colspan="9" style="padding:30px;text-align:center">No se pudo cargar la información.</td></tr>`;});
