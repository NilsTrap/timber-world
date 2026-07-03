# A2 — buy-line migration report (Spec-Alignment Wave · Epic A)

**Ran:** 2026-07-03 · **Env:** STAGING (`fyzrtqsnmnizoxgcqsjc`) · **Prod:** FROZEN (not touched).
**Script:** `apps/portal/scripts/a2-migrate-buy-lines.mts` (shared logic: `apps/portal/scripts/lib/buyLineMigration.mts`, also wired into the E8 cutover script).

## What it does
Normalizes every conflated `side='buy'` `order_line_item` onto the deal that should **own** it, stored as `side='sell'` (a deal's own lines are always `sell`) — spec §2.1 ("no buying inside a selling deal") + §2.3 ("the connection is the spine"):
- **In-place re-tag** if the owning order is itself a `purchase_only` **buy leg** (its buy lines are its own, just mislabelled).
- **Move** to the spine-sibling buy leg otherwise, resolved via **shared `spine_id` + party roles** (the `purchase_only` deal on the same spine whose buyer == this order's seller/house). `upstream_deal_id` is only a cross-check.
- **Report, don't guess** when no buy leg is resolvable.

Idempotent + reconciling (fails if any order that HAS a buy leg still carries buy lines).

## Result on staging
Baseline: **2** `side='buy'` line items across **2** orders.

| Order | deal_kind | Action | Detail |
|---|---|---|---|
| `ART-TWG-067` (`afa627df…`) | `purchase_only` (a buy leg) | ✅ **Re-tagged in place** buy→sell | Its own purchase line (`[DEMO] Glulam Beam GL28h Spruce`, 1 650.00) was mislabelled `side='buy'`; now correctly `sell`. |
| `cf9f7705-6fa6-4a46-a2d4-adea392f485c` | `buy_sell` | ⚠️ **Reported — left for Edgars** | Orphan demo row: **no spine, no seller/buyer/customer, no deal_code**. One `[DEMO] Glulam Beam GL28h Spruce` buy line (420.00). Cannot form a bilateral deal → not migrated. |

Post-run reconciliation: **0** buy lines remain on any order that has a spine-sibling buy leg ✓. The **1** remaining buy line is the reported orphan above.

## Resolution of the orphan (2026-07-03)
- **`cf9f7705…`** — Edgars confirmed (after checking with Nils) it was zero-risk junk demo data. Its residual `side='buy'` line (`[DEMO] Glulam Beam`, 420.00) was **deleted on staging**. Staging now has **0 `side='buy'` line items across all orders** — fully migrated.
- Nils confirmed the model explicitly: **buying and selling are separate deals, united by the "spine" (his "specification number")** — matching spec §2.1/§2.3.

## Interaction with A5 (field-wall filter)
The plan proposed A5 remove the `dealFields.ts` buy-drop projection (`item.side !== "buy" || dealKind !== "buy_sell" || seeSupplier`) as "dead logic". **Decision: keep the filter** as a defence-in-depth guard. Even though **staging is now fully clean** (orphan deleted, 0 buy lines), **PROD is frozen and un-migrated** — the E8 cutover (which runs the identical A2 buy-line step) hasn't run there yet, so residual conflated `buy_sell` rows with priced `side='buy'` lines can still exist in prod. Removing the filter before prod is migrated would risk leaking supplier pricing to non-supplier viewers there. Keep it until the prod cutover runs A2; A5 meanwhile deprecates the *write* paths and annotates the column so no NEW buy lines are created.
