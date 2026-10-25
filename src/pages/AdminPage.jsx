import { useState } from "react";
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

export function AdminPage({ catalog, source, saveItems, saveSettings, reload }) {
  const [authed, setAuthed] = useState(hasSession);
  const [tab, setTab] = useState("products");

  if (!dbConfigured) return <div className="wrap page"><DbSetup /></div>;

  const signOut = () => { signOutDb(); setAuthed(false); reload(); };
  if (!authed) return <AdminLogin onDone={() => { setAuthed(true); reload(); }} />;

  return (
    <div className="wrap page">
      <div className="bar" style={{ marginTop: 0 }}>
        <div>
          <h2>Admin</h2>
          <div className="sku mono">CHANGES GO LIVE AS SOON AS YOU SAVE</div>
        </div>
        <button className="btn ghost" onClick={signOut}>Log out</button>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "products" ? <ProductsAdmin items={catalog.items} source={source} saveItems={saveItems} onExpired={signOut} /> : null}
      {tab === "settings" ? <SettingsAdmin settings={catalog.settings} save={saveSettings} onExpired={signOut} /> : null}
      {tab === "members" ? <MembersAdmin onExpired={signOut} /> : null}
    </div>
  );
}
