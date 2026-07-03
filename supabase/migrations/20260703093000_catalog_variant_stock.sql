-- Manual per-variant stock, broken down BY PACKAGING FORM.
-- Packaging *assignments* say which forms a variant comes in (options + price);
-- this table says HOW MUCH is on hand in each form. A NULL packaging_type_id row is
-- "loose pieces". Total pieces on hand for a variant =
--   Σ(quantity × pieces_per_package) over packaged rows  +  Σ(quantity) over loose rows.
-- Edited by hand for now (the catalog is not yet wired to production/deliveries).

create table if not exists public.catalog_variant_stock (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.catalog_variants(id) on delete cascade,
  packaging_type_id uuid references public.catalog_packaging_types(id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per (variant, packaging form); a single "loose" (null packaging) row per variant.
create unique index if not exists catalog_variant_stock_variant_packaging_uq
  on public.catalog_variant_stock (variant_id, packaging_type_id) where packaging_type_id is not null;
create unique index if not exists catalog_variant_stock_variant_loose_uq
  on public.catalog_variant_stock (variant_id) where packaging_type_id is null;
create index if not exists catalog_variant_stock_variant_idx
  on public.catalog_variant_stock (variant_id);

-- RLS mirrors the sibling catalog child tables: public read, platform-admin write.
alter table public.catalog_variant_stock enable row level security;

drop policy if exists catalog_variant_stock_select on public.catalog_variant_stock;
create policy catalog_variant_stock_select on public.catalog_variant_stock
  for select using (true);

drop policy if exists catalog_variant_stock_admin_write on public.catalog_variant_stock;
create policy catalog_variant_stock_admin_write on public.catalog_variant_stock
  for all using (is_current_user_platform_admin()) with check (is_current_user_platform_admin());
