import { useEffect, useId, useRef } from "react";
import { ProductImage } from "./ProductImage.jsx";
import { hasMemberPrice, peso } from "../lib/format.js";
import { printOf, subliKind } from "../lib/jersey.js";

export function CartDrawer({ open, items, count, sub, memSub, verified, close, qty, rm, checkout }) {
  const ref = useRef(null);
  const titleId = useId();
  const disc = verified ? Math.max(0, Math.round((sub - memSub) * 100) / 100) : 0;
  const total = verified ? memSub : sub;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  // Fallback light-dismiss for browsers without <dialog closedby="any"> (e.g. Safari).
  useEffect(() => {
    const el = ref.current;
    if (!el || "closedBy" in HTMLDialogElement.prototype) return undefined;
    const outside = (e) => {
      const r = el.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const onDown = (e) => { pressedOutside = outside(e); };
    const onUp = (e) => { if (pressedOutside && outside(e) && el.open) el.close(); };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <dialog ref={ref} className="drawer" closedby="any" aria-labelledby={titleId} onClose={close}>
      <div className="dh">
        <h2 id={titleId} style={{ fontSize: 18, margin: 0 }}>
          {"Your cart (" + count + ")"}
        </h2>
        <button type="button" className="link" onClick={() => ref.current?.close()}>
          Close ✕
        </button>
      </div>
      <div className="db">
        {items.length ? (
          items.map((l) => {
            const p = l.p;
            const otherUsed = items.filter((x) => x.key !== l.key && x.id === l.id).reduce((s, x) => s + x.qty, 0);
            const cap = p.stock == null ? 99 : Math.min(99, Math.max(1, p.stock - otherUsed));
            const pr = printOf(subliKind(p), l.jname, l.jersey);
            const label = p.n + (l.size ? ` (${l.size})` : "") + (pr ? `  ${pr.name} #${pr.no}` : "");
            return (
              <div className="line" key={l.key}>
                <div className="thumb">
                  <ProductImage product={p} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.n}</div>
                  <div className="sku mono">{p.id + (l.size ? " / " + l.size : "")}</div>
                  {pr ? <div className="sticker jno mono">{pr.name} #{pr.no}</div> : null}
                  <div className="row" style={{ marginTop: 8 }}>
                    <div className="qty">
                      <button type="button" aria-label={`Decrease quantity for ${label}`} disabled={l.qty <= 1} onClick={() => qty(l.key, -1)}>
                        −
                      </button>
                      <span className="mono">{l.qty}</span>
                      <button type="button" aria-label={`Increase quantity for ${label}`} disabled={l.qty >= cap} onClick={() => qty(l.key, 1)}>
                        +
                      </button>
                    </div>
                    {verified && hasMemberPrice(p) ? (
                      <span className="price-tier mono">
                        <s className="price-old">{peso(p.p * l.qty)}</s>
                        <span className="price-mem">{peso(p.mp * l.qty)}</span>
                      </span>
                    ) : (
                      <span className="mono" style={{ fontSize: 14 }}>
                        {peso(p.p * l.qty)}
                      </span>
                    )}
                  </div>
                  <button type="button" className="link" aria-label={`Remove ${label}`} onClick={() => rm(l.key)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ padding: "24px 0" }}>
            Your cart is empty. Add a shirt or a sticker set to get started.
          </p>
        )}
      </div>
      {items.length ? (
        <div className="df">
          <div className="sum">
            <span>Subtotal</span>
            <span className="mono">{peso(sub)}</span>
          </div>
          {disc > 0 ? (
            <div className="sum good">
              <span>Connect Card discount</span>
              <span className="mono">− {peso(disc)}</span>
            </div>
          ) : null}
          <div className="sum t">
            <span>Total</span>
            {disc > 0 ? (
              <span className="price-tier mono">
                <s className="price-old">{peso(sub)}</s>
                <span className="price-mem">{peso(total)}</span>
              </span>
            ) : (
              <span className="mono">{peso(total)}</span>
            )}
          </div>
          <button type="button" className="btn" style={{ width: "100%", marginTop: 12 }} onClick={checkout}>
            Checkout
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
