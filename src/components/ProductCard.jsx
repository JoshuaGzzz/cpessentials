import { ProductImage, imagesOf } from "./ProductImage.jsx";
import { Carousel } from "./Carousel.jsx";
import { peso } from "../lib/format.js";

export function ProductCard(props) {
  const p = props.p,
    out = p.stock === 0,
    sz = (p.sizes || []).length > 0,
    imgs = imagesOf(p);
  return (
    <article className="card">
      {imgs.length > 1 ? (
        <div className="pic">
          <Carousel
            label={p.n + " photos"}
            slides={imgs.map((src) => (
              <a href={"#/p/" + p.id} aria-label={"View " + p.n}>
                <ProductImage product={p} src={src} />
              </a>
            ))}
          />
        </div>
      ) : (
        <a href={"#/p/" + p.id} className="pic" aria-label={"View " + p.n}>
          <ProductImage product={p} />
        </a>
      )}
      <div className="cb">
        <div className="sku mono">{p.id}</div>
        <h3>
          <a
            href={"#/p/" + p.id}
            style={{
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {p.n}
          </a>
        </h3>
        <p>{p.d.length > 90 ? p.d.slice(0, 88) + "…" : p.d}</p>
        <div className="row">
          <span className="price mono">{peso(p.p)}</span>
          {p.on === false ? <span className="sku mono">HIDDEN</span> : null}
        </div>
        {out ? (
          <button className="btn" disabled>
            Sold out
          </button>
        ) : sz ? (
          <button
            className="btn ghost"
            onClick={function () {
              location.hash = "#/p/" + p.id;
            }}
          >
            Choose size
          </button>
        ) : (
          <button
            className="btn"
            onClick={function () {
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
