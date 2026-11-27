import { useState } from "react";
import { signInDb } from "../../lib/db.js";

export function DbSetup() {
  return (
    <div className="panel login">
      <h2>Database not connected</h2>
      <p className="muted">
        The admin signs in through Supabase. Create a project, run <span className="mono">supabase/schema.sql</span>, then put
        the project URL and key in <span className="mono">.env</span> as <span className="mono">VITE_SUPABASE_URL</span> and{" "}
        <span className="mono">VITE_SUPABASE_ANON_KEY</span>. On your host, add the same two variables and redeploy. Steps are in the README.
      </p>
      <a href="#/">← Back to shop</a>
    </div>
  );
}

export function AdminLogin({ onDone }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try { await signInDb(f.email.trim(), f.password); onDone(); }
    catch (x) { setErr(x.message || "Something went wrong."); }
    setBusy(false);
  }

  return (
    <div className="wrap page">
      <form className="panel login" onSubmit={submit}>
        <h2>Admin login</h2>
        <p className="muted">Staff only. This unlocks products, store settings and the members list.</p>
        <label htmlFor="ae">Email</label>
        <input id="ae" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <label htmlFor="ap">Password</label>
        <input id="ap" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err ? <div className="err" role="alert">{err}</div> : null}
        <div className="row" style={{ marginTop: 16 }}>
          <a href="#/">← Back to shop</a>
          <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      </form>
    </div>
  );
}
