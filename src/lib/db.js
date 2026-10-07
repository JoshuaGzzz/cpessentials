// Tiny Supabase client (plain fetch, no extra dependency).
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see README).
const URL_ = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const SESSION = "cp_db_session";
const BUCKET = "product-images";

export const dbConfigured = Boolean(URL_ && KEY);

const authErr = (m) => Object.assign(new Error(m), { code: "AUTH" });
const readSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch { return null; } };
const writeSession = (s) => { try { s ? sessionStorage.setItem(SESSION, JSON.stringify(s)) : sessionStorage.removeItem(SESSION); } catch { /* ignore */ } };

async function call(path, { method = "GET", body, token, headers = {}, raw = false, timeout = 15000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(URL_ + path, {
      method,
      signal: ctl.signal,
      headers: {
        apikey: KEY, // publishable keys must not be sent as a Bearer token
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(raw ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw new Error(data?.message || data?.error_description || data?.msg || data?.error || "Request failed (" + res.status + ")");
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The database took too long to respond.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function keep(d) {
  const s = { access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  writeSession(s);
  return s;
}

export const hasSession = () => !!readSession();
export const signOutDb = () => writeSession(null);

/** Sign in with a Supabase user and confirm that user is listed in public.admins. */
export async function signInDb(email, password) {
  const s = keep(await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } }));
  let ok = false;
  try { ok = (await call("/rest/v1/rpc/is_admin", { method: "POST", body: {}, token: s.access })) === true; } catch { ok = false; }
  if (!ok) {
    writeSession(null);
    throw new Error("Signed in, but this account isn't an admin. Run the insert into public.admins step with this email.");
  }
}

async function token() {
  let s = readSession();
  if (!s) throw authErr("Sign in first.");
  if (Date.now() > s.exp) {
    try { s = keep(await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh } })); }
    catch { writeSession(null); throw authErr("Session expired. Sign in again."); }
  }
  return s.access;
}

// ---- members ----

/** Public: true if this membership no. + SR code belongs to a member. */
export async function verifyMember(mem, sr) {
  return (await call("/rest/v1/rpc/verify_member", { method: "POST", body: { p_mem: mem, p_sr: sr } })) === true;
}

/** Admin: all members, sorted by name. */
export async function listMembers() {
  const t = await token(), out = [], size = 1000;
  for (let off = 0; ; off += size) {
    const page = await call(`/rest/v1/members?select=*&order=name.asc&limit=${size}&offset=${off}`, { token: t });
    out.push(...page);
    if (page.length < size) return out;
  }
}

/** Admin: add or update members (matched by membership no.). */
export async function upsertMembers(rows) {
  const t = await token();
  for (let i = 0; i < rows.length; i += 500) {
    await call("/rest/v1/members?on_conflict=mem_no", {
      method: "POST", token: t, body: rows.slice(i, i + 500),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  }
}

export async function deleteMember(memNo) {
  await call("/rest/v1/members?mem_no=eq." + encodeURIComponent(memNo), { method: "DELETE", token: await token(), headers: { Prefer: "return=minimal" } });
}

// ---- products and store settings ----

export const rowToItem = (r) => ({
  id: r.id, n: r.name, c: r.category, p: Number(r.price), d: r.description,
  sizes: r.sizes || [], stock: r.stock, on: r.visible, img: r.img || "", images: r.images || [], art: r.art || "",
});
export const itemToRow = (p, i) => ({
  id: p.id, name: p.n, category: p.c || "Other", price: p.p, description: p.d || "",
  sizes: p.sizes || [], stock: p.stock ?? null, visible: p.on !== false, img: p.img || "", images: p.images || [], art: p.art || "",
  position: i, updated_at: new Date().toISOString(),
});

/** Shop data from the database. Signed-in admins also receive hidden products. */
export async function fetchStore() {
  let t = null;
  try { t = hasSession() ? await token() : null; } catch { t = null; }
  const [rows, st] = await Promise.all([
    call("/rest/v1/products?select=*&order=position.asc,id.asc", { token: t, timeout: 6000 }),
    call("/rest/v1/store_settings?select=data&id=eq.1", { token: t, timeout: 6000 }),
  ]);
  return { items: rows.map(rowToItem), settings: st[0]?.data || null };
}

/** Admin: write the whole product list in order, and delete the removed SKUs. */
export async function saveProducts(items, removedIds = []) {
  const t = await token();
  if (items.length) {
    try {
      await call("/rest/v1/products?on_conflict=id", {
        method: "POST", token: t, body: items.map(itemToRow),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });
    } catch (e) {
      if (/images/.test(e.message) && /column/i.test(e.message)) {
        throw new Error("The database needs the updated supabase/schema.sql (it adds the photos column). Run it in the Supabase SQL Editor, then save again.");
      }
      throw e;
    }
  }
  if (removedIds.length) {
    await call("/rest/v1/products?id=in.(" + removedIds.map(encodeURIComponent).join(",") + ")", {
      method: "DELETE", token: t, headers: { Prefer: "return=minimal" },
    });
  }
}

export async function saveSettingsRow(settings) {
  await call("/rest/v1/store_settings?on_conflict=id", {
    method: "POST", token: await token(), body: { id: 1, data: settings },
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
}

/** Admin: upload a JPEG blob to the public photo bucket and return its URL. */
export async function uploadImage(blob) {
  const name = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
  await call(`/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST", token: await token(), raw: true, body: blob, headers: { "Content-Type": "image/jpeg" },
  });
  return `${URL_}/storage/v1/object/public/${BUCKET}/${name}`;
}
