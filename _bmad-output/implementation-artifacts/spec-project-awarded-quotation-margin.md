---
title: 'Awarded quotation trader margin'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_commit: 'bb4e886dfe42accbc0a120be2c68f66e762c377a'
context:
  - 'docs/spec-alignment-wave.md'
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An awarded supplier quotation records the trader's purchase cost, but the trader cannot define the margin or resulting amount to charge its buyer. This leaves the commercial chain incomplete and gives future quotations, invoices, and other documents no reliable sales amount.

**Approach:** Add a private commercial-pricing block to an awarded RFQ leg. The owning trader or platform admin can enter either a margin amount or a gross-margin percentage; the system calculates the other value and the resulting sales amount, then persists all monetary values in integer cents.

## Boundaries & Constraints

**Always:** Keep the awarded supplier quotation total as the immutable purchase-cost source; use gross-margin percentage (`margin / sales amount × 100`), not markup on cost; keep purchase cost, margin, and derived sales amount server-authorized and absent from unauthorized viewer payloads; use the leg currency; round derived cents deterministically; permit later edits by the owning trader and platform admin.

**Ask First:** Any automatic propagation of the sales amount into another bilateral leg, especially where split sourcing creates multiple supplier legs for one buyer-facing sale; any VAT, tax, commission, discount, currency-conversion, or document-generation rules.

**Never:** Overwrite the awarded quotation total or the current leg's bilateral `value_cents`; expose margin data to buyer or supplier users; treat percentage as cost markup; allow negative margin amounts or percentages of 100% or more.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Percentage entry | Cost €8,000; margin 20% | Margin €2,000; sales amount €10,000 | Reject percentage outside 0–99.99% |
| Amount entry | Cost €8,000; margin €1,500 | Sales amount €9,500; margin 15.79% | Reject negative or unsafe amounts |
| Not awarded | RFQ open/cancelled or no winning quote | Margin editor is absent and save is denied server-side | Return conflict without mutation |
| Unauthorized viewer | Buyer, supplier, or unrelated user | No margin fields cross the server/client boundary | Return forbidden on direct action |

</frozen-after-approval>

## Code Map

- `supabase/migrations/*_project_awarded_quotation_margin.sql` -- add constrained margin and resale columns with RLS-safe update support.
- `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- project awarded-pricing projection and validated save action.
- `apps/portal/src/features/projects/services/projectRfq.ts` -- deterministic money calculations and authorization helpers.
- `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` -- awarded quotation commercial-pricing UI.
- `apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts` -- formula, validation, and access regression coverage.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- server/client field-wall and UI presence checks.

## Tasks & Acceptance

**Execution:**
- [x] Add nullable `margin_amount_cents`, `margin_percent`, and `resale_value_cents` columns to `orders`, with non-negative and percentage-range constraints.
- [x] Extend RFQ state only for authorized managers after an award, and add a Zod-validated save action that re-reads the awarded quotation total before calculating and persisting values.
- [x] Render a compact "Trader margin" card after the awarded candidate, with Amount/Percentage mode, live calculation, save feedback, currency labels, and persisted reload state.
- [x] Add focused automated tests for formula direction, cent rounding, lifecycle guards, and absence from non-manager payloads.

**Acceptance Criteria:**
- Given an awarded quotation owned by a trader, when the trader enters either margin input and saves, then both representations and the sales amount reload consistently.
- Given the same project viewed by its supplier, buyer, or unrelated user, when the RFQ data is loaded, then purchase-cost-derived margin and resale fields are absent.
- Given a platform admin, when editing an awarded leg, then the same margin controls are available.
- Given a later margin edit, when it is saved, then the awarded quotation cost remains unchanged.

## Spec Change Log

## Design Notes

Gross margin is calculated from the final sales amount: `sales = cost / (1 - percent/100)`. Amount mode uses `sales = cost + margin`; its displayed percentage is `margin / sales × 100`. The new resale value deliberately stays on the sourcing leg for this MVP; linking or aggregating it into buyer-facing legs is a separate decision because split procurement can create several cost legs for one sale.

## Verification

**Commands:**
- `pnpm --filter portal test:timber-mvp-gate` -- all project/RFQ/access checks pass.
- `pnpm type-check` -- all workspace packages pass.
- Supabase Management API SQL execution -- additive migrations applied to the configured test database.

**Manual checks:**
- Award a local supplier quotation, save margin once by percentage and once by amount, refresh, and verify cost/margin/sales values plus trader/admin versus buyer/supplier visibility.

## Suggested Review Order

**Authorization and persistence**

- Server action projects private pricing only to RFQ managers and validates every save.
  [`projectRfqActions.ts:67`](../../apps/portal/src/features/projects/actions/projectRfqActions.ts#L67)

- Security-definer RPC re-reads awarded cost and mutates only private commercial fields.
  [`20260829010000_project_awarded_quotation_margin.sql:24`](../../supabase/migrations/20260829010000_project_awarded_quotation_margin.sql#L24)

- Follow-up migration enforces the approved 99.99% maximum at the database boundary.
  [`20260829011000_project_awarded_margin_percentage_limit.sql:2`](../../supabase/migrations/20260829011000_project_awarded_margin_percentage_limit.sql#L2)

**Calculation and UI lifecycle**

- Deterministic gross-margin formulas preserve integer cents and reject unsafe inputs.
  [`projectRfq.ts:14`](../../apps/portal/src/features/projects/services/projectRfq.ts#L14)

- Awarded quotation UI supports both inputs and reloads from exact persisted cents.
  [`ProjectRfqCard.tsx:178`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx#L178)

- RFQ history remains mounted after seller assignment so awarded pricing stays accessible.
  [`ProjectDetailView.tsx:90`](../../apps/portal/src/features/projects/components/ProjectDetailView.tsx#L90)

**Regression coverage**

- Formula direction, rounding, bounds, and migration protections have focused assertions.
  [`projectRfq.test.ts:11`](../../apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts#L11)

- Workspace tests guard manager-only projection and exact-cent reload behavior.
  [`projects-workspace.test.ts:190`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L190)
