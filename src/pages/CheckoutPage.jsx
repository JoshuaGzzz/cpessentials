import { useState } from "react";
import { fmtMem, normMem, validMem } from "../lib/card.js";
import { dbConfigured, verifyMember } from "../lib/db.js";
import { normSr } from "../lib/members.js";
import { shrink, toBase64 } from "../lib/image.js";
import { peso } from "../lib/format.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

export function CheckoutPage({ items, sub, pct, gcash, back, place }) {
  const [form, setForm] = useState({ name: "", sr: "", year: "", section: "", email: "", member: false, mem: "" });
  const [errs, setErrs] = useState({});
  const [vs, setVs] = useState(""); // "", "checking", "ok", "bad", "error"
  const [step, setStep] = useState(1);
  const [ref, setRef] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState("");
  const [receipt, setReceipt] = useState(null); // { url, mime, data } the GCash receipt photo
  const [reading, setReading] = useState(false);

  const disc = form.member && vs === "ok" ? Math.round(sub * pct) / 100 : 0;
  const total = sub - disc;

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    if (["sr", "mem", "member"].includes(k)) setVs("");
  }

  function validate() {
    const x = {};
    if (form.name.trim().length < 2) x.name = "Enter your full name.";
    if (!normSr(form.sr)) x.sr = "Use the format 24-12345.";
    if (!form.year) x.year = "Choose your year level.";
    if (!form.section.trim()) x.section = "Enter your section.";
    if (!EMAIL.test(form.email.trim())) x.email = "Enter a valid email address.";
    if (form.member && !validMem(normMem(form.mem))) x.mem = "Use the format CRSR S126 0000 0000.";
    setErrs(x);
    return !Object.keys(x).length;
  }

  async function review() {
    if (!validate()) return;
    if (form.member && vs !== "ok") {
      setVs("checking");
      try { setVs((await verifyMember(form.mem, normSr(form.sr))) ? "ok" : "bad"); }
      catch { setVs("error"); }
      return; // stay here so the result is visible; press again to continue
    }
    setStep(2);
  }

  async function onReceipt(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPlaceErr("");
    setReading(true);
    try {
      const blob = await shrink(f, 1800);
      const data = await toBase64(blob);
      setReceipt((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { url: URL.createObjectURL(blob), mime: "image/jpeg", data };
      });
    } catch (ex) {
      setPlaceErr(ex.message || "Couldn't read that image.");
    }
    setReading(false);
  }

  async function confirm() {
    setPlaceErr("");
    const r = ref.replace(/\s+/g, "");
    if (gcash.number && !/^[A-Za-z0-9]{8,20}$/.test(r)) return setPlaceErr("Enter the reference number from your GCash receipt after paying.");
    if (gcash.number && !receipt) return setPlaceErr("Attach a screenshot or photo of your GCash receipt.");
    const verified = form.member && vs === "ok";
    setPlacing(true);
    try {
      await place({
        name: form.name.trim(), sid: normSr(form.sr), year: form.year, section: form.section.trim(), email: form.email.trim(),
        disc, mem: verified ? normMem(form.mem) : "", total, gcashRef: gcash.number ? r : "",
        receipt: gcash.number && receipt ? { mime: receipt.mime, data: receipt.data } : null,
      });
    } catch (ex) {
      setPlaceErr(ex.message || "Couldn't place the order. Try again.");
      setPlacing(false);
    }
  }

  const field = (k, label, placeholder, type = "text", mono = false) => (
    <div>
      <label htmlFor={k}>{label}</label>
      <input id={k} type={type} className={mono ? "mono" : ""} value={form[k]} placeholder={placeholder} aria-invalid={!!errs[k]} onChange={(e) => set(k, e.target.value)} />
      {errs[k] ? <div className="err" role="alert">{errs[k]}</div> : null}
    </div>
  );

  return (
    <div className="wrap co">
      <div className="panel">
        <div className="steps">
          <b className={step === 1 ? "on" : ""}>1 Details</b>
          <b className={step === 2 ? "on" : ""}>2 Review &amp; confirm</b>
        </div>

        {step === 1 ? (
          <div>
            <h2>Checkout</h2>
            {field("name", "Full name", "Dela Cruz, Juan A.")}
            {field("sr", "SR code", "24-12345", "text", true)}
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="year">Year level</label>
                <select id="year" value={form.year} aria-invalid={!!errs.year} onChange={(e) => set("year", e.target.value)}>
                  <option value="">Select…</option>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
                {errs.year ? <div className="err" role="alert">{errs.year}</div> : null}
              </div>
              <div style={{ flex: 1 }}>{field("section", "Section", "2101")}</div>
            </div>
            {field("email", "Email", "24-12345@g.batstate-u.edu.ph", "email")}

            {dbConfigured ? (
              <>
                <label className={"opt" + (form.member ? " on" : "")} style={{ fontWeight: 400 }}>
                  <input type="checkbox" checked={form.member} onChange={(e) => set("member", e.target.checked)} />
                  <span>
                    <b>I'm a Connect Card Holder (−{pct}%)</b>
                    <br />
                    <span className="muted">Enter the membership number on your Connect Card. We check it against the list with your SR code.</span>
                  </span>
                </label>
                {form.member ? (
                  <div>
                    {field("mem", "Connect Card membership no.", "CRSR S126 0000 0000", "text", true)}
                    {vs === "checking" ? <div className="muted" role="status">Checking Connect Card…</div> : null}
                    {vs === "ok" ? <div className="ok2" role="status">✓ Connect Card verified. {pct}% discount applied.</div> : null}
                    {vs === "bad" ? <div className="err" role="alert">We couldn't find that Connect Card number with that SR code. Check both, or untick the box to order without the discount.</div> : null}
                    {vs === "error" ? <div className="err" role="alert">Couldn't reach the Connect Card list. Try again in a moment.</div> : null}
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="row actions" style={{ marginTop: 20 }}>
              <button className="btn ghost" onClick={back}>← Back to shop</button>
              <button className="btn" disabled={vs === "checking"} onClick={review}>
                {form.member && vs !== "ok" ? "Verify membership" : "Review order →"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2>Review &amp; confirm</h2>
            <dl style={{ lineHeight: 1.9, fontSize: 14 }}>
              {[
                ["Name", form.name],
                ["SR code", normSr(form.sr)],
                ["Year & section", `${form.year} · ${form.section.trim()}`],
                ["Email", form.email],
                ...(disc ? [["Connect Card no.", fmtMem(form.mem)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="row">
                  <dt className="muted">{k}</dt>
                  <dd style={{ margin: 0, textAlign: "right" }} className={k === "SR code" || k === "Connect Card no." ? "mono" : ""}>{v}</dd>
                </div>
              ))}
            </dl>
            {gcash.number ? (
              <div className="gcash">
                <b>Pay with GCash</b>
                <p className="muted" style={{ margin: "6px 0 12px" }}>
                  Open GCash, tap Send Money (or scan the QR), and send exactly <b className="mono">{peso(total)}</b>. Then enter the reference number from your GCash receipt.
                </p>
                <div className="gcash-body">
                  {gcash.qr ? <img src={gcash.qr} alt="GCash QR code" className="gcash-qr" /> : null}
                  <div>
                    <div className="sku mono">SEND TO</div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{gcash.number}</div>
                    {gcash.name ? <div className="muted">{gcash.name}</div> : null}
                    <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(gcash.number)?.catch(() => {})}>Copy number</button>
                  </div>
                </div>
                <label htmlFor="gref">GCash reference number</label>
                <input id="gref" className="mono" autoComplete="off" value={ref} placeholder="1234 567 890123" aria-invalid={!!placeErr} onChange={(e) => setRef(e.target.value)} />
                <label htmlFor="grc">Photo or screenshot of your GCash receipt</label>
                <input id="grc" type="file" accept="image/*" disabled={reading} onChange={onReceipt} />
                {reading ? <div className="muted" role="status">Preparing photo…</div> : null}
                {receipt ? (
                  <div className="rc-prev">
                    <img src={receipt.url} alt="Your GCash receipt" />
                    <button type="button" className="link" onClick={() => { URL.revokeObjectURL(receipt.url); setReceipt(null); }}>Remove</button>
                  </div>
                ) : null}
                <div className="muted" style={{ marginTop: 6 }}>It goes to the organizers' private Google Drive folder, not the website's database.</div>
              </div>
            ) : (
              <p className="muted">Payment is collected when you receive your order.</p>
            )}
            {placeErr ? <div className="err" role="alert" style={{ marginTop: 10 }}>{placeErr}</div> : null}
            <div className="row actions" style={{ marginTop: 16 }}>
              <button className="btn ghost" disabled={placing} onClick={() => setStep(1)}>← Edit details</button>
              <button className="btn" disabled={placing || reading} onClick={confirm}>{placing ? "Placing order…" : `Place order · ${peso(total)}`}</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <b>Order summary</b>
        {items.map((l) => (
          <div className="sum" key={l.key} style={{ marginTop: 8 }}>
            <span>{l.qty} × {l.p.n}{l.size ? ` (${l.size})` : ""}</span>
            <span className="mono">{peso(l.p.p * l.qty)}</span>
          </div>
        ))}
        <div className="sum" style={{ marginTop: 10 }}>
          <span>Subtotal</span>
          <span className="mono">{peso(sub)}</span>
        </div>
        {disc ? (
          <div className="sum good">
            <span>Connect Card discount ({pct}%)</span>
            <span className="mono">− {peso(disc)}</span>
          </div>
        ) : null}
        <div className="sum t">
          <span>{gcash.number ? "Total to pay" : "Total"}</span>
          <span className="mono">{peso(total)}</span>
        </div>
      </div>
    </div>
  );
}
