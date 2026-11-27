-- One-time, idempotent migration to split "Button Pin" (CP-STK-01) into:
--   1. CP-STK-01: "Pin button (3 set)"   — PHP 75 (Connect Card PHP 60), no sizes
--   2. CP-STK-02: "Pin button (per piece)" — PHP 30 (Connect Card PHP 25), Design 1 / 2 / 3
-- Run in Supabase: SQL Editor > New query > paste > Run. Safe to re-run.

begin;

update public.products
set name         = 'Pin button (3 set)',
    price        = 75,
    member_price = 60,
    sizes        = '{}'::text[],
    description  = 'All three designs are included.',
    sheet_tab    = 'Pin button',
    updated_at   = now()
where id = 'CP-STK-01';

insert into public.products (
  id,
  name,
  category,
  price,
  member_price,
  sizes,
  stock,
  visible,
  img,
  images,
  art,
  sheet_tab,
  position,
  updated_at
)
select
  'CP-STK-02',
  'Pin button (per piece)',
  p.category,
  30,
  25,
  array['Design 1', 'Design 2', 'Design 3']::text[],
  null::integer,
  p.visible,
  p.img,
  p.images,
  p.art,
  'Pin button',
  p.position,
  now()
from public.products p
where p.id = 'CP-STK-01'
on conflict (id) do update set
  name         = excluded.name,
  category     = excluded.category,
  price        = excluded.price,
  member_price = excluded.member_price,
  sizes        = excluded.sizes,
  stock        = excluded.stock,
  visible      = excluded.visible,
  img          = excluded.img,
  images       = excluded.images,
  art          = excluded.art,
  sheet_tab    = excluded.sheet_tab,
  position     = excluded.position,
  updated_at   = now();

commit;
