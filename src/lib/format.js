export function peso(n) {
  return (
    "PHP " +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function hasMemberPrice(p) {
  return p?.mp != null && Number.isFinite(Number(p.mp)) && Number(p.mp) < Number(p.p);
}

export function unitPrice(p, verified) {
  return verified && hasMemberPrice(p) ? Number(p.mp) : Number(p.p);
}
