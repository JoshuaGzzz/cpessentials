import { useState } from "react";
import { ProductImage, imagesOf } from "../components/ProductImage.jsx";
import { Carousel } from "../components/Carousel.jsx";
import { peso } from "../lib/format.js";

export function ProductPage(props) {
  const p = props.p;
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [warn, setWarn] = useState(false);
  if (!p || p.on === false)
    return (
      <div className="wrap page">
        <h2>Item not found</h2>
        <a href="#/">← Back to shop</a>
      </div>
    );
  const sizes = p.sizes || [],
    out = p.stock === 0,
    max = p.stock == null ? 20 : Math.min(20, p.stock),
    imgs = imagesOf(p);
  function go(buy) {
    if (sizes.length && !size) {
      setWarn(true);
      return;
    }
    props[buy ? "buy" : "add"](p.id, size, qty, buy);
  }
  return (
    <div className="wrap pd">
      <div
        className="pic"
        style={{
          aspectRatio: "1",
        }}
      >
        <Carousel
          label={p.n + " photos"}
          autoplay={5000}
          slides={imgs.length > 1 ? imgs.map((src) => <ProductImage product={p} src={src} />) : [<ProductImage product={p} />]}
        />
      </div>
      <div>
        <a
          href="#/"
          style={{
            fontSize: 13,
            color: "#002fa7",
          }}
        >
          ← All products
        </a>
        <div
          className="sku mono"
          style={{
            marginTop: 14,
          }}
        >
          {p.id}
        </div>
        <h1>{p.n}</h1>
        <div
          className="price mono"
          style={{
            fontSize: 24,
          }}
        >
          {peso(p.p)}
        </div>
        <p
          style={{
            lineHeight: 1.65,
            color: "#44546a",
          }}
        >
          {p.d}
        </p>
        {sizes.length ? (
          <div>
            <b
              style={{
                fontSize: 13,
              }}
            >
              Size
            </b>
            <div
              className="sz lg"
              role="group"
              aria-label="Size"
              style={{
                marginTop: 6,
              }}
            >
              {sizes.map(function (z) {
                return (
                  <button
                    key={z}
                    aria-pressed={size === z}
                    onClick={function () {
                      setSize(z);
                      setWarn(false);
                    }}
                  >
                    {z}
                  </button>
                );
              })}
            </div>
            {warn ? (
              <div className="err" role="alert">
                Please select a size.
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className="row"
          style={{
            margin: "18px 0",
            justifyContent: "flex-start",
            gap: 16,
          }}
        >
          <b
            style={{
              fontSize: 13,
            }}
          >
            Quantity
          </b>
          <div className="qty">
            <button
              aria-label="Decrease"
              onClick={function () {
                setQty(Math.max(1, qty - 1));
              }}
            >
              −
            </button>
            <span className="mono">{qty}</span>
            <button
              aria-label="Increase"
              onClick={function () {
                setQty(Math.min(max, qty + 1));
              }}
            >
              +
            </button>
          </div>
        </div>
        {out ? (
          <button className="btn" disabled>
            Sold out
          </button>
        ) : (
          <div
            className="row"
            style={{
              justifyContent: "flex-start",
            }}
          >
            <button
              className="btn"
              onClick={function () {
                go(false);
              }}
            >
              Add to cart
            </button>
            <button
              className="btn ghost"
              onClick={function () {
                go(true);
              }}
            >
              Buy now
            </button>
          </div>
        )}
        <table className="spec">
          <tbody>
            {[
              ["Category", p.c],
            ].map(function (r) {
              return (
                <tr key={r[0]}>
                  <td
                    style={{
                      color: "#5b6b7c",
                    }}
                  >
                    {r[0]}
                  </td>
                  <td>{r[1]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
