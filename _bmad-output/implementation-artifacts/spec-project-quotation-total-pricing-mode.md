---
title: 'Quotation itemized or total pricing mode'
type: 'feature'
created: '2026-09-01'
status: 'done'
baseline_commit: '3f4bd31'
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Supplier and administrator quotation entry currently requires prices against specification lines and processes. Some quotations are received only as one total price for the complete leg/project work package.

**Approach:** Ask the quotation author to choose one of two radio-button modes: `Price by line/process` or `One total project price`. Persist the selected mode and canonical total on the quotation candidate, use the same choice for supplier and platform-admin entry, and render/edit the quotation according to its stored mode.

## Boundaries & Constraints

**Always:** Make pricing modes mutually exclusive; require an explicit mode before submission; calculate itemized totals on the server from canonical quantities and integer-cent unit prices; require a nonnegative integer-cent amount for total mode; store no fabricated supplier line prices for total mode; restore the saved mode when reopening; allow platform admin to correct either mode under the existing lifecycle rules; mark awarded commercial results stale when admin changes either mode; preserve exact quotation totals through award, margin, and downstream roll-up.

**Ask First:** Adding taxes, discounts, freight breakdowns, mixed mode within one quotation, or allowing a total-only source quotation to be partially consumed downstream.

**Never:** Infer mode from whether entries happen to be empty; allow both total and itemized payloads simultaneously; expose an internally derived roll-up allocation as if the supplier submitted line prices; use floating-point money; weaken supplier ownership, RFQ deadline, award locking, or admin authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| New quotation | Supplier or admin opens entry | No prices shown until one radio mode is selected | Submission remains disabled |
| Itemized mode | Canonical line/process unit prices | Server recalculates and stores entries plus exact total | Reject stale, duplicate, inactive, or invalid entries |
| Total mode | One amount for the complete leg | Store mode, empty entries, and exact total cents | Reject missing, negative, unsafe, or mixed payload |
| Change mode | Existing draft/submitted quote is edited | Show confirmation, then replace the inactive representation atomically | Preserve persisted quotation if replacement fails |
| View/award | Total-only quotation | Show one clearly labelled total; allow normal award and margin | Reject inconsistent legacy candidate state |
| Downstream roll-up | Awarded total-only source is selected | Source is whole-leg only; allocate exact total internally across its origin lines using existing quantity-weighted, stable remainder rules | Do not permit partial consumption of that source |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- candidate pricing-mode column, supplier/admin submission contracts, award guard, and aggregate-source allocation.
- `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- shared mode-aware action schemas, projections, and authorization boundary.
- `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` -- supplier/admin mode question, forms, details, and edit-mode restoration.
- `apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx` -- direct admin quotation mode and total-price editor.
- `apps/portal/src/features/projects/services/projectQuotationRows.ts` -- itemized payload conversion and mode helpers.
- `apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts` and `projectCommercialRollup.test.ts` -- pricing-mode and roll-up regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/<new>_project_quotation_pricing_mode.sql` -- add `itemized|total` mode and atomically validate supplier/admin submissions, corrections, awards, and stale propagation.
- [x] `projectRfqActions.ts` and `projectQuotationRows.ts` -- model explicit mode/total inputs and project persisted state without inferring from entries.
- [x] `ProjectRfqCard.tsx` -- add the required radio question to both supplier and admin forms, total editor, switch confirmation, and mode-aware detail.
- [x] `ProjectSpecificationTables.tsx` -- mirror the same mode choice for direct administrator quotation entry and hide item price inputs in total mode.
- [x] Commercial-source migration logic -- make total-only quotes indivisible downstream and allocate their exact cost internally without presenting derived values as supplier prices.
- [x] Focused and MVP-gate tests -- cover permissions, deadlines, editing, mutual exclusion, zero totals, award, stale propagation, allocation rounding, reload, and both user roles.

**Acceptance Criteria:**
- Given a supplier or platform admin starts a quotation, when the form opens, then they must choose itemized or total pricing with radio buttons before entering prices.
- Given total mode, when a valid project total is submitted and reloaded, then the same mode and amount are shown and the quotation can be awarded and margined normally.
- Given itemized mode, when prices are submitted, then existing canonical validation and calculated totals remain unchanged.
- Given an awarded total quote is used downstream, when selected, then only the complete source work package is selectable and its allocated internal cents sum exactly to the submitted total.

## Spec Change Log

## Design Notes

`quote_total_cents` remains the canonical commercial amount in both modes. Total-only quotations intentionally retain `quote_entries=[]`; any per-origin allocation exists only in the private commercial-roll-up boundary and is labelled derived, never supplier-entered.

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- all quotation and project gates pass.
- `pnpm --filter @timber/portal exec tsc --noEmit` -- no TypeScript errors.
- `pnpm --filter @timber/portal build` -- production build succeeds.

**Manual checks (if no CLI):**
- Submit and reopen both modes as supplier and platform admin; award each, apply margin, and verify total-only downstream sources cannot be partially selected.

## Suggested Review Order

**Data integrity and commercial semantics**

- Defines canonical modes, atomic submissions, award guards, and exact whole-package allocation.
  [`20260901170000_project_quotation_pricing_mode.sql:7`](../../supabase/migrations/20260901170000_project_quotation_pricing_mode.sql#L7)

- Enforces total-only sources as indivisible complete work packages.
  [`20260901170000_project_quotation_pricing_mode.sql:102`](../../supabase/migrations/20260901170000_project_quotation_pricing_mode.sql#L102)

**Application boundary and UI**

- Validates mutually exclusive payloads and projects persisted pricing mode.
  [`projectRfqActions.ts:15`](../../apps/portal/src/features/projects/actions/projectRfqActions.ts#L15)

- Adds supplier and administrator radio-mode quotation entry and restoration.
  [`ProjectRfqCard.tsx:33`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx#L33)

- Mirrors total pricing in inline administrator specification editing.
  [`ProjectSpecificationTables.tsx:31`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L31)

- Keeps whole-package downstream source selection explicit and complete.
  [`ProjectCommercialRollup.tsx:70`](../../apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx#L70)

**Supporting logic and regression coverage**

- Converts safe decimal totals to canonical integer cents.
  [`projectQuotationRows.ts:33`](../../apps/portal/src/features/projects/services/projectQuotationRows.ts#L33)

- Covers mode validation, RPC replacement, and database invariants.
  [`projectRfq.test.ts:365`](../../apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts#L365)

- Verifies stable exact-cent commercial allocation behavior.
  [`projectCommercialRollup.test.ts:27`](../../apps/portal/src/features/projects/services/__tests__/projectCommercialRollup.test.ts#L27)
