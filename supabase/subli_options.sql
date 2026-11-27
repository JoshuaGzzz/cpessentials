-- =============================================================================
-- Subli shirt 4-option migration (safe to re-run, idempotent)
--
-- HOW TO GO LIVE WITH THIS FILE (run in this exact order):
--   1. Deploy the updated Apps Script (Code.gs) and run CpEssentials menu 2
--      ("2. Create missing tabs and Custom # columns") in Google Sheets.
--   2. Deploy the updated website and verify the existing single Subli shirt
--      still works as before.
--   3. Open Supabase > SQL Editor > New query > paste this file > Run ONCE.
--      - Renames your existing Subli shirt to "Subli shirt (Custom number)"
--        while keeping its exact id (so open carts and in-flight orders stay valid).
--      - Creates 3 new HIDDEN rows: <id>-ENGR, <id>-BOTH, and <id>-NAME
--        (Option 4 "Custom name" is clearly marked below if you want to skip it).
--   4. In Admin > Items: set each option's price and Connect Card price, then
--      tick "Visible in the shop" (or click Show) to turn them live.
-- =============================================================================

begin;

do $$
declare
  v_suffix_re constant text :=
    '\((engr\s*/\s*00|(custom\s+)?name\s*(\+|&|and)\s*(number|no\.?|#)|custom\s+name|name(\s+only)?|custom\s+(number|no\.?|#)|number(\s+only)?)\)\s*$';
  v_count     integer;
  v_ids       text;
  v_migrated  text;
  v_base      public.products%rowtype;
  v_tab       text;
begin
  -- Find existing Subli/Jersey products that do NOT already have an option suffix.
  select count(*), string_agg(id, ', ' order by id)
    into v_count, v_ids
  from public.products
  where name ~* 'subli|jersey'
    and not (name ~* v_suffix_re);

  if v_count = 0 then
    select string_agg(id || ' (' || name || ')', ', ' order by id)
      into v_migrated
    from public.products
    where name ~* 'subli|jersey'
      and name ~* v_suffix_re;

    if v_migrated is not null then
      raise notice 'Nothing changed: Subli shirt options appear to be migrated already (%).', v_migrated;
    else
      raise notice 'Nothing changed: no unsuffixed Subli/Jersey product was found in public.products.';
    end if;
    return;
  end if;

  if v_count > 1 then
    raise notice 'Nothing changed: found % unsuffixed Subli/Jersey products (%). Rename or remove extras so only one matches, then re-run.', v_count, v_ids;
    return;
  end if;

  select *
    into v_base
  from public.products
  where name ~* 'subli|jersey'
    and not (name ~* v_suffix_re);

  -- Code.gs requires product ids matching ^[A-Za-z0-9-]{2,40}$. Suffixes (-ENGR, -BOTH, -NAME) add 5 chars.
  if length(v_base.id) + 5 > 40 or not (v_base.id ~ '^[A-Za-z0-9-]+$') then
    raise notice 'Nothing changed: existing product id "%" cannot form valid <=40-char variant ids (<id>-ENGR/-BOTH/-NAME).', v_base.id;
    return;
  end if;

  v_tab := coalesce(nullif(trim(v_base.sheet_tab), ''), 'Subli shirt');

  -- 1) Keep the existing product's id intact so saved carts and in-flight orders keep working.
  update public.products
  set name       = 'Subli shirt (Custom number)',
      sheet_tab  = v_tab,
      updated_at = now()
  where id = v_base.id;

  -- 2) Option 1: Engr / 00 (no custom inputs; starts hidden until you set its price in Admin).
  insert into public.products (
    id, name, category, price, member_price, sizes, stock, visible,
    img, images, art, description, position, sheet_tab, updated_at
  )
  values (
    v_base.id || '-ENGR', 'Subli shirt (Engr/00)', v_base.category,
    v_base.price, v_base.member_price, v_base.sizes, v_base.stock, false,
    v_base.img, v_base.images, v_base.art, v_base.description,
    v_base.position, v_tab, now()
  )
  on conflict (id) do nothing;

  -- 3) Option 3: Custom name + number (starts hidden until you set its price in Admin).
  insert into public.products (
    id, name, category, price, member_price, sizes, stock, visible,
    img, images, art, description, position, sheet_tab, updated_at
  )
  values (
    v_base.id || '-BOTH', 'Subli shirt (Custom name + number)', v_base.category,
    v_base.price, v_base.member_price, v_base.sizes, v_base.stock, false,
    v_base.img, v_base.images, v_base.art, v_base.description,
    v_base.position, v_tab, now()
  )
  on conflict (id) do nothing;

  -- 4) Option 4 (OPTIONAL): Custom name only (number defaults to 00).
  --    Delete this INSERT block if you only want the first 3 options.
  insert into public.products (
    id, name, category, price, member_price, sizes, stock, visible,
    img, images, art, description, position, sheet_tab, updated_at
  )
  values (
    v_base.id || '-NAME', 'Subli shirt (Custom name)', v_base.category,
    v_base.price, v_base.member_price, v_base.sizes, v_base.stock, false,
    v_base.img, v_base.images, v_base.art, v_base.description,
    v_base.position, v_tab, now()
  )
  on conflict (id) do nothing;

  raise notice 'Done: renamed "%" to "Subli shirt (Custom number)" (tab "%") and inserted hidden variants %-ENGR, %-BOTH, %-NAME. Set prices in Admin > Items and tick them visible.',
    v_base.id, v_tab, v_base.id, v_base.id, v_base.id;
end $$;

commit;
