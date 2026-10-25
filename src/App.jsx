import { useEffect, useRef, useState } from "react";
import { newId, submitOrder } from "./lib/orders.js";
import { Carousel } from "./components/Carousel.jsx";
import { useCatalog } from "./hooks/useCatalog.js";
import { ProductCard } from "./components/ProductCard.jsx";
import { CartDrawer } from "./components/CartDrawer.jsx";
import { ProductPage } from "./pages/ProductPage.jsx";
import { CheckoutPage } from "./pages/CheckoutPage.jsx";
import { ReceiptPage } from "./pages/ReceiptPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";

const DEFAULT_HERO = `${import.meta.env.BASE_URL}images/black.jpg`;
const CART_KEY = "cp_cart_v1"; // bump the version if the saved shape ever changes

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    if (raw?.v !== 1 || !Array.isArray(raw.lines)) return [];
    return raw.lines
      .filter((l) => l && typeof l.id === "string" && Number.isInteger(l.qty) && l.qty > 0)
      .map((l) => ({ id: l.id, size: l.size, qty: Math.min(l.qty, 99) }));
  } catch {
    return [];
  }
}

/** Renders the headline with the accent word highlighted. */
function Headline({ title, accent }) {
  const i = accent ? title.indexOf(accent) : -1;
  if (i < 0) return title;
  return (
    <>
      {title.slice(0, i)}
      <em>{accent}</em>
      {title.slice(i + accent.length)}
    </>
  );
}

export default function App() {
  const { catalog, ready, source, saveItems, saveSettings, reload } = useCatalog();
  const { items: all, settings } = catalog;

  const [cart, setCart] = useState(loadCart); // [{ id, size, qty }], saved in this browser
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState("shop"); // shop | checkout | done
  const [order, setOrder] = useState(null);
  const [cat, setCat] = useState("All");
  const [hash, setHash] = useState(location.hash);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const onHash = () => {
      setHash(location.hash);
      setView((v) => (v === "done" ? "shop" : v));
      window.scrollTo(0, 0);
    };
    const onKey = (e) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify({ v: 1, lines: cart })); } catch { /* storage unavailable */ }
  }, [cart]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const byId = (id) => all.find((p) => p.id === id);
  // Until the catalog has loaded, don't judge saved cart lines against placeholder products.
  const lines = ready
    ? cart.map((l) => ({ ...l, key: `${l.id}|${l.size}`, p: byId(l.id) })).filter((l) => l.p && l.p.on !== false)
    : [];
  const count = ready ? lines.reduce((n, l) => n + l.qty, 0) : cart.reduce((n, l) => n + l.qty, 0);
  const sub = lines.reduce((n, l) => n + l.qty * l.p.p, 0);

  function add(id, size, n = 1, silent = false) {
    const p = byId(id);
    if (!p) return;
    const cap = p.stock == null ? 99 : p.stock;
    setCart((c) => {
      const hit = c.find((l) => l.id === id && l.size === size);
      if (!hit) return [...c, { id, size, qty: Math.min(cap, n) }];
      return c.map((l) => (l === hit ? { ...l, qty: Math.min(cap, l.qty + n) } : l));
    });
    if (!silent) setToast(`Added ${p.n}${size ? ` (${size})` : ""} to cart`);
  }

  function buyNow(id, size, n) {
    add(id, size, n, true);
    goCheckout();
  }

  function goCheckout() {
    setDrawer(false);
    setView("checkout");
    location.hash = "#/";
    window.scrollTo(0, 0);
  }

  function changeQty(key, d) {
    setCart((c) =>
      c.map((l) => {
        if (`${l.id}|${l.size}` !== key) return l;
        const p = byId(l.id);
        const cap = p && p.stock != null ? p.stock : 99;
        return { ...l, qty: Math.min(cap, Math.max(1, l.qty + d)) };
      }),
    );
  }

  const remove = (key) => setCart((c) => c.filter((l) => `${l.id}|${l.size}` !== key));

  const attempt = useRef({ id: "", sig: "" }); // lets a retry reuse the same id so the sheet never double-books

  async function placeOrder(allInfo) {
    const { receipt, ...info } = allInfo;
    const url = settings.ordersUrl || import.meta.env.VITE_ORDERS_URL || "";
    if (!url) throw new Error(`Online ordering isn't available right now. Please contact ${settings.contactEmail}.`);
    const body = {
      customer: { name: info.name, sr: info.sid, year: info.year, section: info.section, email: info.email },
      mem: info.mem, pct: settings.discountPct, gcashRef: info.gcashRef, clientTotal: info.total,
      items: lines.map((l) => ({ id: l.id, name: l.p.n, size: l.size || "", qty: l.qty, price: l.p.p })),
    };
    const sig = JSON.stringify({ ...body, r: receipt ? receipt.data.length + receipt.data.slice(0, 40) : "" });
    if (attempt.current.sig !== sig) attempt.current = { id: newId(), sig };
    const res = await submitOrder(url, { ...body, receipt: receipt || undefined, clientId: attempt.current.id });
    attempt.current = { id: "", sig: "" };
    setOrder({
      ...info, shown: info.total, receiptSaved: !!res.receipt,
      no: res.no, items: lines, sub: res.subtotal, disc: res.discount, total: res.total,
      pct: settings.discountPct, location: settings.pickupLocation, note: settings.pickupNote,
    });
    setCart([]);
    setView("done");
    window.scrollTo(0, 0);
  }

  const r = hash.replace(/^#\/?/, "");
  const route = r.startsWith("p/") ? "product" : r === "admin" ? "admin" : "main";
  const live = all.filter((p) => p.on !== false);
  const cats = ["All", ...new Set(live.map((p) => p.c))];
  const shown = live.filter((p) => cat === "All" || p.c === cat);
  const inCheckout = ready && route === "main" && view === "checkout";

  return (
    <div className="app">
      <header>
        <div className="wrap">
          <a href="#/" className="brand" onClick={() => setView("shop")}>
            {settings.storeName}
            <small className="mono">{settings.tagline}</small>
          </a>
          {inCheckout ? (
            <span className="mono muted">CHECKOUT</span>
          ) : (
            <button className="btn ghost" onClick={() => setDrawer(true)} aria-label="Open cart">
              Cart ({count})
            </button>
          )}
        </div>
      </header>

      {!ready ? <div className="wrap page muted" role="status">Loading…</div> : null}

      {ready && route === "product" ? (
        <ProductPage key={r} p={byId(decodeURIComponent(r.slice(2)))} add={add} buy={buyNow} />
      ) : null}

      {ready && route === "admin" ? (
        <AdminPage catalog={catalog} source={source} saveItems={saveItems} saveSettings={saveSettings} reload={reload} />
      ) : null}

      {ready && route === "main" && view === "shop" ? (
        <main>
          <section className="wrap hero">
            <div>
              <span className="tag mono">{settings.heroTag}</span>
              <h1><Headline title={settings.heroTitle} accent={settings.heroAccent} /></h1>
              <p>{settings.heroText}</p>
              <a href="#shop"><button className="btn" style={{ marginTop: 8 }}>Shop the collection</button></a>
            </div>
            <figure className="bp">
              <Carousel
                label="Featured merch"
                autoplay={4500}
                slides={(settings.heroImages?.filter(Boolean).length ? settings.heroImages.filter(Boolean) : [settings.heroImage || DEFAULT_HERO]).map((src) => (
                  <img src={src} alt="Featured CURSOR merch" draggable={false} />
                ))}
              />
              <figcaption className="mono">{settings.heroCaption}</figcaption>
            </figure>
          </section>

          <section className="wrap" id="shop">
            <div className="bar">
              <div>
                <h2>The collection</h2>
                <div className="sku mono">{shown.length} ITEMS</div>
              </div>
              <div className="chips" role="group" aria-label="Filter by category">
                {cats.map((k) => (
                  <button key={k} className="chip" aria-pressed={cat === k} onClick={() => setCat(k)}>{k}</button>
                ))}
              </div>
            </div>
            <div className="grid">
              {shown.map((p) => <ProductCard key={p.id} p={p} add={add} />)}
            </div>
          </section>
        </main>
      ) : null}

      {inCheckout ? (
        <CheckoutPage
          items={lines} sub={sub} pct={settings.discountPct}
          gcash={{ number: settings.gcashNumber, name: settings.gcashName, qr: settings.gcashQr }}
          back={() => setView("shop")} place={placeOrder}
        />
      ) : null}

      {ready && route === "main" && view === "done" && order ? (
        <ReceiptPage order={order} done={() => setView("shop")} />
      ) : null}

      {drawer ? (
        <CartDrawer
          items={lines} count={count} sub={sub}
          close={() => setDrawer(false)} qty={changeQty} rm={remove} checkout={goCheckout}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button onClick={() => { setToast(""); setDrawer(true); }}>View cart</button>
        </div>
      ) : null}

      <footer>
        <div className="wrap row foot">
          <span>{settings.footerText}</span>
          <span>
            <a href="#/admin" style={{ marginRight: 12 }}>Staff login</a>
            <span className="mono">{settings.contactEmail}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
