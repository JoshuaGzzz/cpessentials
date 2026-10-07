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

grant execute on function public.is_admin() to anon, authenticated;

-- Public bucket for product photos: anyone can view, only admins can upload.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());


-- ===== Several photos per product (swipeable gallery) =====
alter table public.products add column if not exists images text[] not null default '{}';
