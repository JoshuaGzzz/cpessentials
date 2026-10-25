import { normMem, validMem } from "./card.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "2401561" / "24 01561" / "24-01561" -> "24-01561", else "" */
export function normSr(s) {
  const d = String(s || "").replace(/\D/g, "");
  return d.length === 7 ? d.slice(0, 2) + "-" + d.slice(2) : "";
}

/** "3", "3rd", "3rd Year", "Third Year" -> "3rd Year". Unknown text is kept as typed. */
export function normYear(s) {
  const t = String(s || "").trim();
  const words = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
  const w = Object.keys(words).find((k) => t.toLowerCase().startsWith(k));
  const n = w ? words[w] : (t.match(/^\d/) || [])[0];
  if (!n) return t;
  const sfx = { 1: "st", 2: "nd", 3: "rd" }[n] || "th";
  return n + sfx + " Year";
}

/** Split CSV/TSV text into rows of cells. Handles quotes, "" escapes, CRLF, BOM. */
export function splitRows(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const first = src.split(/\r?\n/).find((l) => l.trim()) || "";
  const count = (c) => first.split(c).length - 1;
  const delim = [",", "\t", ";"].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows;
}

const HEADERS = {
  mem: ["membershipno", "membershipnumber", "memberno", "membernumber", "memno", "membershipid", "memberid"],
  name: ["name", "fullname", "membername"],
  sr: ["srcode", "srno", "sr", "studentid", "studentno"],
  year: ["yearlevel", "year"],
  section: ["section", "sec"],
  email: ["email", "emailaddress", "gsuite", "schoolemail"],
};
// Layout of the club's sheet when the file has no header row: A, B, (C, D blank), E, F, G, H
const FIXED = { mem: 0, name: 1, sr: 4, year: 5, section: 6, email: 7 };

function findColumns(row) {
  const cols = {};
  row.forEach((h, i) => {
    const k = String(h).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const f in HEADERS) if (!(f in cols) && HEADERS[f].includes(k)) cols[f] = i;
  });
  return "mem" in cols && "sr" in cols && "name" in cols ? cols : null;
}

/**
 * Parse pasted/uploaded member data.
 * Returns { rows, problems, duplicates, total }.
 *  rows       valid members: { mem_no, name, sr_code, year_level, section, email }
 *  problems   [{ line, reason, raw }] rows that were skipped
 *  duplicates membership numbers that appeared more than once (the last one wins)
 */
export function parseMembers(text) {
  const all = splitRows(text);
  const out = { rows: [], problems: [], duplicates: [], total: 0 };
  let start = 0;
  let cols = null;
  while (start < all.length && all[start].every((c) => !c.trim())) start++;
  if (start < all.length) {
    cols = findColumns(all[start]);
    if (cols) start++;
  }
  const c = cols || FIXED;
  // Name can span several cells (merged cells in Excel export as blanks): take everything up to the next column
  const next = Object.values(c).filter((i) => i > c.name).sort((a, b) => a - b)[0] ?? Infinity;
  const map = new Map();
  const seen = new Set();

  for (let i = start; i < all.length; i++) {
    const r = all[i];
    if (r.every((x) => !x.trim())) continue;
    out.total++;
    const line = i + 1;
    const raw = r.map((x) => x.trim()).filter(Boolean).join(" | ");
    const get = (f) => (f in c ? String(r[c[f]] ?? "").trim() : "");
    const mem = normMem(get("mem"));
    const sr = normSr(get("sr"));
    const name = r.slice(c.name, next).map((x) => x.trim()).filter(Boolean).join(" ");
    const email = get("email").toLowerCase();
    const why = [];
    if (!validMem(mem)) why.push("membership no. not recognised");
    if (!sr) why.push("SR code should look like 24-01561");
    if (!name) why.push("name is empty");
    if (email && !EMAIL.test(email)) why.push("email is not valid");
    if (why.length) { out.problems.push({ line, reason: why.join("; "), raw }); continue; }
    if (seen.has(mem)) out.duplicates.push(mem);
    seen.add(mem);
    map.set(mem, { mem_no: mem, name, sr_code: sr, year_level: normYear(get("year")), section: get("section"), email });
  }
  out.rows = [...map.values()];
  return out;
}
