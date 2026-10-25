import { ProductImage } from "./ProductImage.jsx";
import { peso } from "../lib/format.js";

export function CartDrawer(props) {
  const items = props.items,
    sub = props.sub;
  return (
    <div>
      <div className="ov" onClick={props.close} />
      <aside className="drawer" role="dialog" aria-label="Shopping cart">
        <div className="dh">
          <b
            style={{
              fontSize: 18,
            }}
          >
            {"Your cart (" + props.count + ")"}
          </b>
          <button className="link" onClick={props.close}>
            Close ✕
          </button>
        </div>
        <div className="db">
          {items.length ? (
            items.map(function (l) {
              const p = l.p;
              return (
                <div className="line" key={l.key}>
                  <div className="thumb">
                    <ProductImage product={p} />
                  </div>
                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {p.n}
                    </div>
                    <div className="sku mono">{p.id + (l.size ? " / " + l.size : "")}</div>
                    <div
                      className="row"
                      style={{
                        marginTop: 8,
                      }}
                    >
                      <div className="qty">
                        <button
                          aria-label="Decrease"
                          onClick={function () {
                            props.qty(l.key, -1);
                          }}
                        >
                          −
                        </button>
                        <span className="mono">{l.qty}</span>
                        <button
                          aria-label="Increase"
                          onClick={function () {
                            props.qty(l.key, 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize: 14,
                        }}
                      >
                        {peso(p.p * l.qty)}
                      </span>
                    </div>
                    <button
                      className="link"
                      onClick={function () {
                        props.rm(l.key);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p
              style={{
                color: "#5b6b7c",
                padding: "24px 0",
              }}
            >
              Your cart is empty. Add a shirt or a sticker set to get started.
            </p>
          )}
        </div>
        {items.length ? (
          <div className="df">
            <div className="sum">
              <span>Subtotal</span>
              <span className="mono">{peso(sub)}</span>
            </div>
            
            <div className="sum t">
              <span>Total</span>
              <span className="mono">{peso(sub)}</span>
            </div>
            <button
              className="btn"
              style={{
                width: "100%",
                marginTop: 12,
              }}
              onClick={props.checkout}
            >
              Checkout
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
