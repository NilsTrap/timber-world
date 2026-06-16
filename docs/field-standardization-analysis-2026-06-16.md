I have all the structured findings I need from the five subsystem readers. This is a synthesis task, not a code-exploration task. Producing the report directly.

# Field Standardization Analysis — Timber World

## 1. The problem in one paragraph

Timber World has ~7 core material attributes (wood species, product type/name, processing, humidity, quality grade, FSC, dimensions) plus ~8 commercial attributes (currency, unit, pricing, packaging, statuses, incoterms, transport billing, doc types) that recur across **5 subsystems** (catalog, inventory/packages, production, deals, agent orders) and are stored **three incompatible ways**: (1) **free text** typed by users (all deal line-item attributes, all inventory dimensions, incoterms, SKU), (2) **`ref_*` simple lookup tables** with `id/value/sort_order/is_active` (8 tables, used by inventory + production via FK), and (3) **catalog EAV** (`catalog_fields` → `catalog_field_options` → per-entity values, with per-category assignments). The same concept frequently lives in 2-3 representations at once — e.g. **wood species exists as `ref_wood_species` (inventory FK) AND `catalog_field_options` (a snapshot copy with enriched labels) AND free text in `deal_line_items.wood_species`** — with no sync between them, plus statuses/currency hardcoded as DB enums in ~6 more places. The result is duplication, drift risk, and inconsistent UX (dropdown in one screen, free-typed in another).

## 2. Canonical field-concept inventory

| Concept | Where it appears today | Representation(s) | Admin-managed? | Reusable today? |
|---|---|---|---|---|
| **Wood species** | `ref_wood_species` (FK: inventory, production); `catalog_field_options` (snapshot); `deal_line_items.wood_species` | ref_* **+** catalog EAV **+** free text | ref+catalog yes; deals no | Partially — duplicated, not unified |
| **Product type** (FJ/Full stave) | `ref_types` (FK: inventory, production); `catalog_field_options` (panel_type); `uk_staircase_pricing.product_type` (enum FJ/FS/FJFS) | ref_* **+** catalog EAV **+** enum | ref+catalog yes | Partially — 3 copies |
| **Processing** | `ref_processing` (FK: inv/prod); `catalog_field_options`; `deal_line_items.processing` | ref_* **+** catalog EAV **+** free text | ref+catalog yes; deals no | Partially — duplicated |
| **Humidity** | `ref_humidity` (FK: inv/prod); `catalog_field_options`; `deal_line_items.humidity`; `products.moisture_content` (decimal) | ref_* **+** catalog EAV **+** free text **+** numeric | ref+catalog yes | Partially — duplicated |
| **Quality grade** | `ref_quality` (FK: inv/prod); `catalog_field_options`; `deal_line_items.quality`; `products.quality_grade` (varchar) | ref_* **+** catalog EAV **+** free text **+** varchar | ref+catalog yes | Partially — duplicated |
| **FSC** | `ref_fsc` (FK: inv/prod); `catalog_field_options`; `products.fsc_certified` (bool) | ref_* **+** catalog EAV **+** bool | ref+catalog yes | Partially — duplicated |
| **Product name** | `ref_product_names` (FK: inv/prod); `deal_line_items.product_name` | ref_* **+** free text | ref yes; deals no | Partially — not used by deals/catalog |
| **Production process** | `ref_processes` (FK: production; has work_unit/formula/price) | ref_* (extended) | yes | Yes — production only |
| **Thickness/Width/Length** | inventory/prod/deals (TEXT, ranges); `catalog_variants.*_mm` (numeric); `catalog_fields` (numeric, is_system); `uk_staircase_pricing.*_mm` (numeric) | free text **+** numeric | catalog field def only | No — free-form everywhere except catalog |
| **Pieces / volume** | inventory/prod/deals/orders | free text / decimal | no | No |
| **Currency** | `orders.currency`, `deals.currency`, `order_items.currency`, `catalog_variants.currency` (enums); `catalog_currencies` (full registry) | enum **+** ref_table (catalog) | catalog yes; rest hardcoded | Split — catalog has real registry, others hardcoded |
| **Unit** | `deals.unit` (enum); `catalog_categories.primary_unit` (FK); `catalog_pricing_units` (registry); `portal_products.unit` (default) | enum **+** ref_table **+** free text | catalog yes; rest hardcoded | Split |
| **Pricing** | `products.unit_price_*`, `catalog_variants.price_*_cents`, `uk_staircase_pricing.*`, `inventory_packages.unit_price_*`, `catalog_currency_prices` | numeric (fragmented) | catalog cascade only | No — 4+ separate mechanisms |
| **Packaging** | `catalog_packaging_types` (registry) + variant assignments | ref_table | catalog yes | Yes — catalog only |
| **Statuses** (order/shipment/pkg/production/deal) | hardcoded PG ENUM / CHECK across 5+ tables | enum_check | no | No — not extensible |
| **Incoterms / place** | `deals.incoterms`, `incoterms_place` | free text | no | No |
| **Transport billing / doc type / ext-ref type** | `deals.*` | enum_check | no | No |

**Duplication hotspot:** the 6 material attributes (species, type, processing, humidity, quality, FSC) each exist in **3 representations simultaneously**, with `catalog_field_options` being an un-synced snapshot of the `ref_*` source.

## 3. The three existing patterns & verdict

| Pattern | Strength | Weakness |
|---|---|---|
| **`ref_*` simple lookup** (id/value/sort/active, FK'd) | Clean, normalized, single source, one generic admin UI (ReferenceDataManager), referential integrity via FK | No rich metadata (label vs value, description, image); flat (no per-context visibility); no typed values (numeric/bool); 8 hand-rolled tables |
| **Catalog EAV** (`catalog_fields` → `field_options` → assignments → values) | Rich (label/description/image), typed (select/number/text/bool), reusable field registry with per-category overrides, system-field protection, snapshot options | Heavier; EAV query cost; options are an **un-synced copy** of `ref_*`; built assuming catalog-only consumers |
| **Free text** | Zero setup, max flexibility (ranges "40-50", dual nominals "29 (26)") | No consistency, no filtering, no admin control, drift; correct only for genuinely-variable dimensional specs |

**Verdict — the catalog category-fields+options (EAV) model is the universal standard.** It already does everything `ref_*` does **plus** typed values, rich labels/descriptions, per-context visibility/requirement, and system-field protection — it is a strict superset. `ref_*` should be **demoted to a value source that converges into it**, not kept as a parallel system. **Free text stays only for true dimensional specs** (thickness/width/length/pieces), which are deliberately variable (ranges, expressions) and should remain typed-text — they are not a standardization opportunity. Hardcoded status/currency/incoterms enums should migrate to the same registry over time.

## 4. Recommended target: a universal reference/attribute system

**Promote the catalog field system into a system-wide "Reference / Attributes" service** — same tables, repositioned and generalized so non-catalog features consume it.

**Shape (reuse existing catalog tables; add a thin generalization layer):**
- `attribute_definitions` ≡ today's `catalog_fields` — drop the "catalog" framing. Columns already fit: `key, label, type (select|number|text|bool), unit, is_system, dimension_role`. Add nothing required; optionally add `scope`/tags so a UI can group "material attributes" vs "commercial".
- `attribute_options` ≡ today's `catalog_field_options` (`value, label, description, image, sort_order, is_active`). **This becomes the single source of truth for option values** — `ref_*` collapses into it.
- `attribute_assignments` ≡ today's `catalog_category_field_assignments`, generalized so the "container" can be a catalog category **or** a feature context (deals, inventory) — add a `context_type` alongside `category_id`, or keep category-only and let non-catalog features read the global definition directly (simpler; see below).
- **Values:** keep catalog's EAV (`*_field_values`) for catalog. For deals/inventory, the cheapest non-breaking path is a **FK column to `attribute_options.id`** (mirrors how `inventory_packages` already FKs `ref_*`), not full EAV — features get the dropdown + integrity without an EAV rewrite.

**A single service** (`reference.ts` / `attributes.ts`): `getAttribute(key)`, `getOptions(key)`, `saveOption`, generic CRUD — replaces both `reference-data/*` actions and the catalog field-option actions.

**How each subsystem consumes it:**
- **Catalog** — unchanged (it already is this system).
- **Deals** — replace free-text `wood_species/processing/quality/product_name/humidity` with `*_option_id` FKs to `attribute_options`; render dropdowns via `getOptions(key)`. (This is step 1.)
- **Inventory/Production** — already FK `ref_*`; repoint those FKs to `attribute_options` (or keep `ref_*` as a **DB view** over the unified table for zero code change — see convergence).
- **Agent app** — already a read-only consumer of catalog fields; no change.

**Convergence of `ref_*` and `catalog_field_options` (the key decision):** **Unify into `attribute_options`, with `ref_*` reduced to backward-compat views.**
1. `catalog_field_options` becomes canonical (it already has `ref_value_id` pointing back to `ref_*`, so the link exists).
2. For each `ref_*` table, replace it with a **SQL view** that selects from `attribute_options` for that attribute key (`CREATE VIEW ref_wood_species AS SELECT id, value, sort_order, is_active … FROM attribute_options WHERE …`). Existing inventory/production FKs and the ReferenceDataManager keep working unchanged — **no breakage** — while there is now one physical source.
3. Editing an option in one place updates everywhere; the snapshot-drift problem disappears.

**Backward-compat guarantees:** catalog tables/columns untouched; `ref_*` survive as views; inventory FKs intact; agent app untouched; only additive columns on `deals`. Every consumer keeps reading the same shape.

## 5. Incremental, non-breaking migration path (each step independently shippable)

1. **Deals line-item dropdowns (FIRST — where Edgars wants it).** Add `wood_species_option_id, processing_option_id, quality_option_id, product_name_option_id, humidity_option_id` to `deal_line_items` (nullable, keep the text columns). Point DataEntryTable selects at `getOptions(key)` from existing `catalog_field_options`. Free-typed values still allowed via the retained text column (write to both). Ships value immediately, zero breakage.
2. **Extract the generic attribute service.** Wrap `catalog_field_options` reads in `attributes.ts` (`getOptions(key)`, `saveOption`). No schema change — pure refactor so all features call one API.
3. **Converge `ref_*` → views.** Backfill any `ref_*` value missing from `attribute_options`; recreate `ref_wood_species` etc. as views over `attribute_options`. Inventory/production unaffected. Kills the snapshot-drift class of bugs.
4. **Promote currency + unit to the registry.** Make `deals.currency`/`orders.currency`/`deals.unit` read from `catalog_currencies` / `catalog_pricing_units` instead of hardcoded enums (keep enum constraint as a safety net initially). Single source for currency/unit across deals + catalog.
5. **Backfill deals text → option_id**, then make `option_id` the primary read path; retain text as free-form override note. (Optional: drop text columns later.)
6. **Statuses & incoterms (last, optional).** Move hardcoded status/incoterms/transport-billing/doc-type enums into the registry as new attribute definitions when extensibility is actually needed — lowest priority, highest blast radius.

## 6. Navigation / menu reorg (proposal)

Today all 6 catalog sub-pages sit under **Agents → Catalogue** behind one `catalogue.view` gate, conflating "what agents sell" with "how the system works." Reorg in steps:

**Step A — create a new top-level "System Settings" (or "Reference Data") group.** Move into it the genuinely system-wide reference pages:
- **Attributes / Fields** (`/admin/catalog/fields` → `/admin/settings/attributes`)
- **Reference Data** (`/admin/reference` — the `ref_*` manager) — co-locate, ideally merge into Attributes once step 5.3 lands
- **Packaging Types** (`/admin/catalog/packaging`)
- **Pricing Units** (`/admin/catalog/pricing-units`)
- **Currencies** (`/admin/catalog/currencies`)

**Step B — keep under Agents:**
- **Catalogue** → **Categories** + **Products/Variants** (commission lives on categories; this is what agents browse)
- **Agents**, **Agent Orders**, **Agent Manual**

**Step C — gating.** Introduce a `system-settings.view` (or `reference-data.view`) module for the moved pages; leave `catalogue.view` on Categories/Products only. No functional change for agents (they consume these read-only via the Agents app).

Routes can be moved with redirects from old paths; no data migration. Purely IA/UX — zero functional impact.

## 7. Risks & open questions for Edgars

- **`ref_*` → view conversion:** are any `ref_*` tables written to by code paths other than ReferenceDataManager? (A view is read-mostly; writes must route to `attribute_options`.) Need a quick grep before step 3.
- **Production process specials:** `ref_processes` carries `work_unit/work_formula/price` — it's richer than a plain lookup. Keep it as a separate extended definition, or model those as extra columns on the unified options? (Recommend: leave `ref_processes` as-is for now.)
- **Per-org customization:** `organisation_ref_exclusions` already scopes some values per org (staircase products). The unified registry is currently platform-wide — do we need per-org option visibility, and does the agent/deals UI need it too?
- **Deals dual-write window:** keeping both text + `option_id` on deal line items is the safe path — confirm you're OK with the temporary redundancy until backfill (step 5) completes.
- **Currency authority:** `catalog_currencies` (EUR-base + ECB + charm rounding) is sophisticated; `deals`/`orders` use a flat enum. Converging them means deals inherit the catalog currency model — desired, or keep deals' currency dumb? 
- **Dimensions stay free text** (thickness/width/length/pieces) — confirm you agree these should *not* be standardized into options, given ranges/expressions like "40-50" / "29 (26)".
