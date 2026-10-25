import { peso } from "../lib/format.js";
import { fmtMem } from "../lib/card.js";

export function ReceiptPage({ order: r, done }) {
  return (
    <div className="wrap page">
      <div className="panel rcpt">
        <div className="ok" aria-hidden="true">✓</div>
        <h2 style={{ textAlign: "center" }}>Order received</h2>
        <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
          Salamat, {r.name.split(" ")[0]}! Save your order number. We'll use {r.email} to reach you.
        </p>
        <div className="mono orderno">{r.no}</div>
        {r.items.map((l) => (
          <div className="sum" key={l.key}>
            <span>{l.qty} × {l.p.n}{l.size ? ` (${l.size})` : ""}</span>
            <span className="mono">{peso(l.p.p * l.qty)}</span>
          </div>
        ))}
        <div className="sum" style={{ marginTop: 8 }}>
          <span>Subtotal</span>
          <span className="mono">{peso(r.sub)}</span>
        </div>
        {r.disc ? (
          <div className="sum good">
            <span>Connect Card discount ({r.pct}%)</span>
            <span className="mono">− {peso(r.disc)}</span>
          </div>
        ) : null}
        <div className="sum t">
          <span>{r.gcashRef ? "Total paid via GCash" : "Total due"}</span>
          <span className="mono">{peso(r.total)}</span>
        </div>
        {r.disc ? (
          <p className="note good">Connect Card {fmtMem(r.mem)} verified for {r.sid}. Discount applied.</p>
        ) : null}
        {r.gcashRef ? (
          <p className="note">
            GCash reference <span className="mono">{r.gcashRef}</span>. {r.receiptSaved ? "Your receipt photo was received. " : ""}We'll check your payment and mark the order as paid.
          </p>
        ) : null}
        {Math.abs(r.total - r.shown) > 0.005 ? (
          <p className="note">
            Your total was recalculated to <b>{peso(r.total)}</b> (the page showed {peso(r.shown)}). The organizers will settle the difference at pickup.
          </p>
        ) : null}
        <p className="note">
          Pick up at <b>{r.location}</b>. Show your Student ID ({r.sid}, {r.year} {r.section}) and this order number. {r.note}
        </p>
        <div className="row noprint">
          <button className="btn ghost" onClick={() => window.print()}>Print receipt</button>
          <button className="btn" onClick={done}>Continue shopping</button>
        </div>
      </div>
    </div>
  );
}
