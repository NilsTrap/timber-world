---
title: 'Catalogue specification line quantity and notes editing'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: '0b4df90e2ceae83a229827c14f3dd1253652c5fa'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The UI offers editing inconsistently, while the server rejects every edit to a catalogue-derived specification line as immutable. Users must be able to correct quantity and technical notes without replacing the line.

**Approach:** Preserve immutable catalogue identity, product fields, processes, and unit, but allow existing specification editors to update quantity and notes while the canonical draft/root-leg permission remains valid.

## Boundaries & Constraints

**Always:** Apply the existing server permission and draft/root-leg guard; preserve catalogue product/variant links and structured snapshot fields; validate quantity against the persisted catalogue unit; allow quantity and notes editing for catalogue and custom lines.

**Ask First:** Any request to edit catalogue-derived identity, unit, basic fields, processes, or pricing.

**Never:** Convert a catalogue line into a custom line during editing; delete and recreate a line; bypass lifecycle or role authorization.

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/actions/projectSpecificationActions.ts` -- specification mutation boundary.
- `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` -- edit controls and constrained dialogue.
- `apps/portal/src/features/projects/projection.ts` -- catalogue-snapshot marker projection.
- `apps/portal/src/features/projects/types.ts` -- client-safe line contract.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- regression contract.

## Tasks & Acceptance

**Execution:**
- [x] Project a non-sensitive catalogue-snapshot marker to the editor.
- [x] Permit quantity/notes-only updates while preserving snapshot fields.
- [x] Show edit for every editable line and lock catalogue-derived deliverable/unit.
- [x] Add regression coverage and run portal/MVP gates.

**Acceptance Criteria:**
- Given a draft catalogue-derived line, editing quantity or notes succeeds without changing its catalogue fields, processes, product, variant, or unit.
- Given a direct request attempting to rename or change the unit of a catalogue line, persisted catalogue identity and unit remain unchanged.
- Existing custom-line editing remains unchanged.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate`
- `pnpm --filter @timber/portal type-check`

## Suggested Review Order

**Server mutation boundary**

- Preserves catalogue identity while applying validated quantity and notes updates.
  [`projectSpecificationActions.ts:186`](../../../apps/portal/src/features/projects/actions/projectSpecificationActions.ts#L186)

- Centralizes exact catalogue-versus-custom update payloads for executable verification.
  [`specificationLineEdit.ts:8`](../../../apps/portal/src/features/projects/services/specificationLineEdit.ts#L8)

**Editor behavior**

- Exposes editing for catalogue snapshots without broadening structured custom-line editing.
  [`ProjectSpecificationEditor.tsx:98`](../../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L98)

- Locks immutable fields and aligns discrete quantity controls with server validation.
  [`ProjectSpecificationEditor.tsx:111`](../../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L111)

**Regression coverage**

- Proves catalogue updates ignore attempted product and unit mutations.
  [`specificationLineEdit.test.ts:4`](../../../apps/portal/src/features/projects/services/__tests__/specificationLineEdit.test.ts#L4)
