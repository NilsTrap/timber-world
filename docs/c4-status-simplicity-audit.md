# C4 · Status-simplicity audit (§6.2) — 2026-07-03

**Task:** verify ordinary users (incl. counterparty logins) see only their own deal's
simple stage; the spine rollup / chain overview stays owner/admin-only. Fix any leak.

**Verdict: NO LEAK FOUND — no code change required for C4.** The two-level status split
(§6.2 "ordinary users … see only a simple indication on their own deal … the full spine
overview is for the owner") is already enforced by the Epic A/B field wall + admin gates.
One sentence per surface checked:

| # | Surface | Finding |
|---|---------|---------|
| 1 | **Deal view** (`getOrderDeal` → `OrderDealView.lifecycleStage`) | `lifecycle_stage` is a `general` field, so every viewer sees their **own** deal's stage (the §6.2 "simple indication"); the spine's rolled-up status is never fetched into the deal view at all. |
| 2 | **Spine id / chain linkage** (`dealFields.ts` `projectDealView`) | `spineId` and `upstreamDealId` are in the `chain` field-domain and are nulled for any viewer without a `chain` grant, so a non-owner cannot even learn their deal's spine id, let alone traverse it. |
| 3 | **Chain card** (`getOrderDealView` → `spineLegs`) | `spineLegs` is populated only `if (isAdmin)`; every non-admin receives `[]` and `ChainCard` renders nothing. |
| 4 | **Owner margin block** (`getOrderDealView`) | The cross-leg buy-total + margin resolve only `if (isAdmin)`, and the margin card is `isAdmin && !isBuyLeg` client-side — never shown to ordinary users. |
| 5 | **Orders overview** (`OrdersOverview` ← `getOrders`) | Each row shows only that deal's own `lifecycle_stage` (colour-coded); there is no spine rollup and no chain/pairing indicator, and `getOrders` runs every non-admin row through the field wall (`projectFields(…, ORDER_FIELD_DOMAINS)`), stripping `spineId`. |
| 6 | **Group-rights seed** (`20260701000009_access_groups.sql`) | The `spine.status` deal-visibility right (line 229) and the `chain` field-domain (line 256) are seeded to **`super-admin` only**; `salesperson` / `purchasing` / `client` / `producer` receive neither — verified. |
| 7 | **MCP read tools** (`timber-mcp/route.ts` `SERVICE_ACTOR`) | The MCP (incl. `timber_get_spine` rollup/lineage) runs as the owner-level service agent (`isPlatformAdmin: true`); it is the house's own automation, not a counterparty-facing login, so it is not a non-owner leak surface (§1.4 — the owner/agent coordinates across parties). |
| 8 | **RLS row isolation** | A counterparty login can `SELECT` only rows it is a party to; sibling legs on the same spine are different rows it is not a party to, so cross-leg chain traversal is blocked at the database even if a spine id were known. |

**Observation (not a leak, tech-debt for a future epic):** the `spine.status` deal-visibility
right is defined, seeded (super-admin only), and editable in `GroupRightsEditor`, but no code
path currently *consumes* it — chain/spine visibility is enforced instead via the `chain`
field-domain + the `isAdmin` gates above. The outcome is correct (non-owners are blocked), so
the right is presently decorative; wiring it would be a deliberate refactor, intentionally left
out of this display-only wave.

**Staging verification:** confirmed programmatically with real non-admin logins (see the Epic C
review report on task `nhb839`).
