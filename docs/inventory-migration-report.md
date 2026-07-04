# O1 · Legacy-inventory → catalog migration report

**Wave 2, Epic O (subtask `jkcdxu`; board task `9va5xt`).** Programmatic, idempotent
migration of the legacy inventory product data (`inventory_packages` + the `ref_*`
vocabulary tables) into the dynamic product **catalog** (categories → products →
variants → per-variant stock).

- **Script:** `apps/portal/scripts/o1-migrate-inventory-to-catalog.mts`
- **Target:** STAGING only (`fyzrtqsnmnizoxgcqsjc`). PROD is frozen and was never touched.
- **Run:** from `apps/portal`, with staging env —
  `NEXT_PUBLIC_SUPABASE_URL=https://fyzrtqsnmnizoxgcqsjc.supabase.co SUPABASE_SERVICE_ROLE_KEY=… tsx scripts/o1-migrate-inventory-to-catalog.mts` (dry-run), add `--apply` to write.
- **Idempotent:** safe to re-run — every write guards on a stable natural key (see below); re-running reconciles, never duplicates. (The apply is ~2.5k sequential network writes and takes ~12 min end-to-end; a re-run is a no-op reconcile.)
- Legacy `inventory_packages` / `ref_*` stay **live in parallel** — this only READS them and only WRITES catalog tables. The E5 legacy-inventory decommission stays gated/separate.
- The `[DEMO]`-tagged and hand-made seed categories are untouched: every migrated row is **namespaced** (`inv-*` slugs), so nothing collides with or duplicates the seeds.

## Counts

### Source (legacy `inventory_packages`, staging)
| Metric | Value |
|---|---|
| Total packages | 2071 |
| Non-consumed, with a product name (migration scope) | 1016 |
| — `available` (real on-hand) | 629 rows · 24,479 pieces |
| — `produced` | 229 rows · 86,698 pieces |
| — `ordered` | 158 rows · 1,269 pieces |
| `consumed` (excluded from structure; 0 pieces on-hand) | 1045 rows |
| Rows with **no** `product_name_id` (unmappable) | 10 |

### Catalog target — before → after (`inv-*` migrated scope)
| Catalog table | Before | Created by migration |
|---|---|---|
| categories (`catalog_categories`) | 0 | **7** |
| products (`catalog_products`) | 0 | **92** |
| variants (`catalog_variants`) | 0 | **770** |
| category field assignments | 0 | **63** (9 per category) |
| product field values | 0 | **527** |
| variant packaging assignments (Single Piece) | 0 | **770** |
| variant stock lines (available only) | 0 | **567** (24,479 pieces) |

_Whole-catalog baseline before the run (unchanged seeds): 5 categories, 9 products, 14 variants, 7 stock lines — all preserved._

### The 7 migrated categories (= legacy product names)
Solid wood panels (707 rows) · Strips (103) · Tread (90) · Winder (57) · Quarter (29) · Unedged boards (26) · Edged boards (4).

## Mapping

### Structure grain
- **Category** = the legacy **product name** (`ref_product_names`). One category per distinct product name, slug `inv-<name>`.
- **Product** = a distinct **attribute combination** within a category — the tuple
  (wood species × humidity × type × processing × FSC × quality). Its display name is
  built from the attribute labels (e.g. `Oak · KD · FJ · Sawn · FSC 100% · AB`); a
  combo with no attributes is named `<category> (standard)`.
- **Variant** = a distinct **dimension combination** (thickness × width × length)
  within a product. SKU `INV-<hash(product,dims)>` (deterministic).

### Field mapping (legacy `ref_*` → catalog field)
The catalog **already** seeds `catalog_fields` + `catalog_field_options` from the
`ref_*` tables (via `catalog_field_options.ref_value_id`). The migration **reuses**
that existing controlled vocabulary — it creates **no** new fields or options.
Coverage was verified 100%: every ref-id used in inventory already has a matching
catalog option.

| Legacy `inventory_packages` column | Legacy ref table | Catalog field (`field_key`) | Level |
|---|---|---|---|
| `product_name_id` | `ref_product_names` | → **the category** (not a field) | category |
| `wood_species_id` | `ref_wood_species` | `wood_species` | product |
| `humidity_id` | `ref_humidity` | `humidity` | product |
| `type_id` | `ref_types` | `panel_type` *(the catalog field bound to `ref_types`)* | product |
| `processing_id` | `ref_processing` | `processing` | product |
| `fsc_id` | `ref_fsc` | `fsc` | product |
| `quality_id` | `ref_quality` | `quality` | product |
| `thickness` | — | `thickness` (system dim) → `catalog_variants.thickness_mm` | variant |
| `width` | — | `width` (system dim) → `catalog_variants.width_mm` | variant |
| `length` | — | `length` (system dim) → `catalog_variants.length_mm` | variant |
| `pieces` (where `status='available'`) | — | `catalog_variant_stock.quantity` (Single Piece, ppp=1) | variant stock |

- Attribute field-values are written to `catalog_product_field_values` (option_id).
- Dimensions land on the variant's numeric `*_mm` columns. Text values are parsed
  (comma-decimals like `24,5` → `24.5`). A **non-numeric** dimension (e.g. the range
  `100-350`) becomes a `NULL` mm value, but the raw string still keys the variant, so
  distinct raw dims never collapse (13 such variants).
- Primary unit per category is a small heuristic: Solid wood panels → `m2`; Edged/Unedged
  boards, Strips → `m3`; Tread, Winder, Quarter → `piece`.

### Idempotency keys
categories `.slug` · products `(category_id, slug)` · field assignments
`(category_id, field_id)` · product field values `(product_id, field_id)` · packaging
`(variant_id, packaging_type_id)` · stock `(variant_id, packaging_type_id)`. Variants
have no DB unique key, so they are guarded on the deterministic per-product `sku`.

## Stock decision (what was set + why)

Catalog stock can only be held in a **packaging form**. Every migrated variant is
given a **"Single Piece"** packaging assignment (an existing packaging type,
`pieces_per_package = 1`), so `quantity = pieces` directly and nothing is fabricated.

Stock quantity is set **only from `status = 'available'` pieces** — the unambiguous
sellable on-hand quantity (**567 variants, 24,479 pieces**). This is deliberately
conservative and does **not** invent numbers.

> **Decision needed (Edgars/Nils):** two other statuses carry physical pieces that were
> **not** counted as stock and are left for you to rule on:
> - `produced` — **86,698** pieces (fresh production output; may be pre-availability WIP).
> - `ordered` — **1,269** pieces (allocated/reserved to an order).
>
> If either should count as on-hand catalog stock, say so and the script can be
> extended to include those statuses (the grouping already tracks them).

## Unmappable / left for a human decision

1. **10 `inventory_packages` rows have no `product_name_id`** — they cannot be placed in
   a category and were skipped. (They are also mostly `consumed`.) List them with
   `select id, status, thickness, width, length from inventory_packages where product_name_id is null;`
   if you want them cleaned or backfilled.
2. **Pricing was intentionally not migrated.** Legacy per-package prices
   (`unit_price_piece` / `unit_price_m3` / `unit_price_m2` / `eur_per_m3`) vary per
   package and per org and are noisy; the catalog has its own pricing model (category
   default + charm rounding + currency derivation). All migrated `catalog_products` /
   `catalog_variants` have `price_eur_cents = NULL` — set catalog prices via the pricing
   model, not from legacy package prices.
3. **`ref_processes` is not part of this migration.** It is the production-work
   vocabulary; `inventory_packages` has no column referencing it, so it has no place in
   the product structure. (It was listed among the `ref_*` tables in the spec, hence
   noted here explicitly.)
4. **Namespacing → possible merges.** Migrated categories are namespaced `inv-*` to
   avoid clobbering existing hand-made/[DEMO] categories. Some overlap by intent — e.g.
   migrated `inv-solid-wood-panels` vs the existing `solid-wood-panels` category, and
   Tread/Winder/Quarter vs the existing `stairs` category. If you want these merged into
   the existing categories (rather than kept separate), that is a follow-up curation
   step — the migration does not assume it.
5. **`org` dimension is dropped.** Legacy stock is per-organisation; catalog stock is a
   single company-wide number. Available pieces were summed across orgs per variant. If
   per-org catalog stock is ever needed, that is a schema change, not a migration tweak.

## Status

- Script committed under `apps/portal/scripts/`; a matching note lives here.
- Type-check: **8/8** workspace packages pass; the `.mts` (excluded from the portal
  glob) was type-checked standalone (`tsc --noEmit`, clean).
- Ran against staging (dry-run + `--apply`), counts verified.
- **Board task `9va5xt` is ready to move to in-review** (the orchestrator will move it).
