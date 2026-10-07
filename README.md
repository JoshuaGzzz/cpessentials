# CpEssentials Store

Official merch store for CURSOR (BatStateU Computer Engineering Students' Organization).
React 18 + Vite, Supabase (Postgres + Storage + Auth) for products, photos, settings and members.
Pickup only. Payment by GCash (manual reference check) or at pickup. Every order is written to a Google Sheet.

## Run it

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # outputs dist/

Copy `.env.example` to `.env` and fill in your Supabase URL and publishable key
(Project Settings > API Keys; the legacy anon key also works). Never use the secret / service_role key.

## One-time Supabase setup

1. Create a project at supabase.com (free plan is fine).
2. SQL Editor: paste and run `supabase/schema.sql`. It is safe to run again after updates.
3. Authentication > Users > Add user (your email + password, tick Auto Confirm).
4. SQL Editor: `insert into public.admins (user_id) select id from auth.users where email = 'YOU@example.com';`
   Only users in `admins` can change anything, even if someone else signs up.
5. Put the URL and key in `.env`. On Netlify/Vercel/Cloudflare add the same two variables
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and redeploy. Vite reads them at build time.
6. Open `/#/admin`, sign in, and on Products press "Save starter products to database" (first time only).

## Admin

`/#/admin` (small "Staff login" link in the footer). One login: your Supabase user.

- **Products:** add, edit, copy, hide, reorder, delete, photos, sizes, stock. Saves go live immediately.
  Photos are uploaded to the `product-images` bucket; no catalog.json download or redeploy needed.
- **Store settings:** name, hero text and image, pickup details, footer, member discount %.
- **Members:** import CSV (or paste from Excel), search, remove. Headers: `Membership No, Name, SR Code, Year Level, Section, Email`.

`public/catalog.json` is only the starter copy and the fallback if the database is empty or unreachable.

## Member discount

At checkout everyone enters name, SR code, year level, section and email. Members also tick
"I'm a CURSOR member" and enter their membership no. The discount applies if that membership no.
and SR code exist together in `members`. The public site can only ask yes/no; it cannot read the list.
Membership no. and SR code are not secrets, so match names at pickup.

## Orders and GCash

Checkout sends each order to a Google Sheet through a small Google Apps Script (`google-sheets/Code.gs`),
so the website works like a Google Form that you can edit live in Sheets.

- GCash receipt photos are uploaded by the customer at checkout and saved to a private Google Drive folder
  (set `RECEIPTS_FOLDER_ID` in `Code.gs`). They are never stored in Supabase. The Orders tab has a "View receipt" link per order.
- Tabs: **Orders** (one row per order, Status dropdown, Check column, Notes) and **Items** (one row per item and size, for counting what to prepare).
- The script re-checks prices and member status against your database and flags anything odd in the **Check** column.
- It ignores accidental double submits and flags a GCash reference number that was already used.
- Customers pay by GCash to the number/QR set in Admin > Store settings, then enter the reference number.
  You compare it with your GCash history and set Status to Paid. Leave the GCash number blank to switch to pay-at-pickup.
- Setup: see the steps in the chat or open `google-sheets/Code.gs` (instructions at the top). Paste the web app URL into
  Admin > Store settings > "Orders sheet URL". After editing the script you must deploy a new version.

## Photos

Each product can have up to 8 photos (Admin > Products > Edit). The first is the cover; visitors swipe or use the
arrows/dots to see the rest. The home page hero works the same way (Admin > Store settings > Hero photos) and the hero
and product page advance on their own (paused on hover/touch, off for reduced-motion users).
Run `supabase/schema.sql` again once to add the `images` column.

## Phones

The layout adapts below 800px (single column) and 560px (two products per row, full-width checkout buttons,
admin tables become cards). All phone rules live in `@media (max-width)` blocks at the end of `src/styles/index.css`,
so the desktop layout is unaffected.

## Cart

The cart is saved in the visitor's browser (localStorage key `cp_cart_v1`), so it survives refreshes.

## Known gaps

- GCash payments are checked by hand (reference number vs your GCash history). No automatic confirmation.
- Stock counts are not reduced when an order comes in; update them in Admin > Products.
- The web app URL is public (it has to be). The script validates every order, but someone could still send junk rows.
- Supabase free projects pause after a week of inactivity; the shop then falls back to catalog.json
  and member checks fail until you restore the project from the dashboard.
