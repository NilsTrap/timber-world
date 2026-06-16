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
  6. `9248c4f` — **E2.3/E2.4** retire deals onto orders: `orderDeals.createDeal`/`listDeals` (+ `mapOrderDealHeader`/`OrderDealSummary`); deal_code allocated at create (numbering wired in); MCP re-pointed off `features/deals` onto `features/orders` (list/get/create/upsert + new `timber_allocate_deal_code`); doc renderers salvaged to `features/orders/services/documents/`; **deleted `features/deals` + `app/(portal)/deals` + the `/deals` sidebar entries**; `timber_generate_document` de-registered (rebuilt on orders in E3).
  7. `affb994` — **E2.4** migration `20260616000003_drop_deals_tables.sql`: drops `deals`/`deal_line_items`/`deal_external_refs`/`deal_documents`; KEEPS `deal_counters`+`next_counter()` (numbering), `deals_set_updated_at()` (reused by the order_line_items trigger), `can_access_deal()`, the `deal-documents` bucket.
  8. `430a2ac` — **E2 review fix**: `createDeal` now derives a non-null `name` (`orders.name` is NOT NULL — MCP creates were failing); `timber_list_deals` status vocab fixed to the real `order_status` enum + `listDeals` whitelists status (no `quoted`).
  9. `d1d8249` — **E3.1/E3.2** documents: `documents/assemble.ts` (pure `buildDocumentData` + 25 tests), `orderDocuments.ts` (`assembleDocumentData` + `generateDocument` + `getDocumentUrl`; party company-cards via flexible key fallbacks; stores in `order_documents` + `deal-documents` bucket), `documents/port.ts` (DocumentGenerator port: `localJsPdf` interim / `oscarMcp` env-gated stub), interim renderer routes all 7 types through the generic spec renderer; MCP `timber_get_document_data` + re-registered `timber_generate_document`; `document-render.test.ts` (pdf-lib, 35).
  10. `fe6334c` — **E3.3** order-detail **Deal tab** (`DealPanel.tsx` + local Order/Deal toggle in `OrderDetailClient`): deal summary + read-only line items + documents (generate/download). Thin actions `dealActions.ts` + `_dealActor.ts`. **(NOTE:** this commit also swept up the nav agent's `Store,ChevronDown` SidebarLink imports — harmless.)
  11. `69b247d` — **(other agent)** nav consolidation: "UK Agent app" collapsible sidebar group + Catalogue→on-page tabs. Cleanly layered; not part of the integration epics.
  12. `b7294f2` — **E3 review fix** (3 low-sev): `lineTotalCents` contributes 0 (not phantom qty-1) when a unit's quantity is missing; MCP doc tools validate `side`; DealPanel row/footer use the shared `lineTotalCents` so table=PDF.
- **E1 + E2 + E3 DEPLOYED + SELF-TESTED ON STAGING (2026-06-16) @ `b7294f2`:** all migrations on staging (`fyzrtqsnmnizoxgcqsjc`). E3 verified live: `timber_create_deal` → `timber_get_document_data` (Spec No 1, subtotal 90000, amount-in-words) → `timber_generate_document` (Spec No 2, local-jspdf) → **downloaded PDF HTTP 200 / %PDF / 8135 bytes**; `side:"garbage"` rejected. Deploy coordinated with the nav agent via `DEV/_agent-bus` (one deploy, no race). **Not pushed to `main`/remote.** Outstanding human UAT: visual click-through of the Deal tab + the new "UK Agent app" sidebar (login required).

## What's NOT done yet (continue in this order — from the plan's task split)
1. **E4** — rename "Users" → **"Orgs & People"**; add `crm_org_id`/`crm_synced_at` to `organisations`; extend create-org with the company card; `services/crm/oscarCrm.ts` (config-gated stub; Oscar `/api/crm-mcp`); thin cache + import picker; org MCP tools.
2. **E5** — complete the Timber MCP surface (every lifecycle step a tool) + **MCP-coverage check**.
3. **E1.3** — converge `ref_*` → views (independent; grep for external writers first).
4. **E6** — Oscar-side (gated on the Timber Oscar instance + Oscar dev agent): general doc-generation MCP tool, MCP registration, AI intake + doc-chasing workflows.

### Deferred fast-follows (flagged, not blocking)
- **E3.3b** — in-UI **editing** of universal line items (attribute-driven dropdowns from the attributes service, save via `replaceLineItems`). DealPanel currently shows line items **read-only**; in the live flow they arrive via Oscar intake/MCP. Add when a manual line-item editor is wanted.
- **Oscar doc generator (E6)** — flip `getDocumentGenerator()` to `oscarMcp` via `OSCAR_DOCGEN_ENABLED`+`OSCAR_MCP_URL` and implement `oscarMcpGenerator.generate` once the Oscar instance + general doc tool exist. The interim local renderer (all 7 types via the generic spec layout) is the stopgap.

## Salvage status (deals → orders) — DONE
All model-agnostic services live under `features/orders/services/` (numbering, vat, dealModel, orderDeals); the PDF **renderers** are at `features/orders/services/documents/` and the **data-assembly + generation port + storage** (`assemble.ts`, `port.ts`, `orderDocuments.ts`) are built on top (E3). `features/deals` is **deleted**. Optional/deferred: rename the **Orders** nav label to "Deals" (+ emerald grouping) — cosmetic, left as "Orders" for now.

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
