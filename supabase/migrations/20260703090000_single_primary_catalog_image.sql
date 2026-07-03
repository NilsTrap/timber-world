-- Enforce AT MOST ONE is_primary image per product / per variant (first-wins).
-- The app's upload sets is_primary when it believes the entity has no image yet; if
-- that check is ever wrong (RLS visibility / race / mixed seed+upload), a variant can
-- end up with two "Primary" images — which is impossible by intent. These BEFORE
-- triggers run as the table owner (they see ALL rows regardless of RLS), so the
-- invariant holds no matter what the app inserts: if a primary already exists, the
-- incoming row is silently forced non-primary.

create or replace function public.enforce_single_primary_product_image()
returns trigger language plpgsql as $$
begin
  if new.is_primary and exists (
    select 1 from public.catalog_product_images
    where product_id = new.product_id and is_primary and id <> new.id
  ) then
    new.is_primary := false;
  end if;
  return new;
end; $$;

drop trigger if exists trg_single_primary_product_image on public.catalog_product_images;
create trigger trg_single_primary_product_image
  before insert or update of is_primary on public.catalog_product_images
  for each row execute function public.enforce_single_primary_product_image();

create or replace function public.enforce_single_primary_variant_image()
returns trigger language plpgsql as $$
begin
  if new.is_primary and exists (
    select 1 from public.catalog_variant_images
    where variant_id = new.variant_id and is_primary and id <> new.id
  ) then
    new.is_primary := false;
  end if;
  return new;
end; $$;

drop trigger if exists trg_single_primary_variant_image on public.catalog_variant_images;
create trigger trg_single_primary_variant_image
  before insert or update of is_primary on public.catalog_variant_images
  for each row execute function public.enforce_single_primary_variant_image();

-- Repair existing rows: keep the lowest (sort_order, id) as the single primary.
update public.catalog_product_images t set is_primary = false
where t.is_primary and exists (
  select 1 from public.catalog_product_images o
  where o.product_id = t.product_id and o.is_primary
    and (o.sort_order, o.id) < (t.sort_order, t.id)
);

update public.catalog_variant_images t set is_primary = false
where t.is_primary and exists (
  select 1 from public.catalog_variant_images o
  where o.variant_id = t.variant_id and o.is_primary
    and (o.sort_order, o.id) < (t.sort_order, t.id)
);
