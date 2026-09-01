---
title: 'Compact applicable properties and direct administrator quotation'
type: 'feature'
created: '2026-09-01'
status: 'done'
baseline_commit: '24709e1'
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Specification property controls and process rows are taller than necessary, every snapshotted property is always shown, successful autosaves can falsely display “Error,” and a platform administrator cannot enter a supplier quotation on an already-created trader-to-supplier leg because no RFQ candidate exists.

**Approach:** Tighten the specification controls and process rows by approximately 15%, disable wheel/trackpad numeric mutation, add per-line property applicability with a compact “Show inactive” control, and let a platform administrator explicitly initialize the assigned seller as the leg’s direct quotation candidate. The resulting prices remain the authoritative supplier quotation and use the existing correction and award workflow.

## Boundaries & Constraints

**Always:** Store property applicability in the line’s immutable-definition snapshot without deleting its label, type, options, or value; default existing and new properties to active; hide inactive properties unless “Show inactive” is checked; prevent mouse-wheel and trackpad gestures from changing any focused numeric specification, quantity, process, or quotation value; return the new concurrency version atomically from every successful structured save; restrict applicability changes and direct-quotation creation to platform admins or existing specification editors as appropriate; require an assigned, active, eligible seller for a direct quotation; preserve candidate-scoped quotation entries, totals, supplier locking, and explicit award behavior; maintain autosave and stale-version protection.

**Ask First:** Creating a quotation for a seller different from the leg’s assigned seller; changing trader-margin calculations; deploying application code beyond the configured staging target.

**Never:** Create a separate specification price, silently manufacture a competitor RFQ, delete inactive property data, expose quotation controls to non-admins, or overwrite another leg/candidate’s quotation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Property applicability | Admin unchecks a property | Property becomes inactive, autosaves, and disappears while “Show inactive” is off | Restore visible state and show an error if save fails |
| Numeric scrolling | Pointer rests over a focused numeric input while page scrolls | Page scrolls normally and the numeric value remains unchanged | No autosave is triggered by the gesture |
| Successful autosave | Database mutation commits | UI receives the committed row version and shows “Saved” | Never report an error after a committed update |
| Existing snapshots | Property lacks an applicability flag | Treat it as active without rewriting unrelated values | No missing-property regression |
| Direct phone quote | Assigned seller leg has no RFQ candidate | Show a clear action to initialize that seller’s quotation, then expose line/process prices | Reject missing/inactive/ineligible sellers |
| Existing quotation | Candidate already exists | Reuse it; never create a duplicate | Return the existing candidate deterministically |
| Award direct quotation | Assigned seller candidate has a submitted quote | Award in place without creating or replacing a leg | Preserve current state if validation fails |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx` -- compact controls, property applicability UI, quotation candidate initialization, and inline price rows.
- `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` -- passes the assigned seller context into the specification table.
- `apps/portal/src/features/projects/components/ProjectDetailView.tsx` -- authoritative current-leg seller and administrator capability source.
- `apps/portal/src/features/projects/actions/projectSpecificationActions.ts` -- validates and persists structured values plus applicability.
- `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- administrator-only direct supplier quotation initialization.
- `apps/portal/src/features/projects/projection.ts` and `types.ts` -- safely project the property applicability flag.
- `supabase/migrations/` -- additive snapshot-applicability and direct-quotation/award database contracts.

## Tasks & Acceptance

**Execution:**
- [x] `ProjectSpecificationTables.tsx` -- reduce property input and process row heights by approximately 15%; disable wheel-based numeric mutation; add per-property checkboxes and hidden-property filtering.
- [x] `types.ts`, `projection.ts`, and specification actions -- carry and autosave an `active` flag while treating absent flags as active.
- [x] Database migration -- validate/persist basic-property applicability, return the committed row version atomically, and create or reuse the assigned seller’s direct quotation candidate idempotently.
- [x] `ProjectRfqActions.ts` and specification composition -- expose a clear admin-only “Create supplier quotation” path when the seller leg has no candidate.
- [x] Award database contract -- allow the matching assigned seller candidate to be awarded in place without rebuilding the leg.
- [x] Regression tests -- cover applicability defaults/filtering, compact styles, idempotent candidate creation, authorization, quotation visibility, and direct award.

**Acceptance Criteria:**
- Given a specification line, when viewed locally, then property inputs and applicable-process rows are approximately 15% shorter without clipping labels or values.
- Given any focused numeric editor, when the user scrolls with a mouse wheel or trackpad, then the page scrolls and the value does not change.
- Given a successful structured mutation, when it completes, then the row shows “Saved” and subsequent edits use its returned version without a second RLS-filtered lookup.
- Given an active property, when an authorized editor unchecks it, then it autosaves and remains hidden after reload until “Show inactive” is enabled.
- Given a platform admin on a leg with an assigned seller and no candidate, when direct quotation creation is selected, then that seller becomes the sole explicit quotation source and price inputs become available.
- Given a non-admin viewer, when viewing the same leg, then direct quotation creation and editable quotation prices are absent.
- Given a submitted direct quotation for the assigned seller, when awarded, then the existing leg is retained and its quotation becomes awarded.

## Spec Change Log

## Design Notes

Property applicability belongs to each project-line snapshot, not the global catalogue field. This lets one line hide a normally valid field without changing other products or projects. The current false error occurs after the mutation: the follow-up user-scoped `updated_at` lookup can return no row although the update committed. Returning the version from the mutation makes persistence and UI status atomic. Direct quotation initialization is an explicit admin action and is idempotent; it represents a phone/email quotation from the already-assigned seller, not a competitive request.

## Verification

**Commands:**
- `pnpm --filter @timber/portal exec tsc --noEmit` -- no TypeScript errors.
- Project specification and RFQ service tests -- all focused regressions pass.
- `pnpm --filter @timber/portal build` -- production build succeeds.

**Manual checks (if no CLI):**
- In the logged-in local browser, hide/show a property, reload, initialize the assigned seller quotation, enter line/process prices, reload, and award it.
- Verify the page and nested process tables remain compact at desktop and narrow widths.

**Completed evidence:**
- Property applicability autosaved, hid the field, persisted, and was restored in the logged-in local UI.
- A focused numeric field retained its value during a trackpad scroll gesture.
- Assigned-seller quotation initialization persisted after reload and exposed 22 line/process price editors.
- Migration `20260901130000` was applied and recorded against the linked environment.

## Suggested Review Order

**Specification editing and autosave**

- Start with the compact editor, applicability controls, retry queue, and price binding.
  [`ProjectSpecificationTables.tsx:60`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L60)

- Follow the atomic structured-save action and returned concurrency version.
  [`projectSpecificationActions.ts:243`](../../apps/portal/src/features/projects/actions/projectSpecificationActions.ts#L243)

- Confirm dialog quantities also avoid native wheel mutation.
  [`ProjectSpecificationEditor.tsx:121`](../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L121)

**Quotation and award boundary**

- Review assigned-seller initialization and allocation-safe in-place award changes.
  [`20260901130000_project_property_applicability_direct_quotation.sql:37`](../../supabase/migrations/20260901130000_project_property_applicability_direct_quotation.sql#L37)

- Verify action authorization permits both placeholder and assigned-seller awards.
  [`projectRfqActions.ts:55`](../../apps/portal/src/features/projects/actions/projectRfqActions.ts#L55)

**Projection and tests**

- Confirm absent applicability flags default to active during projection.
  [`projection.ts:238`](../../apps/portal/src/features/projects/projection.ts#L238)

- Finish with focused validation and migration-contract regressions.
  [`specificationStructuredValues.test.ts:1`](../../apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts#L1)
