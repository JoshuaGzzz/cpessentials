import { A } from "./ProductArt.jsx";

const BASE = import.meta.env.BASE_URL;

/** A full URL is used as-is. A bare name like "black" means public/images/black.jpg. */
export function toSrc(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return /^(https?:|data:|\/)/i.test(s) ? s : `${BASE}images/${s}.jpg`;
}

/** Every photo of a product, cover first. Falls back to the single legacy `img` field. */
export function imagesOf(p) {
  const list = (p.images || []).map(toSrc).filter(Boolean);
  if (list.length) return list;
  const one = toSrc(p.imgData || p.img);
  return one ? [one] : [];
}

export function ProductImage({ product: p, src, priority }) {
  const s = src || imagesOf(p)[0] || "";
  return s ? (
    <img
      src={s}
      alt={p.n}
      loading={priority === "high" ? undefined : "lazy"}
      fetchpriority={priority || undefined}
      decoding={priority === "high" ? undefined : "async"}
      draggable={false}
    />
  ) : (
    <svg viewBox="0 0 120 120" aria-label={p.n} role="img">
      {A[p.art] || A.box}
    </svg>
  );
}
