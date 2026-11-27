import { useState } from "react";
import { ProductImage, imagesOf } from "../components/ProductImage.jsx";
import { Carousel } from "../components/Carousel.jsx";
import { hasMemberPrice, peso } from "../lib/format.js";
import {
  JERSEY_RE,
  JNAME_MAX,
  JNAME_RE,
  SUBLI_LABELS,
  cleanJersey,
  cleanJname,
  isPin3Set,
  isPinButton,
  printOf,
  subliKind,
  subliNeedsName,
  subliNeedsNo,
} from "../lib/jersey.js";

export function ProductPage(props) {
  const pair = props.pinPair;
  const subli = !pair && props.subliGroup ? props.subliGroup : null;
  const [variant, setVariant] = useState(() =>
    pair && (props.p?.id === pair.piece.id || (pair.set.stock === 0 && pair.piece.stock !== 0)) ? "piece" : "set"
  );
  const [subliId, setSubliId] = useState(() => {
    if (!subli) return "";
    if (props.p && subli.some((v) => v.id === props.p.id)) {
      if (props.p.id === subli[0].id && props.p.stock === 0) {
        const inStock = subli.find((v) => v.stock !== 0);
        if (inStock) return inStock.id;
      }
      return props.p.id;
    }
    return (subli.find((v) => v.stock !== 0) || subli[0]).id;
  });
  const p = pair
    ? (variant === "piece" ? pair.piece : pair.set)
    : subli
      ? (subli.find((v) => v.id === subliId) || subli[0])
      : props.p;
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [warn, setWarn] = useState(false);
  const [jersey, setJersey] = useState("");
  const [jWarn, setJWarn] = useState(false);
  const [jname, setJname] = useState("");
  const [nWarn, setNWarn] = useState(false);
  if (!p || p.on === false)
    return (
      <div className="wrap page">
        <h2>Item not found</h2>
        <a href="#/">← Back to shop</a>
      </div>
    );
  const sizes = p.sizes || [],
    out = p.stock === 0,
    max = p.stock == null ? 20 : Math.min(20, Math.max(0, p.stock)),
    safeQty = out ? 1 : Math.min(Math.max(1, max), qty),
    ownImgs = imagesOf(p),
    imgs = ownImgs.length
      ? ownImgs
      : pair
        ? imagesOf(variant === "piece" ? pair.set : pair.piece)
        : subli
          ? (subli.map(imagesOf).find((a) => a.length) || [])
          : [],
    kind = subliKind(p),
    needsNo = subliNeedsNo(kind),
    needsName = subliNeedsName(kind),
    preview = kind ? printOf(kind, cleanJname(jname), jersey) : null,
    pinBtn = isPinButton(p),
    optLabel = pinBtn ? "Design" : "Size",
    desc = isPin3Set(p) && !/three designs|3 designs/i.test(p.d || "") ? ((p.d ? p.d + " " : "") + "All three designs are included.") : p.d;
  function go(buy) {
    if (out) return;
    const cleanedName = needsName ? cleanJname(jname) : "";
    const badSize = sizes.length > 0 && !size;
    const badName = needsName && !JNAME_RE.test(cleanedName);
    const badNo = needsNo && !JERSEY_RE.test(jersey);
    setWarn(badSize);
    setNWarn(badName);
    setJWarn(badNo);
    if (badSize || badName || badNo) {
      if (badSize) document.querySelector(".sz.lg button")?.focus();
      else if (badName) document.getElementById("jersey-name")?.focus();
      else if (badNo) document.getElementById("jersey-no")?.focus();
      return;
    }
    const jn = needsNo ? jersey : "";
    const nm = needsName ? cleanedName : "";
    if (buy) props.buy(p.id, size, safeQty, jn, nm);
    else props.add(p.id, size, safeQty, false, jn, nm);
  }
  return (
    <div className="wrap pd">
      <div className="pic pd-pic" style={{ aspectRatio: "1" }}>
        <span className="tape tl" aria-hidden="true" />
        <span className="tape tr" aria-hidden="true" />
        <Carousel
          label={p.n + " photos"}
          autoplay={5000}
          slides={
            imgs.length > 1
              ? imgs.map((src, idx) => <ProductImage product={p} src={src} priority={idx === 0 ? "high" : "low"} />)
              : [<ProductImage product={p} src={imgs[0]} priority="high" />]
          }
        />
      </div>
      <div>
        <div className="pd-crumb">
          <a href="#/" className="back-link">
            ← All products
          </a>
        </div>
        <div className="sku mono hang">{p.id}</div>
        <h1>{p.n}</h1>
        {props.verified && hasMemberPrice(p) ? (
          <div className="price mono price-tag has-mem">
            <s className="price-old">{peso(p.p)}</s>
            <span className="price-mem">{peso(p.mp)}</span>
          </div>
        ) : (
          <div className="price mono price-tag">
            {peso(p.p)}
          </div>
        )}
        <p className="pd-desc">{desc}</p>
        {pair ? (
          <fieldset className="pin-toggle">
            <legend className="pin-legend">Option</legend>
            <div className="pin-opts">
              {[
                ["set", "Set (3 pcs)"],
                ["piece", "Per piece"],
              ].map(([k, label]) => (
                <label key={k} className="pin-opt">
                  <input
                    type="radio"
                    name="pin-variant"
                    className="visually-hidden"
                    checked={variant === k}
                    onChange={() => {
                      setVariant(k);
                      setSize("");
                      setWarn(false);
                    }}
                  />
                  <span className="pin-opt-lbl mono">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {subli ? (
          <fieldset className="pin-toggle">
            <legend className="pin-legend">Option</legend>
            <div className="pin-opts subli-opts">
              {subli.map((opt) => {
                const k = subliKind(opt);
                const label = SUBLI_LABELS[k] || opt.n;
                return (
                  <label key={opt.id} className="pin-opt">
                    <input
                      type="radio"
                      name="subli-variant"
                      className="visually-hidden"
                      checked={p.id === opt.id}
                      onChange={() => {
                        setSubliId(opt.id);
                        setSize("");
                        setWarn(false);
                        setJWarn(false);
                        setNWarn(false);
                      }}
                    />
                    <span className="pin-opt-lbl mono">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {sizes.length ? (
          <div style={{ marginTop: pair || subli ? 16 : 0 }}>
            <b style={{ fontSize: 13 }}>{optLabel}</b>
            <div className="sz lg" role="group" aria-label={optLabel} style={{ marginTop: 6 }}>
              {sizes.map((z) => (
                <button
                  type="button"
                  key={z}
                  aria-pressed={size === z}
                  onClick={() => {
                    setSize(z);
                    setWarn(false);
                  }}
                >
                  {z}
                </button>
              ))}
            </div>
            {warn ? (
              <div className="err" role="alert">
                Please select a {optLabel.toLowerCase()}.
              </div>
            ) : null}
          </div>
        ) : null}
        {needsName ? (
          <div className="jersey">
            <label htmlFor="jersey-name">Custom name</label>
            <div className="jersey-row jersey-name-row">
              <input
                id="jersey-name"
                className="mono"
                type="text"
                maxLength={JNAME_MAX}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                required
                value={jname}
                placeholder="JUAN"
                aria-invalid={nWarn}
                aria-describedby={nWarn ? "jname-hint jname-err" : "jname-hint"}
                onChange={(e) => {
                  setJname(cleanJname(e.target.value, { live: true }));
                  setNWarn(false);
                }}
              />
            </div>
            <div id="jname-hint" className="muted">
              Name printed on the back (max {JNAME_MAX} chars; letters, spaces, . - &apos;).
            </div>
            {nWarn ? (
              <div id="jname-err" className="err" role="alert">
                Enter a custom name starting with a letter (max {JNAME_MAX} characters).
              </div>
            ) : null}
          </div>
        ) : null}
        {needsNo ? (
          <div className="jersey">
            <label htmlFor="jersey-no">Custom #</label>
            <div className="jersey-row">
              <span className="jersey-hash" aria-hidden="true">#</span>
              <input
                id="jersey-no"
                className="mono"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{1,2}"
                maxLength={2}
                autoComplete="off"
                required
                value={jersey}
                placeholder="07"
                aria-invalid={jWarn}
                aria-describedby={jWarn ? "jersey-hint jersey-err" : "jersey-hint"}
                onChange={(e) => {
                  setJersey(cleanJersey(e.target.value));
                  setJWarn(false);
                }}
              />
            </div>
            <div id="jersey-hint" className="muted">Number printed on the back, 0 to 99 (1 or 2 digits).</div>
            {jWarn ? (
              <div id="jersey-err" className="err" role="alert">
                Enter a custom number from 0 to 99.
              </div>
            ) : null}
          </div>
        ) : null}
        {preview ? (
          <div className="jersey-prev mono" aria-live="polite">
            <span className="jersey-prev-lbl">Printed on back:</span>
            <b>{preview.name}</b>
            <b>{preview.no}</b>
          </div>
        ) : null}
        <div className="row" style={{ margin: "18px 0", justifyContent: "flex-start", gap: 16 }}>
          <b style={{ fontSize: 13 }}>Quantity</b>
          <div className="qty">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={out || safeQty <= 1}
              onClick={() => setQty(Math.max(1, safeQty - 1))}
            >
              −
            </button>
            <span className="mono">{safeQty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={out || safeQty >= max}
              onClick={() => setQty(Math.min(max, safeQty + 1))}
            >
              +
            </button>
          </div>
        </div>
        {out ? (
          <button type="button" className="btn" disabled>
            Sold out
          </button>
        ) : (
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn" onClick={() => go(false)}>
              Add to cart
            </button>
            <button type="button" className="btn ghost" onClick={() => go(true)}>
              Buy now
            </button>
          </div>
        )}
        {p.c ? (
          <div className="pd-cat">
            <span className="tag mono">{p.c}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
