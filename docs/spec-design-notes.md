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

## E4 — Group-and-rights + field-level wall + deal-level isolation (FINAL DESIGN 2026-07-01)

> Numbering note: earlier revisions of this file called the access epic "E3" and lifecycle "E4" — the plan's numbering (access = **E4**, lifecycle = E3, shipped) is authoritative. Code comments in `orderDeals.ts` / migration `20260701000004` saying "E3" mean THIS epic.

**Edgars's steer (2026-07-01):** (1) **global groups** (one platform-wide set, house-admin editable) with **per-org assignment** (a user gets a group per org membership); (2) v1 walls = buy-side pricing + supplier identity (vs Salesperson/Client), sell-side pricing + customer identity (vs Purchasing/Producer/Warehouse), margins/commissions admin-only; (3) **groups SUBSUME the module system in E4** — `user_modules` stops being read; module grants come from groups. `organization_modules` stays as the org-level ceiling; `getUserEnabledModules(portalUserId, orgId)` keeps its signature/caching (109 call sites untouched) but resolves **org ceiling ∩ (∪ modules of the user's groups in that org)**.

### Schema (all global-scope, additive)
- `access_groups` (`id`, `key` TEXT UNIQUE slug, `name`, `description`, `is_system` BOOL, `sort_order`) — **no organization_id**: groups are global per the steer.
- `access_group_rights` (`id`, `group_id` FK CASCADE, `right_type ∈ (module, action, visibility, field, scope)`, `resource` TEXT, `key` TEXT, `value` JSONB DEFAULT '{}', UNIQUE(group_id, right_type, resource, key)). One table for all right kinds:
  - `module` / `portal` / `<module_code>` — the subsumed module grants (incl. `orders.tab.*`).
  - `visibility` / `deal` / `side.sell` | `side.buy` | `legacy.producer` | `spine.status` — **row-level** deal access, org-relative (Salesperson=side.sell; Purchasing/Client=side.buy; Producer=side.sell + legacy.producer).
  - `visibility` / `deal_fields` / `<domain>` `{visible, editable}` — **field-domain** grants (see registry below).
  - `field` / `deal` / `<fieldKey>` `{visible, editable}` — per-field overrides; take precedence over the domain grant (this is what the DoD "hide one field in settings" edits).
  - `scope` / `deal` / `deals` = `"mine" | "company" | "all"` — mine = `created_by = current_portal_user_id()` (v1 definition), company = org is a leg party, all = everything (Super admin group only).
  - `action` / `counterparty` / `clients` | `suppliers` — address-book access (view+manage v1).
- `user_access_groups` (`user_id` FK portal_users, `organization_id` FK organisations, `group_id` FK, PK(user_id, organization_id, group_id)) — per-org assignment, multiple groups allowed (rights union).
- `organisations.is_supplier` BOOL (new flag; the supplier book = `is_supplier OR is_producer`; client book = `is_customer`).
- `platform_settings` (key TEXT PK, value JSONB) — `purchasing_may_reuse_clients` (default false), the spec §9.3 admin toggle.
- `user_modules` is NOT dropped (E8 cleanup) — migration `…011` maps each existing (user, org) effective set onto seeded groups where equal, else deterministic `legacy-set-N` groups, preserving exact access.

### RLS (the isolation wall)
- New helpers (SECURITY DEFINER STABLE, like existing): `current_user_has_right(org, type, key)` (rights union over the caller's groups in that org) and **`can_access_deal_row(seller, buyer, producer, created_by)`** — the single master predicate:
  `platform_admin OR (in_org(seller) AND right('visibility','side.sell') AND scope-ok) OR (in_org(buyer) AND right('visibility','side.buy') AND scope-ok) OR (in_org(producer) AND right('visibility','legacy.producer'))` — the producer arm is **transitional** for the 69 un-migrated legacy orders; removed in E8.
- Rewritten in lockstep (the complete 3-party inventory): `orders` ×4 policies, `can_access_order()` (children: line_items/external_refs/documents), `spines_select` + `spine_lineage_select` (+ require `spine.status` right for non-admins), `deal_gate_conf_select` (drop customer/producer arms), `current_user_shares_context_with_org` arm (b) → deal-access-aware and arm (c) → book-aware (a Salesperson stops seeing supplier org rows via raw PostgREST).
- **Close the open holes**: `order_files` + `order_activity_log` get `can_access_order(order_id)` policies (they are `USING(true)` today); `orders` storage bucket policies tightened same way.
- Spine seeding for portal users (deferred from E2): tightly-scoped INSERT policy — creator must be platform admin OR hold `action/deal/create` — resolves migration `…004`'s TODO.
- New indexes: `user_access_groups(user_id, organization_id)`, `access_group_rights(group_id)`, `orders(buyer_organisation_id, status)`.

### Field wall (app-layer projection; RLS has no column security)
- **Field→domain registry** (code, `dealFields.ts`): `general` (code/name/dates/volumes/specs/status/lifecycle — visible to anyone who can see the row), `deal_terms` (value/currency/advance/payment/delivery/incoterms + line-item prices — the leg's own commercial terms, shared by its two parties), `production` (the old PRODUCTION_EDIT_FIELDS + tread/winder/quarter m³), `margin` (`pl_*`, eur_per_m3 analytics — **admin-only per steer**), `financial_docs` (invoice numbers/payment dates), `logistics` (transport fields, package numbers), `customer_identity` / `supplier_identity` (party embeds beyond own leg), `chain` (spine_id/upstream_deal_id — admin-only v1).
- Resolution (pure fn): per-field override ▸ else its domain grant ▸ else `general`=visible, sensitive domains=hidden (**deny by default**, spec §1.4).
- Enforced at the choke points found in the census: `getOrders`/`getOrderPackages`/`getStaircaseCodes` (replaces the 3 duplicated `stripPricing` sites), `updateOrder` (replaces `PRODUCTION_EDIT_FIELDS`; editable-set from profile), `getOrderDealView` (line-item side + price projection), document generation (party cards obey identity domains). MCP service-agent path bypasses by design (Oscar is house-side).
- `getAccessProfile(portalUserId, orgId)` in `lib/access/` — one cached read (unstable_cache, tags `access-profile:<uid>:<oid>` + `access-group:<gid>` per member group so a group edit busts every member's profile). `getUserEnabledModules` reimplemented on top.

### Address books (spec §9.3)
- Client book = active orgs with `is_customer`; supplier book = `is_supplier OR is_producer`. Gated by `action/counterparty/clients|suppliers` rights → also exposed as module codes `counterparties.clients` / `counterparties.suppliers` (registered in `modules`, granted via groups) so nav/page gating rides the existing machinery.
- New `features/counterparties/` + `/counterparties/{clients,suppliers}` pages: list/create/edit org records (name, reg, VAT, address, 3-letter code…) for non-admin house staff — org CRUD is admin-only today, so this is a new, rights-scoped surface. `purchasing_may_reuse_clients` setting controls whether the supplier flow may select/see client records.
- Walls proven at both layers: actions filter by book + right; RLS shared-context rewrite (above) keeps supplier org rows out of a Salesperson's raw reads.

### Seeded groups (all editable in-app; house-relative, direction rights are org-relative so the same keys work for counterparty logins)
| Group | modules | side | domains (v=visible, e=editable) | scope | books |
|---|---|---|---|---|---|
| Super admin | all | both+producer | all v+e | all | both |
| Salesperson | dashboard, orders(+list/sales/prices tabs), counterparties.clients | sell | general, deal_terms, financial_docs, logistics v; customer_identity v | company | clients |
| Purchasing | dashboard, orders(+list tab), counterparties.suppliers | buy | general, deal_terms, financial_docs, logistics v; supplier_identity v | company | suppliers |
| Client | orders(+list tab) | buy | general, deal_terms, logistics v | company | — |
| Producer | orders(+list/production tabs) | sell + legacy.producer | general, deal_terms, logistics v; production v+e | company | — |
| Accounting | dashboard, orders(+list/sales tabs) | both | general, deal_terms v; financial_docs v+e | company | — |
| Warehouse | orders(+list tab), shipments, inventory | both | general, logistics v+e | company | — |

Margin/`pl_*` fields: **no group** — platform admins only (steer #3). Buy-leg pricing is hidden from Salesperson/Client **row-level** (side rights), not field-level — the middle leg is structurally invisible to both ends.

### Settings UI (in-app, no deploy)
- `/admin/settings/groups` (admin-only, GateConfigManager pattern): group list → rights editor (module toggles reusing the category UI, side/domain/scope pickers, per-field override table) + seed-reset for system groups.
- `OrganisationUsersTable`: "Modules" dialog replaced by **UserGroupsDialog** (assign groups per user per org). `OrganisationModulesTab` (org ceiling) stays.
- Every mutation busts the matching cache tags → takes effect within a request (DoD: change in app, no deploy).

### Proof (extends DoD)
Unit: pure rights/field resolution + projection parity with the old strip lists. Staging integration: seeded-group personas exercise create/read paths. rls-and-perf: new personas (`house-sales`, `house-purchasing`, `client-user`) + negative probes — salesperson selects buy leg → 0 rows; client selects another client's deal → 0 rows; middle leg invisible to both ends; org off both legs → 0; salesperson reads supplier org row → blocked; regenerate committed baselines; flip `NEGATIVE_TESTS_FAIL_ON_LEAK=true`. Browser feel-test for Edgars/Nils listed on the bus flag.

---

## E3 — Lifecycle + configurable gates (SHIPPED 2026-07-01 as E3)

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
