import { useCallback, useEffect, useState } from "react";
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
    const r = await fetch("catalog.json");
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Products + store settings.
 *  Source of truth is the database. public/catalog.json is the starter copy and the fallback
 *  if the database is empty or unreachable. `source` is "db" or "file". */
export function useCatalog() {
  const [state, setState] = useState({ catalog: normalize(null), ready: false, source: "file" });

  const load = useCallback(async () => {
    const [file, db] = await Promise.all([loadFile(), dbConfigured ? fetchStore().catch(() => null) : null]);
    const base = normalize(file);
    const hasDb = !!db && db.items.length > 0;
    setState({
      ready: true,
      source: hasDb ? "db" : "file",
      catalog: { items: hasDb ? db.items : base.items, settings: { ...base.settings, ...(db?.settings || {}) } },
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveItems = useCallback(async (next) => {
    const removed = state.source === "db" ? state.catalog.items.filter((p) => !next.some((n) => n.id === p.id)).map((p) => p.id) : [];
    await saveProducts(next, removed);
    setState((s) => ({ ...s, source: "db", catalog: { ...s.catalog, items: next } }));
  }, [state.source, state.catalog.items]);

  const saveSettings = useCallback(async (settings) => {
    await saveSettingsRow(settings);
    setState((s) => ({ ...s, catalog: { ...s.catalog, settings } }));
  }, []);

  return { catalog: state.catalog, ready: state.ready, source: state.source, saveItems, saveSettings, reload: load };
}
