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
