# Jersey number: Apps Script patch for `Code.gs`

`google-sheets/Code.gs` was **not in the downloaded project**, so these changes could not be applied or checked
against the real file. Add them to your existing script in the Apps Script editor (Extensions > Apps Script).
Do **not** replace the whole script: only add the helper block and change the four spots below.

The website now sends, for jersey products only, one extra field per order line:

```json
{ "id": "CP-JRS-01", "name": "CURSOR Jersey", "size": "M", "qty": 1, "price": 450, "jersey": "07" }
```

## 1. Add this helper block (anywhere at top level, e.g. under the constants)

```js
// ---- Jersey number (products whose NAME contains "jersey", any case) ----
var JERSEY_RE = /^\d{1,2}$/;
function isJerseyName_(name) { return /jersey/i.test(String(name || '')); }
/** '' for non-jersey products (the field is ignored). For jersey products: the digits, or throws. */
function jerseyFor_(productName, raw) {
  if (!isJerseyName_(productName)) return '';
  var j = (typeof raw === 'string' || typeof raw === 'number') ? String(raw).trim() : '';
  if (!JERSEY_RE.test(j)) throw new Error('Enter a jersey number from 0 to 99 for ' + productName + '.');
  return j;
}
function jerseySuffix_(j) { return j ? ' #' + j : ''; }
```

## 2. Validate each line (where items are re-checked against Supabase)

Find the loop that looks up each item's SKU in the Supabase products and checks size, price and stock.
Right after the product is found (use the **Supabase** name, not the name the browser sent), add:

```js
it.jersey = jerseyFor_(product.name, it.jersey);   // throws -> the order is rejected with that message
```

Use the variable names your loop already has (`it` = the order line, `product` = the Supabase row).
If the loop collects errors instead of throwing, wrap it: `try { ... } catch (e) { return fail(e.message); }`
using the script's existing error path.

If that loop **merges duplicate lines** by `sku + size`, add the jersey number to that key
(`sku + '|' + size + '|' + (it.jersey || '')`) so two numbers stay as two lines.

## 3. Orders tab: Items text

Find where the Items cell text is built (search for `' x'`). Add the suffix after the size:

```js
name + (size ? ' (' + size + ')' : '') + jerseySuffix_(it.jersey) + ' x' + qty
// -> "CURSOR Jersey (M) #07 x1"
```

No new column, no column order change.

## 4. Item tab: Name cell

Find where a row (Name / Section / Quantity) is written into the year block of the item tab.
Build the Name value with the suffix **before** it is escaped and written:

```js
var rowName = customerName + jerseySuffix_(it.jersey);   // "Dela Cruz, Juan #07"
```

Then use `rowName` everywhere that code uses the name for this line: the written cell **and** any
"find the existing row for this person and add to its quantity" check. Two numbers then give two
different names, so they land on two rows. Keep passing the final string through the existing
formula-injection escape function. The suffix goes at the end, so the first character (the one the
escape checks) doesn't change.

## 5. Read-through checklist (do this in the editor, since it could not be done here)

- **Order numbering** (`CpEstls-26001`…): reads the Orders tab's Order No column only. The jersey change does not touch it.
- **Tab matching**: still uses the product name (ignoring case, spaces, hyphens). The suffix is added to the
  *customer* name, never to the product name used for matching. So a tab called `CURSOR Jersey` must exist.
- **Block detection**: headers in rows 1–2 (Name / Section / Quantity) are not changed.
- **sortBlock**: sorts by section, then name. `"Dela Cruz, Juan #07"` sorts right after `"Dela Cruz, Juan"`; nothing else moves.
- **Escaping**: the suffix is only `" #"` plus 1–2 digits, so the escaping is unaffected.
