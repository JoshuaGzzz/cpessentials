/**
 * CpEssentials orders -> Google Sheets.
 * Paste into the sheet's Apps Script (Extensions > Apps Script), run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * GCash receipt photos are saved to a Google Drive folder: paste that folder's ID below.
 */

// Optional but recommended: lets the script re-check prices and member status against your database,
// so the totals in the sheet can be trusted. Use the same URL and publishable key as the website's .env.
const SUPABASE_URL = "";
const SUPABASE_KEY = "";

// Private Drive folder for GCash receipt photos. Open the folder in Drive: the ID is the end of its URL
// (drive.google.com/drive/folders/THIS_PART). Leave empty to skip saving photos.
const RECEIPTS_FOLDER_ID = "";

const ORDERS = "Orders";
const ITEMS = "Items";
const STATUSES = ["Awaiting payment check", "Paid", "Ready for pickup", "Claimed", "Cancelled", "Pay at pickup"];
const HEAD = ["Order No", "Time (PH)", "Status", "Name", "SR Code", "Year Level", "Section", "Email", "Member",
  "Membership No", "Items", "Subtotal", "Discount", "Total", "GCash Ref", "Check", "Notes", "Client ID", "Receipt"];
const IHEAD = ["Order No", "SKU", "Item", "Size", "Qty", "Unit Price", "Line Total"];

/** Run once from the editor: creates the two tabs, headers, the Status dropdown and text formatting. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const o = ss.getSheetByName(ORDERS) || ss.insertSheet(ORDERS);
  const it = ss.getSheetByName(ITEMS) || ss.insertSheet(ITEMS);
  o.getRange(1, 1, 1, HEAD.length).setValues([HEAD]); // also adds new columns when you re-run setup()
  if (it.getLastRow() === 0) it.appendRow(IHEAD);
  [o, it].forEach((s) => { s.setFrozenRows(1); s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight("bold"); });
  const n = o.getMaxRows() - 1;
  // Plain text so a name like "=1+1" or a section like 3104 is never turned into a formula or number.
  o.getRange(2, 1, n, HEAD.length).setNumberFormat("@");
  o.getRange(2, 12, n, 3).setNumberFormat("#,##0.00");
  it.getRange(2, 1, it.getMaxRows() - 1, 4).setNumberFormat("@");
  it.getRange(2, 6, it.getMaxRows() - 1, 2).setNumberFormat("#,##0.00");
  o.getRange(2, 3, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(true).build());
  o.setColumnWidths(1, HEAD.length, 130);
  o.setColumnWidth(11, 320);
  o.setColumnWidth(16, 260);
  o.setColumnWidth(19, 110);
  o.hideColumns(18); // Client ID: used to ignore accidental double submits
}

function doGet() {
  return json({ ok: true, message: "CpEssentials orders endpoint is running." });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(20000);
    locked = true;
    return json(saveOrder(JSON.parse(e.postData.contents)));
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

// ---------- internals ----------

const json = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const round2 = (n) => Math.round(n * 100) / 100;
const str = (v, n) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, n || 120);
const safe = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v); // belt and braces against formula injection

function sb(path, payload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("database not configured");
  const opt = { headers: { apikey: SUPABASE_KEY }, muteHttpExceptions: true };
  if (payload) { opt.method = "post"; opt.contentType = "application/json"; opt.payload = JSON.stringify(payload); }
  const r = UrlFetchApp.fetch(SUPABASE_URL.replace(/\/$/, "") + path, opt);
  if (r.getResponseCode() >= 300) throw new Error("HTTP " + r.getResponseCode());
  return JSON.parse(r.getContentText());
}

function readOrder(p) {
  const c = p.customer || {};
  const cust = {
    name: str(c.name), sr: str(c.sr, 10), year: str(c.year, 20), section: str(c.section, 20), email: str(c.email).toLowerCase(),
  };
  if (cust.name.length < 2 || !/^\d{2}-\d{5}$/.test(cust.sr) || !cust.year || !cust.section || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) {
    throw new Error("Missing or invalid customer details.");
  }
  const items = (Array.isArray(p.items) ? p.items.slice(0, 40) : []).map((l) => ({
    id: str(l.id, 40), name: str(l.name), size: str(l.size, 20), qty: Math.floor(Number(l.qty)), price: Number(l.price),
  }));
  if (!items.length || items.some((l) => !l.id || !(l.qty >= 1 && l.qty <= 99) || !(l.price >= 0))) throw new Error("The order has no valid items.");
  const ref = str(p.gcashRef, 30).replace(/\s+/g, "").toUpperCase();
  if (ref && !/^[A-Z0-9]{8,20}$/.test(ref)) throw new Error("That GCash reference number doesn't look right.");
  const id = str(p.clientId, 60);
  if (!id) throw new Error("Missing order id.");
  let receipt = null;
  if (p.receipt && p.receipt.data) {
    const mime = str(p.receipt.mime, 30);
    const data = String(p.receipt.data);
    if (!/^image\/(jpeg|png|webp)$/.test(mime) || !/^[A-Za-z0-9+\/=]+$/.test(data) || data.length > 4000000) {
      throw new Error("The receipt photo couldn't be read. Try a smaller screenshot.");
    }
    receipt = { mime, data };
  }
  return { cust, items, ref, id, receipt, mem: str(p.mem, 30).toUpperCase().replace(/[^A-Z0-9]/g, "") };
}

/** Re-price from the database. Never rejects an order: problems are written to the Check column instead. */
function recheck(o, p, flags) {
  let pct = Number(p.pct) || 0;
  let member = !!o.mem;
  try {
    const byId = {};
    sb("/rest/v1/products?select=id,price&visible=eq.true").forEach((x) => { byId[x.id] = Number(x.price); });
    o.items.forEach((l) => {
      if (l.id in byId) {
        if (Math.abs(byId[l.id] - l.price) > 0.005) flags.push("PRICE CHANGED " + l.id);
        l.price = byId[l.id];
      } else flags.push("ITEM NOT FOUND OR HIDDEN " + l.id);
    });
    const st = sb("/rest/v1/store_settings?select=data&id=eq.1");
    if (st[0] && st[0].data && st[0].data.discountPct != null) pct = Number(st[0].data.discountPct);
    if (o.mem) {
      member = sb("/rest/v1/rpc/verify_member", { p_mem: o.mem, p_sr: o.cust.sr }) === true;
      if (!member) flags.push("MEMBER NOT VERIFIED, discount removed");
    }
  } catch (err) {
    flags.push("NOT CHECKED (" + err.message + ")");
  }
  return { pct, member };
}

/** Save the receipt photo into the Drive folder. Never throws: problems go to the Check column. */
function saveReceipt(o, no) {
  if (!o.receipt) return { url: "", flag: o.ref ? "NO RECEIPT PHOTO" : "" };
  if (!RECEIPTS_FOLDER_ID) return { url: "", flag: "RECEIPT NOT SAVED (no Drive folder set in Code.gs)" };
  try {
    const ext = o.receipt.mime === "image/png" ? "png" : o.receipt.mime === "image/webp" ? "webp" : "jpg";
    const blob = Utilities.newBlob(Utilities.base64Decode(o.receipt.data), o.receipt.mime, no + "_" + o.cust.sr + "." + ext);
    return { url: DriveApp.getFolderById(RECEIPTS_FOLDER_ID).createFile(blob).getUrl(), flag: "" };
  } catch (err) {
    return { url: "", flag: "RECEIPT NOT SAVED (" + err.message + ")" };
  }
}

function saveOrder(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ORDERS);
  const itemsSheet = ss.getSheetByName(ITEMS);
  if (!sheet || !itemsSheet) throw new Error("Sheets not set up. Run setup() in Apps Script.");
  const o = readOrder(p);
  const rows = Math.max(1, sheet.getLastRow() - 1);

  // Same order sent twice (customer retried after a bad connection): return the first one.
  const dupe = sheet.getRange(2, 18, rows, 1).createTextFinder(o.id).matchEntireCell(true).findNext();
  if (dupe) {
    const r = sheet.getRange(dupe.getRow(), 1, 1, 18).getValues()[0];
    return { ok: true, duplicate: true, no: r[0], subtotal: r[11], discount: r[12], total: r[13], check: r[15] };
  }

  const flags = [];
  const { pct, member } = recheck(o, p, flags);
  const sub = round2(o.items.reduce((n, l) => n + l.qty * l.price, 0));
  const disc = member && pct > 0 ? Math.round(sub * pct) / 100 : 0;
  const total = round2(sub - disc);
  if (Math.abs(total - Number(p.clientTotal)) > 0.005) flags.push("TOTAL DIFFERS FROM WHAT THE CUSTOMER SAW (PHP " + p.clientTotal + ")");
  if (o.ref) {
    const used = sheet.getRange(2, 15, rows, 1).createTextFinder(o.ref).matchEntireCell(true).findNext();
    if (used) flags.push("GCASH REF ALREADY USED ON " + sheet.getRange(used.getRow(), 1).getValue());
  }

  const props = PropertiesService.getScriptProperties();
  const seq = (Number(props.getProperty("seq")) || 0) + 1;
  props.setProperty("seq", String(seq));
  const now = new Date();
  const no = "CP-" + Utilities.formatDate(now, "Asia/Manila", "yyyy") + "-" + String(seq).padStart(4, "0");
  const rc = saveReceipt(o, no);
  if (rc.flag) flags.push(rc.flag);
  const summary = o.items.map((l) => l.qty + " x " + l.name + (l.size ? " (" + l.size + ")" : "")).join("; ").slice(0, 500);

  sheet.appendRow([
    no, Utilities.formatDate(now, "Asia/Manila", "yyyy-MM-dd HH:mm:ss"), o.ref ? "Awaiting payment check" : "Pay at pickup",
    safe(o.cust.name), o.cust.sr, o.cust.year, safe(o.cust.section), o.cust.email, member ? "YES" : "NO", o.mem,
    safe(summary), sub, disc, total, o.ref, flags.join("; "), "", o.id,
  ]);
  if (rc.url) {
    sheet.getRange(sheet.getLastRow(), 19).setRichTextValue(SpreadsheetApp.newRichTextValue().setText("View receipt").setLinkUrl(rc.url).build());
  }
  itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, o.items.length, 7).setValues(
    o.items.map((l) => [no, safe(l.id), safe(l.name), l.size, l.qty, l.price, round2(l.qty * l.price)]));
  return { ok: true, no, subtotal: sub, discount: disc, total, check: flags.join("; "), receipt: !!rc.url };
}
