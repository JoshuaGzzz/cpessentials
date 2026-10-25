import { useState } from "react";
import { shrink } from "../../lib/image.js";
import { uploadImage } from "../../lib/db.js";
import { toSrc } from "../ProductImage.jsx";

/** Several photos: upload, remove, and choose which one comes first (the cover). */
export function PhotoList({ id, label, value, onChange, onError, onBusy, max = 1000, limit = 8 }) {
  const [up, setUp] = useState(false);
  const busy = (b) => { setUp(b); onBusy?.(b); };

  async function add(files) {
    const list = [...files].slice(0, Math.max(0, limit - value.length));
    if (!list.length) return;
    busy(true);
    const urls = [];
    try { for (const f of list) urls.push(await uploadImage(await shrink(f, max))); }
    catch (ex) { onError(ex); }
    if (urls.length) onChange([...value, ...urls]);
    busy(false);
  }

  return (
    <div className="full">
      <label htmlFor={id}>{label}</label>
      {value.length ? (
        <div className="photos">
          {value.map((u, k) => (
            <div className="ph" key={u + k}>
              <div className="thumb big"><img src={toSrc(u)} alt="" /></div>
              <div className="mini">
                {k > 0 ? <button type="button" onClick={() => onChange([u, ...value.filter((_, j) => j !== k)])}>Make first</button> : <span className="sku mono">COVER</span>}
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== k))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <input id={id} type="file" accept="image/*" multiple disabled={up || value.length >= limit} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {up ? <span className="muted"> Uploading…</span> : null}
      <div className="muted">The first photo is the cover. Visitors can swipe through the rest. Up to {limit} photos.</div>
    </div>
  );
}
