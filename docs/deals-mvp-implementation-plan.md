# Deals MVP — implementation plan (vertical slice #1)

Branch: `feature/deals-mvp`. Author: overnight autonomous build, 2026-06-15.
Scope agreed with Edgars: single trading entity (Timber International), universal deal model, the mechanical slice — messy input → proposal/spec/contract + CRM records → pipeline progress → generated docs + drafted emails. "See small simple workflows work first."

## Architecture (matches what we told Nils)
- **Shared service layer**: business logic lives in `features/deals/services/*` as pure-ish functions taking `(db, actor, input)`. Both callers are thin:
  - **Portal UI** → `features/deals/actions/*` ("use server") resolve session → actor, permission-check, call services with the server client.
  - **Oscar agent** → `app/api/timber-mcp/route.ts` (JSON-RPC) authenticates a bearer → service actor, calls the same services with the admin client.
- One source of truth, auth enforced at the caller boundary, MCP is a thin wrapper.
- New `deals` feature is **additive** and does not touch the live `orders` feature. Orders (UK-stairs-shaped) and Deals (universal) reconcile later — documented, not done now.

## Database (`supabase/migrations/20260615000001_deals_mvp.sql`) — additive only
- `deals` — code, seller/customer/producer org, deal_kind, product_group, currency, incoterms(+place), advance_pct, payment/delivery terms, delivery_deadline, status, notes, created_by, timestamps. One deal carries a **sell side** (customer) and **buy side** (producer) — the buy/sell seam.
- `deal_line_items` — deal_id, line_no, **side** (sell|buy), product/species/humidity/processing/quality/grade_note, thickness/width/length, pieces, volume_m3, unit, unit_price_cents, vat_rate, line_total_cents. Universal multi-row.
- `deal_external_refs` — client-supplied codes (project / job / PO) shown on documents.
- `deal_documents` — doc_type, doc_number, side, status, storage_path, file_name, payload(jsonb snapshot), generated_by.
- `deal_counters` + `next_counter(scope)` — atomic sequential allocation; scope keys build deal codes & doc numbers (purchase ≠ sale series).
- RLS on all tables (platform admin OR member of seller/customer/producer org; children via parent deal). Service-role bypasses.
- `modules` row `deals.view`.

## Numbering (Nils's confirmed rules)
- Deal code: `{ENTITY}{CLIENT3}{SEQ}` (e.g. `TIMSOM001`), **separate buy vs sell**.
- Docs: sales contract `S-YYYYMMDD`(+`-n` same day), purchase `P-YYYYMMDD`, spec sequential, invoices `TWG####`. Built in `services/numbering.ts` (pure formatters, unit-tested) + atomic counter in SQL.

## Documents (jsPDF + autotable — matches repo's existing PDF approach; no headless chromium on Vercel)
- `services/documents/salesSpecification.ts` — full render (seller card, buyer, line items, totals, terms, deal+spec number). **Implemented tonight.**
- Scaffold (`documents/types.ts`, registry) so purchase spec / contract / invoice / packing list / CMR slot in next.
- VAT: `services/vat.ts` — pure rule resolver (LV→LV, LV→UK out-of-EU, LV→SE intra-EU, UK→UK) with legal reference text. Per goods group later.
- Transport cost: supported as in-price or separate line/invoice (deal/line flags).

## MCP (`app/api/timber-mcp/route.ts`) — Oscar Workflows v1 contract (§3/§4)
- JSON-RPC: initialize / tools/list / tools/call. Bearer auth, **two tokens** (full vs read-mostly) → role.
- Tools: `timber_list_deals`, `timber_get_deal` (read), `timber_create_deal`, `timber_upsert_deal_line_items`, `timber_generate_document` (mutations, full only).
- Flat schemas, real descriptions, `_list/_get` read-naming, idempotency key on create, returns created ids. Output JSON string, 500KB-aware, fast side-effect-free tools/list.

## UI (`app/(portal)/deals/`)
- List page + create form; detail page with line-items DataEntryTable + "Generate Sales Specification". Sidebar entry gated on `deals.view`. Uses @timber/ui PageHeader/Summary/etc.

## Testing (programmatic, no live DB needed)
- `pnpm type-check` (CI gate) must pass.
- tsx unit tests: `numbering`, `vat`, sales-spec PDF render (writes a real PDF artifact + validates `%PDF`/pages).
- MCP contract test: `tools/list` shape + auth rejection.
- A real sample Sales Specification PDF generated from fixtures and sent to Edgars.

## Deferred to human (morning) — cannot do safely autonomously
- Apply migration to a cloud DB (CLI is linked to **prod**; `.env.local` target unknown; won't read secrets / won't push to prod unattended). Recommended: apply to **staging** first, then live E2E.
- Live browser E2E (needs the migrated DB).
- Register `timber-mcp` endpoint in the (not-yet-provisioned) Timber Oscar instance + author the intake workflow.

## Out of scope (parked, per Edgars's filter)
Multi-entity chains, buyer↔seller firewall as product, lead-gen/supplier pipelines, deal merge/split, external self-service portals, credit invoices, payment matching, sawmill module.
