---
title: 'Fix specification save status timestamp handling'
type: 'bugfix'
created: '2026-09-01'
status: 'done'
route: 'one-shot'
context: ['{project-root}/_bmad-output/project-context.md']
---

# Fix specification save status timestamp handling

## Intent

**Problem:** Structured specification values commit successfully, but PostgreSQL returns the optimistic-lock timestamp in a format rejected by the server action, causing a false save error and stale follow-up saves.

**Approach:** Normalize PostgreSQL timestamps to ISO form without losing microsecond precision, return that version from both specification save paths, and give quotation-price inputs a subtle visible border.

## Suggested Review Order

**Save response contract**

- Preserve database precision while producing a reusable optimistic-lock version.
  [`specificationStructuredValues.ts:28`](../../apps/portal/src/features/projects/services/specificationStructuredValues.ts#L28)

- Apply the normalized version consistently to both save actions.
  [`projectSpecificationActions.ts:236`](../../apps/portal/src/features/projects/actions/projectSpecificationActions.ts#L236)

**Quotation input clarity**

- Give line and process quotation prices the same subtle bordered treatment.
  [`ProjectSpecificationTables.tsx:255`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L255)

**Regression coverage**

- Cover PostgreSQL offsets, invalid values, round trips, and both price inputs.
  [`specificationStructuredValues.test.ts:29`](../../apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts#L29)
