---
title: 'Catalogue assigned fields in project specification snapshots'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: '6c293b7'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A catalogue category can define product, variant, and process fields without preset product values. Creating a project specification line currently drops every blank assignment, so the line expands to “No additional structured fields” even though its catalogue category defines 29 fields. The working metal-stairs sample is misleading because a one-off seed manually inserted seven basic values and sixteen process values.

**Approach:** Snapshot every assigned field definition when a catalogue line is created, not only fields that already have values. Preserve configured values where present, initialize blank basic fields visibly and process quantities to zero, and let an authorized first-leg specification editor enter project-specific values without mutating the catalogue.

## Boundaries & Constraints

**Always:** Keep product/variant identity and assigned field definitions frozen in the project snapshot; preserve catalogue value precedence (variant over product); retain field label, type, unit, order, and process/basic grouping; validate edits with Zod and the existing draft/root-leg authorization; update specification values atomically; inherit the canonical root snapshot downstream; backfill existing catalogue-derived root lines whose fields were omitted.

**Ask First:** Changing the catalogue itself, allowing downstream legs to change the canonical specification, adding pricing to specification fields, or replacing the snapshot model with live catalogue references.

**Never:** Make old projects change when catalogue definitions change; write project-specific values back into catalogue product/variant values; delete and recreate specification lines; treat blank assigned fields as absent; expose process pricing at this stage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Blank catalogue fields | Category assignment exists but product/variant has no value | Basic field is snapshotted blank; process field appears with quantity `0` and its unit | Creation remains atomic; invalid assignment aborts cleanly |
| Preset value | Product and/or variant carries a value | Snapshot stores the resolved display value, with variant taking precedence | Unsupported/oversized values are rejected |
| Specification edit | Authorized first-leg editor changes field values | Existing snapshot definitions remain; only their values change | Unknown keys, invalid values, non-draft/downstream edits are rejected |
| Existing broken row | Catalogue-linked root line has empty/missing snapshots | Migration backfills assigned definitions without changing identity, quantity, or notes | Existing non-empty project values are preserved |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260830110000_catalogue_assigned_field_snapshots.sql` -- snapshot/backfill and atomic structured-value update boundary.
- `apps/portal/src/features/projects/actions/projectSpecificationActions.ts` -- validated project action invoking the structured-value RPC.
- `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` -- grouped editable basic-property and process controls.
- `apps/portal/src/features/projects/types.ts` -- client-safe snapshot metadata contract.
- `apps/portal/src/features/projects/projection.ts` -- metadata projection without pricing or catalogue internals.
- `apps/portal/src/features/projects/services/` -- pure normalization/validation helpers and executable tests.

## Tasks & Acceptance

**Execution:**
- [x] Add a migration that snapshots all assigned definitions, defaults missing processes to zero, atomically updates values, and backfills empty catalogue-derived root lines.
- [x] Extend the projected basic/process contracts with the metadata required for safe grouped inputs.
- [x] Add a Zod-validated, permission-checked action for structured specification values.
- [x] Render editable “Basic properties” and “Production processes” groups for authorized editors; render the same values read-only for other viewers.
- [x] Add regression coverage for blank assignments, value precedence, unknown-key rejection, preservation, and existing line editing.

**Acceptance Criteria:**
- Given the existing Metal sheets catalogue variant with 29 assigned fields and no EAV values, when it is added to a draft spine specification, then expanding it shows all applicable basic and process fields rather than the empty-state message.
- Given an authorized specification editor, when values are saved, then a refresh shows those values while catalogue definitions remain unchanged.
- Given a downstream or unauthorized viewer, the structured specification is visible according to existing access rules but cannot be edited.
- Given an older empty catalogue snapshot, applying the migration makes its assigned fields available without altering the line’s quantity, notes, product, or variant.

## Spec Change Log

- 2026-08-30: Implemented assigned-field snapshots, safe draft-only repair, atomic editing, and review hardening.

## Design Notes

Blank product/variant fields are stored as snapshot entries with `value: ""`; blank process quantities are stored as `0` because process requirement rows require a concrete quantity and quotation coverage already treats them as quantitative requirements. Snapshot entries carry only presentation/validation metadata (`key`, `label`, `type`, `unit`, `value`, `sortOrder`), not live catalogue IDs or prices.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check`
- `pnpm --filter @timber/portal test:timber-mvp-gate`
- `git diff --check`

**Manual checks:**
- Add Metal sheets to a draft root specification, expand it, edit values, refresh, and verify the catalogue product remains unchanged.

## Suggested Review Order

**Database boundary**

- Start with snapshot creation, repair scope, validation, and atomic concurrency handling.
  [`20260830110000_catalogue_assigned_field_snapshots.sql:15`](../../supabase/migrations/20260830110000_catalogue_assigned_field_snapshots.sql#L15)

- Review the draft-only historical repair and downstream snapshot propagation.
  [`20260830110000_catalogue_assigned_field_snapshots.sql:133`](../../supabase/migrations/20260830110000_catalogue_assigned_field_snapshots.sql#L133)

- Inspect the authoritative structured-value update RPC and permission boundary.
  [`20260830110000_catalogue_assigned_field_snapshots.sql:166`](../../supabase/migrations/20260830110000_catalogue_assigned_field_snapshots.sql#L166)

**Application validation and UI**

- Validate payload limits, numeric normalization, duplicate protection, and concurrency token mapping.
  [`specificationStructuredValues.ts:6`](../../apps/portal/src/features/projects/services/specificationStructuredValues.ts#L6)

- Follow the server action from authorization through the atomic RPC call.
  [`projectSpecificationActions.ts:240`](../../apps/portal/src/features/projects/actions/projectSpecificationActions.ts#L240)

- Review grouped basic/process controls and refresh-safe local editing state.
  [`ProjectSpecificationEditor.tsx:172`](../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L172)

**Projection and regression coverage**

- Confirm snapshot metadata reaches the UI without live catalogue coupling.
  [`projection.ts:313`](../../apps/portal/src/features/projects/projection.ts#L313)

- Exercise validation, migration contracts, and editor wiring in the MVP gate.
  [`specificationStructuredValues.test.ts:11`](../../apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts#L11)
