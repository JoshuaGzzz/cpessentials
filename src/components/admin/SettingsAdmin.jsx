import { useState } from "react";
import { shrink } from "../../lib/image.js";
import { uploadImage } from "../../lib/db.js";
import { PhotoList } from "./PhotoList.jsx";

const FIELDS = [
  ["storeName", "Store name"],
  ["tagline", "Tagline under the logo"],
  ["heroTag", "Hero label"],
  ["heroTitle", "Hero headline"],
  ["heroAccent", "Highlighted word in the headline"],
  ["heroText", "Hero paragraph", "area"],
  ["heroCaption", "Hero image caption"],
  ["pickupLocation", "Pickup location"],
  ["pickupNote", "Pickup note shown on receipts", "area"],
  ["contactEmail", "Contact email"],
  ["footerText", "Footer text"],
  ["discountPct", "Connect Card discount (%)", "number"],
  ["gcashName", "GCash account name"],
  ["gcashNumber", "GCash number (blank = no online payment step)"],
  ["ordersUrl", "Orders sheet URL (Apps Script web app)"],
];

export function SettingsAdmin({ settings, save, onExpired }) {
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const upd = (k, v) => setS((x) => ({ ...x, [k]: v }));

  const photoErr = (ex) => (ex.code === "AUTH" ? onExpired() : setMsg({ t: "Photo upload failed: " + ex.message, bad: true }));

  async function submit(e) {
    e.preventDefault();
    const pct = Number(s.discountPct);
    if (!s.storeName.trim()) return setMsg({ t: "Store name is required.", bad: true });
    if (!(pct >= 0 && pct <= 90)) return setMsg({ t: "Discount must be between 0 and 90.", bad: true });
    setBusy(true);
    try {
      await save({ ...s, discountPct: pct });
      setMsg({ t: "Settings saved.", bad: false });
    } catch (ex) {
      if (ex.code === "AUTH") return onExpired();
      setMsg({ t: "Save failed: " + ex.message, bad: true });
    }
    setBusy(false);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="ad">
        {FIELDS.map(([k, label, kind]) => (
          <div key={k} className={kind === "area" ? "full" : ""}>
            <label htmlFor={"s-" + k}>{label}</label>
            {kind === "area" ? (
              <textarea id={"s-" + k} rows={3} value={s[k]} onChange={(e) => upd(k, e.target.value)} />
            ) : (
              <input id={"s-" + k} type={kind === "number" ? "number" : "text"} value={s[k]} onChange={(e) => upd(k, e.target.value)} />
            )}
          </div>
        ))}
        <PhotoList id="s-heroImages" label="Hero photos (blank = default shirt photo)" max={1200} onError={photoErr}
          value={s.heroImages?.length ? s.heroImages : s.heroImage ? [s.heroImage] : []}
          onChange={(v) => { setS((x) => ({ ...x, heroImages: v, heroImage: v[0] || "" })); setMsg({ t: "Press Save settings to publish the photos.", bad: false }); }} />
        <PhotoField id="s-gcashQr" label="GCash QR code (optional, shown at checkout)" value={s.gcashQr} max={800} onError={photoErr}
          onChange={(u) => { upd("gcashQr", u); if (u) setMsg({ t: "Photo uploaded. Press Save settings to use it.", bad: false }); }} />
      </div>
      {msg ? <p className={msg.bad ? "er2" : "ok2"} role="status">{msg.t}</p> : null}
      <button className="btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

function PhotoField({ id, label, value, max, onChange, onError }) {
  const [up, setUp] = useState(false);
  return (
    <div className="full">
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
        {value ? <div className="thumb"><img src={value} alt="" /></div> : null}
        <input id={id} type="file" accept="image/*" disabled={up} onChange={async (e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (!f) return;
          setUp(true);
          try { onChange(await uploadImage(await shrink(f, max))); } catch (ex) { onError(ex); }
          setUp(false);
        }} />
        {up ? <span className="muted">Uploading…</span> : null}
        {value && !up ? <button type="button" className="link" onClick={() => onChange("")}>Remove</button> : null}
      </div>
    </div>
  );
}
