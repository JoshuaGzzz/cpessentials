import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PRODUCTS } from "../data/products.js";
import { DEFAULT_SETTINGS } from "../data/settings.js";
import { dbConfigured, fetchStore, saveProducts, saveSettingsRow } from "../lib/db.js";

function normalize(q) {
  return {
    items: Array.isArray(q?.items) ? q.items : DEFAULT_PRODUCTS,
    settings: { ...DEFAULT_SETTINGS, ...(q?.settings || {}) },
  };
}

async function loadFile() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}catalog.json`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Products + store settings.
 *  Source of truth is the database. public/catalog.json is the starter copy and the fallback
 *  if the database is empty or unreachable. `source` is "db", "file" (empty/unconfigured DB), or "offline" (DB unreachable). */
export function useCatalog() {
  const [state, setState] = useState({ catalog: normalize(null), ready: false, source: "file", dbError: "" });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    let dbError = "";
    const [file, db] = await Promise.all([
      loadFile(),
      dbConfigured
        ? fetchStore().catch((err) => {
            dbError = err?.message || "Could not reach the database.";
            return null;
          })
        : null,
    ]);
    if (id !== seq.current) return;
    const base = normalize(file);
    if (dbConfigured && db === null) {
      setState({ ready: true, source: "offline", dbError, catalog: base });
      return;
    }
    const hasDb = !!db && db.items.length > 0;
    setState({
      ready: true,
      source: hasDb ? "db" : "file",
      dbError: "",
      catalog: { items: hasDb ? db.items : base.items, settings: { ...base.settings, ...(db?.settings || {}) } },
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveItems = useCallback(async (next) => {
    if (state.source === "offline") {
      throw new Error("Database is unreachable. Press Retry once it is back online before saving.");
    }
    const removed = state.source === "db" ? state.catalog.items.filter((p) => !next.some((n) => n.id === p.id)).map((p) => p.id) : [];
    await saveProducts(next, removed);
    setState((s) => ({ ...s, source: "db", dbError: "", catalog: { ...s.catalog, items: next } }));
  }, [state.source, state.catalog.items]);

  const saveSettings = useCallback(async (settings) => {
    if (state.source === "offline") {
      throw new Error("Database is unreachable. Press Retry once it is back online before saving.");
    }
    await saveSettingsRow(settings);
    setState((s) => ({ ...s, dbError: "", catalog: { ...s.catalog, settings } }));
  }, [state.source]);

  return {
    catalog: state.catalog,
    ready: state.ready,
    source: state.source,
    dbError: state.dbError,
    saveItems,
    saveSettings,
    reload: load,
  };
}
