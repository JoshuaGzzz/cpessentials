// Membership number helpers. Stored/compared in normalized form: CRSRS12627000004
export function normMem(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function validMem(n) {
  return /^CRSR[A-Z0-9]{8}\d{4,}$/.test(n);
}
/** CRSRS12627000004 -> "CRSR S126 2700 0004" */
export function fmtMem(s) {
  const n = normMem(s);
  return n.slice(0, 12).replace(/(.{4})/g, "$1 ") + n.slice(12);
}

export const MEMBER_KEY = "cp_member";

export function loadMember() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(MEMBER_KEY));
    const mem = normMem(raw?.mem);
    const sr = String(raw?.sr || "").trim();
    if (validMem(mem) && /^\d{2}-\d{5}$/.test(sr)) return { mem, sr };
  } catch { /* ignore */ }
  return null;
}

export function saveMember(m) {
  try {
    if (m && validMem(normMem(m.mem)) && /^\d{2}-\d{5}$/.test(m.sr)) {
      sessionStorage.setItem(MEMBER_KEY, JSON.stringify({ mem: normMem(m.mem), sr: m.sr }));
    } else {
      sessionStorage.removeItem(MEMBER_KEY);
    }
  } catch { /* ignore */ }
}
