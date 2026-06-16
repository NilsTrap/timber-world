# Deals MVP — overnight build handoff (2026-06-15)

Branch: `feature/deals-mvp` (uncommitted working tree — review with `git diff`, commit when happy).
Plan: `docs/deals-mvp-implementation-plan.md`. Decisions context: `docs/architecture-approach-2026-06-12.md`.

## What was built (vertical slice #1: intake → sales specification)

**Database** — `supabase/migrations/20260615000001_deals_mvp.sql` (additive only; does NOT touch `orders`):
`deals`, `deal_line_items` (sell/buy side), `deal_external_refs`, `deal_documents`, `deal_counters` + `next_counter()`, RLS mirroring orders, `deals.view` module, private `deal-documents` storage bucket.

**Service layer** (`apps/portal/src/features/deals/services/`) — shared `(db, actor, input)` functions:
- `dealsService` — create / get / list / update deals, replace line items, external refs (with idempotency).
- `numbering` — deal code `ENTITY+CLIENT3+SEQ`, doc numbers (sale vs purchase series), atomic counter allocation.
- `vat` — route-based VAT resolver (LV→LV reverse charge, GB→GB standard, intra-EU, export).
- `documents/` — jsPDF Sales/Purchase Specification renderer, amount-in-words, registry.
- `documentService` — assemble → number → render → store → record → signed URL.

**Callers (thin):**
- Server actions (`actions/`) — session→actor, `deals.view` gate, server client.
- **MCP endpoint** `app/api/timber-mcp/route.ts` — JSON-RPC; two-token auth (full/readonly); tools `timber_list_deals`, `timber_get_deal`, `timber_create_deal`, `timber_upsert_deal_line_items`, `timber_generate_document`; admin client; idempotency; Oscar Workflows v1 contract.

**UI** (`app/(portal)/deals/`, `features/deals/components/`) — list + create form, detail with DataEntryTable line items, generate spec, documents download; sidebar entry gated on `deals.view`.

## Verification done (programmatic, no live DB)
- ✅ `pnpm type-check` — full monorepo green (8/8).
- ✅ 27 unit tests (`features/deals/__tests__/run-tests.ts`, run via tsx) — numbering, VAT, amount-in-words, PDF render.
- ✅ Real sample PDF generated: `/tmp/sample-sales-specification.pdf` (valid PDF, 1 page).
- ✅ Live MCP contract (dev server, no DB): 401 on missing/bad token; initialize; tools/list full=5 tools / readonly=2 tools; readonly mutation refused; unknown method → -32601.
- ✅ `/deals` route serves (HTTP 200, no compile errors).
- ⛔ NOT done (human-gated): migration apply to a cloud DB, live UI E2E, Oscar registration — see below.

## Morning steps (human-gated — why they weren't done autonomously)
The repo's Supabase CLI is linked to **prod** (`psmra…`) and I won't read `.env.local` (secret) to learn the dev DB target, so I did not push migrations to any cloud DB or run live writes.

1. **Review the approach.** Key call to confirm/veto: I built a **new `deals` feature** (additive, safe) rather than extending the live `orders` feature. They reconcile later (orders = UK-stairs implementation; deals = universal model that absorbs it).
2. **Apply the migration to staging first** (mirrors prod): point the CLI at staging and `npx supabase db push`. Then prod when ready (additive → low risk).
3. **Env vars** on the portal deployment: `TIMBER_MCP_TOKEN_FULL`, `TIMBER_MCP_TOKEN_READONLY` (generate strong tokens), and ensure `SUPABASE_SERVICE_ROLE_KEY` is set (admin client / storage / signed URLs).
4. **Enable `deals.view`** for the org (or use a platform-admin login).
5. **Live E2E:** `/deals` → New deal → add line items → Generate Sales Specification → download PDF. Then `timber_create_deal` + `timber_generate_document` over MCP.
6. **Oscar side:** once the Timber Oscar instance is provisioned, register the `timber-mcp` endpoint (URL + the two bearers) and author the intake workflow (email/transcript → LLM → CRM org/person → timber_create_deal → timber_generate_document → approval).

## Open design questions for Edgars
- New `deals` vs extend `orders` (above).
- Numbering interpretations to confirm with Nils: deal code uses the sell-side customer; purchase documents get their own P-series; spec number is sequential per deal.
- Company-card field names: `documentService.fetchPartyCard` reads org fields defensively (multiple fallbacks) since the exact `organisations` / `organisation_details` columns vary — verify it picks up reg/VAT/address/bank on real data.
- VAT resolver is route-based; per-goods-group rates are a later refinement.

## Not mine
`scripts/seed_catalog_staging.{py,sql}` were already untracked in the working tree before this session — left untouched.
