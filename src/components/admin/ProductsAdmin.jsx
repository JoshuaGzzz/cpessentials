import { useEffect, useRef, useState } from "react";
import { ProductImage } from "../ProductImage.jsx";
import { PhotoList } from "./PhotoList.jsx";
import { peso } from "../../lib/format.js";

const BLANK = { orig: "", id: "", n: "", c: "Accessories", p: "", d: "", sizes: "", stock: "", on: true, images: [], art: "" };
const toDraft = (p) => ({
  orig: p.id, id: p.id, n: p.n, c: p.c, p: String(p.p), d: p.d,
  sizes: (p.sizes || []).join(", "), stock: p.stock == null ? "" : String(p.stock),
  on: p.on !== false, images: p.images?.length ? p.images : p.img ? [p.img] : [], art: p.art || "",
});

export function ProductsAdmin({ items, source, saveItems, onExpired }) {
  const [ed, setEd] = useState(null);
  const [msg, setMsg] = useState(null);
  const [del, setDel] = useState("");
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const edRef = useRef(null);
  const editing = ed ? ed.orig : null;
  // Bring the editor into view when Edit / Add item is pressed (the list can be long).
  useEffect(() => { if (editing !== null) edRef.current?.scrollIntoView({ block: "start" }); }, [editing]);
  const upd = (k, v) => setEd((d) => ({ ...d, [k]: v }));
  const cats = [...new Set(items.map((p) => p.c))];

  async function run(next, note) {
    setBusy(true);
    try {
      await saveItems(next);
      setMsg({ t: note, bad: false });
      setEd(null);
      setDel("");
    } catch (ex) {
      if (ex.code === "AUTH") onExpired();
      else setMsg({ t: "Save failed: " + ex.message, bad: true });
    }
    setBusy(false);
  }

  const photoErr = (ex) => (ex.code === "AUTH" ? onExpired() : setMsg({ t: "Photo upload failed: " + ex.message, bad: true }));

  function commit() {
    const id = ed.id.trim();
    const price = parseFloat(ed.p);
    const bad = (t) => setMsg({ t, bad: true });
    if (!/^[A-Za-z0-9-]{2,24}$/.test(id)) return bad("SKU must be 2–24 letters, numbers or dashes.");
    if (items.some((x) => x.id === id && x.id !== ed.orig)) return bad("That SKU already exists.");
    if (!ed.n.trim()) return bad("Name is required.");
    if (isNaN(price) || price < 0) return bad("Enter a valid price.");
    const item = {
      id, n: ed.n.trim(), c: ed.c.trim() || "Other", p: price, d: ed.d.trim(),
      images: ed.images, img: ed.images[0] || "", art: ed.art,
      sizes: ed.sizes.split(",").map((z) => z.trim()).filter(Boolean),
      stock: ed.stock.trim() === "" ? null : Math.max(0, parseInt(ed.stock, 10) || 0),
      on: ed.on,
    };
    run(ed.orig ? items.map((x) => (x.id === ed.orig ? item : x)) : [...items, item], "Item saved.");
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    run(a, "Order updated.");
  }

  function duplicate(p, i) {
    let id = p.id + "-COPY";
    while (items.some((x) => x.id === id)) id += "2";
    const a = [...items];
    a.splice(i + 1, 0, { ...p, id, n: p.n + " (copy)" });
    run(a, "Item duplicated.");
  }

  const fld = (k, label, type = "text", cls = "", list) => (
    <div>
      <label htmlFor={"f-" + k}>{label}</label>
      <input id={"f-" + k} type={type} className={cls} list={list} value={ed[k]} onChange={(e) => upd(k, e.target.value)} />
    </div>
  );

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="sku mono">{items.length} ITEMS</span>
        <button className="btn" onClick={() => { setMsg(null); setEd({ ...BLANK }); }}>+ Add item</button>
      </div>
      {source === "file" ? (
        <div className="note" style={{ marginBottom: 12 }}>
          These are the starter products from catalog.json and they aren't in the database yet. Save them once and they become editable and live.
          <div style={{ marginTop: 8 }}>
            <button className="btn" disabled={busy} onClick={() => run(items, "Starter products saved to the database.")}>Save starter products to database</button>
          </div>
        </div>
      ) : null}
      {msg ? <p className={msg.bad ? "er2" : "ok2"} role="status">{msg.t}</p> : null}

      {ed ? (
        <div className="panel editor" ref={edRef} style={{ marginBottom: 20 }}>
          <h2>{ed.orig ? "Edit item" : "New item"}</h2>
          <div className="ad">
            {fld("n", "Name")}
            {fld("id", "SKU (unique)", "text", "mono")}
            {fld("c", "Category", "text", "", "cats")}
            <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            {fld("p", "Price (PHP)", "number", "mono")}
            {fld("stock", "Stock (blank = unlimited)", "number", "mono")}
            {fld("sizes", "Sizes (comma-separated, blank = none)")}
            <div className="full">
              <label htmlFor="f-d">Description</label>
              <textarea id="f-d" rows={3} value={ed.d} onChange={(e) => upd("d", e.target.value)} />
            </div>
            <PhotoList id="f-img" label="Photos" value={ed.images} onChange={(v) => upd("images", v)} onError={photoErr} onBusy={setUp} />
            <label className="full" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={ed.on} onChange={(e) => upd("on", e.target.checked)} />
              Visible in the shop
            </label>
          </div>
          <div className="row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
            <button className="btn" disabled={busy || up} onClick={commit}>{busy ? "Saving…" : "Save item"}</button>
            <button className="btn ghost" onClick={() => { setEd(null); setMsg(null); }}>Cancel</button>
          </div>
        </div>
      ) : null}

      <div className="panel tw">
        <table className="tbl">
          <thead>
            <tr>{["", "Item", "Price", "Stock", "Sizes", "Status", ""].map((x, i) => <th key={i}>{x}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id}>
                <td><div className="thumb"><ProductImage product={p} /></div></td>
                <td><b>{p.n}</b><div className="sku mono">{p.id} · {p.c}</div></td>
                <td className="mono">{peso(p.p)}</td>
                <td className="mono">{p.stock == null ? "∞" : p.stock}</td>
                <td>{(p.sizes || []).join(" ") || "—"}</td>
                <td>{p.on === false ? "Hidden" : "Live"}</td>
                <td>
                  <div className="mini">
                    <button onClick={() => { setMsg(null); setEd(toDraft(p)); }}>Edit</button>
                    <button disabled={busy} onClick={() => duplicate(p, i)}>Copy</button>
                    <button disabled={busy} onClick={() => run(items.map((x) => (x.id === p.id ? { ...p, on: p.on === false } : x)), p.on === false ? "Item is now visible." : "Item hidden.")}>
                      {p.on === false ? "Show" : "Hide"}
                    </button>
                    <button disabled={busy || i === 0} aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                    <button disabled={busy || i === items.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                    <button disabled={busy} style={{ color: "#b3261e" }} onClick={() => (del === p.id ? run(items.filter((x) => x.id !== p.id), "Item deleted.") : setDel(p.id))}>
                      {del === p.id ? "Confirm delete" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
