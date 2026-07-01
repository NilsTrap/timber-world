# Timber Spec — Design Notes (E1–E5 data model)

Distilled from a full codebase map (2026-07-01). Grounds the [spec-implementation-plan](./spec-implementation-plan.md) in the *actual* schema. Evolve, not rewrite: every change below builds on existing tables/helpers.

## What exists today (the starting point)

- **Deal = the `orders` row.** It already carries `deal_code`, `deal_kind` (`buy_sell`/`sale_only`/`purchase_only`), `product_group`, incoterms/advance/payment/delivery terms, `transport_billing`. Children: `order_line_items` (tagged `side ∈ sell|buy`), `order_documents` (7 types, tagged `side`), `order_external_refs`, `order_files`, `order_activity_log`. Codes via `deal_counters` + `next_counter(scope)` SECURITY DEFINER RPC.
- **Three org slots on one row**: `customer_organisation_id`, `seller_organisation_id` (the trader/"Manufacturer"), `producer_organisation_id`. One row conflates the buy seam and the sell seam; `side` on children is the only seam today. **No spine, no chain, no parent.**
- **Parties = `organisations`** (`code CHAR(3)`, `is_customer/is_manufacturer/is_producer` flags, `crm_org_id`). Membership = `organization_memberships` (+ legacy `portal_users.organisation_id`).
- **Access = `organization_modules ∩ user_modules`** (flat module toggles); platform admins bypass. The **roles/user_roles model was dropped** (`20260406000008`). Field-level wall = the hardcoded `PRODUCTION_EDIT_FIELDS` set in `updateOrder.ts`. RLS helpers (SECURITY DEFINER STABLE): `current_portal_user_id()`, `is_current_user_platform_admin()`, `current_user_in_org(org)`, `current_user_shares_context_with_org(org)`. Orders RLS = visible if member of *any* of the 3 party orgs. **RLS gap: membership-gated, not module-aware.**
- **Lifecycle** = `order_status` enum (8 DB values; UI uses 4), **no state machine, no gates**. One auto-transition (`date_loaded` → `loaded`).
- **MCP** = `apps/portal/src/app/api/timber-mcp/{route,tools}.ts`, 16 tools calling the *same* services as the portal; clean 3-step add-a-tool pattern + coverage test.
- **Documents** = pure `buildDocumentData()` → `DocumentData` (in `documents/assemble.ts`) → `renderDocument()` switch behind a `DocumentGenerator` **port** (`documents/port.ts`); jsPDF renderer active, Oscar adapter stubbed. Store = `order_documents` + `deal-documents` private bucket. Regression net: `document-assemble.test.ts` + `document-render.test.ts` (smoke all 7).
- **Catalog** = modular EAV (`catalog_categories→catalog_fields(+assignments)→catalog_products→catalog_variants`, EAV values, pricing units, currencies w/ charm-rounding, `catalog_currency_prices`, packaging, per-category commissions). Legacy `inventory_packages`/`ref_*`/`production_*` **cannot be dropped** (14+ FKs, active production feature; a trigger already syncs `ref_*` → `catalog_field_options`).
- **Nav** = `SidebarWrapper` (`ADMIN_NAV_ITEMS` vs module-gated `getOrgUserNavItems`). The **"UK Agent app" collapsible section is the exact template** for E9 grouping; an unused emerald `"deals"` group already exists in code.

---

## E1 — Spine (additive; ships first, low-risk)

**Goal:** introduce the traceable identity that links a chain of bilateral deals, without disturbing current behavior.

New `spines`:
- `id`, `code` TEXT UNIQUE (`SP-NNN` via `next_counter('spine')`), `title`
- `life_stage ∈ (spec, lot)` — the Spec→Lot life-stages
- `status` TEXT — rolled-up status cache (recomputed from member deals' lifecycle, E4)
- `product_group`, `origin ∈ (root, split, merge)`, `parent_spine_id → spines(id)` (split parent), `notes`, audit cols
- `updated_at` via existing `deals_set_updated_at()` trigger.

New `spine_lineage` (many-to-many for splits/merges): `spine_id`, `related_spine_id`, `relation ∈ (split_from, merged_from)`.

`orders.spine_id → spines(id)` (nullable; deals attach to a spine).

**RLS:** a spine is visible to platform admins or any org that is a party on one of its deals (mirrors orders visibility). Writes admin/service-only for now (deal creation wires spines server-side).

**Proof:** migration applies clean on staging; `spines`/`spine_lineage`/`orders.spine_id` present; `next_counter('spine')` yields `SP-001`; anon probe on `spines` returns `[]` (RLS on); type-check green.

---

## E2 — Strictly bilateral deals + chain + auto-spawn

**Goal:** each deal = exactly one seller + one buyer; a spine's deals form the chain; creating a sell-leg can auto-spawn the matching buy-leg on the same spine.

- Canonical bilateral pair on `orders`: `seller_organisation_id` + **`buyer_organisation_id`** (new; backfill = `customer_organisation_id`). Both NOT NULL for spec-era deals. The old `producer_organisation_id` slot stops meaning "third party on one row" — a producer relationship becomes its **own buy-leg deal** (seller=producer, buyer=trader) on the same spine.
- `orders.chain_role ∈ (sell, buy, internal)` + optional `upstream_deal_id → orders(id)` for explicit chain adjacency; all legs share `spine_id`.
- **Deal code = SELLER-BUYER-NNN** (change `buildDealCode()` in `numbering.ts`; keep the `deal_code` column + `deal_counters` scope `deal:{SELLER}:{BUYER}`).
- **Auto-spawn**: `createDeal` on a spine optionally spawns the paired buy-leg (spec §"auto-spawn the matching buy deal"). Service-level in `orderDeals.ts`; MCP `timber_create_deal` gains a spine/auto-spawn param (E7).
- Existing `side` tagging stays through migration for back-compat; new deals are single-sided by nature.

**Proof:** create a spine → sell-leg deal → auto-spawned buy-leg on same spine, codes `SELLER-BUYER-NNN`; each deal strictly two orgs; chain query returns the linked pair; existing single-leg deals still load. Data backfill/split of the 77 staging orders is staged here but the *real* prod split runs in E8.

---

## E3 — Group-and-rights + field-level wall + deal-level isolation

**Goal:** reintroduce an editable rights layer (generalizing the deleted roles model) with action + visibility + scope rights, a field-level visibility wall, and deal isolation that hides the middle leg.

- `access_groups` (`id`, `organization_id` nullable=global, `name`, `description`, `is_system`) — a group = a named role.
- `access_group_rights` (`group_id`, `right_type ∈ (action, visibility, scope)`, `resource`, `key`, `value` JSONB) — action (create/edit/delete X), visibility (see field/section Y), scope (which deals/spines, e.g. only where my org is a party).
- `user_access_groups` (`user_id`, `organization_id`, `group_id`).
- **Field-level wall** = `field_visibility_rules` (`group_id`, `resource='deal'`, `field_key`, `visible`, `editable`) — generalizes `PRODUCTION_EDIT_FIELDS`. Enforced by a projection layer in the service tier (read) + a field-guard in the write actions (replaces the hardcoded set).
- **Deal isolation (hide the middle leg)** = the new RLS predicate on `orders`: platform admin OR `current_user_in_org(seller_organisation_id)` OR `current_user_in_org(buyer_organisation_id)`. Because deals are bilateral, the end customer sees only the sell-leg; the producer sees only the buy-leg. The middle price is structurally invisible. This **replaces** the 3-party predicate.
- In-app editable: the groups/rights + field-rules admin UI (extends the existing org-modules admin surface).

**Proof:** a scoped role sees only its deals (RLS negative-probe: customer cannot select the buy-leg row); a field marked hidden is absent from the read projection and rejected on write; group/rights editable in-app and take effect without redeploy.

---

## E4 — Lifecycle + configurable gates

**Goal:** a real 5-stage machine with gates that block transitions until satisfied.

- Stages: **Draft → Confirmed → Produced → Loaded → Delivered** (+ Cancelled). Add `orders.lifecycle_stage` (new TEXT/enum) mapped from legacy `order_status`; keep `order_status` during transition.
- `lifecycle_transitions` (`from_stage`, `to_stage`) — the allowed edges; enforced in a `setDealStage()` service (rejects illegal edges).
- `stage_gates` (`id`, scope: global/spine/deal, `from_stage`, `to_stage`, `gate_type ∈ (party_signoff, condition_met, acceptance)`, `config` JSONB, `required`) + `gate_satisfactions` (`gate_id`, `deal_id`, `satisfied_by`, `satisfied_at`, `note`). A transition is blocked until all its required gates are satisfied.
- Spine `status` rolls up from member deals' stages.
- Documents gated by stage/role wires into E6.

**Proof:** illegal transition rejected; a gated transition blocked until its gate is satisfied then allowed; spine status reflects the rollup; MCP `timber_set_deal_status` (E7) honors the machine.

---

## E5 — Catalog consolidation (scope corrected)

**Correction (flag to Edgars):** legacy inventory can **not** be hard-decommissioned — `inventory_packages`/`ref_*`/`production_*` have 14+ FKs and back the live production feature, and a trigger already mirrors `ref_*` → `catalog_field_options`. So E5 is **consumption + UI consolidation**, not a data drop:
- Make the modular catalog the **canonical** product/pricing definition; ensure deal line-items consume it (the `*_option_id` FKs on `order_line_items` already exist — wire the deal editor to pick from catalog).
- Keep `ref_*` as the writable vocabulary source (synced to `catalog_field_options`).
- Group the legacy inventory/production **UI** under the E9 legacy nav; don't delete the tables.

**Proof:** a deal line-item is created by picking a catalog category/product/variant (option_ids populated); catalog remains the single source for attributes/pricing; no FK breakage; legacy inventory still functions but is nav-grouped.

---

## Cross-cutting

- **Migrations** live in `supabase/migrations/` (`202607DD…`), applied to **staging** (`fyzrtqsnmnizoxgcqsjc`) via the Supabase Management API during the build; the full set replays at prod cutover (E8). Additive/idempotent (`IF NOT EXISTS`, `ADD COLUMN`).
- **Proof discipline** (per [feedback](../)): every epic proven by type-check (incl. agents app) + scripted DB/RLS checks + Playwright/unit where it fits, before the tasks-mcp task → `in-review`.
- **E0 perf** folded in: new deal/spine pages fetch server-side (RSC), cache session, avoid client waterfalls.
