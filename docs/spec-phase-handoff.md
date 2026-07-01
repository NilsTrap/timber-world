# Timber Spec phase — handoff (2026-07-01)

Resume point for a **fresh-context session** continuing Nils's System Spec build (epics E0–E9).
Read this + the bus flag + the tasks board, then continue from **E4**.

## Where things are
- **Branch:** `feature/timber-spec-phase` (off `origin/main`), **pushed**. 8 commits: E0 plan → E1×2 → E2×2 → E3×3. `main`/prod untouched.
- **Staging DB** (`fyzrtqsnmnizoxgcqsjc`, Frankfurt): **all migrations applied** (`20260701000001`–`20260701000008`). Verified.
- **Staging portal APP:** the branch is **deployed** to `https://timber-portal-staging.vercel.app` (deployment `n5qj5ko22`, ● Ready, staging Supabase). CLI deploy of the branch; NOT git-linked → redeploy = the swap→`vercel --prod`→restore dance (see below). Nils logs in with real prod email/password (staging mirrors prod).
- **Tasks board:** project `0d2f3a0a-0755-4274-9218-227812cc6083`. **E1/E2/E3 = in-review** (Edgars to close). E4–E9 = todo. E0 (perf) folded into E8's region move.

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

## NEXT: E4–E9 (todo)
- **E4 · group-and-rights access + field-level visibility wall + deal isolation** (the RLS/permissions epic; hides the middle leg). Design-heavy — worth a short steer from Edgars on the group→org model + which fields are walled. NOTE: E2 left a bridge — the auto-spawned buy-leg mirrors legacy `customer_organisation_id = buyer` so it stays visible under today's 3-party orders RLS **until E4 rewrites RLS to seller+buyer**. (Code comments in `orderDeals.ts` / migration `...04` say "E3" for this — a naming slip; it's E4.)
- **E5 · catalog consolidation** (canonical catalog + UI; legacy inventory NOT hard-dropped — 14+ FKs + live feature).
- **E6 · documents** — in-app HTML editor (Plate) + Handlebars merge + Gotenberg render (Docker on VPS2/hetzner-openclaw2 behind Caddy+bearer) + Mammoth import; templates as open HTML in Supabase.
- **E7 · MCP** extend the timber-mcp surface for spine/bilateral/lifecycle.
- **E8 · data migration + prod rollout** (incl. prod DB region move Ireland→Frankfurt; the E2 69-order migration; prod cutover). **PAUSE for Edgars before E8.**
- **E9 · consolidate legacy sections under one nav group.**

## Operational how-to (for the fresh session)
- **Apply a migration to staging:** `PAT=$(cat ~/.supabase-ijl/pat)` then `POST https://api.supabase.com/v1/projects/fyzrtqsnmnizoxgcqsjc/database/query` with `{"query": "<sql>"}` (jq `--rawfile`/`--arg`; never print the PAT). Staging ref `fyzrtqsnmnizoxgcqsjc`, prod `psmramegggsciirwldjz`.
- **Run unit tests** (from `apps/portal`): `../../tests/rls-and-perf/node_modules/.bin/tsx src/features/orders/services/__tests__/<name>.test.ts`. Type-check: `pnpm type-check`.
- **Real-DB integration test:** write a temp `apps/portal/_x.mts` importing `createAdminClient` from `@timber/database/admin` + the service fns; run with `NEXT_PUBLIC_SUPABASE_URL="https://$(cat ~/.supabase-ijl/staging-ref).supabase.co" SUPABASE_SERVICE_ROLE_KEY="$(cat ~/.supabase-ijl/staging-service-role-key)" ../../tests/rls-and-perf/node_modules/.bin/tsx _x.mts`; **delete it after** (keep the tree clean).
- **Redeploy the staging portal:** from repo root — back up `.vercel/project.json` → `vercel link --yes --project timber-portal-staging --scope nils-projects-ee818bb8` → `vercel --prod --yes --scope nils-projects-ee818bb8` → **restore** `.vercel/project.json` to `timber-world-portal`. Verify the alias serves the new deployment.
- **Discipline:** build → type-check → unit → real-DB integration → **adversarial-review Workflow** (3 lenses × verify) → fix confirmed → commit (rollback unit) → mark tasks. Never claim done without programmatic proof.

## Session/tooling notes
- The **new bus MCP** + **improved tasks subtask-status API** are NOT loaded in the pre-restart session — they arrive with reloaded MCP servers. In the reloaded session, prefer whatever the bus MCP + tasks status-array provide; the file-based bus (`DEV/_agent-bus/active/nils-timber__timber-spec-phase.md`) is the current flag.
- Ultracode is ON → use the Workflow tool for substantive review/build fan-outs.
