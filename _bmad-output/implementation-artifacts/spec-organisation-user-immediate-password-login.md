---
title: 'Organisation user immediate password login'
type: 'bugfix'
created: '2026-09-05'
status: 'done'
baseline_commit: '74ae34f3ed1a2404fd73e0359cad98bd7a33525a'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A newly added customer, supplier, or trader person can receive an administrator-set password while the matching Supabase Auth identity remains email-unconfirmed. Password authentication then fails before the correctly provisioned organisation membership and role access can be used.

**Approach:** Treat an administrator assigning a password as explicit account verification: atomically request password replacement and email confirmation from Supabase Auth, then activate the portal identity. Repair the reported DDC user and verify the same path for every organisation persona before deploying to staging.

## Boundaries & Constraints

**Always:** Preserve the existing exact-company membership and caller authorization checks; keep passwords and auth identifiers out of logs/results; retain automatic role-group assignment from the organisation's single persona; test provider failure and activation behavior.

**Ask First:** Production deployment, DNS or hosted authentication configuration changes, or any unrelated account mutation.

**Never:** Reveal or replace the user's chosen password; weaken RLS or session validation; create a local database; alter multi-persona onboarding semantics; include generated reports in Git.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New organisation user | Invited auth identity plus active company membership and admin-set password | Auth password is updated, email is confirmed, portal status becomes active, and password login reaches the assigned persona | Generic reset failure with no secret or provider detail |
| Existing confirmed user | Active auth identity and new admin password | Password changes and confirmation remains valid | Existing permission and provider checks remain authoritative |
| Ineligible target | Wrong/inactive membership, missing auth identity, disallowed platform or multi-org target | No auth mutation | Existing DENIED or NO_AUTH_USER result |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/organisations/services/manualPasswordReset.ts` -- server-only password mutation currently sends only `password`; add provider email confirmation while preserving membership gates.
- `apps/portal/src/features/organisations/services/__tests__/manualPasswordReset.test.ts` -- mock provider contract and assertions for confirmation, denial and failure paths.
- `apps/portal/src/features/organisations/actions/createOrganisationUser.ts` -- read-only evidence: creates membership, assigns the one organisation-derived Buyer/Trader/Manufacturer group, then creates the auth invite.
- `apps/portal/src/features/organisations/services/passwordlessInvite.ts` -- read-only evidence: generated invite identities remain unconfirmed until link consumption; manual password assignment must close that lifecycle.
- `apps/portal/src/features/auth/actions/login.ts` -- read-only evidence: password authentication occurs before portal activation and role resolution.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/organisations/services/manualPasswordReset.ts` -- confirm the auth email in the same privileged provider mutation that assigns the password.
- [x] `apps/portal/src/features/organisations/services/__tests__/manualPasswordReset.test.ts` -- prove confirmation is requested on valid paths and never on denied paths.
- [x] Reported DDC user in staging-backed Supabase -- confirm only the existing auth email without changing its password, then validate membership and Buyer group remain intact.
- [x] Staging deployment -- commit the focused fix, deploy the saved staging project, and verify deployment health plus login UI availability.

**Acceptance Criteria:**
- Given a new person belongs to a single-role customer, trader, or supplier organisation, when an authorised administrator sets a password, then the auth identity is confirmed and the person can immediately authenticate with the organisation-derived access group.
- Given the reported DDC user, when the repair is applied, then its chosen password remains unchanged and its customer membership and Buyer access remain active.

## Spec Change Log

## Design Notes

Supabase password sign-in rejects an unconfirmed email before application role logic runs. The safe boundary is the existing server-only admin `updateUserById` call: `{ password, email_confirm: true }`. This matches the business meaning of an administrator explicitly provisioning a login and avoids a second partially successful provider operation.

## Verification

Completed 2026-09-05: 11 manual-password tests, 13 onboarding tests, portal TypeScript, and `git diff --check` passed. The reported DDC identity is email-confirmed without replacing its password and retains one active primary membership plus the Buyer system group. Vercel deployment `dpl_k7wjP93fSYERNBKVQV313NTxtZS3` is Ready and aliased to `https://staging.nilitto.com`; browser smoke testing confirmed the deployed Login page exposes email, password and login controls.

**Commands:**
- `pnpm --filter @timber/portal exec tsx apps/portal/src/features/organisations/services/__tests__/manualPasswordReset.test.ts` -- expected: confirmation and all existing security cases pass.
- `pnpm --filter @timber/portal exec tsc --noEmit --pretty false` -- expected: no TypeScript errors.
- `git diff --check` -- expected: clean.
- Staging account state query -- expected: DDC portal identity active, one active primary membership, Buyer system group, confirmed auth email.
- Staging deployment inspection and browser smoke test -- expected: Ready deployment and reachable login page.

## Suggested Review Order

**Authentication lifecycle**

- Confirm password and auth email together before activating the portal identity.
  [`manualPasswordReset.ts:66`](../../apps/portal/src/features/organisations/services/manualPasswordReset.ts#L66)

- Preserve exact membership and target-account authorization before provider mutation.
  [`manualPasswordReset.ts:44`](../../apps/portal/src/features/organisations/services/manualPasswordReset.ts#L44)

**Regression coverage**

- Assert every successful admin password assignment requests email confirmation.
  [`manualPasswordReset.test.ts:104`](../../apps/portal/src/features/organisations/services/__tests__/manualPasswordReset.test.ts#L104)

- Keep provider-call shape explicit in the reusable test fixture.
  [`manualPasswordReset.test.ts:34`](../../apps/portal/src/features/organisations/services/__tests__/manualPasswordReset.test.ts#L34)
