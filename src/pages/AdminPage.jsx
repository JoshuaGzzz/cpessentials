import { useRef, useState } from "react";
import { AdminLogin, DbSetup } from "../components/admin/AdminLogin.jsx";
import { ProductsAdmin } from "../components/admin/ProductsAdmin.jsx";
import { SettingsAdmin } from "../components/admin/SettingsAdmin.jsx";
import { MembersAdmin } from "../components/admin/MembersAdmin.jsx";
import { dbConfigured, hasSession, signOutDb } from "../lib/db.js";

const TABS = [
  ["products", "Products"],
  ["settings", "Store settings"],
  ["members", "Members"],
];

export function AdminPage({ catalog, source, dbError, saveItems, saveSettings, reload }) {
  const [authed, setAuthed] = useState(hasSession);
  const [tab, setTab] = useState("products");
  const tabRefs = useRef([]);

  if (!dbConfigured) return <div className="wrap page"><DbSetup /></div>;

  const signOut = () => { signOutDb(); setAuthed(false); reload(); };
  if (!authed) return <AdminLogin onDone={() => { setAuthed(true); reload(); }} />;

  const offline = source === "offline";

  function onTabKeyDown(e, i) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
  }

  const offlineNotice = (
    <div className="panel" role="alert">
      <b>Database unreachable</b>
      <p className="muted" style={{ margin: "6px 0 12px" }}>
        Couldn't load live data from Supabase{dbError ? ` (${dbError})` : ""}. Editing products and store settings is paused so fallback data from catalog.json won't overwrite your live store.
      </p>
      <button type="button" className="btn" onClick={reload}>Retry</button>
    </div>
  );

  return (
    <div className="wrap page">
      <div className="bar" style={{ marginTop: 0 }}>
        <div>
          <h2>Admin</h2>
          <div className="sku mono">CHANGES GO LIVE AS SOON AS YOU SAVE</div>
        </div>
        <button type="button" className="btn ghost" onClick={signOut}>Log out</button>
      </div>

      <div className="tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(([k, label], i) => (
          <button
            key={k}
            ref={(el) => { tabRefs.current[i] = el; }}
            id={`admin-tab-${k}`}
            type="button"
            role="tab"
            aria-selected={tab === k}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === "products" ? (offline ? offlineNotice : <ProductsAdmin items={catalog.items} source={source} saveItems={saveItems} onExpired={signOut} />) : null}
        {tab === "settings" ? (offline ? offlineNotice : <SettingsAdmin settings={catalog.settings} save={saveSettings} onExpired={signOut} />) : null}
        {tab === "members" ? <MembersAdmin onExpired={signOut} /> : null}
      </div>
    </div>
  );
}
