---
title: 'Restore buyer project visibility for memberships missing their role group'
type: 'bugfix'
created: '2026-09-03'
status: 'done'
baseline_commit: 'b5d2db568857ca7e77ccc2bad614d5cd9bc2511f'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The active AAI buyer belongs to Buyer #1 and that organisation is the buyer on three projects, but the user has no `user_access_groups` assignment. Deal RLS therefore returns no projects even though authentication and membership are valid.

**Approach:** Add an idempotent data migration that restores the canonical buyer, trader, or manufacturer system group only for active memberships whose organisation has exactly one matching Nilitto persona and whose membership currently has no access-group assignment.

## Boundaries & Constraints

**Always:** Preserve RLS as the authoritative visibility wall; scope backfill to active users, active memberships, active organisations, exact single-persona organisations, and memberships with zero existing groups; keep existing assignments untouched.

**Ask First:** Any attempt to infer access for multi-persona organisations or replace an existing custom assignment.

**Never:** Bypass project RLS with the service client in the project loader; expose unrelated organisations' projects; assign buyer access merely from a successful password login.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| AAI buyer | Active customer-only organisation, active membership, no groups | Assign the system `buyer` group; its buyer-side projects become visible | Idempotent on repeat |
| Existing access | Membership already has any group | Preserve all assignments | No mutation |
| Ambiguous persona | Organisation has multiple or no supported personas | Do not infer a group | Leave for explicit administration |
| Inactive record | User, membership, or organisation inactive | Do not grant access | No mutation |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/actions/getProjects.ts` -- correctly scopes non-admin rows to the current organisation and relies on RLS; read-only evidence, do not bypass.
- `supabase/migrations/20260701000010_access_rls_rewrite.sql` -- `can_access_deal_row` requires a per-organisation group granting `side.buy`.
- `supabase/migrations/20260825000001_nilitto_role_navigation.sql` -- canonical Nilitto `buyer`, `trader`, and `manufacturer` groups and rights.
- `apps/portal/src/features/organisations/actions/createOrganisationUser.ts` -- current onboarding already assigns the organisation role group; read-only evidence that this is legacy/incomplete data repair.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- existing static regression suite for project migrations and access invariants.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260903170000_backfill_missing_nilitto_role_groups.sql` -- idempotently assign the exact role group to eligible group-less memberships.
- [x] `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- assert safety predicates, canonical mapping, and no replacement of existing groups.
- [x] Repair AAI in the configured development database and verify its authenticated RLS projection returns exactly its three buyer-side projects.

**Acceptance Criteria:**
- Given the active AAI buyer membership and three AAI buyer-side orders, when the repair is applied and the buyer opens Projects, then those projects are listed.
- Given an existing group assignment, inactive record, or ambiguous organisation persona, when the repair runs, then access is not added or replaced.
- Given a non-party organisation, when its user lists projects, then RLS still hides AAI projects.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @timber/portal exec tsx src/features/projects/__tests__/projects-workspace.test.ts` -- expected: project workspace assertions pass.
- `git diff --check` -- expected: clean patch formatting.

**Manual checks:**
- Authenticated AAI verification returned exactly `TIM-AAI-012`, `TIM-AAI-011`, and `TIM-AAI-002`; the available browser tab remained in the administrator session, so its UI was not used as buyer evidence.

## Suggested Review Order

**Safe legacy access repair**

- Infer only canonical single-persona roles while preserving every explicit assignment.
  [`20260903170000_backfill_missing_nilitto_role_groups.sql:5`](../../supabase/migrations/20260903170000_backfill_missing_nilitto_role_groups.sql#L5)

- Enforce active records, ambiguity exclusion, and idempotency in regression coverage.
  [`projects-workspace.test.ts:401`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L401)
