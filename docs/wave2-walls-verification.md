# Wave 2 — Walls Verification Sweep (L4 · task `kf7gtm`)

**FINAL pass over the MERGED + DEPLOYED Wave 2 code — 2026-07-04 (branch `feature/timber-spec-phase` @ `efae93f`, staging ● Ready 200).** Read-only. No source, DB, or deploy touched.
Verified at three levels: **A. Code** (party validator, pick-lists, deal-list query, deal-detail action, CRM books, L1 leg actions, L2 traders picker/book, M1 overview), **B. RLS/DB** (policy SQL in `supabase/migrations/` + read-only staging Management-API queries), **C. MCP** (staging readonly token). Browser-login confirmation was NOT possible (admin password rotated, held by Edgars) — the RLS side-right walls hinge on group-right *seeding*, closed via the item-#6 DB audit below; remaining role-by-role UI confirmations are listed at the end.

**Result (code/RLS/MCP): 28 rows checked → 28 PASS, ZERO unresolved CODE leaks.** The new L1/L2/M1 walls are all enforced in the merged code. The ONLY leak is the documented **DATA/CONFIG** one (item #6 — misseeded staging access-groups, owner: Edgars), which is a data fix, not a code change.

**⚠️ DATA/CONFIG LEAK found in the staging seeding audit (item #6, resolved 2026-07-04 via read-only Management-API queries):** misseeded access-groups + mis-flagged counterparty orgs let over-privileged logins — including EXTERNAL counterparty logins — enumerate the entire platform CRM address book, and let internal house staff see both deal sides. This is a **data fix for Edgars/Nils, NOT a code change** (the code's action+module+is_external defense-in-depth is correct in design; every layer is just misconfigured on staging). Full detail + offending rows + remediation in the **"Item #6 — Group-membership audit"** section below.

Nils's 5 walls (from `wave2-spine-lego.md` §1 + L4):
1. Salesperson sees ONLY clients + own trader org(s), NEVER suppliers.
2. Purchasing sees ONLY suppliers, NEVER clients.
3. Counterparty login (supplier/client/producer) sees ONLY their own deal, NEVER spine siblings.
4. No per-salesperson client subsets, no client groups, no geo filters (categories only).
5. Traders = third counterparty category; a Traders CRM view is admin-only.

---

## Verification table

| # | Surface | Role / Login | Method | Result | Evidence (file:line / query) |
|---|---------|--------------|--------|--------|------------------------------|
| 1 | New-deal / Parties org pick-list (server build) | Non-admin salesperson/customer | Code | **PASS** | `getOrderPartyOptions.ts:111-158` — non-admins draw options ONLY from `organisation_trading_partners`, filtered by role flag + `is_active`. No supplier concept in the picker; only `customerOptions`(is_customer) + `manufacturerOptions`(is_manufacturer) are offered. |
| 2 | Party assignment on create/set (server enforcement) | Non-admin (any) | Code | **PASS** | `_validateOrderParty.ts:51-91` `resolvePartySlots` — own-org slot FORCED by role; the picked counterparty re-validated via `isAllowedOrderParty` (trading-partner ∧ role flag ∧ active). Dropdown filtering never trusted. Shared by `createOrder` + `setDealParties`. |
| 3 | New-deal dialog / Parties card (UI picker) | Non-admin | Code | **PASS** | `PartyFields.tsx:42-43` shows only the slot the user may pick; forced slot rendered read-only. `NewDealDialog.tsx` / `DealPartiesCard.tsx` both call `getOrderPartyOptions` — same walled options. Server re-validates (row 2). |
| 4 | CRM "Clients" book (list/create/edit) | Salesperson (clients-right) | Code | **PASS** | `counterparties.ts:80-101` `requireBookAccess("clients")` — admin OR (`counterparty:clients` action ∧ `counterparties.clients` module). Suppliers book unreachable without its own right. |
| 5 | CRM "Suppliers" book | Salesperson (no suppliers-right) | Code | **PASS (never suppliers)** | `counterparties.ts:97` — salesperson lacking `counterparty:suppliers`+module → FORBIDDEN. `listCounterparties` suppliers filter = `is_supplier OR is_producer` (`:146-149`); `updateCounterparty` re-checks `isInBook` (`:314`). |
| 6 | CRM "Suppliers" book | Purchasing (suppliers-right) | Code | **PASS** | Same gate, suppliers side. Purchasing lacking `counterparty:clients` cannot reach the Clients book → **wall 2 (never clients)**. Service-role read is AFTER the right check (documented `:3-16`). |
| 7 | Deal-list query (Orders list / overview) | Non-admin (salesperson/purchasing/counterparty) | Code+RLS | **PASS** | `getOrders.ts:156-158` app filter `.or(seller/buyer/producer = orgId)` is a *superset mirror*; the authoritative narrowing is RLS `can_access_deal_row` on the user-scoped client. Spine siblings have different parties → not returned. |
| 8 | `orders` row visibility (SELECT) | Salesperson (side.sell) vs Purchasing (side.buy) | RLS | **PASS (direction-aware)** | `20260701000010_access_rls_rewrite.sql:87-129` + `20260702000001:45-82` `can_access_deal_row` — member-of-seller ∧ `visibility/deal/side.sell` OR member-of-buyer ∧ `side.buy`. Salesperson (side.sell only) cannot see buy legs; purchasing (side.buy only) cannot see sell legs. **Hinges on group-right seeding — live-login spot-check.** |
| 9 | Counterparty login → own deal only | Supplier / client / producer login | RLS | **PASS** | Same `can_access_deal_row`: only rows where their org is a party AND they hold the matching side right. Sibling legs (different parties) excluded. A supplier's own buy leg = they are the seller → `side.sell` in their own org. |
| 10 | Direct nav to a sibling deal `/orders/<id>` | Counterparty login | Code+RLS | **PASS** | `getOrderDeal` (`orderDeals.ts:163-167`) fetches via the RLS server client (`_dealActor.ts:26` `createClient()`); `.single()` on an inaccessible row → no row → NOT_FOUND. |
| 11 | Deal-detail cross-leg data (margin / buy-leg cost) | Non-admin | Code | **PASS** | `dealActions.ts:126-138` `siblingBuyLegTotalCents`/`hasSiblingBuyLeg` populated ONLY when `isAdmin`. `DealPanel.tsx:192` `showMargin = isAdmin && !isBuyLeg`. |
| 12 | Deal-detail sourcing state (supplier identity) | Salesperson | Code | **PASS** | `dealActions.ts:139-148` `sourcing` populated only when `canStartSourcing` (admin OR suppliers-book); `supplierName` only when `seeSupplier` (`supplier_identity` domain). Salesperson without suppliers-book → `sourcing: null`. |
| 13 | Chain card (all spine legs, both directions) | Non-admin / counterparty | Code | **PASS** | `dealActions.ts:150-151` `spineLegs = getSpineLegs()` only when `isAdmin`; else empty array. `DealPanel.tsx:489` `<ChainCard legs={deal.spineLegs} …>` renders nothing on empty. |
| 14 | `spines` / `spine_lineage` rows | Non-admin / counterparty | RLS | **PASS** | `20260701000010:254-284` — SELECT requires platform-admin OR an accessible party deal on the spine AND `visibility/deal/spine.status` right. Counterparty/ordinary users (no spine.status) cannot read the spine or its lineage. |
| 15 | Order children: line items / documents / external refs | Any non-party login | RLS | **PASS** | `20260616000001_orders_universal.sql:135-151` — `order_line_items`/`order_external_refs`/`order_documents` all `USING can_access_order(order_id)` → same deal wall. |
| 16 | Order files + activity log + `orders` storage bucket | Any authenticated user | RLS | **PASS** | `20260701000010:188-247` — closed the old `USING(true)` holes: `order_files`, `order_activity_log`, and the storage bucket now all gate on `can_access_order` / `order_path_accessible`. |
| 17 | `organisations` row reads (raw org visibility) | Salesperson vs Purchasing | RLS | **PASS (book-aware)** | `20260701000010:315-363` `current_user_shares_context_with_org` — forward partner arm walled by book: client orgs need `counterparty/clients`, supplier orgs (`is_supplier OR is_producer`) need `counterparty/suppliers`. Deal arm gated by `can_access_deal_row` (salesperson stops seeing supplier orgs via raw reads). Policy: `20260601000002:93-99`. |
| 18 | Overview spine/pairing hint | Non-admin | Code | **PASS (double-gated)** | `OrdersOverview.tsx:92-96,154` pairing computed/rendered only `if (isAdmin)`; AND `spineId` is field-walled to null — `dealFields.ts:107` `spineId: f("chain")`, `:304` nulls it without the `chain` grant. Overview gets the real flag: `orders/page.tsx:29,50` `isAdmin(session)`. |
| 19 | No per-salesperson subsets / groups / geo filters | All | Code | **PASS (by absence)** | Pickers + `getOrders` filter on trading-partner links + role flags only. Grep found no client-group / geographic / per-salesperson-subset code paths. Model is categories-only as specified. |
| 20 | MCP staging endpoint (readonly token) | Readonly agent identity | MCP | **PASS (read-only enforced)** | `tools/list` → 20 tools, ALL get/list (no write tools exposed). `timber_create_deal` → `"requires a full-access token (this token is read-only)"`. Unauth POST → HTTP 401. Reads return all 32 orgs / 100 deals — a BROAD INTERNAL read identity by design (agent, not a walled human login); the wall it must respect is read-vs-write, which holds. |
| 21 | New-deal "Trader" (seller) picker — salesperson locked to their trader org(s) | Salesperson | Code+DB | **PASS** ✅ *(L2, now built @ efae93f)* | UI: `getOrderPartyOptions.ts:174,206` `traderOptions = userIsTrader ? userTraderOrgs : partners.filter(is_trader)` — a salesperson's trader options = ONLY their own `is_trader` memberships (`:78-90`). Server wall: `_validateOrderParty.ts:106-129` `resolvePartySlots` — for a trader-bound user the seller MUST be in `sellerCandidates` (their trader memberships) else `FORBIDDEN`; admin picks all (`:87`). The trader slot only ever accepts `is_trader` orgs — **staging has exactly TIM+TWG flagged `is_trader`, neither supplier/customer/producer** (live query) — so no supplier can enter the seller slot. |
| 22 | Traders CRM book = admin-only | Non-admin (salesperson/purchasing) | Code | **PASS** ✅ *(L2, now built)* | Page: `counterparties/traders/page.tsx:20` `if (!isAdmin(session)) notFound()` (unauth → `redirect("/login")` `:19`). Action layer: `counterparties.ts:96` `if (book === "traders") return FORBIDDEN` for non-admins — no rights path exists. Nav: `navItems.ts:97-110` Traders listed ONLY in `ADMIN_NAV_ITEMS`. Unauth HTTP hit on staging → 200 Next client-redirect shell to `/login`, **zero traders data in body** (verified). |
| 23 | Overview spine code / spine filter / Volume col / party order numbers | Non-admin | Code (data + field + component) | **PASS (triple-gated)** ✅ *(M1)* | DATA LAYER: `getOrders.ts:271-294` the spine-code + `order_external_refs` reads run ONLY inside `if (userIsAdmin && …)` — non-admins get empty maps → `spineCode:null`, `externalRefs:[]` (never on the wire). FIELD WALL: `dealFields.ts:108` `spineCode: f("chain")` nulls it for non-chain viewers. COMPONENT: `OrdersOverview.tsx` spine filter `:162`, Volume col `:179,228`, spine badge `:105,188`, party order nos `:123,189,216` all `isAdmin`-gated. |
| 24 | ChainCard spine code (SP-NNN) | Non-admin / counterparty | Code | **PASS (owner-only)** ✅ *(M1)* | `ChainCard.tsx:27` returns null when `legs.length === 0`; `deal.spineLegs` is populated only for admins (`dealActions.ts:150-151`) and `NextLegCard`/ChainCard render behind `{isAdmin && …}` (`DealPanel.tsx:578,489`). SP-NNN header (`ChainCard.tsx:34`) therefore reaches admins only. |
| 25 | New-deal mode choice + origin-order dropdown ("Leg from an original order") | Salesperson | Code | **PASS (admin-only)** ✅ *(L1)* | Server: `legActions.ts:37` `getOriginDealOptions` → `if (!isPlatformAdmin) FORBIDDEN`. UI: `NewDealDialog.tsx:79` origin options load only `if (partyOptions?.isAdmin)`; the mode toggle + leg parties are admin-only (salespeople only ever see blank mode — `:24` comment). |
| 26 | "Create next leg" card on the deal view | Salesperson / non-admin | Code | **PASS (admin-only)** ✅ *(L1)* | Render: `DealPanel.tsx:578` `{isAdmin && <NextLegCard …>}`. Server: `legActions.ts:80` `createDealLegAction` → `if (!isPlatformAdmin) FORBIDDEN`. |
| 27 | Empty-party deal may be held | Non-admin | Code | **PASS (admin-held; not a visibility wall)** ✅ *(L3)* | The one-party-unset hold is exercised through the admin-only leg path (`legActions.ts:71-88` allows either party null). `createOrder`/`resolvePartySlots` still wall any *provided* slot; leaving a party null is not a data-visibility breach (RLS gates on whatever parties ARE set). Observation (not a leak): `createOrder` server-side tolerates a null customer for a trader-bound salesperson, but the New-deal UI requires the customer pick (`partyPickComplete`), and no wall is implicated. |
| 28 | L2 migration surface (`is_trader`) | All | RLS/DB | **PASS (additive, no new RLS surface)** ✅ | `20260704100000_traders_category.sql` — additive `is_trader BOOLEAN DEFAULT false`, seed scoped to two house orgs by explicit id (TIM/TWG); `is_manufacturer` untouched; NO RLS policy change. `is_trader` is a picker/book flag, not an RLS predicate — adds no cross-party read path. Live staging: exactly 2 orgs `is_trader`. |

---

## LEAKs

**CODE leaks: ZERO (unresolved: 0).** Every wall in the current merged code — baseline (rows 1–20) AND the new Wave 2 L1/L2/M1 walls (rows 21–28) — is enforced. Nothing routes to Stream 1.

**DATA/CONFIG leak: ONE — item #6 below. Owner: Edgars (ESCALATED on the bus 2026-07-04; remediation listed; re-audit before E8 PROD cutover).** Over-privileged access-group seeding + mis-flagged counterparty orgs on *staging* let over-privileged logins (incl. external counterparties) enumerate the whole CRM address book and let house staff see both deal sides. Fix is in DATA (reassign users off `legacy-*`, set `is_external=true` on counterparty orgs, disable their `counterparties.*` modules) — **not a code change.** Independent of the Wave 2 merge (the new traders book is admin-only and adds no new rights path).

## Risk to spot-check (config/seeding, not a code leak)

- **Legacy access-groups grant BOTH CRM books.** `20260701000012_e4_review_fixes.sql:21-26` grants every `legacy-*` group BOTH `counterparty/clients` AND `counterparty/suppliers` (transitional). If any *active* salesperson or purchasing user is still assigned to a `legacy-*` group (instead of the proper system Salesperson/Purchasing group), walls 1 & 2 collapse for them — they'd see both books. **Spot-check on staging: confirm no real salesperson/purchasing login sits in a `legacy-*` group.** (Suggested fix if found: reassign to the system group; not a code change.)
- **Side-right seeding is the linchpin of walls 1/2/3 at RLS.** `can_access_deal_row` is correct, but its effect depends on Salesperson groups holding `side.sell` ONLY and Purchasing groups holding `side.buy` ONLY. A group accidentally granted both sides sees both legs. Only a live login (or a `pg_policies`/`access_group_rights` data read) confirms the seed.

---

## Closeout — still pending a live-browser login (staging credential)

The code/RLS/DB walls are all verified above. What remains is *role-by-role UI confirmation* — cheap belt-and-suspenders once a staging login exists (these cannot leak beyond what the verified code/RLS already permit; they confirm the seeded rights render as intended):

1. **Salesperson login** — Orders list shows sell legs only; New-deal "Trader" slot shows ONLY their own trader org (auto-selected if one), zero suppliers; no leg mode-choice / "Create next leg"; CRM shows Clients only (no Suppliers/Traders tab); deal detail no margin/sourcing/chain; sibling `/orders/<id>` → NOT_FOUND.
2. **Purchasing login** — Orders list buy legs only; CRM Suppliers only (no Clients/Traders); prices a buy leg, not a sell leg; no client orgs in any picker.
3. **Supplier login** (counterparty) — exactly ONE deal (own buy leg); no spine code / chain card / siblings.
4. **Client login** (counterparty) — own sell deal only; no upstream buy leg / supplier identity; activity log generic "Sourcing started".
5. **Producer login** (transitional, pre-E8) — own leg only via the migrated buy-leg `side.sell` arm.
6. **Group-membership audit — ✅ RESOLVED 2026-07-04 (read-only DB, no browser): result = LEAK (data/config).** See the item-#6 section below.
7. **L2/L1/M1 code walls — ✅ RESOLVED 2026-07-04 on the merged `efae93f` build:** trader-locked picker (row 21), admin-only Traders book (row 22, incl. unauth-hit → login shell, no data), admin-only overview spine/volume/party-order-nos (row 23), owner-only ChainCard SP-NNN (row 24), admin-only leg mode-choice + "Create next leg" (rows 25–26), empty-party hold (row 27). Only the live-UI confirmations in 1–5 remain.

---

## FINAL VERDICT

**28 walls verified · 28 PASS · ZERO unresolved CODE leaks.** The Wave 2 L1/L2/M1 walls are enforced in the merged+deployed code (`efae93f`, staging Ready/200). The single leak is a **DATA/CONFIG** issue on staging (item #6 — misseeded `legacy-*` access-groups + mis-flagged counterparty orgs), owned by **Edgars**, escalated on the bus, remediation listed, to be re-audited before the E8 prod cutover. No code fix routes to Stream 1.

---

## Item #6 — Group-membership + seeding audit → **DATA/CONFIG LEAK · OWNER: Edgars · ESCALATED (bus, 2026-07-04) · re-audit before E8 prod cutover**

*(RESOLVED via read-only Management-API queries — no browser login needed. This is the ONLY leak in the whole sweep, and it is NOT a code defect.)*

Run against staging `fyzrtqsnmnizoxgcqsjc` with read-only `SELECT`s (PAT in Bearer header only, non-default User-Agent). No writes.

### What is correctly seeded (PASS)
- **System groups are seeded exactly as intended:** `salesperson` → `counterparty/clients` + `visibility/deal/side.sell` ONLY; `purchasing` → `counterparty/suppliers` + `visibility/deal/side.buy` ONLY. `client` → `side.buy` only; `producer` → `side.sell` only. The *design* of the walls is correct.

### The LEAK (data/config, not code)
Two compounding misconfigurations on staging defeat the walls for specific logins:

**(a) 9 transitional `legacy-*` groups each grant BOTH CRM books AND BOTH deal sides** (`counterparty/clients` + `counterparty/suppliers` + `side.sell` + `side.buy`) — confirmed in `access_group_rights`. Migration `20260701000012` said these groups "disappear in E8 when users are reassigned to proper groups" — **that reassignment has NOT happened on staging.** 14 active non-admin users are still on `legacy-*` (or, one case, on both system groups), giving each the union of both books + both sides.

**(b) The module ceiling that was supposed to protect the CRM books is DEFEATED:** every real counterparty org is wrongly flagged `is_external = false` AND has BOTH `counterparties.clients` + `counterparties.suppliers` modules `enabled = true` in `organization_modules`. So `requireBookAccess` (`counterparties.ts:97`, which needs action-right ∧ ceiling-capped module) passes for these users, and `listCounterparties` then service-role-reads the ENTIRE platform-wide book (incl. `bank_account_number`, `vat_number`, `registration_number` — see `COUNTERPARTY_COLUMNS`).

**Only ONE active user is `is_platform_admin` (UAT Admin).** Nils and all house staff are NON-admin, so none of this is "moot via admin bypass" — the over-grant is live.

### Blast radius (which wall, for whom)
- **CRM address-book wall (walls 1 & 2) — BROKEN for every over-granted login, including EXTERNAL counterparties.** Because both books' modules are enabled on their (mis-flagged non-external) orgs, these logins can enumerate ALL clients AND ALL suppliers platform-wide, with full bank/VAT/registration data. **Most severe — external counterparty logins:**
  - **Mārtiņš Pūpols** `martin.pupols@gmail.com` — org **Wood ART.LV SIA** (`is_producer` + `is_supplier`), group `legacy-431fd90a`.
  - **Parth** `parth@ddclondon.co.uk` — org **Ovoms** (`is_customer`), group `legacy-aeaeabfd`.
  - **Niks Trapāns** `n.trapans@gmail.com` — org **Timber Trade Ltd**, group `legacy-f497a2a3`.
- **Deal-side wall (walls 1 & 2) — BROKEN for internal house staff on legacy/dual groups.** For a user whose org is a party on many deals, holding BOTH `side.sell` + `side.buy` means they see BOTH the customer sell legs AND the supplier buy legs of house deals (Nils's "labāk šaurāk" wall, currently open):
  - **UAT Fulfilment** `test-fulfil@timberuat.local` — in BOTH `salesperson` AND `purchasing` system groups (a clean misseed; not even legacy). Sees both sides + both books.
  - **Jānis Siliņš** `janis@timber-international.com`, **TIM** `nils@timber-international.com`, **Aija Bērziņa** `ablueroyal@gmail.com` — house orgs (Timber International / The Wood and Good), all on `legacy-*` → both sides.
  - **Nils** — 6 `legacy-*` groups; over-privileged, but he is the OWNER (intended broad). Flag: he should be `is_platform_admin` (or an explicit owner group), not riding transitional legacy groups.
  - Dev/agency accounts (**Edgars Rozentāls**, **Māris**, **Uldis** @ Inerce SIA; **Edgars (Wood and Good test)**) — over-privileged, but this is Edgars's team.
- **Deal-ROW wall (wall 3) HOLDS even for the misseeded counterparties** — `can_access_deal_row` gates on org-membership (`current_user_in_org`) FIRST, so the extra `side.buy`/`side.sell` only widens a user to deals where THEIR OWN org is a party. Mārtiņš/Parth/Niks still cannot list deals their org isn't in. The leak is the **CRM books** (which do NOT check membership), not the deal list.

### Remediation (DATA — for Edgars/Nils; no code change)
1. **Reassign the 14 users off `legacy-*` groups** to the correct system group (`salesperson` / `purchasing` / `client` / `producer`), and remove **UAT Fulfilment** from one of its two system groups. Then drop the transitional `legacy-*` groups (their planned E8 fate).
2. **Set `is_external = true` on every real counterparty org** (Wood ART.LV, Ovoms, DDC, Timber Trade Ltd, and any other supplier/client org), and **disable `counterparties.clients`/`counterparties.suppliers` on those external orgs** — restoring the module ceiling that gates the address book.
3. Consider making **Nils** (and any true owner) `is_platform_admin` rather than relying on legacy groups.
4. After (1)+(2), re-run the per-user aggregate query — every non-admin should show at most ONE book and ONE side, and no external-org user should hold any `counterparties.*` module.

Nothing here is a code defect; the layered gate (action-right ∧ module ∧ `is_external`) is correctly implemented — all three layers are simply misconfigured on staging. Prod should be audited with the same queries before/at the E8 cutover.

---

## Method notes / caveats

- Levels A (code) and B (RLS SQL) are authoritative for *mechanism*; they prove the walls are coded and the policies exist. What they cannot prove without a live login is the *seeding* of `access_group_rights` (which side-right / book-right each real user's group holds) — flagged above.
- MCP level C exercised the staging endpoint with the READONLY token (`TIMBER_MCP_TOKEN_READONLY`, never printed): confirmed read-only enforcement + auth. The readonly MCP token is an internal broad-read agent identity, NOT one of the walled human roles, so its ability to read all orgs/deals is expected and is not a wall breach.
- Re-verification: the orchestrator will re-run specific rows after each checkpoint deploy (esp. rows 8, 9, 12, 17 after L1/L2, and rows 21/22 once L2's traders category ships).
