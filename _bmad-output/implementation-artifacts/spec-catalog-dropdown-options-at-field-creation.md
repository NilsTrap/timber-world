---
title: 'Create dropdown options with catalog fields'
type: 'feature'
created: '2026-08-31'
status: 'done'
baseline_commit: '7932b32d94963583d0c358b03570ecdb9b652a78'
context:
  - '{project-root}/docs/nils-agent-onboarding.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dropdown fields can be created, but their values are hidden behind an unlabeled row chevron and can only be added after field creation. This makes the feature difficult to discover and leaves new dropdown fields incomplete.

**Approach:** When the selected field type is a dropdown, show an explicit option builder inside the new-field form and persist those options immediately after the field is created. Keep a clearly labeled option-management control on every existing dropdown field.

## Boundaries & Constraints

**Always:** Preserve the existing field and option data model, permissions, audit logging, and category assignments. Clearly distinguish the stored value from the user-facing label. Surface partial option-save failures without hiding that the field itself was created.

**Ask First:** Any database schema or migration change.

**Never:** Deploy to staging, mutate production, require at least one option, or remove the existing ability to add and delete options later.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Create dropdown | Valid field plus zero or more complete option rows | Field and entered options are created; option management is opened | N/A |
| Incomplete option | Value or label missing | Field creation is blocked and incomplete row is identified | Show validation toast |
| Option persistence failure | Field succeeds but an option fails | Created field remains visible with successful options and management open | Explain partial failure and allow retry |
| Existing dropdown | Dropdown field row | Visible Manage options control opens the option editor | N/A |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/catalog/components/GlobalFieldsPage.tsx` -- global field creation, field list, and option-management UI.
- `apps/portal/src/features/catalog/actions/fields.ts` -- existing audited persistence actions reused for fields and options.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/catalog/components/GlobalFieldsPage.tsx` -- add draft option rows to dropdown field creation, persist them after field creation, and replace the hidden chevron with a labeled management control.
- [x] Run portal type checking and exercise the local page.

**Acceptance Criteria:**
- Given a new field form, when type Select (dropdown) is chosen, then an understandable Dropdown options editor is visible before creation.
- Given valid option rows, when the field is created, then the field and options appear together without a separate discovery step.
- Given an existing dropdown field, when viewing its row, then a labeled Manage options control shows how to maintain its values.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter portal type-check` -- expected: no TypeScript errors.

**Manual checks:**
- On `/admin/settings/fields`, choose Select (dropdown), add option rows, create the field, and confirm the options are shown under the new field.

## Suggested Review Order

**Creation and persistence**

- Validate complete option rows and save them with the newly created field.
  [`GlobalFieldsPage.tsx:83`](../../../apps/portal/src/features/catalog/components/GlobalFieldsPage.tsx#L83)

- Present understandable option fields directly inside dropdown creation.
  [`GlobalFieldsPage.tsx:232`](../../../apps/portal/src/features/catalog/components/GlobalFieldsPage.tsx#L232)

**Ongoing management**

- Make option counts and the management action visible on every dropdown row.
  [`GlobalFieldsPage.tsx:303`](../../../apps/portal/src/features/catalog/components/GlobalFieldsPage.tsx#L303)
