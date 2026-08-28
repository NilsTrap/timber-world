---
title: 'Project workflow stage automation'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_commit: 'e00de65'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="user directly requested implementation and previously waived approval checkpoints">

## Intent

**Problem:** Project stages do not consistently follow the RFQ workflow, so an awarded quotation can leave its leg labeled with an earlier stage.

**Approach:** Make the database operations that open and award an RFQ atomically set the corresponding project stage, while retaining unrestricted manual stage selection for platform admins.

## Boundaries & Constraints

**Always:** A newly created project remains Draft; opening an RFQ sets Request for quotation; awarding a submitted quotation sets Awarded in the same transaction; the refreshed UI shows the new stage immediately.

**Ask First:** None for this approved local and staging implementation.

**Never:** Infer production, dispatch, delivery, cancellation, or quotation-review transitions without a concrete workflow event; add status-transition validation; overwrite configurable stage labels or colors.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| RFQ opened | Eligible placeholder leg and candidates | RFQ is created and leg becomes `request_for_quotation` atomically | Existing RFQ validation remains unchanged |
| Winner awarded | Open RFQ and submitted candidate | Seller, value, RFQ result, and `awarded` stage commit atomically | Failed award changes nothing |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260829004000_project_stage_automation.sql` -- patches the authoritative RFQ transaction functions.
- `apps/portal/src/features/projects/components/ProjectRfqCard.tsx` -- refreshes the route after RFQ creation.
- `apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts` -- guards automatic stage wiring.

## Tasks & Acceptance

**Execution:**
- [x] Add atomic RFQ-open and RFQ-award stage changes.
- [x] Refresh the project header after opening an RFQ.
- [x] Add regression assertions and run project gates.
- [x] Apply the shared database migration; keep the frontend change local until the next approved deployment.

**Acceptance Criteria:**
- Given a valid RFQ request, when it is created, then the project header and list show Request for quotation.
- Given a submitted supplier quotation, when it is awarded, then the same leg shows Awarded without manual status selection.
- Given any later stage, manual platform-admin selection remains available and unrestricted.

## Spec Change Log

## Design Notes

Draft is already assigned at project creation. Later operational statuses remain manual because the platform does not yet have authoritative events for them. Quotation review remains manual until its trigger is defined.

## Verification

**Commands:**
- `pnpm --filter portal type-check`
- `pnpm --filter portal test:timber-mvp-gate`

## Suggested Review Order

**Atomic workflow transitions**

- Start with the database-owned RFQ stage changes and failure anchors.
  [`20260829004000_project_stage_automation.sql:1`](../../supabase/migrations/20260829004000_project_stage_automation.sql#L1)

**Immediate UI feedback**

- Refresh the route after RFQ creation so the header displays its new stage.
  [`ProjectRfqCard.tsx:54`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx#L54)

**Regression coverage**

- Guard both stage keys and the client refresh binding.
  [`projectRfq.test.ts:49`](../../apps/portal/src/features/projects/services/__tests__/projectRfq.test.ts#L49)
