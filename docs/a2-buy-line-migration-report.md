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

## Action needed from Edgars
- **`cf9f7705…`** — decide the fate of this orphan `buy_sell` demo row (delete it, or assign parties + a spine so a future A2 run can place its buy line). It is harmless in the UI today (all parties null ⇒ only an admin can open it), but it is why the field-wall buy-drop filter must stay (below).

## Interaction with A5 (field-wall filter)
The plan proposed A5 remove the `dealFields.ts` buy-drop projection (`item.side !== "buy" || dealKind !== "buy_sell" || seeSupplier`) as "dead logic". **The data proves it is NOT dead yet:** the orphan `cf9f7705…` is a `buy_sell` row still carrying a priced `side='buy'` line. Removing the filter would expose that buy price to a non-supplier viewer. **Decision: keep the filter** (documented as a defence-in-depth guard for residual legacy conflated rows) until such rows are cleaned up. A5 instead deprecates the *write* paths and annotates the column.
