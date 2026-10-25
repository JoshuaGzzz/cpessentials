import { useEffect, useMemo, useRef, useState } from "react";
import { deleteMember, listMembers, upsertMembers } from "../../lib/db.js";
import { fmtMem } from "../../lib/card.js";
import { parseMembers } from "../../lib/members.js";

export function MembersAdmin({ onExpired }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [txt, setTxt] = useState("");
  const [parsed, setParsed] = useState(null);
  const [msg, setMsg] = useState(null); // { t, bad }
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try { setMembers(await listMembers()); setMsg(null); }
    catch (x) { if (x.code === "AUTH") onExpired(); else setMsg({ t: x.message, bad: true }); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? members.filter((m) => [m.name, m.sr_code, m.mem_no, m.section, m.email].join(" ").toLowerCase().includes(s)) : members;
  }, [members, q]);

  function read(text) { setTxt(text); setParsed(text.trim() ? parseMembers(text) : null); setMsg(null); }
  async function onFile(e) {
    const f = e.target.files?.[0];
    if (f) read(await f.text());
    e.target.value = "";
  }
  async function doImport() {
    try {
      await upsertMembers(parsed.rows);
      const n = parsed.rows.length;
      read("");
      await load();
      setMsg({ t: `Saved ${n} member${n === 1 ? "" : "s"} to the database.` });
    } catch (x) { if (x.code === "AUTH") onExpired(); else setMsg({ t: "Import failed: " + x.message, bad: true }); }
  }
  async function remove(m) {
    if (!confirm(`Remove ${m.name} (${m.sr_code})?`)) return;
    try { await deleteMember(m.mem_no); setMembers((l) => l.filter((x) => x.mem_no !== m.mem_no)); }
    catch (x) { if (x.code === "AUTH") onExpired(); else setMsg({ t: x.message, bad: true }); }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div className="panel">
        <b>Import members</b>
        <p className="muted">
          Upload your CSV or paste rows straight from Excel. Columns are found by their headers (Membership No, Name, SR Code,
          Year Level, Section, Email). Existing members are updated, not duplicated, so re-importing is safe.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={onFile} aria-label="CSV file" />
        <label htmlFor="paste">Or paste rows</label>
        <textarea id="paste" rows={4} className="mono" value={txt} onChange={(e) => read(e.target.value)} />

        {parsed ? (
          <div style={{ marginTop: 12 }}>
            <p className={parsed.problems.length ? "er2" : "ok2"} role="status">
              {parsed.rows.length} ready to import
              {parsed.problems.length ? `, ${parsed.problems.length} skipped` : ""}
              {parsed.duplicates.length ? `, ${parsed.duplicates.length} duplicate membership no. in the file (last one kept)` : ""}.
            </p>
            {parsed.problems.length ? (
              <ul className="muted" style={{ paddingLeft: 18 }}>
                {parsed.problems.slice(0, 20).map((p) => (
                  <li key={p.line}>Line {p.line}: {p.reason}. <span className="mono">{p.raw}</span></li>
                ))}
                {parsed.problems.length > 20 ? <li>…and {parsed.problems.length - 20} more.</li> : null}
              </ul>
            ) : null}
            {parsed.rows.length ? (
              <div className="mt">
                <table>
                  <thead><tr><th>Membership no.</th><th>Name</th><th>SR code</th><th>Year</th><th>Section</th><th>Email</th></tr></thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((m) => (
                      <tr key={m.mem_no}><td className="mono">{fmtMem(m.mem_no)}</td><td>{m.name}</td><td className="mono">{m.sr_code}</td><td>{m.year_level}</td><td>{m.section}</td><td>{m.email}</td></tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 5 ? <div className="muted">Showing the first 5 of {parsed.rows.length}.</div> : null}
              </div>
            ) : null}
            <button className="btn" style={{ marginTop: 12 }} disabled={!parsed.rows.length} onClick={doImport}>
              Import {parsed.rows.length} member{parsed.rows.length === 1 ? "" : "s"}
            </button>
          </div>
        ) : null}
        {msg ? <p className={msg.bad ? "er2" : "ok2"} role="status">{msg.t}</p> : null}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="row">
          <b>Members ({members.length})</b>
          <input aria-label="Search members" placeholder="Search name, SR code, section…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        </div>
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && !members.length ? <p className="muted">No members yet. Import your CSV above.</p> : null}
        {shown.length ? (
          <div className="mt">
            <table>
              <thead><tr><th>Membership no.</th><th>Name</th><th>SR code</th><th>Year</th><th>Section</th><th>Email</th><th></th></tr></thead>
              <tbody>
                {shown.slice(0, 200).map((m) => (
                  <tr key={m.mem_no}>
                    <td className="mono">{fmtMem(m.mem_no)}</td><td>{m.name}</td><td className="mono">{m.sr_code}</td>
                    <td>{m.year_level}</td><td>{m.section}</td><td>{m.email}</td>
                    <td><button className="btn ghost" onClick={() => remove(m)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 200 ? <div className="muted">Showing 200 of {shown.length}. Use search to narrow down.</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
