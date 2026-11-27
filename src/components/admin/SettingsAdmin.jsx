import { useEffect, useState } from "react";
import { shrink } from "../../lib/image.js";
import { uploadImage } from "../../lib/db.js";
import { DEFAULT_TICKER, cleanCopy, cleanTickerLine } from "../../data/settings.js";
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
  ["gcashName", "GCash account name"],
  ["gcashNumber", "GCash number (blank = no online payment step)"],
  ["ordersUrl", "Orders sheet URL (Apps Script web app)"],
];

const initSettings = (st) => ({
  ...st,
  heroTag: cleanCopy(st.heroTag, "OFFICIAL MERCH"),
  heroCaption: cleanCopy(st.heroCaption, "OFFICIAL MERCH"),
});
const initTickerText = (st) => (Array.isArray(st?.ticker) ? st.ticker : DEFAULT_TICKER).join("\n");

export function SettingsAdmin({ settings, save, onExpired }) {
  const [s, setS] = useState(() => initSettings(settings));
  const [tickerOn, setTickerOn] = useState(() => settings.tickerOn !== false);
  const [tickerText, setTickerText] = useState(() => initTickerText(settings));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const upd = (k, v) => setS((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setS(initSettings(settings));
    setTickerOn(settings.tickerOn !== false);
    setTickerText(initTickerText(settings));
  }, [settings]);

  const photoErr = (ex) => (ex.code === "AUTH" ? onExpired() : setMsg({ t: "Photo upload failed: " + ex.message, bad: true }));

  async function submit(e) {
    e.preventDefault();
    const ordersUrl = String(s.ordersUrl || "").trim();
    if (!s.storeName.trim()) return setMsg({ t: "Store name is required.", bad: true });
    if (ordersUrl && !/^https:\/\/.+/i.test(ordersUrl)) {
      return setMsg({ t: "Orders sheet URL must start with https:// (or leave it blank).", bad: true });
    }
    const rawLines = tickerText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (rawLines.some((l) => /<[^>]+>/.test(l))) {
      document.getElementById("s-ticker")?.focus();
      return setMsg({ t: "Ticker messages must be plain text only (no HTML).", bad: true });
    }
    const lines = rawLines.map(cleanTickerLine).filter(Boolean);
    if (lines.length > 8) {
      document.getElementById("s-ticker")?.focus();
      return setMsg({ t: "Ticker messages can have at most 8 lines.", bad: true });
    }
    if (lines.some((l) => l.length > 60)) {
      document.getElementById("s-ticker")?.focus();
      return setMsg({ t: "Each ticker message must be 60 characters or fewer.", bad: true });
    }
    if (tickerOn && !lines.length) {
      document.getElementById("s-ticker")?.focus();
      return setMsg({ t: "Enter at least one ticker message, or untick Show ticker.", bad: true });
    }
    setBusy(true);
    try {
      await save({
        ...s,
        ordersUrl,
        tickerOn,
        ticker: lines.length ? lines : DEFAULT_TICKER,
      });
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
        <div className="full">
          <label htmlFor="s-tickerOn" className={"opt" + (tickerOn ? " on" : "")} style={{ alignItems: "center", marginTop: 14 }}>
            <input id="s-tickerOn" name="tickerOn" type="checkbox" checked={tickerOn} onChange={(e) => setTickerOn(e.target.checked)} style={{ marginTop: 0 }} />
            <span>Show ticker</span>
          </label>
        </div>
        <div className="full">
          <label htmlFor="s-ticker">Ticker messages</label>
          <div id="s-ticker-hint" className="muted" style={{ marginBottom: 5 }}>
            One message per line, max 8 lines, max 60 characters each. Plain text only.
          </div>
          <textarea
            id="s-ticker"
            name="ticker"
            rows={4}
            value={tickerText}
            aria-describedby="s-ticker-hint"
            onChange={(e) => { setTickerText(e.target.value); setMsg(null); }}
          />
        </div>
        <PhotoList id="s-heroImages" label="Hero photos (blank = default shirt photo)" max={1200} onError={photoErr} onBusy={setUp}
          value={s.heroImages?.length ? s.heroImages : s.heroImage ? [s.heroImage] : []}
          onChange={(v) => { setS((x) => ({ ...x, heroImages: v, heroImage: v[0] || "" })); setMsg({ t: "Press Save settings to publish the photos.", bad: false }); }} />
        <PhotoField id="s-gcashQr" label="GCash QR code (optional, shown at checkout)" value={s.gcashQr} max={800} onError={photoErr} onBusy={setUp}
          onChange={(u) => { upd("gcashQr", u); if (u) setMsg({ t: "Photo uploaded. Press Save settings to use it.", bad: false }); }} />
      </div>
      {msg ? <p className={msg.bad ? "er2" : "ok2"} role="status">{msg.t}</p> : null}
      <button type="submit" className="btn" style={{ marginTop: 16 }} disabled={busy || up}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

function PhotoField({ id, label, value, max, onChange, onError, onBusy }) {
  const [up, setUp] = useState(false);
  const busy = (b) => { setUp(b); onBusy?.(b); };
  return (
    <div className="full">
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
        {value ? <div className="thumb"><img src={value} alt="" /></div> : null}
        <input id={id} type="file" accept="image/*" disabled={up} onChange={async (e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (!f) return;
          busy(true);
          try { onChange(await uploadImage(await shrink(f, max))); } catch (ex) { onError(ex); }
          busy(false);
        }} />
        {up ? <span className="muted">Uploading…</span> : null}
        {value && !up ? <button type="button" className="link" onClick={() => onChange("")}>Remove</button> : null}
      </div>
    </div>
  );
}
