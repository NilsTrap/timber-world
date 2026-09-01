---
title: 'Multiline specification and inline quotation entry'
type: 'feature'
created: '2026-08-31'
status: 'done'
baseline_commit: 'bd8d5b72b579da11af2f6e63db1b0b947e965f68'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Specification groups with many fields require horizontal scrolling, which makes values hard to scan and edit. A platform administrator who receives a supplier quotation by phone must also leave the specification area and use a separate quotation form to enter the same line and process prices.

**Approach:** Render every compatible specification line as a compact, wrapping, label-and-value grid inside its existing schema group, followed by its applicable-process table and a dedicated quotation-price row. The price editor must update the selected supplier candidate's existing RFQ quotation entries through the current quotation APIs; it must never create an independent specification price.

## Boundaries & Constraints

**Always:** Preserve schema grouping for line items that share properties; avoid page-level horizontal scrolling; keep cell blur/change autosave for technical fields; render select options and Boolean Yes/No controls according to the snapshotted field type; hide number-input spinners; restrict inline quotation editing to platform administrators; require selection of an existing RFQ candidate; calculate line and process subtotals from the same quotation entries used for submission and award; keep supplier quotation locking and award behavior unchanged.

**Ask First:** Creating an RFQ or candidate implicitly when none exists; changing quotation authorization, award rules, database schema, or trader-margin calculations.

**Never:** Store a second estimate, internal price, or specification-only price; bypass `correctProjectQuotation`; expose supplier quotation values to viewers without existing quotation visibility; overwrite another candidate's quotation; treat the displayed subtotal as a persisted source of truth.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Structured editing | Mixed text, number, select, and Boolean fields | Fields wrap into labeled cells and autosave without horizontal page scrolling | Existing value remains visible and an error state/toast appears when save fails |
| Phone quotation | Admin selects an existing candidate and enters unit prices | Existing candidate quotation entries are corrected and totals refresh | Invalid or failed saves remain editable and show an explicit error |
| No RFQ candidate | No existing candidate can be selected | No price input is shown; direct the admin to create/request the quotation first | Do not create hidden RFQ data |
| Awarded quotation | Candidate is already awarded | Values remain visible; admin correction uses existing super-admin correction authority | Supplier remains locked; award state is preserved |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx` -- grouped specification rendering, structured inputs, process rows, and autosave state.
- `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` -- technical-specification card composition and viewer capability inputs.
- `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` -- existing candidate selection, quotation entry mapping, totals, and award UI.
- `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- authoritative RFQ state and administrator quotation correction action.
- `apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts` -- RFQ authorization and quotation contract regression coverage.
- `apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts` -- structured-field rendering and autosave regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx` -- replace the wide property table with grouped wrapping line blocks, preserving inline typed controls, save state, actions, and process rows.
- [x] `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` -- provide administrator/currency quotation context to the specification presentation without broadening ordinary specification permissions.
- [x] `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` -- extract/reuse quotation row mapping and correction UI behavior so inline entry and the RFQ card edit one authoritative candidate quotation.
- [x] `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- reuse the existing safe administrator correction/read contract required by inline entry; retain existing authorization and validation.
- [x] `apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts` and `projectRfq.test.ts` -- cover wrapping typed fields, no spinner controls, candidate-scoped pricing, totals, and use of the existing correction action.

**Acceptance Criteria:**
- Given a line with many properties, when the project is viewed at desktop or narrow width, then its labeled fields wrap within the card and the page does not require horizontal scrolling.
- Given dropdown or Boolean snapshot fields, when rendered inline, then configured options or Yes/No choices are available and save to the structured snapshot.
- Given a platform administrator and an existing RFQ candidate, when unit prices are entered from the specification section, then the candidate's authoritative quotation entries and totals update without creating another price value.
- Given a non-admin viewer, when viewing the same specification, then inline administrator quotation controls are absent.
- Given an awarded quotation, when an administrator corrects it inline, then the correction uses existing admin authority while supplier locking and award state remain intact.

## Spec Change Log

## Design Notes

Each specification line remains inside its schema group but becomes a vertical block: identity and quantity summary, a responsive property grid, a separate quotation row, and its process table. Quotation inputs appear only after an administrator selects an existing candidate, making the supplier source explicit and preventing accidental cross-candidate edits.

## Verification

**Commands:**
- `pnpm --filter @timber/portal exec tsc --noEmit` -- expected: no TypeScript errors.
- `pnpm --filter @timber/portal exec tsx src/features/projects/services/__tests__/specificationStructuredValues.test.ts` -- expected: structured-field tests pass.
- `pnpm --filter @timber/portal exec tsx src/features/projects/services/__tests__/projectRfq.test.ts` -- expected: RFQ tests pass.
- `pnpm --filter @timber/portal build` -- expected: production build succeeds.

**Manual checks (if no CLI):**
- As platform admin, select an existing RFQ candidate, edit line/process unit prices, reload, and confirm the same quotation values and totals appear in both the specification and Supplier quotations sections.
- At narrow and desktop widths, confirm property blocks wrap without page-level horizontal scrolling.

## Suggested Review Order

**Inline quotation workflow**

- Start here: candidate-scoped autosave keeps one authoritative supplier quotation.
  [`ProjectSpecificationTables.tsx:22`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L22)

- Serialized corrections prevent stale or cross-candidate quotation writes.
  [`ProjectSpecificationTables.tsx:81`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L81)

- Shared row mapping keeps specification and RFQ totals consistent.
  [`projectQuotationRows.ts:6`](../../apps/portal/src/features/projects/services/projectQuotationRows.ts#L6)

**Authorization and persistence**

- Admin correction accepts an empty authoritative quote without weakening supplier submission.
  [`projectRfqActions.ts:15`](../../apps/portal/src/features/projects/actions/projectRfqActions.ts#L15)

- Database correction preserves award state while permitting final-entry removal.
  [`20260901090000_admin_empty_quotation_correction.sql:5`](../../supabase/migrations/20260901090000_admin_empty_quotation_correction.sql#L5)

- RFQ card refreshes immediately after inline quotation changes.
  [`ProjectRfqCard.tsx:60`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx#L60)

**Presentation and tests**

- Responsive labeled fields replace the horizontally scrolling property table.
  [`ProjectSpecificationTables.tsx:123`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L123)

- Regression coverage validates typed fields, autosave, and quotation contracts.
  [`specificationStructuredValues.test.ts:51`](../../apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts#L51)
