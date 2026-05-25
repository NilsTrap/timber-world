# Production rollout plan — `IJL/security-and-performance` → `main`

**Branch:** `IJL/security-and-performance`
**Staging URL (uses staging Supabase, identical schema):** https://timber-world-portal-ijl-secperf.vercel.app
**Production URL (Nils's daily-use):** https://timber-world-portal.vercel.app

This document covers the merge sequence, the user-visible changes Nils will experience, the rollback paths, and the things to do before and after the cut.

---

## What's in the rollout

### Performance — measurable on every page load
- **Vercel region moved iad1 → fra1** (Frankfurt). Single biggest perf win — TTFB drops from ~1.6 s to ~80 ms on EU traffic. Applies to prod automatically when the next deploy happens. Nils will feel this immediately.
- Server actions parallelized: `getOrgUserPackages`, `getAuditPackages`, `getOrders`, `getProcesses`, `getProcessesWithNotes`.
- Suspense boundaries on dashboard / inventory / orders — header paints immediately, data streams in.
- Heavy dialogs (`PasteImportModal`, `OutputPasteImportModal`, `AddUserDialog`, `UserModulesDialog`) load on click rather than with the page.
- Sidebar hover-only prefetch (eliminates 12-26 background RSC requests per nav).
- `unstable_cache` on `getUserEnabledModules` / `getOrgEnabledModules` with tag invalidation on admin module changes.
- 3 composite indexes on `orders` (customer/seller/producer × status).
- `OrdersPageClient` constant arrays lifted out of render.

### Security — RLS on every multi-tenant table
Before this work: **RLS was not enabled on any of the multi-tenant tables**. Any authenticated user could read or modify any row in `orders`, `inventory_packages`, `shipments`, `portal_production_entries`, etc. The `project-context.md` claim that "RLS filters all queries" was inaccurate — it described intent, not reality.

After this work, every table in `public.` has RLS:
- Data tables (orders, inventory, shipments, production): membership in customer/seller/producer/owning org, or platform admin.
- Auth + permission tables (portal_users, organisations, memberships, modules, user_modules, organization_modules): own row + platform admin + same-org peers where appropriate.
- Reference tables (ref_*, module_presets): read by any authenticated user, write platform admin only.
- Child tables (production_inputs/outputs/lines, shipment_pallets, order_shipments): cascade via parent visibility.
- Audit log, CRM, legacy: appropriate scope per table.

Server actions that need to bypass RLS (cross-org operations, admin scripts) continue to use the service-role client, which is unaffected by these policies.

### Other
- Hardcoded `nils@nils.lv` recipient → `RESEND_TO_EMAIL` env var with current value as fallback.
- 5 data-import migrations (`20260125183550`, `20260208100000`, `20260209000002`, `20260405000022`, `20260405000025`, `20260405000026`) guarded so they no-op on DBs that don't have the prerequisite seed data. Production is unaffected — those migrations are already recorded as applied there.
- Test harness in `tests/rls-and-perf/` + GitHub Actions CI workflow.

### What's intentionally NOT in this rollout
- C7 (move `useEffect` tab fetches to server) — would require restructuring `ProductionPageTabs` and `OrgUserInventoryPageContent`; defer to a follow-up.
- C9 (pagination on list endpoints) — defer until data volume warrants.
- Service-role key rotation / scraper push API (separate audit finding) — defer to a follow-up branch.
- `validateProduction.ts` unit tests (separate audit finding) — defer to a follow-up branch.

These remain as items in `docs/timber-world-audit/`. They don't block this rollout.

### Diagnostic instrumentation to remove
The `PerfDebugger` client component and the `[PERF-SRV]` console logs in `proxy.ts` + `perfLog()` wrappers in page.tsx files are intentionally still in the branch for the UAT window. **Remove before merging to main** — one revert commit:

```bash
git checkout IJL/security-and-performance
# Find the instrumentation commits
git log --oneline | grep -E 'diag:'
# Remove the PerfDebugger import + mount from apps/portal/src/app/(portal)/layout.tsx
# Remove apps/portal/src/components/debug/PerfDebugger.tsx
# Remove apps/portal/src/lib/debug/perfLog.ts
# Remove the perfLog() wraps in dashboard/orders/inventory page.tsx
# Remove the [PERF-SRV] console.log + Server-Timing header in proxy.ts
```

---

## Pre-rollout checklist

| ☐ | Item |
|---|---|
| ☐ | Edgars: final pass on staging URL, verify nothing feels broken |
| ☐ | Edgars: drop the diagnostic instrumentation commit (PerfDebugger + perfLog wrappers + proxy.ts logging) |
| ☐ | Edgars: open PR `IJL/security-and-performance` → `main`, paste this plan into the description |
| ☐ | Nils: pull staging URL credentials (`test-admin@ijl.test` / `IjlTestAdmin!9417zk`), do his own UAT pass for an hour |
| ☐ | Nils: confirm rollout window (recommend low-traffic time of day; can be done within minutes if needed) |

---

## Rollout sequence

Order matters. The migrations have to land on prod DB **before** the merged code starts running, otherwise the app will crash on policies it expects but doesn't have.

### Step 1 — apply migrations to production Supabase
From a clean shell linked to prod (`npx supabase link --project-ref psmramegggsciirwldjz`):
```bash
npx supabase db push --linked
```
Migrations that will be applied (in order):
- `20260522000001_orders_perf_indexes.sql` (additive; index-only)
- `20260522000002_rls_helpers.sql` (helper functions; no behavior change yet)
- `20260522000003_rls_orders.sql` (RLS on orders)
- `20260522000005_rls_inventory_shipments_production.sql`
- `20260522000007_rls_auth_permissions.sql`
- `20260522000009_rls_remaining_tables.sql`

The `.sql.disabled` rollback files are skipped by the migration runner.

**Verification after this step:** any authenticated user using the prod URL should immediately see only their own org's data. Platform admins (Nils) see everything as before. If something is broken, jump to "Rollback" below.

### Step 2 — merge the PR
Once Nils confirms the migrated production still works for him:
```bash
git checkout main
git merge IJL/security-and-performance
git push origin main
```
Vercel auto-deploys `main` to `https://timber-world-portal.vercel.app`. The region change to `fra1` takes effect on this deploy.

### Step 3 — monitor
First 30 minutes:
- Edgars watches Vercel function logs for anomalies.
- Nils tries his usual workflows and reports any oddity.
- The CI workflow (added in this branch) runs against staging on every push — confirms snapshot+negative tests still pass.

### Step 4 — celebration / next steps
Once monitoring window passes cleanly:
- Delete the staging Supabase project (`fyzrtqsnmnizoxgcqsjc`) if you don't want to keep paying for it. Schema lives in the migrations; we can recreate any time.
- Or keep it — it remains useful for the deferred follow-ups (C7, pagination, scraper API, validateProduction tests).

---

## Rollback paths

### If RLS breaks something on prod (most likely place for surprises)
Each RLS cluster has a paired `.sql.disabled` rollback file. To revert any cluster:
```bash
cd supabase/migrations
mv 20260522000004_rls_orders_rollback.sql.disabled 20260522000004_rls_orders_rollback.sql
npx supabase db push --linked
mv 20260522000004_rls_orders_rollback.sql 20260522000004_rls_orders_rollback.sql.disabled
```
Reverts that one cluster only; other clusters stay protected. Takes ~10 seconds.

Available rollback files:
- `20260522000004_rls_orders_rollback.sql.disabled` — orders only
- `20260522000006_rls_inventory_shipments_production_rollback.sql.disabled` — clusters 2+3
- `20260522000008_rls_auth_permissions_rollback.sql.disabled` — cluster 4 (auth)
- `20260522000010_rls_remaining_tables_rollback.sql.disabled` — cluster 5

### If the merged code itself has a regression
Revert the merge commit on `main`, push, Vercel auto-redeploys the previous code:
```bash
git checkout main
git revert -m 1 <merge-sha>
git push origin main
```
Migrations stay applied — they're additive (indexes + RLS policies). The reverted code works fine alongside them.

### If you want to fully back out
Revert the merge as above + apply ALL rollback migrations to remove RLS + the region setting reverts on the next deploy from main (if you also reset the region via Vercel API or dashboard).

---

## What changes for Nils on day-one

**The big visible thing:** the platform should feel ~10× faster on every page. The Vercel region move alone accounts for most of that, but the Suspense / parallelization / dialog-splits compound.

**The big invisible thing:** the database now actually enforces multi-tenancy. Today his single tenant (Timber International) sees the same data as before. The moment a second tenant exists, they're properly isolated at the DB level — not just by application convention.

**Things that should feel identical:**
- All workflows (creating orders, recording production, managing shipments, etc.).
- All admin operations (org management, user management, module assignment).
- The login flow.
- Reports, exports, and dashboards.

**Things that will be slightly different but acceptable:**
- The sidebar takes a moment to "warm up" the page when you hover a link (50-150 ms). After the first hover on each link, the prefetch is cached and clicks feel instant.
- Admin-only operations on tables like the audit log, CRM, internal counters now reject non-admin attempts at the DB level (previously they relied on the app filtering correctly).

---

## What's been measured

| Page | Pre-fix (iad1) | Post-fix (fra1, all perf+RLS) | Change |
|---|---:|---:|---:|
| `/dashboard` TTFB | 1646 ms | 78 ms | **21×** |
| `/dashboard` FCP | 5452 ms | 608 ms | **9×** |
| `/dashboard` LCP | 8552 ms | 928 ms | **9×** |
| `/dashboard` Load | 10052 ms | 962 ms | **10×** |

Cross-tenant negative probes:
- Before RLS: 2 probes leaked (orders.read, orders.insert).
- After RLS (all 5 clusters): 8 probes, 0 leaked.

Snapshot diff vs baseline: 0 differences. Legitimate access is unchanged.

---

## Open follow-ups (separate work)

Tracked in `docs/timber-world-audit/audit-findings-preview.md`:
- Service-role key reduction (scraper-push API)
- `validateProduction.ts` unit test coverage
- Pagination on list endpoints
- ProductionPageTabs / OrgUserInventoryPageContent restructure (C7)
- `OrdersTable.tsx` decomposition along tab boundaries
- Centralised volume / number formatting (`@timber/utils`)
- Marketing sitemap / robots.txt

These are real items but don't block this rollout.
