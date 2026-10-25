import { useCallback, useEffect, useRef, useState } from "react";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Swipeable, scroll-snapping photo strip. `slides` is an array of React nodes.
 *  autoplay = milliseconds between slides (0 = off); it pauses on hover, focus and touch,
 *  and never runs for people who prefer reduced motion. One slide renders as-is, no wrapper. */
export function Carousel({ slides, label, autoplay = 0 }) {
  const n = slides.length;
  const track = useRef(null);
  const cur = useRef(0);
  const hold = useRef(false);
  const touch = useRef(0);
  const [i, setI] = useState(0);

  const go = useCallback((k) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: (((k % n) + n) % n) * el.clientWidth, behavior: reduced() ? "auto" : "smooth" });
  }, [n]);

  const onScroll = () => {
    const el = track.current;
    const k = Math.round(el.scrollLeft / (el.clientWidth || 1));
    if (k !== cur.current) { cur.current = k; setI(k); }
  };

  useEffect(() => {
    if (!autoplay || n < 2 || reduced()) return undefined;
    const id = setInterval(() => { if (!hold.current && !document.hidden) go(cur.current + 1); }, autoplay);
    return () => clearInterval(id);
  }, [autoplay, n, go]);

  if (n < 2) return slides[0] ?? null;

  return (
    <div
      className="car" role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => { hold.current = true; }} onMouseLeave={() => { hold.current = false; }}
      onFocus={() => { hold.current = true; }} onBlur={() => { hold.current = false; }}
      onTouchStart={() => { hold.current = true; clearTimeout(touch.current); }}
      onTouchEnd={() => { touch.current = setTimeout(() => { hold.current = false; }, 4000); }}
    >
      <div className="car-track" ref={track} onScroll={onScroll} tabIndex={0}>
        {slides.map((s, k) => (
          <div className="car-slide" key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`}>{s}</div>
        ))}
      </div>
      <button type="button" className="car-btn prev" aria-label="Previous photo" onClick={() => go(cur.current - 1)}>‹</button>
      <button type="button" className="car-btn next" aria-label="Next photo" onClick={() => go(cur.current + 1)}>›</button>
      <div className="car-dots">
        {slides.map((_, k) => (
          <button type="button" key={k} className="car-dot" aria-label={`Photo ${k + 1} of ${n}`} aria-current={k === i} onClick={() => go(k)} />
        ))}
      </div>
    </div>
  );
}
