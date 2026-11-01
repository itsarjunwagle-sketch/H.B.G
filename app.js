/* H.B.G. configuration: paste your deployed Apps Script Web App URL and shared team PIN here. */
const HBG_CONFIG = {
  SCRIPT_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
  TEAM_PIN: "CHANGE_THIS_PIN",
  CURRENCY: "MMK"
};

const $ = id => document.getElementById(id);
const DB_NAME = "hbg-local-v1";
const STORE = "pending";
let db, orders = [], customers = [], selectedPage = "HeinBaby", editingOrderId = null;
let toastTimer;

function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
function money(n) { return `${Number(n || 0).toLocaleString("en-US")} MMK`; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function openDB() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, {keyPath:"localId"});
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
function dbPut(item) { return new Promise((resolve,reject) => { const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).put(item); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); }); }
function dbAll() { return new Promise((resolve,reject) => { const req=db.transaction(STORE).objectStore(STORE).getAll(); req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error); }); }
function dbDelete(id) { return new Promise(resolve => { const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete=resolve; }); }

function jsonp(params) {
  return new Promise((resolve,reject) => {
    if (!HBG_CONFIG.SCRIPT_URL.startsWith("https://script.google.com/")) return reject(new Error("Apps Script URL is not configured."));
    const cb = "hbg_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const timer = setTimeout(() => { cleanup(); reject(new Error("Server timed out.")); }, 15000);
    function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
    window[cb] = data => {cleanup(); data && data.ok ? resolve(data) : reject(new Error(data?.error || "Server error."));};
    const query = new URLSearchParams({...params, pin:HBG_CONFIG.TEAM_PIN, callback:cb});
    script.src = HBG_CONFIG.SCRIPT_URL + "?" + query.toString();
    script.onerror = () => {cleanup();reject(new Error("Could not reach Google Sheets."));};
    document.head.appendChild(script);
  });
}
async function sendWrite(payload) {
  if (!HBG_CONFIG.SCRIPT_URL.startsWith("https://script.google.com/")) throw new Error("Apps Script URL is not configured.");
  const body = new URLSearchParams({pin:HBG_CONFIG.TEAM_PIN, payload:JSON.stringify(payload)});
  await fetch(HBG_CONFIG.SCRIPT_URL, {method:"POST",mode:"no-cors",body});
  // no-cors hides the response; confirm by refreshing server data on next sync.
}

async function loadInitial() {
  try {
    const data = await jsonp({action:"bootstrap"});
    orders = data.orders || []; customers = data.customers || [];
    renderAll(); setConnection(true);
  } catch (e) {
    setConnection(false);
    if (e.message.includes("not configured")) $("setupNotice").classList.remove("hidden");
    const cached = await getCache();
    orders = cached.orders || []; customers = cached.customers || [];
    renderAll();
    if (!navigator.onLine) toast("Offline mode: showing saved data on this device.");
    else if (!cached.orders) toast(e.message);
  }
  await updatePendingCount();
}
let cache = {orders:[],customers:[]};
async function getCache(){return cache;}
function setConnection(ok) {
  $("connectionDot").style.background = ok ? "#39c786" : "#ffb84d";
  $("connectionText").textContent = ok ? "Connected" : "Offline";
}
function renderAll(){renderDashboard();renderOrders();renderCustomers();renderReports();fillSuggestions();}
function fillSuggestions(){
  $("customerSuggestions").innerHTML=customers.map(c=>`<option value="${esc(c.name)}"></option>`).join("");
}
function renderDashboard(){
  const ym=localDate().slice(0,7), month=orders.filter(o=>String(o.date).slice(0,7)===ym);
  $("dashSales").textContent=money(month.reduce((s,o)=>s+Number(o.amount||0),0));
  $("dashOrders").textContent=month.length;
  $("dashQty").textContent=month.reduce((s,o)=>s+Number(o.quantity||0),0).toLocaleString();
  $("dashUnpaid").textContent=money(month.filter(o=>o.payment!=="Paid").reduce((s,o)=>s+Number(o.amount||0),0));
  $("recentOrders").innerHTML=orders.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map(orderHTML).join("") || '<div class="empty">No orders yet.</div>';
}
function orderHTML(o){
  return `<div class="order-item"><div class="item-top"><div><div class="item-name">${esc(o.customer)}</div><div class="subtext">${esc(o.id)} · ${esc(o.date || "No date")} · ${esc(o.page)} · ${Number(o.quantity||0)} clothes</div></div><div class="item-actions"><div class="amount">${money(o.amount)}</div><button class="edit-btn" type="button" data-edit-order="${esc(o.id)}">Edit</button></div></div><div class="pills"><span class="pill ${o.payment==="Paid"?"paid":"unpaid"}">${esc(o.payment||"Unpaid")}</span><span class="pill ${o.shipping==="Shipped"?"shipped":"pending"}">${esc(o.shipping||"Not shipped")}</span></div></div>`;
}
function renderOrders(){
  const q=$("orderSearch").value.toLowerCase(), page=$("pageFilter").value, status=$("statusFilter").value;
  const filtered=orders.filter(o=>(!q||`${o.customer} ${o.id}`.toLowerCase().includes(q))&&(!page||o.page===page)&&(!status||o.payment===status));
  $("ordersList").innerHTML=filtered.slice().reverse().map(orderHTML).join("")||'<div class="empty">No matching orders.</div>';
}
function renderCustomers(){
  const q=$("customerSearch").value.toLowerCase();
  const list=customers.filter(c=>String(c.name).toLowerCase().includes(q));
  $("customersList").innerHTML=list.map(c=>`<div class="customer-item"><div class="item-top"><div><div class="item-name">${esc(c.name)}</div><div class="subtext">${Number(c.orders||0)} orders · ${Number(c.quantity||0)} clothes</div><div class="subtext">${esc(c.address||"")}</div></div><div class="amount">${money(c.spending)}</div></div></div>`).join("")||'<div class="empty">No customers found.</div>';
}
function renderReports(){
  const period=$("reportPeriod").value, val=$("reportDate").value || localDate().slice(0,7);
  const key=period==="year"?val.slice(0,4):val.slice(0,7);
  const list=orders.filter(o=>String(o.date).startsWith(key));
  $("reportSales").textContent=money(list.reduce((s,o)=>s+Number(o.amount||0),0));
  $("reportOrders").textContent=list.length;
  $("reportQty").textContent=list.reduce((s,o)=>s+Number(o.quantity||0),0);
  $("reportPaid").textContent=money(list.filter(o=>o.payment==="Paid").reduce((s,o)=>s+Number(o.amount||0),0));
  const byPage=["HeinBaby","BoMaLay","G2"].map(p=>({name:p,total:list.filter(o=>o.page===p).reduce((s,o)=>s+Number(o.amount||0),0)}));
  const max=Math.max(1,...byPage.map(x=>x.total));
  $("pageBreakdown").innerHTML=byPage.map(x=>`<div class="bar-row"><div class="bar-label"><b>${x.name}</b><span>${money(x.total)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${x.total/max*100}%"></div></div></div>`).join("");
  const totals={}; list.forEach(o=>{const k=o.customer||"Unknown";totals[k]=(totals[k]||0)+Number(o.amount||0);});
  $("topCustomers").innerHTML=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n,v],i)=>`<div class="order-item"><div class="item-top"><div><b>${i+1}. ${esc(n)}</b></div><div class="amount">${money(v)}</div></div></div>`).join("")||'<div class="empty">No sales in this period.</div>';
}
async function updatePendingCount(){const p=await dbAll();$("pendingCount").textContent=`${p.length} orders waiting to sync`;}
async function saveOrder(event){
  event.preventDefault();
  const customer=$("customerName").value.trim(), qty=Number($("quantity").value), amount=Number($("amount").value);
  const date=$("orderDate").value.trim();
  if(!customer||!Number.isInteger(qty)||qty<1||!Number.isFinite(amount)||amount<0){toast("Please check the customer, quantity and amount.");return;}
  if(date && !validDate(date)){toast("Enter the date as YYYY-MM-DD, or leave it blank.");return;}
  const known=customers.find(c=>String(c.name).toLowerCase()===customer.toLowerCase());
  const existing=editingOrderId ? orders.find(o=>o.id===editingOrderId) : null;
  const record={...(existing||{}),localId:existing?.localId || (crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),id:existing?.id||"HBG-"+Date.now(),date,page:$("salesPage").value,customerId:known?.id||existing?.customerId||"",customer,address:$("address").value.trim(),quantity:qty,amount,payment:$("paymentStatus").value,shipping:$("shippingStatus").value,staff:"",createdAt:existing?.createdAt||new Date().toISOString()};
  if(editingOrderId){
    const pending=await dbAll();
    const queued=pending.find(x=>x.id===record.id && (x.action||"addOrder")==="addOrder");
    if(queued){record.action="addOrder";await dbPut(record);}
    else {record.action="updateOrder";record.localId="edit-"+record.id;await dbPut(record);}
    orders=orders.map(o=>o.id===record.id?record:o);
    toast("Order changes saved on this device.");
  } else {
    record.action="addOrder"; await dbPut(record); orders.push(record);
    toast("Order saved on this device.");
  }
  resetOrderForm(); renderAll(); await updatePendingCount();
  if(navigator.onLine) syncPending();
}
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+"T00:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}
function resetOrderForm(){
  editingOrderId=null; $("orderForm").reset(); $("salesPage").value=selectedPage;
  $("saveOrderBtn").textContent="Save order"; $("cancelEditBtn").classList.add("hidden");
}
async function startEditOrder(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  editingOrderId=id; selectView("neworder");
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view==="neworder"));
  $("salesPage").value=o.page; selectedPage=o.page;
  document.querySelectorAll(".page-btn").forEach(b=>b.classList.toggle("selected",b.dataset.page===o.page));
  $("orderDate").value=o.date||""; $("customerName").value=o.customer||""; $("address").value=o.address||"";
  $("quantity").value=o.quantity||1; $("amount").value=o.amount??"";
  $("paymentStatus").value=o.payment||"Unpaid"; $("shippingStatus").value=o.shipping||"Not shipped";
  $("saveOrderBtn").textContent="Save changes"; $("cancelEditBtn").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

async function syncPending(){
  if(!navigator.onLine){toast("You are offline. Orders will sync later.");return;}
  const pending=await dbAll(); if(!pending.length){toast("Everything is synchronized.");return;}
  try{
    for(const item of pending){await sendWrite({action:item.action||"addOrder",order:item});}
    // Apps Script POST response is intentionally opaque. Reload from server after writes before clearing queue.
    await new Promise(r=>setTimeout(r,1200));
    const data=await jsonp({action:"bootstrap"});
    orders=data.orders||[];customers=data.customers||[];
    for(const item of pending) await dbDelete(item.localId);
    cache={orders,customers}; renderAll(); await updatePendingCount(); setConnection(true);
    toast("Orders synchronized.");
  }catch(e){setConnection(false);toast("Sync not confirmed. Pending orders kept on this device.");}
}
function exportCSV(){
  const rows=[["Order ID","Date","Page","Customer","Address","Quantity","Amount MMK","Payment","Shipping"],...orders.map(o=>[o.id,o.date,o.page,o.customer,o.address,o.quantity,o.amount,o.payment,o.shipping])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="HBG-orders.csv";a.click();URL.revokeObjectURL(a.href);
}
function selectView(name){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===name));
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>selectView(b.dataset.view)));
document.querySelectorAll(".page-btn").forEach(b=>b.addEventListener("click",()=>{
  selectedPage=b.dataset.page; $("salesPage").value=selectedPage;
  document.querySelectorAll(".page-btn").forEach(x=>x.classList.toggle("selected",x===b));
}));
$("orderForm").addEventListener("submit",saveOrder);
$("cancelEditBtn").addEventListener("click",resetOrderForm);
document.addEventListener("click",e=>{const b=e.target.closest("[data-edit-order]");if(b)startEditOrder(b.dataset.editOrder);});
$("customerName").addEventListener("change",()=>{
  const c=customers.find(x=>String(x.name).toLowerCase()=== $("customerName").value.trim().toLowerCase());
  if(c)$("address").value=c.address||"";
});
["orderSearch","pageFilter","statusFilter"].forEach(id=>$(id).addEventListener("input",renderOrders));
$("customerSearch").addEventListener("input",renderCustomers);
["reportPeriod","reportDate"].forEach(id=>$(id).addEventListener("change",renderReports));
$("refreshBtn").addEventListener("click",loadInitial); $("syncBtn").addEventListener("click",syncPending); $("exportBtn").addEventListener("click",exportCSV);
window.addEventListener("online",()=>{setConnection(true);syncPending();}); window.addEventListener("offline",()=>setConnection(false));
(async()=>{try{db=await openDB();$("reportDate").value=localDate().slice(0,7);$("salesPage").value=selectedPage;await loadInitial();}catch(e){toast("This browser does not support local offline storage.");}})();
