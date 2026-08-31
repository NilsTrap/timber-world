---
title: 'Default active processes and compact specification tables'
type: 'ui'
created: '2026-08-31'
status: 'done'
route: 'one-shot'
---

# Default active processes and compact specification tables

## Intent

**Problem:** Process applicability was inferred from a positive quantity, which made zero-quantity draft processes look inactive. The line-item and process tables also reserved unnecessary horizontal space.

**Approach:** Persist applicability separately from quantity, default every catalogue process to active, hide unchecked processes unless explicitly requested, size property columns to their headers, and constrain process quantity/unit columns to compact fixed widths.

## Acceptance

- New and existing process requirements default to active independently of quantity.
- Unchecking a process hides it immediately; `Show inactive` reveals unchecked rows.
- Inactive processes are excluded from quotations in both UI and database enforcement.
- Property columns use their header width rather than a shared minimum width.
- The process table fits its card with narrow Use, Quantity, and Unit columns.

## Suggested Review Order

- Review the compact line-item and applicability interaction in [`ProjectSpecificationTables.tsx`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx).
- Review persisted applicability and RFQ safeguards in [`20260831120000_project_process_applicability.sql`](../../supabase/migrations/20260831120000_project_process_applicability.sql).
- Review quotation filtering in [`ProjectRfqCard.tsx`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx).
- Review projection and validation coverage in [`projects-projection.test.ts`](../../apps/portal/src/features/projects/__tests__/projects-projection.test.ts) and [`specificationStructuredValues.test.ts`](../../apps/portal/src/features/projects/services/__tests__/specificationStructuredValues.test.ts).
