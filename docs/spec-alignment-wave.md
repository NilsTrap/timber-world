# Spec-Alignment Wave — document-driven deal flow (planned 2026-07-03, rev 2 after adversarial review)

**Purpose:** close the gaps between Nils's **System Specification v1.0** (`nils-timber/docs/Timber_World_Trading_Platform_Specification.pdf` — the authoritative document; § references cite it) and what the E1–E9 build shipped. Planned + adversarially reviewed (3 critics: spec fidelity / code feasibility / coverage) on 2026-07-03. **Built by separate dev agents** (Opus 4.8 sessions), one epic at a time.

**Ground rules for every dev agent picking up a task:**
- Branch `feature/timber-spec-phase`; **staging only — PROD IS FROZEN** (no prod deploys, no prod DB).
- `git fetch && git rebase origin/feature/timber-spec-phase` **before every push AND before every staging deploy** (two+ agents share this branch; memory `feedback_multiagent_staging_deploys`). Do NOT merge `main` mid-wave unless explicitly asked.
- Staging portal: **https://timber-portal-staging.vercel.app** (Nils logs in with prod credentials). Deploy = the swap dance: back up `.vercel/project.json` → `vercel link --yes --project timber-portal-staging --scope nils-projects-ee818bb8` → `vercel --prod --yes --scope nils-projects-ee818bb8` → restore `project.json` → poll `vercel inspect` until READY. Staging DB migrations via Supabase Management API (project `fyzrtqsnmnizoxgcqsjc`, PAT at `~/.supabase-ijl/pat`).
- Type-check (8/8) + relevant unit tests before commit; verify the actual feature on staging after deploy; use the agent-bus (`bus_start_run`/`bus_claim`/`bus_end`).
- Mark finished tasks **in-review** (not done) and report what shipped.

---

## 1. Why this wave — contradictions found (2026-07-03 re-read of the spec)

| # | Spec says | Build does today | Verdict |
|---|---|---|---|
| 1 | **§2.1** "A deal knows about its two parties and nothing else. **There is no concept of 'buying' inside a selling deal**, or the reverse." **§5.3** (non-standard products) "the selling price is entered on the sell deal, the buying price on the buy deal." | The Deal view (`DealPanel.tsx:125-126,178-182`) renders **sell-side AND buy-side line-item tables on the same order**; margin = same-row sell−buy; the purchase-spec document generates from the sell order's `side='buy'` lines. | **Contradiction** → Epic A |
| 2 | **§2.3** the spine "is the one and only place where the deals are connected to each other; **the connection does not live inside any deal**." | The build's chain adjacency also lives in `orders.upstream_deal_id` (a deal-held pointer). | **Model deviation** — resolve the chain via the **shared `spine_id`**; treat `upstream_deal_id` as a legacy/internal cache only (Epics A/B rules below) |
| 3 | **§9.3** Purchasing "creates and edits supplier **and producer** records (the same fields) **and selects them onto buy deals**"; **§10** auto-spawn when a sale needs sourcing. | Auto-spawn exists (`createDeal` `needsSourcing`+`sourceOrganisationId`, `orderDeals.ts:553-571`) but is **MCP-only**; no supplier-picker UI, no supplier change, the spawned buy leg has **no line items**, no navigation between legs. | **Gap** → Epic B |
| 4 | **§6.1** stage = "a milestone… **not a sequence of mandatory steps**"; **§7** per-stage per-direction *activities* — explicitly "described here so the system is understood… **not built as enforced tasks** (§1.3)"; **§2.5** direction is viewer-relative. | Deal view is direction-blind and stage-blind. Note: absence of §7 *tracking* is spec-compliant (§1.3 excludes activity tracking); what's missing is the **guidance display** and direction framing. | **Gap (display-only)** → Epic C |
| 5 | **§8.2** "**Quotation → order specification** — one document in two states"; "**Purchase order** — the buy-side order to the supplier; **belongs to the buy deal**". **§8.1** every document is available on every deal — stage does **not** gate document existence. | No quotation→firm state transition; purchase docs assemble from the sell order; doc types are hardcoded in ~9 places incl. two DB CHECK constraints. | **Partial gap** → Epic D |
| 6 | **§6.3** gates = engine of 3 blocks, admin-configured; "condition met — the system checks a **fact**". | Gate config's document-present condition takes a **free-text docType**; sign-off/acceptance confirmations ARE recorded (user+org+timestamp — auditable, not fake) but presented weakly. | **Polish** → Epic E (deliberately last; Edgars 2026-07-03: keep gates "out of the game" for now) |
| 7 | **§12** brand status palette; **§3.1** deal codes SELLER-BUYER-NNN (built ✓ `buildBilateralDealCode`, used `orderDeals.ts:418`); **§6.2** "the full spine overview is for the owner". | Overview badges use generic colours; direction (sell/buy) not shown; no chain visibility anywhere (not even for the owner). | **Polish** → Epic F |

**Explicitly ALIGNED / keep as-is (do not "fix"):**
- Suppliers/producers quote **off-system** and Purchasing enters the buy price (§5.3, §7 buy-Draft, §9.2). *Note (per adversarial review):* §1.4 forbids party-to-party comms **through the system**, not party-to-hub — an in-system supplier price submission would NOT violate §1.4 (§9.2's producer login already accepts orders in-system). Deferring it is **Edgars's product decision of 2026-07-03**, not a spec mandate. Revisit with Nils later.
- The buy leg is a **separate deal row**; the chain is linked **by the spine** (§2.1/§2.3). The customer's order never "contains" the purchase.
- RLS deal-level isolation (a supplier login sees exactly their own deal) — verified working; don't weaken it.
- No rigid workflow (§1.3): all stage-aware UI is **guidance**, never lockout; "must exist before advancing" is expressible **only** as a configurable gate.

**Reconciling Edgars's step-by-step ask with the spec (so it's explicit):** Edgars described "order comes in → employee converts it into a buying specification → that gates the transition → buying request is created → step by step". In this plan that maps to: the **buying specification** = the buy leg's copied spec lines created by **B1 Start sourcing**; the **step-by-step feel** = Epic C's per-stage §7 activity guidance + Epic D3's expected-documents checklist; and the **gate** = optionally configuring a document-present gate (e.g. "purchase order present before the buy deal confirms") in the existing gate engine — configuration, never hardcoded, exactly as §6.3/§1.3 demand. Nothing is locked by stage (§8.1).

**Target flow (the firewood example):**
1. Customer asks for a truckload of firewood → salesperson creates the **sell deal** (TIM→customer). Draft: build the sales spec lines, generate the **Quotation**.
2. Fulfilment needs goods from another entity → **Start sourcing**: pick the supplier from the suppliers book → the system creates the **buy deal** (supplier→TIM) on the **same spine**, with the same product-definition lines, prices blank.
3. Purchasing works the buy-deal Draft (§7): quote from producer **off-system**, enter the agreed buy price on the buy deal, generate the **Purchase order**, secure agreement → Confirm.
4. Quotation accepted → becomes the firm **Order specification**; owner sees both legs' totals → **margin** → approves (§5.3).
5. Each deal advances Draft→Confirmed→Produced→Loaded→Delivered with §7 guidance; configured gates (if any) hold transitions.

---

## 2. Epics

Build order: **A → B → (C ∥ D ∥ G) → F → E**. Each epic = one parent task on the board; subtasks are full tasks with their own notes. **Read this file before starting any of them.**

**Parallelization map (what can actually run concurrently).** The hard constraint is HOT FILES — `DealPanel.tsx`, `orderDocuments.ts`/`assemble.ts`, `tools.ts` are touched by A, B, D and G2/G3 — not the epic sequence itself. Recommended: **max 2–3 concurrent sessions**, every session `bus_claim`s its files before editing and rebases before push/deploy.

- **Track 1 — critical path (one session at a time):** Epic A (subtask order: A1+A4 → A2 → A3 → A5) → Epic B (B1 → B5 → B2/B3/B4) → Epic C.
- **Track 2 — independent, can start IMMEDIATELY (parallel with A):**
  - **G1** (placeholder audit doc — research only, no code)
  - **G4** (counterparty form completeness — counterparties UI only)
  - **F2** (§12 colour map), **F3** (deal-code check)
  - **E2** (confirmation audit-trail surfacing — GateConfigManager/DealAdvanceControl, untouched by A)
- **Track 3 — after A lands:** Epic D (D2 → D1 → D3; D2 overlaps `tools.ts`/`documents/types.ts` with A4/A5 — don't run alongside A), **G3** (touches `assemble.ts` — after A4), **G2** (deal-view terms card — after A1; shares the `canEditDealTerms` mechanism with B5, coordinate or sequence after B5), **G5** (last in G), **F1** (badges could go earlier, but the pairing links want B's chain semantics — simplest after B).
- **E1** strictly after D2 (consumes the registry).

Do NOT run two sessions inside the same epic. If only one dev session is available, plain order A → B → G → D → C → F → E works fine.

**ENDGAME (2026-07-04 — remaining epics E, F, H, I; A–D and G are built).** Run THREE sessions in parallel NOW, then one final epic:
- **Session 1 → Epic H** (H1 then H2). Hot files: `OrdersOverview.tsx`, `DealTermsEditor.tsx`, `createOrder`/`orderDeals` actions.
- **Session 2 → Epic I** (I1 → I2 → I4; I3 anytime). Hot files: `features/organisations/`, `features/counterparties/`, `features/access/`, `components/layout/OrganizationSwitcher|Sidebar`. Naming DECIDED: rename nav "Counterparties" → **"CRM"** (label-only; routes + `counterparties.*` module codes unchanged).
- **Session 3 → Epic E** (E1, E2). Hot files: `GateConfigManager.tsx`, `DealPipeline.tsx`. Fully independent.
- **Epic F runs LAST, strictly AFTER H** (same session 1 or 3 picks it up): F1 shares `OrdersOverview.tsx` with H1, and F3's deal-code verification depends on H1's allocation fix. Order inside F: F2 → F1 → F3.
No other orderings are load-bearing. Every session: bus_claim files, rebase before push AND deploy, staging only.

### Epic A — Bilateral purity: each deal carries only its own order (spec §2.1, §2.4, §5.3) — P1

- **A1. Deal view: own lines only.** `DealPanel.tsx`: remove the dual sell/buy tables; render ONE "Order specification" table = the deal's own line items. `DealLineAdder` loses its `side` prop. Keep add-from-catalog/custom + amount editing (gating changes in B5).
- **A2. Migrate buy-side lines onto the buy legs (staging).** Idempotent script (pattern `apps/portal/scripts/e8-migrate-legacy-orders.mts`): for each sell order with `side='buy'` lines AND a buy leg **on the same spine** (resolve legs via `spine_id` + party roles; `upstream_deal_id` may serve as a cross-check only), move those lines to the buy leg. Sell orders with buy lines but NO buy leg: **report, don't guess** (list for Edgars). Extend the E8 cutover script identically (prod later; risk-reducing, cutover itself stays frozen).
- **A3. Margin from the chain.** Margin block: sell subtotal = own lines; buy subtotal = the spine-sibling buy leg's line total (**resolve via `spine_id`**, not the deal pointer). Owner/admin only (§9.1 — cross-leg data never reaches ordinary users). "Provisional" when no buy leg or unpriced. Keep approve/revoke (§5.3).
- **A4. Documents assemble from the right deal.** Two specific fixes encoded from review: (1) `orderDocuments.ts:115` derives the buy-doc buyer card from `producer` — on spawned buy legs producer is NULL; derive from the **`buyer` embed** instead. (2) `assemble.ts:81` filters lines by `side` — the buy leg's own lines are stored `side='sell'` (`orderDeals.ts:538`), so a purchase doc on the buy leg finds ZERO lines; neutralise `defaultSideFor`/the side filter: a document assembles from **the deal's own lines**, whatever their legacy side value. Purchase order generates ON the buy deal (§8.2). Update `document-assemble.test.ts` + `document-render.test.ts`.
- **A5. Deprecate `side` on line items.** Keep the column (no destructive migration); stop writing `side='buy'` from UI/MCP; MCP line tools operate on "the deal's lines". Touch points from review: `tools.ts` line tools + coverage test, `dealFields.ts:271-275` (buy-side projection special case → dead logic, remove) + `access.test.ts`.
- **Acceptance:** a sell deal shows only its own lines; the buy leg holds the purchase lines; margin = sell-total − spine-sibling-buy-total (owner view); purchase order PDF renders from the buy deal with a correct buyer card and non-empty lines; type-check + doc/access tests green; migration report saved to `docs/`.

### Epic B — Sourcing flow: find supplier → buy leg (spec §9.3, §10, §2.4) — P1 (after A)

- **B1. "Start sourcing" on a sell deal.** Server action wrapping the existing spawn path (`orderDeals.ts:553-571` semantics): supplier picker (orgs `is_supplier OR is_producer` — the suppliers book; respect `counterparties.suppliers` gating), creates the buy deal on the **same spine**, **copies the sell deal's line items** (product-definition + catalog-link fields via the existing `createDeal.lineItems`→`replaceLineItems` path — verified feasible; **prices/amounts blank**), never relies on `upstream_deal_id` as the model (it may still be written for legacy compatibility). UI: primary CTA on a sell deal without a buy leg, in the right action column. **Activity-log rule (review finding):** `order_activity_log` is readable by the deal's counterparty (customer login) — the sell-deal log entry must be **generic** ("Sourcing started"), with supplier identity + buy-deal code logged **on the buy leg only**.
- **B2. Replace supplier.** Final decision (no ambiguity): **cancel the old buy leg (existing cancel action) + spawn a new one via B1.** Deal codes are directional identities (§3.1 "a deal is defined by who sells to whom") — never re-point an existing deal at a different seller. Allowed while the buy leg is ≤ Confirmed; the cancel flags the spine per §6.4 — surface that to the user as expected behaviour.
- **B3. Chain card.** On the deal view for **owner/admin + `chain`-domain rights only** (§2.6/§6.2): spine code + each leg on the spine (deal code, parties, stage, own total) with links — **resolved via `spine_id`**. Sell leg ↔ buy leg navigation. Ordinary users and counterparty logins never see it.
- **B4. Sourcing state on the sell deal.** Where the buy table used to be: nothing for ordinary users; for users with sourcing rights: the Start-sourcing CTA (no buy leg) or "Sourced — <buy deal code> <stage>" link (buy leg exists; supplier name only for users whose rights allow supplier identity).
- **B5. Purchasing can price the buy deal.** Full touch list (from review — the action alone is NOT enough): (1) `dealActions.ts:44` `updateDealLineItemAmounts` guard → allow platform admin OR actor whose access-group grants `deal_terms` **editable** and who passes row visibility for that deal (the E4 field-wall model; note: `resolveFieldAccess` is profile-global — side isolation comes from ROW visibility (`side.buy`), state this in code comments); (2) expose `canEditDealTerms` on `OrderDealViewResult` (`dealActions.ts:20`); (3) `DealPanel.tsx:472` `{isAdmin &&` edit-UI gate and `DealPanel.tsx:123` `canEditPrice` → use the new flag (blank-priced buy legs must still show inputs); (4) export/hoist `requireLineWriteAccess` (file-private in `catalogPicker.ts:34`) so both paths share one check.
- **Acceptance:** pick supplier → buy deal on same spine with copied lines + blank prices; chain card navigates both ways (owner only); a seeded-Purchasing-group user (non-admin) prices the buy deal but cannot touch sell prices; a salesperson login cannot see the buy leg (verify with real logins on staging); customer login's activity view shows no supplier identity; replace-supplier = cancel+respawn with spine flag surfaced.

### Epic C — Direction- and stage-aware deal workspace (spec §2.5, §6.1, §6.2, §7) — P2 (after A/B)

- **C1. Direction-aware header.** "Sell deal — facing customer <X>" / "Buy deal — facing supplier <Y>", derived from the house org vs parties (viewer-relative for counterparty logins, §2.5). Deal code + counterparty prominent.
- **C2. Activities guidance — DISPLAY-ONLY.** Render the §7 activities for the deal's current stage + direction as a static guidance card (verbatim §7 texts). **No persistence, no checkboxes** — §1.3 explicitly excludes task/activity tracking, and the critics confirmed a stored check-off would be out-of-spec scope. (A persisted checklist is listed in §3 as a future option needing Edgars's explicit approval as a deliberate spec-plus.)
- **C3. Stage emphasis, not lockout.** Current stage's activities + suggested documents highlighted; every capability stays available at every stage (§8.1, §1.3).
- **C4. Status simplicity audit.** Ordinary users see their deal's stage only; spine rollup/chain = owner/admin (verify `spine.status` right seeding; fix if leaked).
- **Acceptance:** sell deal in Draft shows the five §7 sell-Draft activities (read-only guidance); buy deal shows the buy-Draft set; stage change swaps the card; producer login sees the simple stage, no spine/chain; nothing is disabled by stage.

### Epic D — Document set alignment (spec §8) — P2 (parallel with C)

- **D1. Quotation → Order specification (one document, two states).** Reconcile with the EXISTING `order_documents.status` (`draft|issued`, migration `20260616000001:92`) — do not add an overlapping column blindly: add `doc_state (quotation|firm)` **only** for the spec doc type, orthogonal to `status`. **Regeneration path (review finding):** generation today always allocates a new number + new row (`orderDocuments.ts:121-127,177-193`); build a **regenerate-in-place** path for the firming transition — same row, same doc number, replace the stored PDF, set `doc_state='firm'`, record `firmed_at/by`. House user clicks "Accepted → make firm" (client-login acceptance can drive it later).
- **D2. Doc-type registry (single source of truth).** New `features/orders/services/documents/registry.ts`: key, label, direction affinity (sell/buy/both), template linkage. **Constraint discovered in review:** `order_documents.doc_type` and `document_templates.doc_type` have DB CHECK constraints enumerating the 7 existing keys — **v1 keeps exactly the existing keys** (quotation = `doc_state` on `sales_spec`; the buy-side order keeps key `purchase_spec` with display label "Purchase order"); any new key requires migrating BOTH checks (note in code). Replace ALL hardcoded lists with registry imports: `tools.ts:37` (DOC_TYPE_ENUM), `dealModel.ts:14` (DocType union — keep as the type, derive values), `numbering.ts:73/95`, `documents/types.ts:73`, `starters/index.ts:164`, `templates.ts:33`, `DocumentTemplatesManager.tsx:65/75`. The templates editor **cannot mint types outside the registry** — so registry-driven lists (incl. Epic E1's gate options) provably equal the editor's list.
- **D3. Document panel = expected-set checklist.** For the deal's direction: the §8.2 set with exists/missing (informational only — §8.1: stage never gates existence) + the existing generate buttons. **Generation-only affinity:** generating a buy-affinity doc on a sell deal is rejected with a pointer to the buy leg — but **uploads stay unrestricted** (§9.2: a Client legitimately uploads their own purchase order onto a sell deal).
- **Acceptance:** quotation → firm order spec keeps its number with an audit stamp; purchase order generates only on buy deals (uploads unaffected); zero hardcoded doc-type lists left outside the registry (grep-proof); doc tests updated + green.

### Epic E — Gates, minimal + honest (spec §6.3, §9.4) — P3 (LAST; small; gates stay configured-off)

- **E1. docType dropdown.** `GateConfigManager.tsx:238`: the document-present condition's free-text docType becomes a dropdown fed by the D2 registry.
- **E2. Honest sign-offs.** Surface the existing audit trail (`deal_gate_confirmations` user/org/timestamp): satisfied blocks show who/when; relabel as "recorded confirmation by <role>".
- *(Cut from this wave per coverage review + Edgars's "keep gates out of the game": the `margin_approved` condition kind. Listed in §3 as a future option.)*
- **Acceptance:** no free-text doc types in gate config; satisfied blocks show their evidence; no new gate capabilities added.

### Epic F — Overview & branding polish (spec §3.1, §12, §6.2) — P2/P3 (anytime after A)

- **F1. Overview: direction badge + owner-only chain hint.** Sell/Buy badge derived by **party comparison** (there is NO `chain_role` column — review-verified); direction filter. The chain/pairing indicator is **owner/admin-only** (§6.2 "the full spine overview is for the owner"; §9.2 salesperson sees "not upstream deals") — ordinary users see just their rows with no pairing hint.
- **F2. §12 status colours.** Centralise one stage→colour map used by overview badges, the stage rail, and the deal header. Spec-fixed: Draft→`#D89B33`, Delivered→Success `#2E9748`, Cancelled→Error `#CA3733`. For the middle stages pick from the §12 palette (suggest Confirmed→Pending `#F6D44B`, Produced→Info `#2682CC`, Loaded→Warning `#F6A338`) — §12 allows tuning; do NOT invent off-palette colours.
- **F3. Deal-code sanity.** Verify new deals get SELLER-BUYER-NNN on staging (`buildBilateralDealCode`, `orderDeals.ts:418`); legacy `ORD-NNN` codes display as-is.
- **Acceptance:** direction visible + filterable; pairing hint invisible to non-owners; one colour map, spec palette only; new-deal code verified on staging.

### Epic G — Template placeholders ↔ deal data linkage (Edgars 2026-07-03) — P1/P2 (after A; parallel with C/D)

The Plate templates system has a clean, centralised merge-field registry (`features/documents/compiler/registry.ts` — MERGE_FIELD_GROUPS: Document / Seller / Buyer / Terms / Totals + LINE_ITEM_COLUMNS), and `DocumentData`/`PartyCard` (`features/orders/services/documents/types.ts`) defines the data those tokens read. Audit result (2026-07-03): **counterparty tokens are data-backed** (organisations has legal_address, registration_number, vat_number, country, email, phone, bank_name, bank_account_number, bank_swift_code; `orderDocuments.ts:78-94` picks them), but **deal-term tokens have NO input UI** — `incoterms`, `incoterms_place`, `advance_pct`, `payment_terms`, `delivery_terms`, `delivery_deadline` are DB columns settable **only via MCP `timber_update_deal`**; the portal shows them read-only. **Signee has no column, token, or UI at all.**

- **G1. Placeholder→source audit (deliverable doc).** Walk all 7 seeded templates + MERGE_FIELD_GROUPS; produce `docs/template-field-mapping.md`: every token → data source (orders column / organisations column / computed) → edit UI (which page) → status (OK / no-UI / no-column). Include DocLineItem + totals fields (where does `vatRate`/`vatReference` come from — audit + document). This doc drives G2–G5 and is the checklist Edgars asked for.
- **G2. Deal-terms editor on the deal view.** An "Edit terms" card/dialog on the deal (incoterms + place, advance %, payment terms, delivery terms, delivery deadline, notes) calling the existing `updateDealFields` service (already MCP-exposed — add the server action + UI). Permission: the `deal_terms` field-wall (editable ⇒ can edit; same mechanism as B5). The read-only summary stays for everyone else.
- **G3. Signee fields end-to-end.** organisations: `default_signee_name`, `default_signee_role` (+ counterparty form inputs); orders: per-deal override (`seller_signee_name/role`, `buyer_signee_name/role`, defaulted from the org record at deal creation, editable via G2's card); `PartyCard` gains `signeeName`/`signeeRole`; assemble populates (deal override → org default); registry gains "Seller/Buyer signee (name, role)" tokens; templates can then place signature blocks.
- **G4. Counterparty form completeness.** Verify every PartyCard-consumed organisations field is editable in the Counterparties UI (bank details, reg/VAT, legal address, country, email, phone); add any missing inputs. (The walled books + role flags stay untouched.)
- **G5. Unsourced-field sweep.** From G1's audit: give every remaining unsourced token a home + input (e.g. VAT rate/reference per deal if currently hardcoded), or remove the token from the registry if Nils's documents don't need it. No orphan tokens left: every palette field must render real data on a staging test deal.
- **Acceptance:** `docs/template-field-mapping.md` exists with zero "unknown" rows; a house user edits deal terms in the portal and a generated contract shows them; signee renders on a contract from a staging test deal; every merge-field in the palette resolves to real data (spot-check each group on one generated PDF per doc type).

---

## 3. Out of scope for this wave (with honest attribution)

- **In-system supplier price submission** — deferred by **Edgars (2026-07-03)**. §1.4 does NOT forbid it (party-to-hub is fine); revisit with Nils.
- **Payment recording** — deferred by decision (no payments module yet). NOTE: this IS spec-base scope (§8.2 "payment records", §9.2 Accounting "record invoices and payments", §6.3 payment gate example) — a strong candidate for the NEXT wave; `payment_recorded` gate condition stays disabled until then.
- **Outbound one-button transport pack + AI carrier-reply ingest** (§8.3/§9.5) — spec-base scope ("what to build now" §11.6/§11.8), deferred earlier for missing transport fields; candidate for the NEXT wave. Only multi-carrier quoting is excluded by §1.3.
- **Persisted §7 activity check-offs** — would exceed §1.3 (activity tracking excluded); only with Edgars's explicit approval as a deliberate spec-plus.
- **`margin_approved` gate condition kind** — future option (small: `lifecycle.ts` union + 4 more touch points), parked with the rest of gates.
- **Spine split/merge + supply-driven spine UI** (§2.3 "must be supported from day one" — the **services/schema exist** from E1: `spines.ts` split/merge/lineage; what's missing is UI) — surface in a later wave.
- **Counterparty-login activation** (Client/Producer logins work via RLS + groups; invites/onboarding is a separate effort). **Signed-copy proof uploads** on documents. **Enforced workflow** of any kind. **Prod cutover** (E8 second half — frozen).

## 4. Task tracking

Tasks created 2026-07-03 on the Oscar board (project `0d2f3a0a-0755-4274-9218-227812cc6083`): one parent per epic, subtasks as **full child tasks** (own notes + status). Dev agents: claim your epic on the agent-bus, work subtasks in order, set **in-review** + report. Cross-cutting invariants live in this file — read it first.

| Epic | Parent (shortId) | Subtasks (shortIds) |
|---|---|---|
| A — Bilateral purity | `hgewaj` | A1 `chgx7y` · A2 `wnwaad` · A3 `duyan8` · A4 `s6dwgk` · A5 `enbsca` |
| B — Sourcing flow | `75748d` | B1 `f6b2af` · B2 `njhbks` · B3 `evxqke` · B4 `4hqbt5` · B5 `9rk5rr` |
| C — Stage-aware workspace | `nhb839` | C1 `sfr68t` · C2 `tvrq79` · C3 `tkkskq` · C4 `u4av3n` |
| D — Document set | `v2fcdf` | D1 `8vcvgb` · D2 `jb2k6q` · D3 `3c9zx8` |
| E — Gates (last) | `tmd72z` | E1 `e7u2vb` · E2 `62qd4s` |
| F — Overview & branding | `hrabm6` | F1 `zytdkn` · F2 `4w3xpk` · F3 `jsjw2g` |
| G — Placeholders ↔ deal data | `kqtkmz` | G1 `m59783` · G2 `7cc282` · G3 `tc67xe` · G4 `e7gkcc` · G5 `z8d8gr` |
| H — UAT fixes (2026-07-04): new-deal parties dialog + Parties card + auto deal code; Incoterms dropdown (Settings→Fields-managed) + calendar deadline | `swgbkj` | H1 `y3s98j` · H2 `k89g7y` |
| I — Identity & CRM consolidation (2026-07-04): one-truth UX (is_supplier toggle BUG + appears-in indicator + cross-links), group-assignment discoverability (People column + group Members tab), org-switcher retirement, legacy audit. PARALLEL-SAFE with H (no hot-file overlap). | `u4r9jx` | I1 `hraagf` · I2 `kgatbx` · I3 `me76z9` · I4 `8nke4x` |
| J — MCP parity for Vilma (2026-07-04 audit: 29 tools; gaps = firming, start-sourcing-on-existing, margin approval, org update + role flags, users/groups writes, catalog/stock). J1/J2/J4 after H; J3 strictly after I2; J5 last. | `mp4ssr` | J1 `j67aep` · J2 `k7k8dz` · J3 `gfxdbq` · J4 `2ufcna` · J5 `gjxy7e` |
