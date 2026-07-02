# Timber Spec phase — handoff (2026-07-02)

Resume point for a **fresh-context session** continuing Nils's System Spec build (epics E0–E9).
Read this + the bus flag + the tasks board, then continue from **E6**.

## Where things are
- **Branch:** `feature/timber-spec-phase` (off `origin/main`), **pushed**. E0 plan → E1×2 → E2×2 → E3×3 → E4 (`328f1d4`) → E5 (`a0537e0`). `main`/prod untouched.
- **Staging DB** (`fyzrtqsnmnizoxgcqsjc`, Frankfurt): **all migrations applied** (`20260701000001`–`20260701000016`). Verified.
- **Staging portal APP:** the branch is **deployed** to `https://timber-portal-staging.vercel.app` (E5 deployment `9zorpf2ma`, staging Supabase). CLI deploy of the branch; NOT git-linked → redeploy = the swap→`vercel --prod`→restore dance (see below). Nils logs in with real prod email/password (staging mirrors prod).
- **Tasks board:** project `0d2f3a0a-0755-4274-9218-227812cc6083`. **E1–E5 = in-review** (Edgars to close). E6–E9 = todo. E0 (perf) folded into E8's region move. Two E5 subtasks (retire flat stairs table, decommission inventory) = **postponed** (import-gated, bundle with E8).
- **CI:** `NEGATIVE_TESTS_FAIL_ON_LEAK=true` repo var set — the rls-and-perf leak gate is enforced.

## Done — E5 · catalog consolidation (2026-07-02) → in-review
Migrations `...13`–`...16` (staging): `file` catalog field type + EAV file value columns + private `catalog-files` bucket; per-surface visibility (`visible_agents/internal/marketing`) on categories+products; `order_line_items.catalog_product_id/catalog_variant_id/is_standard` + `orders.margin_approved_at/by`; seeded firewood/boards/stairs categories + spec fields (slug-idempotent) + fields riser/stair_family/joint_type.
- **Canonical + consume:** `dealPricing.ts` `resolveCatalogLine` (EUR base / derived-currency cascade, unit from calc_method, attribute option-id resolution); the **Deal-tab catalog picker** (`DealPanel` + `DealLineAdder`): category→product→variant → auto-price (standard) or a custom per-deal line; populates `order_line_items.*_option_id` + catalog links. Owner margin-approval UI. File-field admin widget + EAV persistence. Category-scoped AI vocabulary + MCP `timber_get_category_fields`.
- **Steer (Edgars/Nils):** legacy inventory + `uk_staircase_pricing` stay **in parallel** — decommission gated on import-readiness (memory `project_e5_inventory_decommission`). The stairs catalog category is built alongside the flat table.
- **Proof:** type-check clean (portal+agents); 303 unit assertions (35 dealPricing + 70 tools-coverage); staging integration (resolver 11/11, m2 line-total 7/7). Adversarial review (4 lenses × refuters): **6 findings all fixed** — incl. a **critical field-wall bypass** (picker/custom/remove line-writes now require `deal_terms`-editable), the m2/linear_m line-total drop, and the preview double-multiply.
- **Needs Edgars/Nils feel-test:** the Deal tab "Add from catalog"/"Add custom" + margin approval; a `file` field on a catalog product; per-surface visibility hiding a category from the agents storefront.

## Done — E4 · group-and-rights access + field wall + bilateral RLS (2026-07-02) → in-review
Migrations `...09` (access_groups/rights/user_access_groups/platform_settings + organisations.is_supplier + 7 seeded system groups), `...10` (bilateral direction-aware RLS: `can_access_deal_row` replaces the 3-party predicate across orders/children/spines/gate-conf/organisations-shared-context; closes `order_files`/`order_activity_log`/orders-bucket `USING(true)` holes; scoped spine-INSERT policy), `...11` (user_modules→legacy-parity groups over the EFFECTIVE org∩user set), `...12` (review fix: legacy groups get both counterparty action rights). App: `lib/access` profile engine (`getUserEnabledModules` re-backed by groups; org ceiling ∩ ∪ group module rights; signature + 109 call sites unchanged), `dealFields.ts` field-wall registry+projection (replaces 3 stripPricing sites + PRODUCTION_EDIT_FIELDS + deal-view projection; deny-by-default), `features/counterparties` (walled books + `purchasing_may_reuse_clients`), Groups settings UI (`/admin/settings/groups`) + `UserGroupsDialog`, sidebar wiring (`requiresExactModule` for the two books).
- **Steer (Edgars):** global groups + per-org assignment; groups subsume modules; walls = buy-side pricing+supplier identity (vs Salesperson/Client), sell-side pricing+customer identity (vs Purchasing/Producer/Warehouse), margins/commissions admin-only.
- **Proof:** type-check clean (portal+agents); 198 unit assertions (69 access); staging negative probes **16/16 blocked** (salesperson can't read buy leg / supplier identity / buy-leg files; client sees only their deal; middle leg invisible to both ends); per-persona positive snapshots exact; migration module-parity 22/22. Adversarial review (4 lenses × refuters): **13 findings → all fixed + re-proven**.
- **E2/E4 bridge resolved:** RLS is bilateral seller+buyer now; the `customer==buyer` mirror on writes is retained ONLY to keep legacy list columns populated until the E8 data migration. `can_access_deal_row`'s `producer` arm is **transitional** (the 69 un-migrated 3-party orders) — remove it in E8.
- **Needs Edgars/Nils browser feel-test:** Settings → Access Groups (edit a group's field domains, watch a member's fields change with no deploy); a Salesperson login seeing only sell legs; the two Counterparties books walled.

## Done — E1, E2, E3 (each: migrations on staging, type-check clean, unit + real-DB integration tests, 3-lens adversarial review with every finding verified)
- **E1 · Spine** — `spines` + `spine_lineage` + `orders.spine_id` + `inventory_packages.spine_id`; `spines.ts` service (create/getSpine/product/Spec→Lot/split/merge/lineage/lot-link/rollup). 12/12 unit + SQL ops-smoke.
- **E2 · Bilateral deals + chains** — `orders.buyer_organisation_id` + `upstream_deal_id`; deal code `SELLER-BUYER-NNN`; `dealDirectionFor()` viewer-relative; every deal seeded onto a spine; **auto-spawn** the matching buy-leg on the same spine. 14/14 real-`createDeal` integration. Review: 2 fixed (orphan-spine, admin-only spine writes).
- **E3 · Lifecycle + gates** — `orders.lifecycle_stage` (Draft→Confirmed→Produced→Loaded→Delivered +Cancelled) alongside legacy `order_status`; `deal_gates` + `deal_gate_confirmations`; `lifecycle.ts` engine (nextStage / evaluateGate / rollupSpineStage / advanceDeal / cancelDeal / gate CRUD / confirmations); **spine rollup + chain_broken maintained by SECURITY DEFINER trigger** `trg_orders_spine_cache` (+ `_del`). UI: `DealPipeline`, `GateConfigManager`, `/admin/settings/gates`, `lifecycleActions.ts`. 29/29 unit + 15/15 + 14/14 integration. Review: 5 fixed (condition-gate data source, sign-off party-binding, advance TOCTOU, terminal-cancel guard, DELETE-rollup).

Design detail: `docs/spec-design-notes.md` + `docs/spec-implementation-plan.md` + commit messages.

## Deferred (on purpose)
- **E2 subtask `92903750`** — migrating the 69 existing staging orders into split bilateral deals + spines. Same op as the prod cutover and it churns Nils's UAT data → bundled into **E8** (which already tracks migration+prod rollout). Existing deals show stage **Draft** (backfilled) and have no spine until re-created.

## Needs Edgars/Nils (browser feel-test on staging)
- Deal → **Deal tab** → pipeline (advance / sign-off / cancel round-trips).
- **Settings → Deal Gates** (`/admin/settings/gates`) → configure a gate, watch it block/allow.

## NEXT: E6–E9 (todo)
- **E6 · documents** — in-app HTML editor (Plate) + Handlebars merge + Gotenberg render (Docker on VPS2/hetzner-openclaw2 behind Caddy+bearer) + Mammoth import; templates as open HTML in Supabase. NOTE: an interim jsPDF renderer + `DocumentGenerator` port already exist (`orders/services/documents/`); E6 swaps in the HTML-template + Gotenberg path.
- **E7 · MCP** extend the timber-mcp surface for spine/bilateral/lifecycle.
- **E8 · data migration + prod rollout** (incl. prod DB region move Ireland→Frankfurt; the E2 69-order migration; prod cutover). **PAUSE for Edgars before E8.**
- **E9 · consolidate legacy sections under one nav group.**

## Operational how-to (for the fresh session)
- **Apply a migration to staging:** `PAT=$(cat ~/.supabase-ijl/pat)` then `POST https://api.supabase.com/v1/projects/fyzrtqsnmnizoxgcqsjc/database/query` with `{"query": "<sql>"}` (jq `--rawfile`/`--arg`; never print the PAT). Staging ref `fyzrtqsnmnizoxgcqsjc`, prod `psmramegggsciirwldjz`.
- **Run unit tests** (from `apps/portal`): `../../tests/rls-and-perf/node_modules/.bin/tsx src/features/orders/services/__tests__/<name>.test.ts`. Type-check: `pnpm type-check`.
- **Real-DB integration test:** write a temp `apps/portal/_x.mts` importing `createAdminClient` from `@timber/database/admin` + the service fns; run with `NEXT_PUBLIC_SUPABASE_URL="https://$(cat ~/.supabase-ijl/staging-ref).supabase.co" SUPABASE_SERVICE_ROLE_KEY="$(cat ~/.supabase-ijl/staging-service-role-key)" ../../tests/rls-and-perf/node_modules/.bin/tsx _x.mts`; **delete it after** (keep the tree clean).
- **Redeploy the staging portal:** from repo root — back up `.vercel/project.json` → `vercel link --yes --project timber-portal-staging --scope nils-projects-ee818bb8` → `vercel --prod --yes --scope nils-projects-ee818bb8` → **restore** `.vercel/project.json` to `timber-world-portal`. Verify the alias serves the new deployment.
- **Run the rls-and-perf harness:** from `tests/rls-and-perf`, export `TEST_SUPABASE_URL=https://$(cat ~/.supabase-ijl/staging-ref).supabase.co`, `TEST_SUPABASE_ANON_KEY=$(cat ~/.supabase-ijl/staging-anon-key)`, `TEST_SUPABASE_SERVICE_ROLE_KEY=$(cat ~/.supabase-ijl/staging-service-role-key)`, then `tsx src/lib/seed.ts` (personas incl. E4 groups + chain fixture), `tsx src/run.ts --mode=baseline` (rewrite baselines after a schema/RLS change), `--mode=all` (0-diff + probes). **Auth rate-limits** on rapid re-runs — space sign-in-heavy runs ~2min apart (seeding is service-role, unaffected).
- **Discipline:** build → type-check → unit → real-DB integration → **adversarial-review Workflow** (lenses × refuters) → fix confirmed → commit (rollback unit) → mark tasks. Never claim done without programmatic proof.

## Session/tooling notes
- The **new bus MCP** + **improved tasks subtask-status API** are NOT loaded in the pre-restart session — they arrive with reloaded MCP servers. In the reloaded session, prefer whatever the bus MCP + tasks status-array provide; the file-based bus (`DEV/_agent-bus/active/nils-timber__timber-spec-phase.md`) is the current flag.
- Ultracode is ON → use the Workflow tool for substantive review/build fan-outs.
