/**
 * CpEssentials orders -> Google Sheets (+ receipt photos -> Google Drive).
 *
 * Setup in short: open the order sheet, Extensions > Apps Script, paste this file, fill in the
 * constants below, run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Full steps are in the README.
 *
 * What one order does:
 *  - adds one row to the Orders tab (columns are found by their header names)
 *  - adds one row per item to that item's tab (Subli shirt, T-shirt 1, ...), in the block for the
 *    buyer's year, then re-sorts that block by section and name
 *  - gives Connect Card points on the member's FIRST order only (tiers come from the Points tab)
 *  - saves the GCash receipt photo into your private Drive folder
 *  - marks anything odd by coloring the GCash Ref cell (or Order No) and adding a hover note
 */

// Leave empty when this script was opened from the sheet (Extensions > Apps Script).
// Only needed if the script was created on its own: the ID is in the sheet's URL
// (docs.google.com/spreadsheets/d/THIS_PART/edit).
const SPREADSHEET_ID = "";

// Optional but recommended: lets the script re-check prices and Connect Card numbers against your
// database. Same URL and publishable key as the website's .env.
const SUPABASE_URL = "";
const SUPABASE_KEY = "";

// Private Drive folder for GCash receipt photos: the ID is the end of the folder's URL
// (drive.google.com/drive/folders/THIS_PART). Paste only the ID, not the whole link.
const RECEIPTS_FOLDER_ID = "";

const PREFIX = "CpEstls-"; // order numbers look like CpEstls-26001 (year + running number)
const ORDERS = "Orders";
const POINTS = "Points";
const FLAG_COLOR = "#f4cccc";

// Orders tab headers (the script finds columns by these names, so you can reorder or add columns).
const H = {
  no: "Order No", time: "Time (PH)", name: "Name", sr: "SR Code", year: "Year Level", section: "Section",
  email: "Email", member: "Member", memNo: "Membership No", items: "Items", sub: "Subtotal",
  disc: "Discount", total: "Total", ref: "GCash Ref", client: "Client ID", receipt: "Receipt", pts: "Connect Card Pts",
};
const TEXT_COLS = [H.no, H.time, H.name, H.sr, H.year, H.section, H.email, H.member, H.memNo, H.items, H.ref, H.client, H.receipt];
const MONEY_COLS = [H.sub, H.disc, H.total];

// Sections that can order, and the year block each belongs to.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const SECTIONS = [].concat(range(1101, 1108), range(2101, 2108), range(3101, 3105), range(4101, 4103));
const YEAR_TEXT = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };
const YEAR_BY_LABEL = { firstyears: 1, secondyears: 2, thirdyears: 3, fourthyears: 4 };
const DEFAULT_TIERS = [[500, 30], [300, 20], [150, 15], [50, 5]]; // [from total, points], used only if the Points tab is missing
const ITEM_TABS = ["Subli shirt", "T-shirt 1", "T shirt 2", "Jacket", "Tote bag", "Key chain", "Mousepad", "Pin", "Cap"];

// ---------- entry points ----------

/** Run once from the editor. Safe to run again: it checks your sheet and formats it, and never deletes data. */
function setup() {
  const ss = book();
  const o = ss.getSheetByName(ORDERS);
  if (!o) throw new Error('There is no tab named "' + ORDERS + '". Import CpEssentials_Orders.xlsx into this sheet first.');
  const c = cols(o);
  const missing = Object.keys(H).map((k) => H[k]).filter((h) => !c[h]);
  if (missing.length) throw new Error("The Orders tab is missing these headers in row 1: " + missing.join(", "));
  const n = Math.max(1, o.getMaxRows() - 1);
  TEXT_COLS.forEach((h) => o.getRange(2, c[h], n, 1).setNumberFormat("@")); // never turn "=1+1" into a formula or 3104 into a number
  MONEY_COLS.forEach((h) => o.getRange(2, c[h], n, 1).setNumberFormat("#,##0.00"));
  o.getRange(2, c[H.pts], n, 1).setNumberFormat("0");
  o.hideColumns(c[H.client]); // used to ignore accidental double submits
  o.setFrozenRows(1);
  const notes = [];
  if (!ss.getSheetByName(POINTS)) notes.push('No "Points" tab: using built-in tiers ' + JSON.stringify(DEFAULT_TIERS));
  ITEM_TABS.forEach((t) => { if (!findTab(ss, t)) notes.push('No item tab named "' + t + '"'); });
  if (!SUPABASE_URL || !SUPABASE_KEY) notes.push("SUPABASE_URL / SUPABASE_KEY are empty: prices and Connect Card numbers will not be re-checked");
  if (!RECEIPTS_FOLDER_ID) notes.push("RECEIPTS_FOLDER_ID is empty: receipt photos will not be saved");
  else DriveApp.getFolderById(RECEIPTS_FOLDER_ID); // fails here (not at the first order) if the ID or access is wrong
  Logger.log("Setup OK." + (notes.length ? "\nCheck these:\n- " + notes.join("\n- ") : " Everything looks right."));
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

// ---------- helpers ----------

const json = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const round2 = (n) => Math.round(n * 100) / 100;
const str = (v, n) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, n || 120);
const safe = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v); // belt and braces against formula injection
const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");

function book() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("This script isn't attached to a spreadsheet. Open your sheet, then Extensions > Apps Script, or set SPREADSHEET_ID at the top of Code.gs.");
  return ss;
}

/** header text -> 1-based column number */
function cols(sheet) {
  const n = Math.max(1, sheet.getLastColumn());
  const m = {};
  sheet.getRange(1, 1, 1, n).getValues()[0].forEach((h, i) => { if (String(h).trim()) m[String(h).trim()] = i + 1; });
  return m;
}

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
  const section = str(c.section, 6);
  if (SECTIONS.indexOf(Number(section)) < 0) throw new Error("Section must be one of 1101-1108, 2101-2108, 3101-3105 or 4101-4103.");
  const cust = {
    name: str(c.name), sr: str(c.sr, 10), section, year: YEAR_TEXT[section.charAt(0)], email: str(c.email).toLowerCase(),
  };
  if (cust.name.length < 2 || !/^\d{2}-\d{5}$/.test(cust.sr) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) {
    throw new Error("Missing or invalid customer details.");
  }
  const items = (Array.isArray(p.items) ? p.items.slice(0, 40) : []).map((l) => ({
    id: str(l.id, 40), name: str(l.name), size: str(l.size, 30), qty: Math.floor(Number(l.qty)), price: Number(l.price),
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

/** Re-price from the database. Never rejects an order: problems are returned as flags. */
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
      if (!member) flags.push("CONNECT CARD NOT VERIFIED, discount removed");
    }
  } catch (err) {
    flags.push("NOT CHECKED (" + err.message + ")");
  }
  return { pct, member };
}

/** Connect Card points for an order total, from the Points tab (columns: From, Points). */
function pointsFor(ss, total) {
  let tiers = [];
  const sh = ss.getSheetByName(POINTS);
  if (sh && sh.getLastRow() >= 3) {
    sh.getRange(3, 1, sh.getLastRow() - 2, 2).getValues().forEach((r) => {
      if (r[0] !== "" && r[1] !== "" && !isNaN(Number(r[0])) && !isNaN(Number(r[1]))) tiers.push([Number(r[0]), Number(r[1])]);
    });
  }
  if (!tiers.length) tiers = DEFAULT_TIERS.slice();
  tiers.sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < tiers.length; i++) if (total >= tiers[i][0]) return tiers[i][1];
  return 0;
}

/** Save the receipt photo into the Drive folder. Never throws: problems become flags. */
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

// ---------- item tabs ----------

const findTab = (ss, name) => ss.getSheets().filter((s) => s.getName() !== ORDERS && s.getName() !== POINTS && norm(s.getName()) === norm(name))[0];

/** Where each year block starts on an item tab: { 1: {start, width, name, section, size, qty}, ... } */
function blockLayout(tab) {
  const lastCol = Math.max(1, tab.getLastColumn());
  const r1 = tab.getRange(1, 1, 1, lastCol).getValues()[0];
  const r2 = tab.getRange(2, 1, 1, lastCol).getValues()[0];
  const starts = [];
  r1.forEach((v, i) => { const y = YEAR_BY_LABEL[norm(v)]; if (y) starts.push({ y, col: i + 1 }); });
  const out = {};
  starts.forEach((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].col - 1 : lastCol;
    let w = 0;
    while (s.col + w <= end && String(r2[s.col + w - 1] || "").trim() !== "") w++;
    const b = { start: s.col, width: w };
    for (let j = 0; j < w; j++) {
      const h = norm(r2[s.col + j - 1]);
      if (h === "name") b.name = s.col + j;
      if (h === "section") b.section = s.col + j;
      if (h === "size") b.size = s.col + j;
      if (h === "quantity" || h === "qty") b.qty = s.col + j;
    }
    out[s.y] = b;
  });
  return out;
}

/** Add one order line to its item tab (in the buyer's year block) and re-sort that block. Returns a flag or "". */
function addToItemTab(ss, line, cust) {
  const tab = findTab(ss, line.name);
  if (!tab) return "NO TAB FOR " + line.name;
  const year = Number(cust.section.charAt(0));
  const b = blockLayout(tab)[year];
  if (!b) return tab.getName() + ": NO BLOCK FOR " + YEAR_TEXT[year];
  if (!b.name || !b.section || !b.qty) return tab.getName() + ": BLOCK HEADERS NOT RECOGNISED";
  const maxRows = tab.getMaxRows();
  const existing = tab.getRange(3, b.name, Math.max(1, maxRows - 2), 1).getValues();
  let used = 0;
  existing.forEach((r, i) => { if (String(r[0]).trim() !== "") used = i + 1; });
  const row = 3 + used;
  if (row > maxRows) tab.insertRowsAfter(maxRows, 50);
  tab.getRange(row, b.name).setValue(safe(cust.name));
  tab.getRange(row, b.section).setValue(Number(cust.section));
  if (b.size) tab.getRange(row, b.size).setValue(line.size);
  tab.getRange(row, b.qty).setValue(line.qty);
  sortBlock(tab, b, row);
  return "";
}

/** Sort rows 3..lastRow of one year block by section, then name. Other blocks are untouched. */
function sortBlock(tab, b, lastRow) {
  const n = lastRow - 2;
  const rg = tab.getRange(3, b.start, n, b.width);
  const rows = rg.getValues().map((r, i) => ({ r, i })).filter((x) => x.r.some((v) => String(v).trim() !== ""));
  rows.sort((p, q) => {
    const ds = Number(p.r[b.section - b.start]) - Number(q.r[b.section - b.start]);
    if (ds) return ds;
    const dn = String(p.r[b.name - b.start]).toLowerCase().localeCompare(String(q.r[b.name - b.start]).toLowerCase());
    return dn || p.i - q.i;
  });
  const blank = new Array(b.width).fill("");
  const out = rows.map((x) => x.r.map((v, j) => (j === b.name - b.start ? safe(String(v)) : v)));
  while (out.length < n) out.push(blank);
  rg.setValues(out);
}

// ---------- the order ----------

function saveOrder(p) {
  const ss = book();
  const sheet = ss.getSheetByName(ORDERS);
  if (!sheet) throw new Error('Orders tab not found. Run setup() and check the tab is named "' + ORDERS + '".');
  const c = cols(sheet);
  const need = Object.keys(H).map((k) => H[k]).filter((h) => !c[h]);
  if (need.length) throw new Error("The Orders tab is missing these headers: " + need.join(", "));
  const o = readOrder(p);
  const lastCol = Math.max(sheet.getLastColumn(), Math.max.apply(null, Object.keys(c).map((k) => c[k])));
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues() : [];
  const at = (r, h) => String(r[c[h] - 1] == null ? "" : r[c[h] - 1]);

  // Same order sent twice (customer retried after a bad connection): return the first one.
  const same = rows.filter((r) => at(r, H.client) === o.id)[0];
  if (same) {
    return { ok: true, duplicate: true, no: at(same, H.no), subtotal: Number(same[c[H.sub] - 1]), discount: Number(same[c[H.disc] - 1]),
      total: Number(same[c[H.total] - 1]), receipt: at(same, H.receipt) !== "" };
  }

  const flags = [];
  const { pct, member } = recheck(o, p, flags);
  const sub = round2(o.items.reduce((n, l) => n + l.qty * l.price, 0));
  const disc = member && pct > 0 ? Math.round(sub * pct) / 100 : 0;
  const total = round2(sub - disc);
  if (Math.abs(total - Number(p.clientTotal)) > 0.005) flags.push("TOTAL DIFFERS FROM WHAT THE CUSTOMER SAW (PHP " + p.clientTotal + ")");
  if (o.ref) {
    const used = rows.filter((r) => at(r, H.ref) === o.ref)[0];
    if (used) flags.push("GCASH REF ALREADY USED ON " + at(used, H.no));
  }

  // Order number: CpEstls- + 2-digit year + running number, counted from the sheet itself
  // (so deleting test rows starts you back at 001, and a new year restarts the count).
  const now = new Date();
  const yy = Utilities.formatDate(now, "Asia/Manila", "yy");
  const stem = PREFIX + yy;
  let top = 0;
  rows.forEach((r) => {
    const v = at(r, H.no);
    if (v.indexOf(stem) === 0 && /^\d+$/.test(v.slice(stem.length))) top = Math.max(top, Number(v.slice(stem.length)));
  });
  const no = stem + String(top + 1).padStart(3, "0");

  const rc = saveReceipt(o, no);
  if (rc.flag) flags.push(rc.flag);

  // Connect Card points: first order of a verified card holder only.
  let pts = 0;
  if (member && o.mem && !rows.some((r) => norm(at(r, H.memNo)) === norm(o.mem))) pts = pointsFor(ss, total);

  const summary = o.items.map((l) => l.qty + " x " + l.name + (l.size ? " (" + l.size + ")" : "")).join("; ").slice(0, 500);
  const row = new Array(lastCol).fill("");
  const put = (h, v) => { row[c[h] - 1] = v; };
  put(H.no, no); put(H.time, Utilities.formatDate(now, "Asia/Manila", "yyyy-MM-dd HH:mm:ss"));
  put(H.name, safe(o.cust.name)); put(H.sr, o.cust.sr); put(H.year, o.cust.year); put(H.section, o.cust.section); put(H.email, o.cust.email);
  put(H.member, member ? "YES" : "NO"); put(H.memNo, o.mem); put(H.items, safe(summary));
  put(H.sub, sub); put(H.disc, disc); put(H.total, total); put(H.ref, o.ref); put(H.client, o.id); put(H.pts, pts);
  sheet.appendRow(row);
  const r = sheet.getLastRow();

  o.items.forEach((l) => { const f = addToItemTab(ss, l, o.cust); if (f) flags.push(f); });

  if (rc.url) {
    sheet.getRange(r, c[H.receipt]).setRichTextValue(SpreadsheetApp.newRichTextValue().setText("View receipt").setLinkUrl(rc.url).build());
  }
  if (flags.length) {
    sheet.getRange(r, o.ref ? c[H.ref] : c[H.no]).setBackground(FLAG_COLOR).setNote(flags.join("\n"));
  }
  return { ok: true, no, subtotal: sub, discount: disc, total, points: pts, receipt: !!rc.url };
}
