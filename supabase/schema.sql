-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.members (
  mem_no      text primary key,          -- normalized, e.g. CRSRS12627000004
  name        text not null,
  sr_code     text not null,             -- e.g. 24-01561
  year_level  text not null default '',
  section     text not null default '',
  email       text not null default '',
  updated_at  timestamptz not null default now()
);
create index if not exists members_sr_code_idx on public.members (sr_code);

-- Only people listed here can read or change members.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.members enable row level security;
alter table public.admins  enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins manage members" on public.members;
create policy "admins manage members" on public.members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The public checkout can only ask "is this membership no. + SR code a member?" (true/false).
-- It can never read the member list.
create or replace function public.verify_member(p_mem text, p_sr text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.members
    where mem_no = upper(regexp_replace(coalesce(p_mem, ''), '[^A-Za-z0-9]', '', 'g'))
      and sr_code = trim(coalesce(p_sr, ''))
  );
$$;
revoke all on function public.verify_member(text, text) from public;
grant execute on function public.verify_member(text, text) to anon, authenticated;

-- (Second section below adds products + photos.)
-- AFTER creating your admin user (Authentication > Users > Add user), run this with your email:
-- insert into public.admins (user_id) select id from auth.users where email = 'YOU@example.com';


-- ===== Shop content: products, store settings, product photos =====
-- Safe to re-run: everything below is idempotent.

create table if not exists public.products (
  id          text primary key,                 -- SKU
  name        text not null,
  category    text not null default 'Other',
  price       numeric(10,2) not null check (price >= 0),
  description text not null default '',
  sizes       text[] not null default '{}',
  stock       integer check (stock is null or stock >= 0),   -- null = unlimited
  visible     boolean not null default true,
  img         text not null default '',         -- photo URL, or a legacy name like "black"
  art         text not null default '',
  position    integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.store_settings (
  id   integer primary key check (id = 1),
  data jsonb not null default '{}'::jsonb
);

alter table public.products       enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated using (visible);
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read settings" on public.store_settings;
create policy "public read settings" on public.store_settings
  for select to anon, authenticated using (true);
drop policy if exists "admins manage settings" on public.store_settings;
create policy "admins manage settings" on public.store_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Public bucket for product photos: anyone can view, only admins can upload.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;  -- photos break if the bucket was created as private

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());


-- ===== Several photos per product (swipeable gallery) =====
alter table public.products add column if not exists images text[] not null default '{}';

-- ===== Two-tier Connect Card pricing + Google Sheet tab routing =====
alter table public.products add column if not exists member_price numeric check (member_price is null or member_price >= 0);
alter table public.products add column if not exists sheet_tab text not null default '';


-- ===== API access =====
-- Newer Supabase projects no longer expose new tables to the website automatically, so grant it here.
-- Row level security above still decides what each person can actually see or change.
grant usage on schema public to anon, authenticated;
grant select on public.products, public.store_settings to anon, authenticated;
grant insert, update, delete on public.products, public.store_settings to authenticated;
grant select, insert, update, delete on public.members to authenticated;


-- ===== Stock: Code.gs lowers stock when an order is saved =====
-- The order script proves itself with a long random secret (never the service_role key).
-- Read it once with:  select secret from public.script_secret;
-- and paste it into STOCK_SECRET at the top of google-sheets/Code.gs.
create table if not exists public.script_secret (
  id     integer primary key check (id = 1),
  secret text not null
);
alter table public.script_secret enable row level security;   -- no policies: unreadable from the website
revoke all on table public.script_secret from public, anon, authenticated;
insert into public.script_secret (id, secret)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- p_items: [{"id": "CP-TS-BLK", "qty": 2}, ...]. Unlimited stock (null) is left alone.
-- Returns {"ok": true} after lowering stock, or {"ok": false, "short": [ids]} and changes nothing.
create or replace function public.take_stock(p_secret text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ids   text[];
  qtys  bigint[];
  short text[];
begin
  if p_secret is null or length(p_secret) < 32
     or not exists (select 1 from public.script_secret where id = 1 and secret = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', true);
  end if;

  select coalesce(array_agg(w.id order by w.id), '{}'),
         coalesce(array_agg(w.qty order by w.id), '{}')
  into ids, qtys
  from (
    select x.id, sum(x.qty)::bigint as qty
    from jsonb_to_recordset(p_items) as x(id text, qty integer)
    where x.id is not null and x.qty is not null and x.qty > 0
    group by x.id
  ) w;

  if cardinality(ids) = 0 then
    return jsonb_build_object('ok', true);
  end if;

  perform 1 from public.products where id = any(ids) order by id for update;

  select coalesce(array_agg(p.id order by p.id), '{}') into short
  from public.products p join unnest(ids, qtys) as w(id, qty) on w.id = p.id
  where p.stock is not null and p.stock < w.qty;

  if cardinality(short) > 0 then
    return jsonb_build_object('ok', false, 'short', to_jsonb(short));
  end if;

  update public.products p set stock = p.stock - w.qty::integer, updated_at = now()
  from unnest(ids, qtys) as w(id, qty)
  where w.id = p.id and p.stock is not null;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.take_stock(text, jsonb) from public;
grant execute on function public.take_stock(text, jsonb) to anon, authenticated;
