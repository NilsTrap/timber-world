---
title: 'Specification cell autosave and durable consecutive edits'
type: 'bugfix'
created: '2026-08-31'
status: 'in-review'
baseline_commit: '7932b32d94963583d0c358b03570ecdb9b652a78'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The specification grid requires separate Save line and Save fields buttons. After one structured-field save, the browser keeps the old concurrency version; the next save is rejected as stale and a refresh restores the previous server value, making the latest edit appear to disappear.

**Approach:** Make the grid behave like a spreadsheet: text and numeric cells save when focus leaves the cell, while select, boolean, and applicability controls save immediately. Serialize mutations per line, update the client concurrency token after every successful mutation, remove manual save buttons, and show a compact Saving/Saved/Error state without resetting locally edited cells.

## Boundaries & Constraints

**Always:** Preserve the existing first-leg, draft-stage, and role authorization; retain optimistic-concurrency protection; save complete structured snapshots atomically; serialize edits from the same row so responses cannot overwrite newer input; retain entered values after a failed request and provide visible error feedback; keep delete as an explicit action.

**Ask First:** Changing lifecycle or access rules, autosaving catalogue identity or unit, removing concurrency checks, or adding collaborative real-time editing.

**Never:** Debounce every keystroke into server writes; issue overlapping writes for one line; refresh the route after each successful cell save; silently discard a failed edit; write project values back to the catalogue.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Property edit | User types in a basic property and leaves the cell | Entire current structured snapshot saves once; Saved state appears | Keep the typed value and show Error/toast if saving fails |
| Consecutive edits | User saves one cell, then edits another | Second mutation uses the version returned by the first; both values persist after reload | Serialize requests; stale response cannot reset newer local state |
| Discrete control | User changes select, boolean, or process applicability | Save begins immediately with the changed value included | Restore neither the old UI nor route automatically on failure |
| Line metadata | User changes quantity or technical notes and leaves the cell | Quantity/notes persist without a button | Existing validation errors remain visible and editable |
| Unchanged blur | User focuses and leaves a cell without changing it | No server request | N/A |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx` -- local row state, cell controls, serialized autosave queue, status indicator, and removal of manual save controls.
- `apps/portal/src/features/projects/actions/projectSpecificationActions.ts` -- return the authoritative post-save `updated_at` token for structured and line mutations.
- `apps/portal/src/features/projects/services/specificationStructuredValues.ts` -- structured payload validation retained for full-snapshot writes.
- `apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts` -- executable source contracts for autosave wiring and version propagation.

## Tasks & Acceptance

**Execution:**
- [x] `projectSpecificationActions.ts` -- return a validated authoritative version after each line or structured-value save so consecutive mutations retain optimistic concurrency.
- [x] `ProjectSpecificationTables.tsx` -- add a per-line serialized mutation queue, dirty-value comparisons, blur/immediate save triggers, and compact aria-live status; remove Save line and Save fields buttons.
- [x] `specificationStructuredValues.test.ts` and related project tests -- cover version return, blur autosave wiring, immediate discrete controls, absence of manual save buttons, and no route refresh on success.
- [ ] Browser-test consecutive basic properties, process quantities/applicability, quantity, and notes; reload and confirm every saved value remains.

**Acceptance Criteria:**
- Given two consecutive edits in one specification line, when each edited cell loses focus, then both values survive a full page reload without a stale-specification error.
- Given an unchanged cell, when focus leaves it, then no save is initiated.
- Given a save failure, when the request completes, then the user-entered value remains visible and the row reports an error.
- Given an editable specification line, no manual Save line or Save fields button is rendered.

## Spec Change Log

## Design Notes

Autosave is commit-on-blur rather than per-keystroke. A row owns one promise chain shared by structured fields and line metadata. Each queued structured mutation reads the latest successful version token and submits a complete snapshot captured at commit time. Successful saves update local committed snapshots and the token without `router.refresh()`, preventing server refreshes from replacing a newer edit.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check`
- `pnpm --filter @timber/portal test:timber-mvp-gate`
- `git diff --check`

**Manual checks:**
- Repeat the reported two-save sequence in the local browser, verify Saving/Saved feedback, reload, and compare persisted values.
- Change a process checkbox and quantity, then reload and confirm applicability and quantity persist.
