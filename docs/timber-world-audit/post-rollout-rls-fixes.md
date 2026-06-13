# Post-RLS-Rollout Fixes & Handoff (June 2026)

Context for whoever picks this up next. After the 2026-05-22 RLS rollout
(`20260522000003/5/7/9`) enabled strict owner-only RLS, several legitimate
cross-org supply-chain flows broke because the app assumed counterparties could
read/transfer each other's rows. The fixes below restore those flows while
keeping the default-deny posture. All changes are on `main` and applied to the
cloud DB unless noted.

## What changed (newest first)

| Commit | Area | Summary |
|---|---|---|
| `3c8959a` | Module enforcement (audit-driven) | **Made the two-layer (org ∩ user) module model consistent across the whole portal + closed two data leaks.** A multi-agent, adversarially-verified audit found only Orders + the new agent/catalogue areas enforced both layers; everything else was org-only or unenforced. Fixes: (1) **CRM** — 16 service-role company/contact actions had NO permission check (any user in an org with `crm.view` could read/write/DELETE companies & contacts); added two-layer `crm.view` gates (taxonomy actions stay admin-only). (2) **Quotes** — `getQuoteRequests`/`updateQuoteRequestStatus` had no auth + RLS `USING(true)` for any authenticated user; gated on `quotes.view`, switched to service-role admin client, and RLS tightened to drop blanket authenticated read/update (`20260613000002`, public insert kept for the marketing form). (3) Flipped **13 org-only page gates** (dashboard/inventory/production/shipments/marketing/quotes/crm[+id]/organisations[+id]/people) from `orgHasModule` → `getUserEnabledModules`. (4) Gated **5 ungated detail routes** (production `[id]`/plans/tracking, shipments `[id]`/new — two client pages became thin server gates rendering extracted clients). (5) competitor-pricing + uk-staircase-pricing now honor their modules; `getStockPrices` gated. (6) **Backfilled** `user_modules` from org grants for active members (`20260613000001`, verified **0 lockouts**) before the flip. (7) **Dropped 11 stale non-registry grants** (`production.*`/`shipments.*`) that were invisible in dialogs, unenforced, and would be silently wiped on any dialog save (`20260613000003`). (8) Removed dead `orders.customer-select` branch (no permission change). Verified: tsc clean, 0 `orgHasModule` call sites left, 2 adversarial review passes (gate-completeness + regression). |
| `94eaf05` | Modules (feature) | Made the new areas from the catalog merge grantable: registered `agents.view` / `agent-orders.view` / `agent-manual.view` / `catalogue.view` (`20260612000001`), converted their 13 admin pages + 53 server-action gates from hard admin-only to admin OR two-layer module check, and added org-user sidebar entries. UI label spelled **"Catalogue"** (route remains `/admin/catalog`, CMS↔marketing.view pattern). |
| `3f4bbee` | Orders cleanup + data | Retired the two obsolete order sub-modules (`20260609000002` deletes `orders.create` + `orders.customer-select` from `modules`/`organization_modules`/`user_modules`). Producer party is now role-driven (`getOrderPartyOptions.producerOptions`), editable **only on the Sales tab** by anyone who can see it. UI label **"Workshop" → "Producer"** (orders table/detail/files). `getActiveOrganisations` (admin shipments picker) decoupled from the orders module → returns trading partners for non-admins. Still-live granular permission: `orders.tab.production.edit` (producer users edit only production-tab fields). |
| `f432293`..`2a85a32` | Orgs + Orders (feature) | **Company roles + role-based order creation + order permission rework.** (1) New `is_customer`/`is_manufacturer`/`is_producer` flags on `organisations` (`20260609000001`), backfilled from order history + manual (TIM=Manufacturer, INE/B55/MAR=Producer); a "Roles" multi-toggle in org details. (2) Add Order auto-fills the creating user's own org into the correct party slot by role; the counterparty is picked from the user's trading partners filtered by role (`getOrderPartyOptions`); admins pick freely. **Server-side validated** (`_validateOrderParty.ts`) — a non-admin cannot assign an arbitrary org. (3) create/edit/cancel gated on `orders.view` (anyone who can see the list); **delete is admin-only** (button hidden for non-admins; they use Cancel). Verified by a 3-lens adversarial pass; fixed the server-validation gap + an analytics-footer column-alignment regression it found. Known minor UX: a customer-side user with no manufacturer trading partner sees an empty Manufacturer dropdown (set up a trading partner). |
| `33f9c62` | Orders (app) + data | **Orders now enforces the two-layer (org AND user) module model.** Previously every Orders gate used `orgHasModule` (org layer only), so per-user `user_modules` checkboxes did nothing. Converted all 11 gates (page tabs/customer-select/view + getOrders/getOrder/createOrder/updateOrder/updateOrderStatus/saveOrderProducts/deleteOrder/add+removeOrderPackage/getCustomerOptions) to `getUserEnabledModules(session.portalUserId, orgId).has(...)`, and added an `orders.tab.prices` gate to `getStaircaseCodes` (prices data was previously ungated). Admin bypass kept as `isAdmin` (role==="admin"); both platform admins satisfy it. Verified 0 lockouts (every non-admin in an orders-enabled org already had `orders.view` at user level; backfill was a no-op). Granted the OVOMS test user `orders.tab.list`. **Known follow-ups (not done):** order file/activity/packages actions take an orderId without an org-membership check (IDOR-class); sidebar uses `role` not `isPlatformAdmin`; `isAdmin` still ignores `is_platform_admin`. |
| `9183d93` | Shipments (app) + data | **`acceptShipment` silently failed to transfer inventory** on internal incoming shipments: the transfer ran on the RLS-bound client, but the receiver isn't a member of the sender's org so the owner-only RLS `USING` filtered out every row — the UPDATE hit **0 rows with no error** and the shipment still completed. Fixed to transfer/renumber/rollback via the admin client (after receiver+pending checks) and to **fail loudly** on a 0-row transfer. Also hardened `getShipmentAvailablePackages` Query 1 with an explicit `organisation_id = orgId` filter (shipment status ≠ ownership). **Data repair:** 57 packages stranded on completed `INE-TWG-014/015/016` were transferred INE→TWG to match their completed status. |
| `fa758d8` | Shipments (app) | Sending to an **external** org failed with "Failed to transfer inventory". The ownership transfer now runs via the **service-role admin client inside `submitShipment.ts`**, gated by `isOwner` + draft state + destination-is-external, scoped by `shipment_id` + current owner. No SQL change. |
| `d4c701d` | RLS (DB) | `20260601000002` — widened `organisations` SELECT so a user can read an org they share a **shipment / order / trading-partner** relationship with (helper `current_user_shares_context_with_org`). Fixes "From: -" sender name, empty trading-partner dropdown, empty Customer/Manufacturer order selectors. |
| `3777982` | RLS (DB) | `20260601000001` — widened `inventory_packages` SELECT so shipment **counterparties** can read packages on a pending shipment (helper `current_user_on_shipment_for_package`). Fixes receivers seeing 0 packages / 0 m³ on incoming "on the way" shipments. |
| `5c51a72` | CI | Playwright runs headless in CI; e2e test creds now come from `E2E_*` env/secrets instead of committed placeholders. |

## Design conventions used (please keep consistent)

- **Cross-org READS** → widen the table's SELECT policy with a `STABLE SECURITY
  DEFINER` helper scoped to the actual relationship (never a blanket grant).
  See `20260601000001` / `20260601000002`. Helpers bypass nested RLS, so no
  recursion as long as the queried tables don't reference the policy's table.
- **Privileged cross-org WRITES** (e.g. ownership transfer) → keep the strict
  owner-only RLS WITH CHECK and perform the write via `createAdminClient()`
  **inside a server action, after** verifying authorization in TypeScript
  (owner check, state check, destination read from the row — never from caller
  input, scope by `shipment_id`). This matches the rollout's stated
  "service-role for intentional bypass" architecture (`20260522000002` header).

## Outstanding / recommended follow-ups

1. **Playwright CI job — needs you.** It has never passed (no app bug — it's
   setup). Remaining: create two test users in the **staging** DB and set repo
   secrets `E2E_ADMIN_EMAIL/PASSWORD` + `E2E_ORG_EMAIL/PASSWORD` (org user must
   belong to an org named "Inerce"). Until then it fails at login.
2. **Migration history discrepancy.** `20260527000001_rls_marketing_anon_read.sql`
   is **applied to the cloud DB** but its file lives only on your
   `feature/product-catalog-schema` branch, not `main`. Merging that branch
   reconciles it. (It had to be temporarily checked out locally to run
   `db push`; it is intentionally not committed to `main` by me.)
3. **Transfer atomicity (hardening).** In `submitShipment.ts` the external
   package transfer (admin client) and the shipment status flip (RLS client)
   are two statements with a manual rollback. A crash between them could strand
   packages in the external org. Optional: wrap both in one SECURITY DEFINER
   RPC for atomicity.
4. **Package-number collision at external orgs (edge).** The outgoing transfer
   doesn't do the renumber-on-collision that `acceptRejectShipment.ts` does. If
   one external org ever receives packages with duplicate `package_number`s from
   different senders, the bulk UPDATE could hit
   `inventory_packages_org_package_unique`. Low likelihood today.
5. **Incoming-from-external one-click (UX).** Incoming already works (receiver
   records goods → they're owned by the receiver; external party does nothing),
   but still has a receiver-side Accept step. Auto-completing it on submit is
   possible but was deferred — it skips `acceptShipment` post-processing and
   needs its own verification.
6. **`organisations` sensitive columns.** The SELECT widening means related
   counterparties can read each other's `bank_account_number` / `vat_number` /
   contact columns (needed for CMR + Packing List PDFs; strictly tighter than
   the pre-RLS "everyone reads everything" baseline). If the business wants
   bank/VAT hidden from partners, the clean path is a column-restricted view
   (`id/code/name/is_external/logo_url`) that cross-org joins embed instead of
   the base table.

## Where everything lives

- **Code:** GitHub `main` @ `fa758d8` (Vercel auto-deploys from `main`).
- **Database:** Supabase cloud project; migrations `20260601000001` and
  `20260601000002` applied. `npx supabase migration list` is in sync except the
  remote-only `20260527000001` noted in item 2.
