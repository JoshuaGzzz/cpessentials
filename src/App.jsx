import { useEffect, useRef, useState } from "react";
import { newId, submitOrder } from "./lib/orders.js";
import { fmtMem, loadMember, normMem, saveMember, validMem } from "./lib/card.js";
import { dbConfigured, verifyMember } from "./lib/db.js";
import { normSr } from "./lib/members.js";
import { unitPrice } from "./lib/format.js";
import { Carousel } from "./components/Carousel.jsx";
import { useCatalog } from "./hooks/useCatalog.js";
import { ProductCard } from "./components/ProductCard.jsx";
import { CartDrawer } from "./components/CartDrawer.jsx";
import { ProductPage } from "./pages/ProductPage.jsx";
import { CheckoutPage } from "./pages/CheckoutPage.jsx";
import { ReceiptPage } from "./pages/ReceiptPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";
import { cleanCopy, tickerOf } from "./data/settings.js";
import { getPinPair, getSubliGroup, jerseyOf, jnameOf, lineKey, printOf, subliKind, subliNeedsName, subliNeedsNo } from "./lib/jersey.js";

const DEFAULT_HERO = `${import.meta.env.BASE_URL}images/black.jpg`;
const CART_KEY = "cp_cart_v1"; // bump the version if the saved shape ever changes

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    if (raw?.v !== 1 || !Array.isArray(raw.lines)) return [];
    const merged = new Map();
    for (const l of raw.lines) {
      if (!l || typeof l.id !== "string" || !l.id || !Number.isInteger(l.qty) || l.qty <= 0) continue;
      const size = typeof l.size === "string" ? l.size : "";
      const jersey = jerseyOf(l.jersey); // older saved carts have no jersey field: treated as ""
      const jname = jnameOf(l.jname); // older saved carts have no jname field: treated as ""
      const key = lineKey({ id: l.id, size, jersey, jname });
      const prev = merged.get(key);
      const line = { id: l.id, size, qty: Math.min(99, (prev ? prev.qty : 0) + l.qty) };
      if (jersey) line.jersey = jersey;
      if (jname) line.jname = jname;
      merged.set(key, line);
    }
    return [...merged.values()];
  } catch {
    return [];
  }
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return ""; }
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

/** Decorative motifs from the designs folder (crown + squiggle arrow), drawn as inline SVG. */
function Crown({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 48" aria-hidden="true" focusable="false">
      <path d="M6 38 L4 10 L18 22 L32 4 L46 22 L60 10 L58 38 Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M8 44 H56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 38 v6 M44 38 v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Squiggle({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 40" aria-hidden="true" focusable="false">
      <path d="M4 30 C20 30 24 8 40 10 S52 32 66 26 S82 6 96 12 S118 28 146 18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M134 8 L148 18 L134 28" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MemberBanner({ member, onChange }) {
  const [mem, setMem] = useState("");
  const [sr, setSr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const nMem = normMem(mem);
    const nSr = normSr(sr);
    if (!validMem(nMem)) return setErr("Enter a valid Membership No. (e.g. CRSR S126 0000 0000).");
    if (!nSr) return setErr("Enter your SR Code in the format 24-12345.");
    if (!dbConfigured) return setErr("Member verification isn't connected right now. Please try again later.");
    setBusy(true);
    try {
      if (await verifyMember(nMem, nSr)) {
        onChange({ mem: nMem, sr: nSr });
        setMem("");
        setSr("");
      } else {
        setErr("Connect Card number and SR Code didn't match our member list.");
      }
    } catch {
      setErr("Couldn't reach the Connect Card list. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (member) {
    return (
      <section className="mem-bar unlocked" aria-label="Connect Card status">
        <div className="wrap mem-strip">
          <span className="mem-strip-text">
            <b className="mono">✓</b> Member prices unlocked <span className="mem-meta mono">· {fmtMem(member.mem)}</span>
          </span>
          <button type="button" className="link mem-switch mono" onClick={() => { onChange(null); setErr(""); }}>
            Switch card
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mem-bar" aria-label="Connect Card verification">
      <div className="wrap mem-inner">
        <span className="mem-prompt">
          <b className="mono">CONNECT CARD:</b> Verify for member prices
        </span>
        <form className="mem-form" onSubmit={onSubmit} noValidate>
          <div className="mem-field">
            <label htmlFor="mb-mem">Card No.</label>
            <input
              id="mb-mem"
              name="mem"
              className="mono"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="CRSR S126 0000 0000"
              value={mem}
              aria-invalid={!!err}
              aria-describedby={err ? "mb-err" : undefined}
              onChange={(e) => { setMem(e.target.value); setErr(""); }}
            />
          </div>
          <div className="mem-field mem-sr">
            <label htmlFor="mb-sr">SR Code</label>
            <input
              id="mb-sr"
              name="sr"
              className="mono"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="24-12345"
              value={sr}
              aria-invalid={!!err}
              aria-describedby={err ? "mb-err" : undefined}
              onChange={(e) => { setSr(e.target.value); setErr(""); }}
            />
          </div>
          <button type="submit" className="btn mem-btn" disabled={busy}>
            {busy ? "…" : "Verify"}
          </button>
          {err ? <div id="mb-err" className="mem-err" role="alert">{err}</div> : null}
        </form>
      </div>
    </section>
  );
}

export default function App() {
  const { catalog, ready, source, dbError, saveItems, saveSettings, reload } = useCatalog();
  const { items: all, settings } = catalog;

  const [cart, setCart] = useState(loadCart); // [{ id, size, qty }], saved in this browser
  const [member, setMember] = useState(loadMember);
  const updateMember = (m) => { setMember(m); saveMember(m); };
  const verified = Boolean(member);
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState("shop"); // shop | checkout | done
  const [order, setOrder] = useState(null);
  const [cat, setCat] = useState("All");
  const [hash, setHash] = useState(location.hash);
  const [toast, setToast] = useState("");
  const [tickerPaused, setTickerPaused] = useState(false);

  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#shop") return;
      setHash(location.hash);
      setView((v) => (v === "done" ? "shop" : v));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
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
  // Once loaded, drop sold-out / hidden / invalid-size lines and clamp totals across sizes to stock.
  const lines = (() => {
    if (!ready) return [];
    const left = new Map();
    const out = [];
    for (const l of cart) {
      const p = byId(l.id);
      if (!p || p.on === false || p.stock === 0) continue;
      const sizes = p.sizes || [];
      const size = typeof l.size === "string" ? l.size : "";
      if (sizes.length ? !sizes.includes(size) : size !== "") continue;
      // Subli/Jersey products carry only the custom fields their option needs; drop stale/unused fields.
      const kind = subliKind(p);
      const jersey = subliNeedsNo(kind) ? jerseyOf(l.jersey) : "";
      const jname = subliNeedsName(kind) ? jnameOf(l.jname) : "";
      if (subliNeedsNo(kind) && !jersey) continue;
      if (subliNeedsName(kind) && !jname) continue;
      const avail = p.stock == null ? 99 : (left.has(p.id) ? left.get(p.id) : Math.max(0, p.stock));
      if (avail <= 0) continue;
      const qty = Math.min(l.qty, avail, 99);
      if (p.stock != null) left.set(p.id, avail - qty);
      out.push({ ...l, size, jersey, jname, qty, key: lineKey({ id: l.id, size, jersey, jname }), p });
    }
    return out;
  })();

  const count = ready ? lines.reduce((n, l) => n + l.qty, 0) : cart.reduce((n, l) => n + l.qty, 0);
  const sub = Math.round(lines.reduce((n, l) => n + l.qty * l.p.p, 0) * 100) / 100;
  const memSub = Math.round(lines.reduce((n, l) => n + l.qty * unitPrice(l.p, true), 0) * 100) / 100;

  function cartLineKey(l) {
    const p = byId(l.id);
    const kind = p ? subliKind(p) : null;
    const size = typeof l.size === "string" ? l.size : "";
    const jersey = p ? (subliNeedsNo(kind) ? jerseyOf(l.jersey) : "") : jerseyOf(l.jersey);
    const jname = p ? (subliNeedsName(kind) ? jnameOf(l.jname) : "") : jnameOf(l.jname);
    return lineKey({ id: l.id, size, jersey, jname });
  }

  function add(id, size, n = 1, silent = false, jersey = "", jname = "") {
    const p = byId(id);
    if (!p || p.on === false || p.stock === 0) return false;
    const sizes = p.sizes || [];
    const sz = sizes.length ? (typeof size === "string" ? size : "") : "";
    if (sizes.length && !sizes.includes(sz)) return false;
    const kind = subliKind(p);
    const jn = subliNeedsNo(kind) ? jerseyOf(jersey) : "";
    const nm = subliNeedsName(kind) ? jnameOf(jname) : "";
    if (subliNeedsNo(kind) && !jn) return false;
    if (subliNeedsName(kind) && !nm) return false;
    const same = (l) => l.id === id && l.size === sz && (l.jersey || "") === jn && (l.jname || "") === nm;
    const used = lines.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
    const lineQty = lines.find(same)?.qty || 0;
    const room = p.stock == null ? Math.max(0, 99 - lineQty) : Math.max(0, Math.min(99 - lineQty, p.stock - used));
    if (room <= 0) {
      setToast(p.stock != null ? `Only ${p.stock} left for ${p.n}` : `Maximum quantity reached for ${p.n}`);
      return false;
    }
    setCart((c) => {
      const curUsed = c.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
      const hit = c.find(same);
      const hitQty = hit ? hit.qty : 0;
      const maxAdd = p.stock == null ? Math.max(0, 99 - hitQty) : Math.max(0, Math.min(99 - hitQty, p.stock - curUsed));
      const delta = Math.min(n, maxAdd);
      if (delta <= 0) return c;
      if (!hit) {
        const entry = { id, size: sz, qty: delta };
        if (jn) entry.jersey = jn;
        if (nm) entry.jname = nm;
        return [...c, entry];
      }
      return c.map((l) => (l === hit ? { ...l, qty: l.qty + delta } : l));
    });
    if (!silent) {
      const pr = printOf(kind, nm, jn);
      setToast(`Added ${p.n}${sz ? ` (${sz})` : ""}${pr ? `  ${pr.name} #${pr.no}` : ""} to cart`);
    }
    return true;
  }

  function buyNow(id, size, n, jersey = "", jname = "") {
    const ok = add(id, size, n, true, jersey, jname);
    const p = byId(id);
    const kind = p ? subliKind(p) : null;
    const sz = typeof size === "string" ? size : "";
    const jn = subliNeedsNo(kind) ? jerseyOf(jersey) : "";
    const nm = subliNeedsName(kind) ? jnameOf(jname) : "";
    if (ok || lines.some((l) => l.id === id && l.size === sz && (l.jersey || "") === jn && (l.jname || "") === nm)) goCheckout();
  }

  function goCheckout() {
    setDrawer(false);
    setView("checkout");
    location.hash = "#/";
    window.scrollTo(0, 0);
  }

  function changeQty(key, d) {
    setCart((c) =>
      c.flatMap((l) => {
        if (cartLineKey(l) !== key) return [l];
        const p = byId(l.id);
        if (!p || p.on === false || p.stock === 0) return [];
        const otherUsed = c.filter((x) => x !== l && x.id === l.id).reduce((s, x) => s + x.qty, 0);
        const cap = p.stock == null ? 99 : Math.min(99, Math.max(0, p.stock - otherUsed));
        if (cap <= 0) return [];
        return [{ ...l, qty: Math.min(cap, Math.max(1, l.qty + d)) }];
      }),
    );
  }

  const remove = (key) => setCart((c) => c.filter((l) => cartLineKey(l) !== key));

  const attempt = useRef({ id: "", sig: "" }); // lets a retry reuse the same id so the sheet never double-books

  async function placeOrder(allInfo) {
    if (!lines.length) throw new Error("Your cart is empty.");
    const { receipt, ...info } = allInfo;
    const url = settings.ordersUrl || import.meta.env.VITE_ORDERS_URL || "";
    if (!url) throw new Error(`Online ordering isn't available right now. Please contact ${settings.contactEmail}.`);
    const body = {
      customer: { name: info.name, sr: info.sid, year: info.year, section: info.section, email: info.email },
      mem: info.mem, gcashRef: info.gcashRef, clientTotal: info.total,
      items: lines.map((l) => {
        const kind = subliKind(l.p);
        return {
          id: l.id, name: l.p.n, size: l.size || "", qty: l.qty, price: unitPrice(l.p, Boolean(info.mem)),
          ...(subliNeedsNo(kind) && l.jersey ? { jersey: l.jersey } : {}), // digits only; set only when option needs a custom #
          ...(subliNeedsName(kind) && l.jname ? { jname: l.jname } : {}), // uppercase; set only when option needs a custom name
        };
      }),
    };
    const sig = JSON.stringify({ ...body, r: receipt ? receipt.data.length + receipt.data.slice(0, 40) : "" });
    if (attempt.current.sig !== sig) attempt.current = { id: newId(), sig };
    const res = await submitOrder(url, { ...body, receipt: receipt || undefined, clientId: attempt.current.id });
    attempt.current = { id: "", sig: "" };
    setOrder({
      ...info, shown: info.total, receiptSaved: !!res.receipt,
      no: res.no, items: lines, sub: res.subtotal, disc: res.discount, total: res.total,
      location: settings.pickupLocation, note: settings.pickupNote,
    });
    setCart([]);
    setView("done");
    window.scrollTo(0, 0);
    reload();
  }

  function scrollToShop() {
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("shop")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }

  const r = hash.replace(/^#\/?/, "");
  const route = r.startsWith("p/") ? "product" : r === "admin" ? "admin" : "main";
  const live = all.filter((p) => p.on !== false);
  const pinPair = getPinPair(live);
  const subliGroup = getSubliGroup(live);
  const cats = ["All", ...new Set(live.map((p) => p.c))];
  const activeCat = cats.includes(cat) ? cat : "All";
  const shown = live.filter((p) => activeCat === "All" || p.c === activeCat);
  const shopCards = (() => {
    if (!pinPair && !subliGroup) return shown.map((p) => ({ p, pinPair: null, subliGroup: null }));
    let seenPin = false;
    let seenSubli = false;
    const cards = [];
    for (const p of shown) {
      if (pinPair && (p.id === pinPair.set.id || p.id === pinPair.piece.id)) {
        if (!seenPin) {
          seenPin = true;
          cards.push({ p: pinPair.set, pinPair, subliGroup: null });
        }
      } else if (subliGroup && subliGroup.some((v) => v.id === p.id)) {
        if (!seenSubli) {
          seenSubli = true;
          cards.push({ p: subliGroup[0], pinPair: null, subliGroup });
        }
      } else {
        cards.push({ p, pinPair: null, subliGroup: null });
      }
    }
    return cards;
  })();
  const inCheckout = ready && route === "main" && view === "checkout";
  const heroSlides = settings.heroImages?.filter(Boolean).length
    ? settings.heroImages.filter(Boolean)
    : [settings.heroImage || DEFAULT_HERO];
  const heroTag = cleanCopy(settings.heroTag, "OFFICIAL MERCH");
  const heroCaption = cleanCopy(settings.heroCaption, "OFFICIAL MERCH");
  const tickerItems = tickerOf(settings);
  const showTicker = settings.tickerOn !== false && tickerItems.length > 0;
  const tickerReps = tickerItems.length ? Math.min(12, Math.max(1, Math.ceil(120 / Math.max(1, tickerItems.join("   ").length)))) : 1;
  const tickerRun = Array.from({ length: tickerReps }, () => tickerItems).flat();
  const activeProd = route === "product" ? byId(safeDecode(r.slice(2))) : null;
  const activePinPair =
    pinPair && activeProd && (activeProd.id === pinPair.set.id || activeProd.id === pinPair.piece.id) ? pinPair : null;
  const activeSubliGroup =
    subliGroup && activeProd && subliGroup.some((v) => v.id === activeProd.id) ? subliGroup : null;

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
            <button type="button" className="btn ghost" onClick={() => setDrawer(true)}>
              Cart ({count})
            </button>
          )}
        </div>
      </header>

      {ready && route === "main" && view === "shop" && showTicker ? (
        <div className={"ticker" + (tickerPaused ? " paused" : "")}>
          <div className="tk-view" aria-hidden="true">
            <div className="tk-track">
              {[0, 1].map((k) => (
                <span key={k} className="tk-run">
                  {tickerRun.map((t, j) => <span key={j} className="tk-item">{t}<b>★</b></span>)}
                </span>
              ))}
            </div>
          </div>
          <button type="button" className="tk-btn mono" aria-pressed={tickerPaused} onClick={() => setTickerPaused((v) => !v)}>
            {tickerPaused ? "Play ticker" : "Pause ticker"}
          </button>
        </div>
      ) : null}

      {ready && ((route === "main" && view === "shop") || route === "product") ? (
        <MemberBanner member={member} onChange={updateMember} />
      ) : null}

      {!ready ? <div className="wrap page muted" role="status">Loading…</div> : null}

      {ready && route === "product" ? (
        <ProductPage
          key={activePinPair ? "pin-pair" : activeSubliGroup ? "subli-group" : r}
          p={activeProd}
          pinPair={activePinPair}
          subliGroup={activeSubliGroup}
          add={add}
          buy={buyNow}
          verified={verified}
        />
      ) : null}

      {ready && route === "admin" ? (
        <AdminPage catalog={catalog} source={source} dbError={dbError} saveItems={saveItems} saveSettings={saveSettings} reload={reload} />
      ) : null}

      {ready && route === "main" && view === "shop" ? (
        <main>
          <section className="wrap hero">
            <div className="hero-copy">
              <Crown className="hero-crown" />
              {heroTag ? <span className="tag stamp mono">{heroTag}</span> : null}
              <h1><Headline title={settings.heroTitle} accent={settings.heroAccent} /></h1>
              <p>{settings.heroText}</p>
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={scrollToShop}>
                Shop the collection
              </button>
              <Squiggle className="hero-arrow" />
            </div>
            <figure className="bp">
              <span className="tape tl" aria-hidden="true" />
              <span className="tape br" aria-hidden="true" />
              <Carousel
                label="Featured merch"
                autoplay={4500}
                slides={heroSlides.map((src, idx) => (
                  <img
                    src={src}
                    alt="Featured CURSOR merch"
                    draggable={false}
                    fetchpriority={idx === 0 ? "high" : "low"}
                    loading={idx === 0 ? undefined : "lazy"}
                    decoding={idx === 0 ? undefined : "async"}
                  />
                ))}
              />
              {heroCaption ? <figcaption className="mono">{heroCaption}</figcaption> : null}
            </figure>
          </section>

          <section className="wrap" id="shop">
            <div className="bar">
              <div>
                <h2>The collection</h2>
                <div className="sku mono">{String(shopCards.length).padStart(2, "0")} ITEMS</div>
              </div>
              <div className="chips" role="group" aria-label="Filter by category">
                {cats.map((k) => (
                  <button type="button" key={k} className="chip" aria-pressed={activeCat === k} onClick={() => setCat(k)}>{k}</button>
                ))}
              </div>
            </div>
            {shopCards.length ? (
              <div className="grid">
                {shopCards.map(({ p, pinPair: pair, subliGroup: sg }, idx) => (
                  <ProductCard key={p.id} p={p} pinPair={pair} subliGroup={sg} add={add} n={idx + 1} verified={verified} />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ paddingBottom: 48 }}>No items available right now. Check back soon.</p>
            )}
          </section>
        </main>
      ) : null}

      {inCheckout ? (
        <CheckoutPage
          items={lines} sub={sub} memSub={memSub}
          member={member} onMemberChange={updateMember}
          gcash={{ number: settings.gcashNumber, name: settings.gcashName, qr: settings.gcashQr }}
          back={() => setView("shop")} place={placeOrder}
        />
      ) : null}

      {ready && route === "main" && view === "done" && order ? (
        <ReceiptPage order={order} done={() => setView("shop")} />
      ) : null}

      <CartDrawer
        open={drawer}
        items={lines} count={count} sub={sub} memSub={memSub} verified={verified}
        close={() => setDrawer(false)} qty={changeQty} rm={remove} checkout={goCheckout}
      />

      <div role="status" aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className="toast">
            <span>{toast}</span>
            <button type="button" onClick={() => { setToast(""); setDrawer(true); }}>View cart</button>
          </div>
        ) : null}
      </div>

      <footer>
        <div className="wrap row foot">
          <span>{settings.footerText}</span>
          <span>
            <a href="#/admin" style={{ marginRight: 12 }}>Staff login</a>
            <span className="mono">{settings.contactEmail}</span>
          </span>
        </div>
        <div className="wrap foot-tag" aria-hidden="true">#CONTINUE PURSUING EXCELLENCE</div>
      </footer>
    </div>
  );
}
