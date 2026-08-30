---
title: 'Compact grouped specification tables with attached process rows'
type: 'feature'
created: '2026-08-31'
status: 'done'
baseline_commit: '7289bf39f10c5022728e610b46b83b72a3e9ba38'
context:
  - '{project-root}/../_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Catalogue specification lines currently expand into large two-column forms, making a multi-line specification difficult to scan and obscuring which manufacturing processes belong to each product.

**Approach:** Replace the expanded form with compact spreadsheet-style tables. Group lines that share the same basic-field schema, render one product row per specification line, and render that line’s applicable manufacturing processes immediately underneath as compact calculation rows.

## Boundaries & Constraints

**Always:** Preserve the existing catalogue snapshot, structured-value RPC, optimistic concurrency, specification permissions, root-leg restriction, and price-free specification boundary. Basic properties must edit inline. Process rows must display quantity and unit, support hiding/showing the complete process block, and allow zero-value processes to be hidden or revealed as inactive. Saving must submit every snapshotted field key so the existing RPC remains valid. Read-only users receive the same compact structure without editing controls. Tables must remain usable through horizontal scrolling on narrow screens.

**Ask First:** Any database migration, new persistence state for process applicability, alteration to catalogue-field definitions, or movement of supplier quotation pricing into the technical-specification editor.

**Never:** Create part-level child rows not present in the catalogue; detach process rows into a project-wide process table; duplicate supplier pricing controls; modify downstream specification immutability or commercial-access rules; deploy to staging.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shared schema | Multiple catalogue lines have identical basic field keys/types/units | Lines appear in one grouped product table with their own attached process rows | A line with a different schema starts a separate group |
| Applicable processes | Process value is greater than zero | Process is visible beneath its product by default | User may set it to zero; it becomes inactive after saving |
| Inactive processes | Process value is zero | Hidden by default and revealed by “Show inactive” | Required snapshot keys remain included in save payload |
| Read-only view | Viewer cannot edit specification | Same grouped structure renders values without inputs, checkboxes, or save action | No mutation controls enter the DOM |
| Save conflict | Structured-values version is stale | Existing conflict message is shown and local data is preserved | Refresh remains user-controlled |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` — current line table, expanded structured editor, mutation state, and catalogue/custom-line dialogs.
- `apps/portal/src/features/projects/types.ts` — projected basic-property and process-requirement contracts.
- `apps/portal/src/features/projects/actions/projectSpecificationActions.ts` — guarded structured-value mutation boundary.
- `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` — existing supplier material/process pricing rows; must remain the sole quotation editor.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` — source-level MVP guards.
- `apps/portal/src/features/catalog/__tests__/process-fields.test.ts` — process snapshot regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` — introduce deterministic schema grouping and compact product/process tables; retain catalogue/custom-line dialogs and existing server mutations.
- [x] `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` — provide per-product process collapse, inactive-process reveal, compact applicability toggles, accessible labels, and one save action per editable catalogue line.
- [x] `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` — add guards for grouped tables, attached process rows, inactive-process behavior, read-only rendering, and absence of pricing controls.
- [x] `apps/portal/src/features/catalog/__tests__/process-fields.test.ts` — update structural expectations for the compact editor without weakening snapshot/security assertions.

**Acceptance Criteria:**
- Given ten catalogue lines sharing a schema, when the specification renders, then they are scannable in one compact table rather than ten expanded forms.
- Given a product has process requirements, when its process section is visible, then every process is visually subordinate to that exact product line.
- Given an inactive process is revealed and enabled or assigned a positive quantity, when saved, then the existing structured-value action persists it without schema changes.
- Given the viewer lacks edit permission, when the page renders, then product and process values remain readable and no editable control is exposed.
- Given the supplier enters a quotation, when pricing is required, then pricing continues through the existing RFQ quotation table rather than the specification editor.

## Design Notes

The approved alternative prototype is `apps/portal/public/prototypes/specification-table-process-rows.html`. Process applicability uses the already-supported numeric quantity: positive values are active; zero values are inactive. This avoids an MVP migration while preserving every snapshotted requirement key.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check` — expected: no TypeScript errors.
- `pnpm --filter @timber/portal test:timber-mvp-gate` — expected: all MVP and role-visibility assertions pass.
- `git diff --check` — expected: no whitespace errors.

**Manual checks:**
- Compare the real project specification at desktop and narrow widths against the approved prototype.
- Edit and save basic fields and process quantities, toggle inactive rows, reload, and confirm persistence.
- Verify editable and read-only role views and confirm pricing remains in supplier quotations only.

## Spec Change Log

- 2026-08-31 review pass: separated line and structured-field saves to prevent partial two-mutation saves; restored legacy property visibility; aligned grouping with the approved key/type/unit schema; removed read-only checkboxes; preserved unsaved process quantities across applicability toggles; adopted shared dense-table tokens; and removed invented fallback units.

## Suggested Review Order

**Table architecture**

- Start with schema grouping and the compact horizontally scrollable product table.
  [`ProjectSpecificationTables.tsx:19`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L19)

- Review independent line and structured-field saves at their existing guarded boundaries.
  [`ProjectSpecificationTables.tsx:67`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L67)

**Attached processes**

- Inspect per-product process visibility, applicability, quantity, and read-only behavior.
  [`ProjectSpecificationTables.tsx:98`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L98)

- Confirm schema keys and legacy values remain visible without false grouping.
  [`ProjectSpecificationTables.tsx:126`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L126)

**Integration and regression guards**

- Verify the existing editor retains catalogue/custom-line dialogs around the new table.
  [`ProjectSpecificationEditor.tsx:77`](../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L77)

- Review workspace guards for attached, dense, price-free process rendering.
  [`projects-workspace.test.ts:393`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L393)

- Confirm structured snapshot assertions now target the compact table component.
  [`specificationStructuredValues.test.ts:43`](../../apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts#L43)
