---
title: 'Restore specification editing during Specification stage'
type: 'bugfix'
created: '2026-09-05'
status: 'done'
review_loop_iteration: 0
baseline_commit: '48ec2397dff468a063dd376b9a83f7c9c0d1d42e'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Projects moved to the configured `specification` lifecycle stage lose all specification creation controls because the authorization boundary still recognizes only `draft`. Super Admin and eligible Trader users therefore cannot build the specification at the stage intended for that work.

**Approach:** Treat `draft` and `specification` as the two editable pre-RFQ stages in both the server capability and database mutation guards, while retaining root-leg, role, and later-stage locks.

## Boundaries & Constraints

**Always:** Super Admin and an authorized root-leg Trader can add and edit canonical specification lines in Draft and Specification. Database guards must match UI capability. Downstream legs and post-specification lifecycle stages remain read-only.

**Ask First:** Expanding editing to downstream legs or to RFQ and later stages.

**Never:** Bypass role checks, mutate downstream copies independently, or weaken canonical root ownership.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Specification authoring | Root leg, Specification stage, Super Admin or authorized Trader | Add controls are visible and mutations succeed | N/A |
| Locked workflow | Root leg after Specification stage | Controls remain hidden and writes are rejected | Return stage-specific error |
| Downstream leg | Purchase-only leg | Specification remains read-only | Return forbidden |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/services/projectSpecification.ts` -- shared capability and denial-code boundary.
- `apps/portal/src/features/projects/actions/projectSpecificationActions.ts` -- server action enforcement and user-facing stage errors.
- `supabase/migrations/20260905010000_allow_specification_stage_edits.sql` -- aligns authoritative RPC guards with the UI capability.
- `apps/portal/src/features/projects/services/__tests__/projectSpecification.test.ts` -- role/stage regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] Expand the editable-stage predicate and test Super Admin and Trader cases.
- [x] Update mutation error copy and database function guards.
- [x] Run targeted tests, typecheck, and production build.

**Acceptance Criteria:**
- Given a canonical root project in Specification stage, when a Super Admin or authorized Trader opens it, then Add from catalogue and Custom line are available and persist a new line.
- Given a downstream or later-stage project, specification mutations remain unavailable.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter portal test` -- project tests pass.
- `pnpm --filter portal typecheck` -- TypeScript passes.
- `pnpm --filter portal build` -- production build succeeds.

**Manual checks:**
- Browser acceptance follows deployment because the current staging build does not contain this patch.

## Suggested Review Order

**Authorization boundary**

- Defines both pre-RFQ stages as editable without weakening role or root-leg checks.
  [`projectSpecification.ts:21`](../../../apps/portal/src/features/projects/services/projectSpecification.ts#L21)

- Keeps server-action rejection copy aligned with the expanded stage policy.
  [`projectSpecificationActions.ts:77`](../../../apps/portal/src/features/projects/actions/projectSpecificationActions.ts#L77)

**Database enforcement**

- Updates all authoritative specification RPC guards atomically and fails on schema drift.
  [`20260905010000_allow_specification_stage_edits.sql:3`](../../../supabase/migrations/20260905010000_allow_specification_stage_edits.sql#L3)

**Regression coverage**

- Covers Super Admin and authorized Trader access during Specification stage.
  [`projectSpecification.test.ts:20`](../../../apps/portal/src/features/projects/services/__tests__/projectSpecification.test.ts#L20)
