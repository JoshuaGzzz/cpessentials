import { A } from "./ProductArt.jsx";

const BASE = import.meta.env.BASE_URL;

/** A full URL is used as-is. A bare name like "black" means public/images/black.jpg. */
export function toSrc(v) {
  if (!v) return "";
  return /^(https?:|data:|\/)/.test(v) ? v : `${BASE}images/${v}.jpg`;
}

/** Every photo of a product, cover first. Falls back to the single legacy `img` field. */
export function imagesOf(p) {
  const list = (p.images || []).filter(Boolean).map(toSrc);
  if (list.length) return list;
  const one = toSrc(p.imgData || p.img);
  return one ? [one] : [];
}

export function ProductImage({ product: p, src }) {
  const s = src || imagesOf(p)[0] || "";
  return s ? (
    <img src={s} alt={p.n} loading="lazy" decoding="async" draggable={false} />
  ) : (
    <svg viewBox="0 0 120 120" aria-label={p.n} role="img">
      {A[p.art] || A.box}
    </svg>
  );
}
