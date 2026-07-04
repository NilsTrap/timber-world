# Wave 2 — Spine-Lego chain, traders, meeting fixes, inventory migration (planned 2026-07-04)

**Source:** two Nils meetings on 2026-07-04 — the 2-hour walkthrough (`#8p5eay`) and the 15-minute follow-up (`#8ejt3v`) — plus Edgars's clarifications. The follow-up call **overrides** parts of the first: read §1 carefully. Executed by **one Opus 4.8 orchestrator** with sub-agents (parallelization in §4).

**Ground rules (same as Wave 1 — `docs/spec-alignment-wave.md` top section applies verbatim):** branch `feature/timber-spec-phase`, **STAGING ONLY / PROD FROZEN**, rebase before every push AND deploy, the vercel swap-dance deploy from the **repo root**, staging DB via Supabase Management API (non-default User-Agent), type-check 8/8 + tests before commit, bus claims, finished tasks → **in-review**. **Deploys are done by the ORCHESTRATOR only, serialized — sub-agents commit + push but never deploy.**

---

## 1. The final model (what the meetings decided)

**The chain has NO fixed shape.** Meeting 1's "UK→customer, LV→UK middle, supplier→LV" example is just one case. Nils (follow-up): *"the chain can be anything"* — a UK trader buying directly from an LV producer, an LV trader selling straight to a Swedish buyer, 2 legs, N legs. There are no criteria that determine the shape; nothing auto-spawns.

**Deals are Lego blocks on a spine.** The **origin deal** mints the spine (SP-NNN). Afterwards, any number of deals attach to the same spine — any parties, any direction — and each new leg **copies the spec lines from the spine's origin content** so nobody re-enters the specification (*"uztaisi man vēl vienu dīlu par šito pašo spine"*). Each leg keeps its own commercial terms + prices (§2.4 of Nils's spec). Nils, as admin, assembles chains **manually** for now; automation is a later layer.

**Traders are a third counterparty category** (besides Clients and Suppliers): the house's own companies (Timber International + The Wooden Goods SIA today; more later). A salesperson is **bound to their trader org(s)** via organization membership ("obligāti — vienai vai vairākām").

**Visibility stays narrow (explicit mutual decision — "labāk mums šaurāk palikt"):** salespeople see clients + their own trader(s), never suppliers; purchasing sees suppliers, never clients; a counterparty login sees only their own deal, never spine siblings. NO per-salesperson client subsets, NO client groups, NO geographic anything — categories only, deferred.

**Splits = several deals on one spine** with edited quantities. No forks, no spine subcodes ("fork is an effect, not a concept").

### The New-order UX (Edgars 2026-07-04, final)
- Clicking **Add order** opens the dialog with a **mode choice** (admin only sees the choice):
  1. **Blank order** — today's flow; the deal becomes a spine **origin** (mints a spine when it gets its lines/parties per existing semantics).
  2. **Leg from an original order** — a dropdown of existing deals (show: deal code / buyer / spine code) → the new deal attaches to that spine and its **lines copy from the origin** (spec + quantities; **prices blank** — each leg prices itself).
- On a deal's detail view, the right action column gets **"Create next leg"** (admin-only) — same dialog, pre-set to this deal's spine.
- **Salespeople never see either leg option** — they only create blank deals for their own trader.

### Deferred (recorded, DO NOT build in Wave 2)
Chain automation / auto-spawned middle deals of any kind; inter-trader approval sequences (Nils runs the middle legs manually); per-salesperson client visibility, client groups/tags; per-trader catalog pricing (one catalog, one price list — "needs hard thinking" later); shipments/production integration with the new deals (prod flows stay untouched); take-from-stock action (P3, later); comms; mobile.

---

## 2. Epics & subtasks

### Epic L — Spine-Lego chain (P1; core stream, sequential L2 → L1 → L3)

- **L2 · Traders category.** Additive migration: `organisations.is_trader` BOOL; seed it on the house orgs (identify on staging — the New-deal picker currently shows exactly "Timber International" and "The Wooden Goods SIA"; confirm + seed those; report which). New-deal dialog: the second party is labelled **"Trader"** (not Manufacturer); options = `is_trader` orgs; a **salesperson is locked to their member trader org(s)** (auto-selected when exactly one); admin picks from all traders. Orgs & People Roles toggle + "Appears in" indicator gain **Trader**. CRM: a Traders view/filter is **admin-only** (salespeople/purchasing don't need the traders book). Keep `is_manufacturer` untouched (legacy flows still read it).
- **L1 · New-deal-on-spine mechanic.** (after L2) Implement the §1 UX exactly: dialog mode choice (admin-only) + origin-order dropdown + right-column "Create next leg" card (admin-only). Server: create deal with chosen parties, `spine_id` = origin's spine (create the spine on the origin at this moment if it doesn't have one yet), **copy the origin deal's line items** (product-definition fields + catalog links + quantities; `unitPriceCents`/totals NULL). **Fold `startSourcing` into this** — the SourcingCard's action becomes "Create next leg" with sourcing defaults (seller = picked supplier, buyer = **defaults to the current deal's seller but is editable** — this fixes Meeting 1's wrong-buyer bug); remove the now-wrong hardcoded buyer logic. MCP parity in the same task: extend `timber_create_deal` with `from_spine`/`copy_lines` (wraps the same service; update coverage test).
- **L3 · Empty-counterparty deals.** (after L1) A deal may be created/held with ONE party unset (e.g. purchase leg while shopping suppliers — "viņam jāļauj viņu tukšu atstāt"). NewDealDialog + `createOrder` + `_validateOrderParty` allow it; the deal code mints lazily when both parties exist (already the `allocateDealCode` semantics); the H1 Parties card fills the blank later; document generation with a missing party fails gracefully with a clear message. Salesperson flows unaffected (their parties are always known).
- **L4 · Walls verification sweep.** (parallel from the START; read-only first) With REAL staging logins (salesperson / purchasing / producer / client): verify every org picker (New-deal dialog, Parties card, next-leg dialog, counterparties books), deal lists (no spine siblings visible), CRM books, MCP reads with the READONLY token. Nils's requirements: salesperson sees ONLY clients + their trader(s); purchasing sees ONLY suppliers; counterparty sees only their own deal. Write `docs/wave2-walls-verification.md` (surface → login → PASS/LEAK). Fix leaks (coordinate fixes in core files through the Stream-1 agent).

### Epic M — Chain visibility (after L1; owns ALL OrdersOverview edits)

- **M1 · Spine code + overview consolidation.** ChainCard header shows the spine code (SP-NNN). OrdersOverview (admin-only surfaces): spine code tooltip/column on paired rows + a spine filter/grouping affordance; add the extra basic columns Nils asked for (volume if cheaply available) + render N3's party order numbers in the Reference column area; keep every §6.2 wall (non-admins see no spine/pairing hints). **This task supersedes board task `ey65kr`** — set it to done/moved when landing. NOTE: to avoid file contention, OrdersOverview.tsx is edited ONLY by this sub-agent in this wave.

### Epic N — Meeting fixes (independent streams)

- **N1 · Gates: drop the deal-kind axis.** Nils: "all deals are the same — buy/sell kinds in gates are legacy." One gate set per `from_stage`: migrate `deal_gates` (keep the `buy_sell` rows as the universal set, delete/ignore others), remove the kind selector from GateConfigManager, make `getGateConfig` kind-agnostic. Small; keep the E1/E2 behaviour intact.
- **N2 · Document uploads + signed versions.** The deal documents panel gains: (a) **free-form upload** of external files onto the deal (the legacy Order-tab file section died with the tab — restore an equivalent on the deal view, walls as before), and (b) **"Upload signed version"** on a generated document row (`order_documents.signed_storage_path` additive column; upload/download/replace + confirmed delete; show a "signed" badge). Nils: "esošajiem uzģenerētajiem dokumentiem jāspēj uploadot parakstīto versiju."
- **N3 · Party order numbers (Nils's explicit ask).** *"Bieži vien arī klientam un ražotājam ir savs order number, kuram jāparādās darījumā obligāti — gan dokumentos, gan sarakstos."* Implement as first-class labeled refs on `order_external_refs` (table EXISTS; `timber_set_deal_refs` MCP tool EXISTS; `DocumentData.externalRefs` ALREADY renders into generated PDFs): canonical labels **"Customer order no."** and **"Supplier order no."** + free extras. UI: a References editor on the deal (fold into the terms card or its own small card; same `deal_terms` edit gating). Merge fields: add "Customer order no" / "Supplier order no" tokens to the compiler registry (resolve from the canonical refs) so templates can place them. Lists: provide the accessor; the overview RENDER is done by M1's agent (hand over, don't edit OrdersOverview here). Verify against the already-landed editable "Reference" (commit 7b016d6) — that one is the house reference; party refs are separate.
- **N4 · Terms editor polish.** Reposition the Save button per Nils ("save pogu būtu jānolaiž" — it sits awkwardly; move it to the card's bottom/footer), plus any 5-minute UX nits from the meeting (labels). Tiny.

### Epic O — Inventory → catalog migration (fully parallel, independent)

- **O1 · Programmatic migration.** Nils's go: *"paņem visus tos produktus, izveido kategorijas, pielasi fieldus, pārceli uz šo katalogu."* Idempotent script (pattern: e8 migration scripts): legacy inventory product data (`inventory_packages` + `ref_*` vocabularies) → catalog categories + field assignments + products + variants (+ per-variant stock where the legacy data carries real on-hand quantities; stock only in packaging forms — create sensible packaging assignments or leave stock unset and report). STAGING only; legacy tables stay live in parallel (the E5 decommission stays gated — memory `project_e5_inventory_decommission`). Deliverable: `docs/inventory-migration-report.md` (counts, mapping table, anything unmappable listed for Edgars/Nils). Updates board task `9va5xt` to in-review. The `[DEMO]`-tagged seeds stay (cleanup is a separate later step).

---

## 3. Task board

Created 2026-07-04. Every subtask's full spec is THIS file §2 — read it first; board notes are pointers.

| Epic | Parent | Subtasks |
|---|---|---|
| L — Spine-Lego chain | `4hq3fx` | L2 `75d8px` · L1 `knfu33` · L3 `52rg5v` · L4 `kf7gtm` |
| M — Chain visibility | `px77xq` | M1 `5s8w33` (supersedes `ey65kr`) |
| N — Meeting fixes | `tjda6t` | N1 `737vy5` · N4 `dccjvb` · N2 `khx3vd` · N3 `qns35x` |
| O — Inventory migration | `xq363b` | O1 `jkcdxu` (updates `9va5xt`) |
| P — Add-product buttons (UAT 2026-07-04 evening: product creation has NO UI path — full spec in the task notes) | `mugtxc` | P1 `tdcw5p` — runs as an EXTRA parallel sub-agent (owns AllProductsPage, CategoryDetailTabs, NewProductDialog; zero overlap with streams 1–5) |

## 4. Parallelization for the orchestrator (sub-agent streams)

**Max 3–4 concurrent sub-agents.** File ownership is the law — each stream `bus_claim`s its files; only the orchestrator deploys (serialized, after each stream lands, rebase first).

| Stream | Work (in order) | Owns (files) |
|---|---|---|
| **1 — core** | L2 → L1 → L3 → M1 | NewDealDialog, PartyFields, createOrder/_validateOrderParty, orderDeals/sourcingActions, SourcingCard, ChainCard, organisations flag+UI, **OrdersOverview (M1, last)**, timber-mcp create_deal extension |
| **2 — small fixes** | N1 → N4 | GateConfigManager, lifecycle.ts, DealTermsEditor |
| **3 — documents** | N2 → N3 | Deal documents panel, orderDocuments/assemble, order_files-equivalent, compiler registry, order_external_refs actions (NOT OrdersOverview — hand the render to Stream 1/M1) |
| **4 — migration** | O1 | scripts/, staging DB, docs/inventory-migration-report.md |
| **5 — verification** | L4 (read-only from the start; report; leak-fixes in core files go through Stream 1) | staging logins, docs/wave2-walls-verification.md |

Sequencing constraints (the only hard ones): L2 before L1 before L3; M1 after L1 AND after N3 (it renders N3's data); everything else free. Suggested checkpoints: deploy after L2+L1, after N1+N4, after N2+N3+M1, after O1 — verify on staging each time.

**Done =** all subtasks in-review, staging deploy verified per checkpoint, both report docs committed, type-check 8/8, walls report has zero unresolved LEAK rows.
