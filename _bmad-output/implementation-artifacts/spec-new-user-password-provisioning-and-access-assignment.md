---
title: 'Provision passwords and access for newly created organisation users'
type: 'bugfix'
created: '2026-09-05'
status: 'done'
baseline_commit: 'f0e037817b72bdb583a89b3b6cf1d657f41e8463'
review_loop_iteration: 0
context:
  - 'timber-world/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Newly created organisation users may not show the manual password action because no Supabase auth identity exists yet. User creation can also partially succeed and show “User created but access could not be assigned” when the organisation is missing the module ceiling required by its role preset.

**Approach:** Let authorised password management provision and link an auth identity when necessary, then set the password. Make organisation-user creation repair the role’s required base modules before assigning its access group so a successful create has immediately usable access.

## Boundaries & Constraints

**Always:** Preserve exact-organisation membership checks, active-user checks, platform-admin protections, trader restrictions, effective access as organisation ceiling intersected with access-group rights, generic provider errors, and secret-free logs/audits. Roll back a newly created auth identity if linking it to the portal user fails.

**Ask First:** Any change that broadens trader password administration beyond its own single-organisation users, or changes role permissions beyond existing role presets.

**Never:** Return, log, email, or persist the plaintext password; silently grant access outside the organisation role; weaken password validation; overwrite an existing linked auth identity.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New user password | Active `created` portal user with active membership and no auth identity | Key action is visible; setting a password creates, links, confirms, and activates the auth user | Roll back a newly created auth user if portal linking fails; show generic failure |
| Existing user password | Active `invited` or `active` user with linked auth identity | Existing auth password is updated | Show generic failure without exposing provider detail |
| New user access | Organisation has a single buyer/trader/manufacturer role but missing required base modules | Required preset modules are enabled and the matching role group is assigned | Return a specific creation failure only if repair or assignment genuinely fails |
| Forbidden target | Inactive/wrong-company/platform-admin/multi-org target outside caller authority | No auth or portal mutation | Return permission denied |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/organisations/services/manualPasswordReset.ts` -- password provisioning/reset transaction boundary.
- `apps/portal/src/features/organisations/components/manualPasswordEligibility.ts` -- key-action visibility.
- `apps/portal/src/features/organisations/actions/createOrganisationUser.ts` -- organisation-user creation orchestration.
- `apps/portal/src/features/organisations/services/personOnboarding.ts` -- role preset and organisation module-ceiling helpers.
- `apps/portal/src/features/organisations/services/__tests__/*` -- onboarding and password regression coverage.
- `supabase/migrations/20260905000001_repair_role_user_access.sql` -- repairs existing role ceilings and memberships left without a default group.

## Tasks & Acceptance

**Execution:**
- [x] `manualPasswordReset.ts` and eligibility -- provision auth identities for eligible new users and expose the action.
- [x] `personOnboarding.ts` and `createOrganisationUser.ts` -- ensure role-required modules before assigning the role group.
- [x] Service tests -- cover provisioning, rollback, existing reset, permissions, module repair, and real assignment failure.

**Acceptance Criteria:**
- Given any newly created active organisation user, when an authorised super admin opens user actions, then Set password is available and produces a working linked login.
- Given a correctly classified organisation missing base role modules, when a user is created, then role modules and role-group access are assigned without a false partial-success error.
- Given a genuine provider, database, or permission failure, the action fails safely and does not expose secrets or leave a newly created orphan auth account.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- complete portal regression gate passes.
- `pnpm --filter @timber/portal type-check` -- no TypeScript errors.
- `pnpm --filter @timber/portal build` -- production build succeeds.

## Suggested Review Order

**Password provisioning**

- Provision, link, and safely roll back a new authentication identity.
  [`manualPasswordReset.ts:77`](../../apps/portal/src/features/organisations/services/manualPasswordReset.ts#L77)

- Expose password setup for every active organisation user state.
  [`manualPasswordEligibility.ts:7`](../../apps/portal/src/features/organisations/components/manualPasswordEligibility.ts#L7)

**Access assignment**

- Repair required module ceilings before creating the portal user.
  [`createOrganisationUser.ts:38`](../../apps/portal/src/features/organisations/actions/createOrganisationUser.ts#L38)

- Centralize the existing role-to-module requirements.
  [`personOnboarding.ts:31`](../../apps/portal/src/features/organisations/services/personOnboarding.ts#L31)

- Backfill existing incomplete memberships without replacing custom assignments.
  [`20260905000001_repair_role_user_access.sql:4`](../../supabase/migrations/20260905000001_repair_role_user_access.sql#L4)

**Regression coverage**

- Verify new-auth provisioning, rollback, and security boundaries.
  [`manualPasswordReset.test.ts:153`](../../apps/portal/src/features/organisations/services/__tests__/manualPasswordReset.test.ts#L153)

- Verify module repair and genuine database failure behavior.
  [`personOnboarding.test.ts:253`](../../apps/portal/src/features/organisations/services/__tests__/personOnboarding.test.ts#L253)
