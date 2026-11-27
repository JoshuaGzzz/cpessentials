import { ProductImage, imagesOf } from "./ProductImage.jsx";
import { Carousel } from "./Carousel.jsx";
import { hasMemberPrice, peso, unitPrice } from "../lib/format.js";
import { isPin3Set, isPinButton, subliKind, subliNeedsName, subliNeedsNo, subliTitle } from "../lib/jersey.js";

export function ProductCard(props) {
  const pair = props.pinPair,
    subli = !pair && props.subliGroup ? props.subliGroup : null,
    grouped = Boolean(pair || subli),
    p = pair ? pair.set : subli ? subli[0] : props.p,
    title = subli ? subliTitle(p.n) : p.n,
    out = pair ? pair.set.stock === 0 && pair.piece.stock === 0 : subli ? subli.every((v) => v.stock === 0) : p.stock === 0,
    sz = (p.sizes || []).length > 0,
    pinBtn = isPinButton(p),
    kind = subliKind(p),
    needsCustom = subliNeedsNo(kind) || subliNeedsName(kind),
    desc = isPin3Set(p) && !/three designs|3 designs/i.test(p.d || "") ? ((p.d ? p.d + " " : "") + "All three designs are included.") : p.d,
    setImgs = imagesOf(p),
    imgs = setImgs.length
      ? setImgs
      : pair
        ? imagesOf(pair.piece)
        : subli
          ? (subli.map(imagesOf).find((a) => a.length) || [])
          : [],
    href = "#/p/" + encodeURIComponent(p.id),
    lowBase = pair ? Math.min(pair.set.p, pair.piece.p) : subli ? Math.min(...subli.map((v) => v.p)) : p.p,
    lowMem = pair
      ? Math.min(unitPrice(pair.set, true), unitPrice(pair.piece, true))
      : subli
        ? Math.min(...subli.map((v) => unitPrice(v, true)))
        : unitPrice(p, true);
  return (
    <article className="card">
      {props.n ? <span className="num" aria-hidden="true">{String(props.n).padStart(2, "0")}</span> : null}
      {p.c ? <span className="sticker cat" aria-hidden="true">{p.c}</span> : null}
      {imgs.length > 1 ? (
        <div className="pic">
          <Carousel
            label={title + " photos"}
            slides={imgs.map((src) => (
              <a href={href} aria-label={"View " + title}>
                <ProductImage product={p} src={src} />
              </a>
            ))}
          />
        </div>
      ) : (
        <a href={href} className="pic" aria-label={"View " + title}>
          <ProductImage product={p} src={imgs[0]} />
        </a>
      )}
      <div className="cb">
        <div className="sku mono hang">{p.id}</div>
        <h3>
          <a href={href} className="card-title">
            {title}
          </a>
        </h3>
        <p>{desc.length > 90 ? desc.slice(0, 88) + "…" : desc}</p>
        <div className="row">
          {grouped ? (
            props.verified && lowMem < lowBase ? (
              <span className="price-tier mono">
                <span className="price-from">from</span>
                <s className="price-old">{peso(lowBase)}</s>
                <span className="price-mem">{peso(lowMem)}</span>
              </span>
            ) : (
              <span className="price mono">
                <span className="price-from">from </span>
                {peso(lowBase)}
              </span>
            )
          ) : props.verified && hasMemberPrice(p) ? (
            <span className="price-tier mono">
              <s className="price-old">{peso(p.p)}</s>
              <span className="price-mem">{peso(p.mp)}</span>
            </span>
          ) : (
            <span className="price mono">{peso(p.p)}</span>
          )}
          {p.on === false ? <span className="sku mono">HIDDEN</span> : null}
        </div>
        {out ? (
          <button type="button" className="btn" disabled>
            Sold out
          </button>
        ) : grouped || sz || needsCustom ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              location.hash = href;
            }}
          >
            {grouped ? "Choose option" : pinBtn && sz ? "Choose design" : sz ? "Choose size" : subliNeedsNo(kind) ? "Choose number" : "Customize"}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              props.add(p.id, "", 1);
            }}
          >
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}
