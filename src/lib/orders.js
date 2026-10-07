/** Send an order to the Google Sheet (Apps Script web app). Resolves to { no, subtotal, discount, total, check }.
 *  Content-Type text/plain keeps this a "simple" request, so the browser sends no CORS preflight
 *  (Apps Script can't answer one). The same clientId may be sent again safely: the sheet ignores repeats. */
export async function submitOrder(url, payload) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    let data;
    try { data = await res.json(); } catch {
      console.error("Order endpoint did not return JSON. Is the Apps Script deployment set to 'Anyone'?");
      throw new Error("The order sheet isn't set up correctly yet. Please contact the organizers.");
    }
    if (!data.ok) throw new Error(data.error || "The order couldn't be saved.");
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("That took too long. Press Place order again; it won't create a duplicate.");
    if (e instanceof TypeError) throw new Error("Couldn't reach the order sheet. Check your connection and press Place order again; it won't create a duplicate.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
