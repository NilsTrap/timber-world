# Oscar-integration phase — session handoff (2026-06-16)

Resume point for a fresh session. **Read first:** the approved master spec at
`~/.claude/plans/vast-drifting-token.md` (all 8 resolved decisions, epics E1–E7,
Oscar-side deps, task split, verification). This doc is just the current state +
how to continue.

## Where we are
- **Branch:** `feature/oscar-integration-phase` (rebased on latest main, which brought the portal-wide dense-table restyle). Working tree clean.
- **Commits done + verified (portal type-check green, 27 unit tests green):**
  1. `94221b2` — orders-universal **schema** (`supabase/migrations/20260616000001_orders_universal.sql`): `order_line_items` (attribute-driven, `*_option_id` → `catalog_field_options` + text fallback), `order_external_refs`, `order_documents` (Timber-side doc storage), universal deal fields on `orders` (deal_kind, product_group, incoterms(+place), advance_pct, payment/delivery terms, delivery_deadline, transport_billing, deal_code), `can_access_order()` + RLS. Reuses `next_counter`/`deal_counters` + `deal-documents` bucket from the deals build.
  2. `86d94c0` — order-deal **data layer**: `features/orders/services/{dealModel,numbering,vat,orderDeals}.ts` + `__tests__/deal-numbering.test.ts`.
  3. `da934a1` — **E1.1** Settings area: new top-level **Settings** sidebar group (neutral slate, gated `settings.view`); moved Fields/Packaging/Pricing-Units from `/admin/catalog/*` → `/admin/settings/*` with `next.config` redirects; migration `20260616000002_register_settings_module.sql`. Categories/Products/Currencies stay under Catalogue. Removed dead `CatalogLayout.tsx`.
  4. `8c101fa` — **E1.2** `features/catalog/services/attributes.ts` (listDefinitions/getOptions/saveOption + pure mappers, 10 tsx tests) + read-only MCP tools `timber_get_attribute_definitions` / `timber_list_attribute_options`.
  5. `736a7cb` — E1.1 **review fix** (adversarial review): the field/packaging/pricing-unit *actions* accept `settings.view OR catalogue.view` (catalog pages still read this data), so the Settings *pages* + sidebar item now also accept either module — otherwise a non-admin `catalogue.view`-only org user lost the only path to those pages. Added `requiresAnyModule` (OR) nav support.
- **E1 DEPLOYED + SELF-TESTED ON STAGING (2026-06-16):** migrations `20260616000001`+`20260616000002` pushed to staging DB (`fyzrtqsnmnizoxgcqsjc`), PostgREST reloaded, links restored to prod. Verified: old `/admin/catalog/{fields,packaging,pricing-units}` 307→`/admin/settings/*`; new routes auth-gated (not 404); MCP `timber_get_attribute_definitions` returns 10 defs from real data, `timber_list_attribute_options('processing')` returns 12 options, unknown-key → isError, read-only token sees both attribute tools and not the mutation tools. **Not pushed to `main`/remote** (branch-local per build rules).

## What's NOT done yet (continue in this order — from the plan's task split)
1. **E2.3+E2.4** — wire numbering into order create; **retire the deals feature** (salvage already done — the canonical services now live under `features/orders/services`): delete `features/deals`, `app/(portal)/deals`, drop `deals*` tables via a new migration (keep `deal_counters`/`next_counter`/`can_access_deal`); re-point/extend the MCP route off deals onto orders. Unify nav to one entry (recommend UI label **"Deals"** backed by `orders`; the emerald sidebar group already exists). NOTE: the MCP route still imports `features/deals/services/{dealsService,documentService}` — E2.4 re-points these onto the orders services.
2. **E3** — document data-assembly service (payload from order + line items + party company-card + totals + VAT + amount-in-words + allocated number) + **generation port** (interim local jsPDF adapter — salvage `features/deals/services/documents/*` renderers — / Oscar-MCP adapter) + store in `order_documents` + bucket + **wire universal line-items + documents into the orders detail UI** (a new tab; UK-stairs tabs untouched).
3. **E4** — rename "Users" → **"Orgs & People"**; add `crm_org_id`/`crm_synced_at` to `organisations`; extend create-org with the company card; `services/crm/oscarCrm.ts` (config-gated stub; Oscar `/api/crm-mcp`); thin cache + import picker; org MCP tools.
4. **E5** — complete the Timber MCP surface (every lifecycle step a tool) + **MCP-coverage check**.
5. **E1.3** — converge `ref_*` → views (independent; grep for external writers first).
6. **E6** — Oscar-side (gated on the Timber Oscar instance + Oscar dev agent): general doc-generation MCP tool, MCP registration, AI intake + doc-chasing workflows.

## Salvage status (deals → orders)
The model-agnostic services were **re-created** under `features/orders/services/` (numbering, vat, dealModel). Still to salvage from `features/deals/services/`: `documents/*` (amountInWords, specification renderer, types, registry) and the `documentService`/MCP route logic — move/adapt onto orders during E3/E5, then delete `features/deals` + `app/(portal)/deals` + the deals MCP route in E2.4.

## Build rules (from Edgars, this phase)
- **MCP completeness:** every deterministic step ships its MCP tool in the same task — no UI-only mutations. Verify with an MCP-coverage check.
- **Shared service layer:** UI actions + MCP are twin thin callers.
- **Deploy a user-testable staging version ONLY after self-testing** (type-check + unit tests + MCP contract + a real exercise). Don't ship untested.
- Keep each increment green + committed (commits allowed on this branch; **no push** unless asked).

## Verify + deploy mechanics (proven this phase)
- Type-check: `pnpm --filter @timber/portal type-check`. Unit tests: `apps/portal && ../../tests/rls-and-perf/node_modules/.bin/tsx <test>` (no global tsx).
- **Staging DB** (`fyzrtqsnmnizoxgcqsjc`): migrate via PAT-auth CLI without echoing secrets — backup `supabase/.temp`, `SUPABASE_ACCESS_TOKEN="$(cat ~/.supabase-ijl/pat)" npx supabase link --project-ref fyzrtqsnmnizoxgcqsjc -p "$(cat ~/.supabase-ijl/staging-db-pass)"`, `... db push`, then restore `supabase/.temp` to prod. Reload PostgREST cache via Management API `notify pgrst, 'reload schema'`.
- **Staging portal** (`timber-portal-staging.vercel.app`, project `timber-portal-staging`, team `nils-projects-ee818bb8`): backup root `.vercel/project.json`, `vercel link --project timber-portal-staging --scope nils-projects-ee818bb8 --yes`, `vercel --prod --yes --scope nils-projects-ee818bb8`, restore `.vercel/project.json`. MCP tokens already set on staging (`~/.supabase-ijl/timber-mcp-staging-tokens`).
- Edgars tests as platform admin with his real (mirrored) prod login.

## Open questions (defaults in the plan; non-blocking) — and Nils still owes
Deal-code exact algorithm, `KIN-####` series, P+5-digit client refs, per-product CMR density. Build behind the swappable numbering service + a small density map.
