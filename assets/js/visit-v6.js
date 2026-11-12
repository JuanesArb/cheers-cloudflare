/* Cheers V6 · cada visita comienza con una cuenta clara y personalizada. */
(() => {
  const KEY="cheers_visit_v6",overlay=document.querySelector("#visitWelcome"),form=document.querySelector("#visitForm"),nameInput=document.querySelector("#visitName"),tableSelect=document.querySelector("#visitTable"),tableField=document.querySelector("#visitTableField"),currentTable=new URLSearchParams(location.search).get("table")||"8";
  let mode="mesa";
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||"null")}catch{return null}};
  const write=value=>sessionStorage.setItem(KEY,JSON.stringify(value));
  const setVisit=next=>{mode=next;document.querySelectorAll("[data-visit-mode]").forEach(button=>button.classList.toggle("active",button.dataset.visitMode===mode));tableField.hidden=mode!=="mesa"};
  const apply=visit=>requestAnimationFrame(()=>{if(typeof setMode==="function")setMode(visit.mode==="mesa"?"mesa":"llevar");const customer=document.querySelector("#customerName");if(customer)customer.value=visit.name||""});
  const fillTables=menu=>{const tables=(menu.tables||[]).filter(table=>table.active!==false);tableSelect.innerHTML=tables.map(table=>`<option value="${table.id}" ${String(table.id)===String(currentTable)?"selected":""}>${table.name||`Mesa ${String(table.id).padStart(2,"0")}`}</option>`).join("")||`<option value="${currentTable}">Mesa ${String(currentTable).padStart(2,"0")}</option>`};
  const saved=read();fetch("/api/menu").then(response=>response.ok?response.json():null).then(menu=>fillTables(menu||{})).catch(()=>fillTables({}));
  if(saved&&saved.name&&(saved.mode!=="mesa"||String(saved.tableId)===String(currentTable))){overlay.hidden=true;apply(saved)}else{nameInput.focus()}
  document.addEventListener("click",event=>{const button=event.target.closest("[data-visit-mode]");if(button)setVisit(button.dataset.visitMode)});
  form.addEventListener("submit",event=>{event.preventDefault();const name=nameInput.value.trim();if(!name)return nameInput.focus();const visit={name,mode,tableId:mode==="mesa"?tableSelect.value:""};write(visit);if(mode==="mesa"&&String(visit.tableId)!==String(currentTable)){const url=new URL(location.href);url.searchParams.set("table",visit.tableId);location.replace(url);return}overlay.hidden=true;apply(visit)});
  document.addEventListener("click",event=>{if(event.target.closest(".cart-button")){const visit=read(),customer=document.querySelector("#customerName");if(visit?.name&&customer)customer.value=visit.name}},true);
})();
