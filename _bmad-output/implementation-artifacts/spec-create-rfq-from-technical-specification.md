---
title: 'Create RFQ from technical specification'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'b5d2db568857ca7e77ccc2bad614d5cd9bc2511f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Traders currently assemble a technical specification and then must understand the internal leg model before requesting supplier quotations. The normal sourcing path is unclear and can create inconsistent scope.

**Approach:** Add a specification-level Create RFQ flow that selects specification lines, suppliers, and a deadline, then atomically creates the sellerless sourcing leg and RFQ. Once created, the action becomes Manage RFQ and opens that sourcing workspace.

## Boundaries & Constraints

**Always:** Keep the existing sellerless sourcing-leg and award model; select all available lines by default; require at least one line, two eligible suppliers, and a future deadline; freeze scope by copying only selected lines; preserve admin Create leg as a recovery tool; enforce authorization and validation in the database.

**Ask First:** Any change to the two-supplier minimum, award semantics, or supplier notification delivery.

**Never:** Create one leg per invited supplier, mutate the source specification, expose ineligible organisations, or enable RFQ creation without specification lines.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create | Draft buyer-to-trader leg, selected remaining lines, two suppliers, future deadline | One sellerless sourcing leg and one open RFQ are created atomically; navigate to it | No partial leg if validation fails |
| Empty scope | No selected/available line | Creation disabled/rejected | Explain that at least one line is required |
| Existing sourcing leg | Active downstream sourcing leg exists | Show Manage RFQ and do not create another | Navigate to existing workspace |
| Stale allocation | Quantity was allocated concurrently | No RFQ or partial leg is committed | Show conflict and refresh |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx` -- specification header action surface.
- `apps/portal/src/features/projects/components/CreateProjectRfqDialog.tsx` -- RFQ scope/supplier/deadline composer.
- `apps/portal/src/features/projects/actions/projectRfqActions.ts` -- validated server boundary.
- `apps/portal/src/features/projects/actions/getProject.ts` -- sourcing-workspace discovery.
- `supabase/migrations/20260903211000_create_rfq_from_specification.sql` -- atomic authorization and creation.

## Tasks & Acceptance

**Execution:**
- [x] Add source-leg RFQ eligibility and sourcing-workspace projection.
- [x] Add the Create/Manage RFQ header action and composer.
- [x] Add an atomic database RPC that creates selected work packages and the RFQ.
- [x] Cover validation, authorization, rendering, and navigation with focused tests.

**Acceptance Criteria:**
- Given a draft trader-owned leg with specification lines, when the trader opens Create RFQ, then all available lines are preselected and suppliers plus deadline can be chosen.
- Given valid selections, when submitted, then exactly one sellerless sourcing workspace opens with only the selected specification lines and invited suppliers.
- Given an existing active sourcing workspace, when viewing the source specification, then Manage RFQ replaces Create RFQ.
- Given no specification lines, then Create RFQ is visible but disabled.
- Given a non-admin trader, then generic Create leg is not the primary workflow; admins retain it for recovery.

## Spec Change Log

## Design Notes

The sellerless order remains the shared RFQ workspace. Supplier-specific bilateral identity is established only when one quotation is awarded, preserving the current quotation and margin model.

## Verification

**Commands:**
- `pnpm --filter portal test -- projectRfq projects-workspace` -- focused behavior tests pass.
- `pnpm --filter portal typecheck` -- no new TypeScript failures.
- Browser test: create an RFQ from a test project, verify scope and suppliers on the resulting workspace, then verify Manage RFQ navigation.

## Suggested Review Order

**User workflow**

- The specification header launches the primary sourcing workflow.
  [`ProjectSpecificationEditor.tsx:82`](../../apps/portal/src/features/projects/components/ProjectSpecificationEditor.tsx#L82)

- The composer owns scope, suppliers, deadline, validation, and navigation.
  [`CreateProjectRfqDialog.tsx:14`](../../apps/portal/src/features/projects/components/CreateProjectRfqDialog.tsx#L14)

**Authorization and transaction**

- Server projection exposes the workflow only for an eligible source leg.
  [`getProject.ts:231`](../../apps/portal/src/features/projects/actions/getProject.ts#L231)

- The action validates input and maps stable database failures.
  [`projectRfqActions.ts:111`](../../apps/portal/src/features/projects/actions/projectRfqActions.ts#L111)

- One database transaction creates the sourcing leg, scope, and RFQ.
  [`20260903211000_create_rfq_from_specification.sql:2`](../../supabase/migrations/20260903211000_create_rfq_from_specification.sql#L2)

**Supporting contract**

- The projected composer payload is explicit and server-owned.
  [`types.ts:82`](../../apps/portal/src/features/projects/types.ts#L82)
