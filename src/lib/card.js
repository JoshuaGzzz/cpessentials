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
