/**
 * H.B.G. Google Apps Script backend
 * Spreadsheet tabs used: Orders and (optionally) Customers.
 * Script Properties required:
 *   SPREADSHEET_ID = ID from the Google Sheets URL
 *   HBG_TEAM_PIN = shared team PIN (change it from the example)
 *
 * Deploy as Web app: Execute as Me. Access: Anyone.
 * Anyone with the URL and PIN can use this lightweight shared-team setup.
 * For sensitive/high-volume use, move to individual authenticated accounts.
 */
const TAB_ORDERS = "Orders";
const TAB_CUSTOMERS = "Customers";

function doGet(e) {
  const p = (e && e.parameter) || {};
  let result;
  try {
    authorize_(p.pin);
    if (p.action === "bootstrap") result = bootstrap_();
    else result = {ok:false,error:"Unknown action"};
  } catch (err) { result = {ok:false,error:String(err.message || err)}; }
  const json = JSON.stringify(result);
  if (p.callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    authorize_(p.pin);
    const payload = JSON.parse(p.payload || "{}");
    if (payload.action === "addOrder") addOrder_(payload.order);
    else if (payload.action === "updateOrder") updateOrder_(payload.order);
    else throw new Error("Unknown write action.");
    return ContentService.createTextOutput(JSON.stringify({ok:true}));
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err.message || err)}));
  }
}

function authorize_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty("HBG_TEAM_PIN");
  if (!expected) throw new Error("HBG_TEAM_PIN is not configured in Script Properties.");
  if (!pin || pin !== expected) throw new Error("Incorrect team PIN.");
}
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("SPREADSHEET_ID is not configured in Script Properties.");
  return SpreadsheetApp.openById(id);
}
function rows_(tabName) {
  const sh = spreadsheet_().getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
}
function bootstrap_() {
  const ss = spreadsheet_();
  const orderRows = rows_(TAB_ORDERS);
  const orders = orderRows.map(r => ({
    id:String(r[0]||""), date:dateString_(r[1]), page:String(r[2]||""),
    customerId:String(r[3]||""), customer:String(r[4]||""), address:String(r[5]||""),
    quantity:Number(r[6]||0), amount:Number(r[7]||0), payment:String(r[8]||"Unpaid"),
    shipping:String(r[9]||"Not shipped")
  }));
  const customerRows = rows_(TAB_CUSTOMERS);
  const customerMap = {};
  customerRows.forEach(r => {
    const id=String(r[0]||""); const name=String(r[1]||"");
    if(name) customerMap[name.toLowerCase()]={id,name,address:String(r[2]||""),orders:Number(r[3]||0),quantity:Number(r[4]||0),spending:Number(r[5]||0),lastOrder:dateString_(r[6])};
  });
  // Derive customer totals from orders to keep the customer tab optional as a pre-populated source.
  orders.forEach(o=>{
    const k=o.customer.toLowerCase(); if(!k)return;
    if(!customerMap[k])customerMap[k]={id:o.customerId||"CUS-"+Utilities.getUuid().slice(0,8),name:o.customer,address:o.address,orders:0,quantity:0,spending:0,lastOrder:""};
    const c=customerMap[k]; c.orders++; c.quantity+=o.quantity; c.spending+=o.amount;
    if(o.date>=c.lastOrder){c.lastOrder=o.date;if(o.address)c.address=o.address;}
  });
  return {ok:true,orders,customers:Object.values(customerMap)};
}
function addOrder_(o) {
  if(!o || !o.id || !o.customer || !o.page) throw new Error("Order is missing required fields.");
  if(["HeinBaby","BoMaLay","G2"].indexOf(o.page)<0) throw new Error("Invalid sales page.");
  if(!Number.isInteger(Number(o.quantity)) || Number(o.quantity)<1 || !isFinite(Number(o.amount)) || Number(o.amount)<0) throw new Error("Invalid quantity or amount.");
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh=spreadsheet_().getSheetByName(TAB_ORDERS);
    if(!sh) throw new Error("Orders tab not found.");
    const existing=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String):[];
    if(existing.includes(String(o.id))) return; // idempotency prevents duplicate offline sync.
    const now=new Date();
    sh.appendRow([o.id,o.date||"",o.page,o.customerId||"",o.customer,o.address||"",Number(o.quantity),Number(o.amount),o.payment||"Unpaid",o.shipping||"Not shipped","",now,now]);
  } finally { lock.releaseLock(); }
}
function updateOrder_(o) {
  if(!o || !o.id || !o.customer || !o.page) throw new Error("Order is missing required fields.");
  if(["HeinBaby","BoMaLay","G2"].indexOf(o.page)<0) throw new Error("Invalid sales page.");
  if(!Number.isInteger(Number(o.quantity)) || Number(o.quantity)<1 || !isFinite(Number(o.amount)) || Number(o.amount)<0) throw new Error("Invalid quantity or amount.");
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh=spreadsheet_().getSheetByName(TAB_ORDERS);
    if(!sh || sh.getLastRow()<2) throw new Error("Order not found.");
    const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String);
    const index=ids.indexOf(String(o.id));
    if(index<0) throw new Error("Order not found: "+o.id);
    const row=index+2, now=new Date();
    sh.getRange(row,2,1,10).setValues([[o.date||"",o.page,o.customerId||"",o.customer,o.address||"",Number(o.quantity),Number(o.amount),o.payment||"Unpaid",o.shipping||"Not shipped",""]]);
    sh.getRange(row,13).setValue(now);
  } finally { lock.releaseLock(); }
}
function dateString_(v) {
  if(v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v||"").slice(0,10);
}
