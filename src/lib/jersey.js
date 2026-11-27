// Subli/Jersey print options (/subli|jersey/i) and Pin button option detection.
export const JERSEY_RE = /^\d{1,2}$/;
export const JNAME_MAX = 12;
export const JNAME_RE = new RegExp(`^(?!.*  )[A-ZÑ](?:[A-ZÑ .'\\-]{0,${JNAME_MAX - 2}}[A-ZÑ.'\\-])?$`);
export const DEFAULT_PRINT_NAME = "ENGR";
export const DEFAULT_PRINT_NO = "00";

// Display order for Subli shirt options.
// Option 4 ("name") is optional to complete the 2x2 grid — delete "name" here and from SUBLI_LABELS if not offered.
export const SUBLI_KINDS = ["base", "number", "both", "name"];
export const SUBLI_LABELS = {
  base: "Engr / 00",
  number: "Custom #",
  both: "Name + #",
  name: "Name only", // Option 4 (optional)
};

const nameOf = (p) => (typeof p === "string" ? p : String(p?.n || ""));
export const isJersey = (p) => /subli|jersey/i.test(nameOf(p));
export const isPinButton = (p) => /pin button/i.test(nameOf(p));
export const isPin3Set = (p) => isPinButton(p) && /3\s*-?\s*set/i.test(nameOf(p));
export const isPinSetVariant = (p) => isPinButton(p) && /\(3\s*-?\s*set\)\s*$/i.test(nameOf(p).trim());
export const isPinPieceVariant = (p) => isPinButton(p) && /\(per\s+piece\)\s*$/i.test(nameOf(p).trim());

/** Returns { set, piece } when both visible Pin button variants exist, else null. */
export function getPinPair(items) {
  const live = (items || []).filter((p) => p && p.on !== false);
  const set = live.find(isPinSetVariant);
  const piece = live.find(isPinPieceVariant);
  return set && piece ? { set, piece } : null;
}

/** Returns "base" | "number" | "name" | "both" for Subli/Jersey products, else null. Unsuffixed -> "number". */
export function subliKind(p) {
  const s = nameOf(p).trim();
  if (!isJersey(s)) return null;
  const m = /\(([^)]+)\)\s*$/.exec(s);
  if (m) {
    const suf = m[1].trim().toLowerCase();
    if (/^engr\s*\/\s*00$/.test(suf)) return "base";
    if (/^(?:custom\s+)?name\s*(?:\+|&|and)\s*(?:number|no\.?|#)$/.test(suf)) return "both";
    if (/^(?:custom\s+name|name(?:\s+only)?)$/.test(suf)) return "name"; // Option 4 (optional)
    if (/^(?:custom\s+(?:number|no\.?|#)|number(?:\s+only)?)$/.test(suf)) return "number";
  }
  return "number";
}

export const subliNeedsNo = (kind) => kind === "number" || kind === "both";
export const subliNeedsName = (kind) => kind === "name" || kind === "both";

/** Removes a recognized Subli option suffix for grouped card headings. */
export function subliTitle(name) {
  const s = String(name || "").trim();
  return s.replace(/\s*\((?:engr\s*\/\s*00|(?:custom\s+)?name\s*(?:\+|&|and)\s*(?:number|no\.?|#)|custom\s+name|name(?:\s+only)?|custom\s+(?:number|no\.?|#)|number(?:\s+only)?)\)\s*$/i, "").trim() || s;
}

/** Returns ordered array [base, number, both, name] of visible Subli variants when >= 2 exist, else null. */
export function getSubliGroup(items) {
  const live = (items || []).filter((p) => p && p.on !== false);
  const byKind = {};
  for (const p of live) {
    const k = subliKind(p);
    if (k && !byKind[k]) byKind[k] = p;
  }
  const ordered = SUBLI_KINDS.map((k) => byKind[k]).filter(Boolean);
  return ordered.length >= 2 ? ordered : null;
}

/** Digits-only, at most 2 characters (used while typing). */
export const cleanJersey = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 2);
/** A valid saved number, or "" if missing/invalid. */
export const jerseyOf = (v) => (typeof v === "string" && JERSEY_RE.test(v) ? v : "");

/** Uppercase, keep only letters (incl. Ñ), spaces, . - ', collapse repeated spaces, max JNAME_MAX chars.
 *  Pass { live: true } while typing to keep a single trailing space. Use JNAME_RE to check starting letter. */
export function cleanJname(s, { live = false } = {}) {
  const raw = String(s ?? "");
  let out = (raw.normalize ? raw.normalize("NFC") : raw)
    .replace(/[\u2018\u2019]/g, "'")
    .toUpperCase()
    .replace(/[^A-ZÑ .'-]/g, "")
    .replace(/ {2,}/g, " ");
  if (live) return out.replace(/^ +/, "").slice(0, JNAME_MAX);
  return out.trim().slice(0, JNAME_MAX).trim();
}

/** A valid saved custom name, or "" if missing/invalid (never strips illegal characters). */
export function jnameOf(v) {
  if (typeof v !== "string") return "";
  const s = (v.normalize ? v.normalize("NFC") : v)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return JNAME_RE.test(s) ? s : "";
}

/** Returns { name, no } with ENGR / 00 defaults for Subli options, or null for non-Subli products. */
export function printOf(kind, jname, jersey) {
  if (!kind) return null;
  const name = subliNeedsName(kind) && jname ? jname : DEFAULT_PRINT_NAME;
  const no = subliNeedsNo(kind) && jersey ? jersey : DEFAULT_PRINT_NO;
  return { name, no };
}

/** Cart/line merge key. Empty jname keeps the exact legacy key format (id|size|jersey). */
export const lineKey = (l) => `${l.id}|${l.size || ""}|${l.jersey || ""}${l.jname ? `|${l.jname}` : ""}`;
