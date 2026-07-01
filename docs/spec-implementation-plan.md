# Timber World — System Specification Implementation Plan

Source spec: `../docs/Timber_World_Trading_Platform_Specification.pdf` (Nils, v1.0, June 2026).
Example output document: `../docs/TWG012 U shape steps.pdf`.
Mirror of the AgentWave tasks on the **Timber World - IT pakalpojumi** project (`0d2f3a0a-0755-4274-9218-227812cc6083`).
Kept in sync with the task board; each epic states its **Goal** and its **Proof (definition of done)**.

## Verdict: evolve, not rewrite

Evidence (codebase + all 6 AgentWave meetings Jun 11–27): the foundation is healthy and load-bearing (~105k LOC, 221 migrations, RLS everywhere, CI green, prod+staging+customer instance, and the **live 16-tool Oscar/AgentWave MCP integration** the spec's whole "AI-via-MCP" picture depends on). The new spec is ~70–80% a refactor of the newest layer + additive features. A rewrite would rebuild all of that identically. So: **evolve.**

The reported "slowness" is a cross-region prod misconfiguration (DB in Ireland, functions in Frankfurt), **not** Supabase and **not** the architecture — fixed in E0.

## Key decisions (2026-07-01)

- **Regions:** the **prod** Supabase move eu-west-1 (Ireland) → **eu-central-1 (Frankfurt)** is the dominant perf fix, but it is **deferred to prod-deploy time (E8)** — done when we cut over to production, not now. Staging is *already* in Frankfurt (co-located), so staging perf is representative during the build. End state: both DBs + functions in Frankfurt.
- **CRM boundary:** the new spec **defers a full CRM layer** (task mgmt, activity tracking, comms logs — spec §1.3). Timber builds only **counterparty records** (the two walled address books, §9.3) + the client-facing deal portal. The communication CRM lives in **Vilma/AgentWave**; **Pipedrive stays Nils's operational CRM**, bridged by Vilma via MCP. We do **not** rebuild Pipedrive inside Timber now. (Consistent with Jun 17/25: ERP = Timber, CRM = Vilma.)
- **Documents / templates:** generation happens **within Timber**, from **editable open-HTML templates stored in the DB** (Google Drive dropped — a binary-in-Drive template isn't AI-native). Researched stack (task w8h7poukk): in-app **Plate** rich-text editor (Slate + shadcn, MIT, Docs-like, built-in DOCX import) → templates as **versioned HTML rows in Supabase** → **Handlebars** merge (`{{val}}` + `{{#each lineItems}}`, escape-by-default) → **Gotenberg** (MIT, self-hosted EU container) renders the PDF (page breaks via print CSS; avoids the fragile in-serverless Chromium). Import via **Mammoth.js** (.docx → clean HTML); PDF best-effort via pdf.js. Sanitize on write+render (DOMPurify / sanitize-html). Editing a template in-app updates the next doc, no redeploy. Reusable across projects; templates are DB rows Vilma can read/edit via MCP. **Render host (resolved 2026-07-01):** Gotenberg as a Docker container on the existing **VPS2** (`hetzner-openclaw2`, already the Docker/app plane) behind Caddy + a bearer token — no new box; a central `pdf.*` endpoint reusable by other projects (cap concurrency+timeout; auth is required since an open HTML→PDF service is an SSRF/abuse risk).
- **Catalog:** the agents `catalog_*` schema (categories → category fields → field options → products → variants → packages → currencies/pricing) is the **robust single source**. Unify onto it: **decommission the separate inventory model** and migrate its data onto the catalog; add **per-surface visibility** (agents / internal / marketing) so each category/product shows only where wanted.
- **Legacy UI:** at the end of the phase, the main navigation shows only new/reworked sections; anything legacy that still lingers is grouped under **one collapsible nav item** (like the agents app) so it doesn't clutter the UI (E9).
- **Out of scope now** (spec §1.3 / meetings): production module; enforced/mandatory workflow (§7 activities are documentation, not gated tasks); AI brain (lives in Oscar); multi-carrier quoting; automatic margin rules; rich reporting; AI cancellation resolution.

## External dependency (Nils)
The *engine* of every epic can be built and verified with representative data. The **real content** must come from Nils and is not a blocker for the mechanism: the actual firewood/boards/stairs field sets, the per-deal-type gate rules (which confirmations are required), and the real document templates/requisites. Nils committed to writing the stage-role-document matrix and populating the catalog.

---

## E0 · App-level performance hardening (staging; prod DB move deferred to E8)
**Goal:** cut per-page round-trips, on staging during the build. The DOMINANT fix (co-locating the prod DB with the functions) is **deferred to E8 / prod-deploy time** — staging is already co-located, so staging perf is representative.
**Root cause (measured):** prod DB eu-west-1 (Ireland) vs functions fra1 (Frankfurt) → ~25–35 ms per server→DB hop; an order-detail open ≈ 15–20 hops (getSession = 3 sequential hops, run ~5× per page). DB exec itself = 0.19 ms.
**Scope (app-level):** cache session (portal_users + memberships); local JWT verify in middleware; server-side (RSC) fetch as the pattern for all new deal/spine pages; cache reference dropdowns.
**Proof (DoD):** getSession round-trips per page down to a handful (logged) on staging; new pages fetch server-side (no client waterfall); middleware uses local JWT verify; CI green.

## E1 · Spine — the traceable identity that links the chain
**Goal:** introduce the SPINE, the one object linking a chain of separate deals (spec §2.3–2.4, §3.2, §4). Missing entirely today.
**Scope:** `spines` table (SP-NNN, rolled-up status, parent_spine_id); shared product definition on the spine; Spec→Lot life-stage; splits (SP-042→-A/-B) + merges with lineage; demand- vs supply-seeded; wire inventory lots as the spine's physical lot.
**Proof (DoD):** migration applies clean on staging; a spine can be created, carry the product definition, transition Spec→Lot, split into -A/-B and merge with lineage queryable; unit tests for the ID generator + split/merge; RLS on new tables (no advisor error); a full chain is reconstructable from a spine.

## E2 · Bilateral deals + chains (deal-core refactor)
**Goal:** a deal is strictly bilateral (one seller, one buyer), self-contained, linked into chains via the spine (spec §2, §3.1). Today `orders` conflate buy+sell into one row.
**Scope:** deal = seller + buyer + own order/terms/docs/direction + one spine FK; deal code SELLER-BUYER-NNN; direction relative to viewer; order = spine product def + per-deal commercial terms; **auto-spawn** the matching buy deal on the same spine when a sale needs sourcing; migrate existing single-row orders → linked bilateral deals.
**Proof (DoD):** a bilateral deal creates with a SELLER-BUYER-NNN code; creating a sale auto-spawns the buy deal on the SAME spine (asserted by test); the middle leg renders as sell/buy per viewer; existing orders migrate into linked deals with reconciled totals; unit + integration tests green.

## E3 · Deal lifecycle (5 stages) + configurable gates
**Goal:** the 5-stage lifecycle + a configurable gate engine (spec §6) — the sequential pipeline model. Today order_status is a fixed enum.
**Scope:** per-deal stages Draft→Confirmed→Produced→Loaded→Delivered (+Cancelled); gate engine from building-blocks (party sign-off / condition met / acceptance), switchable per deal-type, empty=auto-advance, configured in-app; two-level status (deal + spine rollup); cancel ≤Loaded flags spine + downstream; pipeline visualization; gates kept separate from groups (§9.4).
**Proof (DoD):** a deal advances only when its configured gate is satisfied; an empty gate auto-advances; changing a gate in the settings UI (no code) changes behaviour; cancel flags the spine + downstream; spine rollup reflects the worst leg; each gate building-block has test coverage; pipeline UI renders ordered stages with brand badges.

## E4 · Configurable group-and-rights access + field-level visibility wall
**Goal:** the access model — "the central reason for the system" (spec §9) and Nils's #1 recurring ask. Rebuild groups/rights + field-level visibility, editable in-app. (Roles tables were deleted 2026-04-06; today only coarse module gates + a hardcoded field whitelist.)
**Scope:** group = action rights + visibility rights + scope (mine/company/all), in-app editable; default groups (Super admin, Salesperson, Purchasing, Client, Producer, Accounting, Warehouse); deal-level isolation via RLS (party-to-deal, hides the middle leg); config-driven field-level visibility (replace PRODUCTION_EDIT_FIELDS); two walled address books (clients vs suppliers). **CRM boundary:** counterparty records only — no full CRM (see Key decisions).
**Proof (DoD):** RLS negative-probe (extends the rls-and-perf harness) — a Salesperson can't read the buy leg or purchase prices; a Client sees only their own deal; the middle leg is invisible to both ends; a field hidden for a group via the settings UI is absent from API *and* UI; the two address books are walled; changing a group in-app (no deploy) changes access; all green in CI.

## E5 · Product catalogue & spec fields (unified catalog + file-upload)
**Goal:** the configurable catalogue is the single source of spec fields that also drive what the AI asks (spec §5). Unify onto the `catalog_*` schema.
**Scope:** populate real categories (firewood, boards, stairs) + fields; retire the flat stairs table; **decommission the separate inventory model → migrate onto the catalog**; **per-surface visibility** (agents/internal/marketing); add a **file-upload field type** (images/drawings); per-line spec fields per §5.2; standard vs non-standard pricing (per-deal sell/buy price; owner margin approval).
**Proof (DoD):** the three categories exist and drive the order form; a file-upload field accepts and renders an image/drawing; standard products auto-price, non-standard take a per-deal price; the flat stairs table is gone and its data reads through the catalogue; former inventory data reads through the unified catalog with reconciled counts; per-surface visibility toggles which categories appear per app; verified in browser + unit tests.

## E6 · Documents — in-app HTML template editor, DB templates, PDF render
**Goal:** the document set on the deal, generated **within Timber** from deal data, gated by stage/role, matching Nils's real layouts (spec §8, §10, §12; TWG012 sample), from **editable open-HTML templates stored in the DB** (no Google Drive).
**Stack (researched, task w8h7poukk):** in-app **Plate** editor (Slate+shadcn, MIT) → templates as versioned HTML rows in Supabase → **Handlebars** merge (`{{val}}`/`{{#each}}`, escape-by-default) → **Gotenberg** (self-hosted EU container) renders the PDF (page breaks via print CSS). Import: **Mammoth.js** (.docx→HTML), pdf.js best-effort for PDF. Sanitize on write+render.
**Scope:** the stack above; 7 doc types on every deal; match the TWG012 layout; role/stage-gated visibility+creation (client can't create a CMR); one-button outbound transport pack; brand palette + badges. Keep `documents/assemble.ts` as the structured-data source; retire the hardcoded jsPDF renderer.
**Proof (DoD):** a template authored in the in-app editor and stored as HTML renders to a PDF via Gotenberg matching the TWG012 layout; editing it in-app changes the next doc with no redeploy; a .docx import lands as an editable template; deal data merges via Handlebars (line-item loop), HTML-escaped, sanitizer strips injected script; all 7 types generate; role/stage gating verified; transport pack + brand palette done.
**Render host (resolved):** Gotenberg (Docker) on the existing VPS2 behind Caddy + token — reusable central `pdf.*` endpoint, no dedicated box.

## E7 · Extend the AI/MCP surface for the new model
**Goal:** extend the live 16-tool Oscar/AgentWave MCP so Vilma can drive the new spine/deal/gates/roles model (spec §10). The AI brain stays in Oscar; Timber exposes deterministic tools.
**Scope:** tools for spine + bilateral-deal + auto-spawn; read/advance stage through gates; spine query; doc generation; inbound-ingestion contract (email/PDF/note → deal spec+commercial); outbound-to-logistics contract; user/group management surface; keep two-token auth + idempotency.
**Proof (DoD):** the tool-coverage test asserts a tool for every new lifecycle step; an end-to-end MCP run (as Vilma) on staging creates a deal + spawns the buy side + advances a stage + generates a doc; the read-token can't write; idempotency verified.

## E8 · Data migration & prod rollout (incl. prod DB region move)
**Goal:** migrate real prod data onto the new model and ship safely (agency deploy rules: snapshot before data migration; staging first; verify in prod; rollback ready). Includes the deferred prod DB region move.
**Scope:** backfill spines; migrate single-row orders → bilateral deals; map organisations → two address books + seed group memberships; staging validation; **migrate prod Supabase → Frankfurt to co-locate with the fra1 functions (the dominant perf fix, deferred from E0; fallback pin functions to dub1)**; snapshot + migrate + deploy + verify prod + rollback; update CI gates; roll the customer instance via the **fleet engine only**.
**Proof (DoD):** staging dry-run reconciles row counts + totals; RLS negative-probe + lifecycle + docs + MCP suites green on staging; **prod DB region = eu-central-1 confirmed, prod page latency ≈ staging**; prod snapshot taken; prod migration applied and verified (open a migrated deal, generate a doc, MCP read); rollback rehearsed; customer instance updated via fleet engine and verified.

## E9 · Consolidate remaining legacy sections under one nav group
**Goal:** end-of-phase UI hygiene — the main nav shows only new/reworked sections; anything legacy still lingering is grouped under **one collapsible nav item** (like the agents app) so it doesn't clutter the UI.
**Scope:** audit the portal left-nav after E1–E8 (superseded vs still-needed); move remaining legacy sections (old order tabs, uk-staircase-pricing, competitor-pricing, marketing-cms/stock, quotes, production module, pre-catalog inventory views, reference-data — whichever remain) under one "Legacy"/"More" group; delete nothing, orphan nothing; follow the existing SidebarLink/module-gating patterns.
**Proof (DoD):** main nav shows only reworked/new sections; all remaining legacy sections live under one collapsible group, each still reachable; nothing orphaned; verified in browser (admin + a scoped role).

---

## Sequence & dependencies
`E1 → E2 → (E3 ‖ E4) → (E5 ‖ E6 ‖ E7) → E8 → E9`
E0 (app-level perf) is cross-cutting — apply during the build. E5 is largely independent and can start early. E4 needs E1+E2 for deal-level isolation. E6/E7 need the deal/spine model. E8 includes the deferred prod DB region move; E9 (legacy nav consolidation) is last.
