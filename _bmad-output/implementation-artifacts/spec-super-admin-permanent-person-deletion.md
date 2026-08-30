---
title: 'Super-admin permanent person deletion'
type: 'feature'
created: '2026-08-30'
status: 'done'
baseline_commit: '888f75d'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Platform administrators can deactivate people but cannot permanently remove a person and their authentication identity. The retained profile and Auth email prevent inviting the same email again.

**Approach:** Add an explicit super-admin-only permanent-delete action to the People directory. Delete login/access data while retaining business records with deleted-user attribution cleared, then make the email immediately reusable for a fresh invitation.

## Boundaries & Constraints

**Always:** Require a current platform-admin session; reject deletion of the signed-in admin's own person record; require an explicit destructive confirmation naming the person and email; remove the Supabase Auth identity and portal person; remove dependent memberships, groups, sessions/API keys, and other access-only records; preserve projects, orders, quotations, files, audit history, and other business records by clearing nullable historical actor references; return a clear error and refresh the directory only after complete success; audit successful deletion without storing secrets.

**Ask First:** Any need to delete business records, organisations, projects, orders, files, quotations, or audit records; any requirement to permit non-platform-admin deletion; any deployment or staging migration.

**Never:** Soft-delete instead of satisfying the requested permanent deletion; allow self-deletion; expose service-role credentials; silently claim success after only deactivation or profile deletion; leave a successfully deleted person's email reserved in either Auth or `portal_users`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Permanent delete | Platform admin selects another person and confirms | Auth identity, portal profile, memberships, groups, keys, and access records are removed; historical business rows remain; email can be invited again | Show success and reload People directory |
| Person has no Auth identity | Created profile was never invited | Portal profile and dependants are removed | Same successful result |
| Self-delete | Target person equals current session person | No mutation | Return a specific forbidden error |
| Unauthorized call | Non-platform-admin invokes action directly | No mutation | Return permission denied |
| Auth or database failure | One deletion step fails | Do not report success; keep/recover a retryable state | Return a safe actionable error; no credentials or raw internals |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/organisations/components/PeopleTable.tsx` -- People-directory actions and confirmation dialogs.
- `apps/portal/src/features/organisations/actions/deletePerson.ts` -- new guarded permanent-delete orchestration.
- `apps/portal/src/features/organisations/actions/_platformAdmin.ts` -- current platform-admin/session guard.
- `apps/portal/src/features/organisations/actions/index.ts` -- public action export.
- `supabase/migrations/20260830100000_permanent_portal_user_deletion.sql` -- safe FK behavior and transactional profile cleanup contract.
- `apps/portal/src/features/organisations/personDeletion.test.ts` -- permission, self-delete, retention, and UI contract coverage.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260830100000_permanent_portal_user_deletion.sql` -- make access-only relations cascade and historical actor relations nullable/`SET NULL`, and provide a narrowly scoped deletion function if needed for atomic profile cleanup.
- [x] `apps/portal/src/features/organisations/actions/deletePerson.ts` -- validate UUID and authority, reject self-delete, remove Auth plus profile safely, audit success, and revalidate admin people routes.
- [x] `apps/portal/src/features/organisations/actions/index.ts` -- export the action.
- [x] `apps/portal/src/features/organisations/components/PeopleTable.tsx` -- add trash action, explicit permanent-delete confirmation, busy state, toast, and reload.
- [x] `apps/portal/src/features/organisations/services/__tests__/personDeletion.test.ts` -- cover the edge-case matrix and destructive UX contract.

**Acceptance Criteria:**
- Given a different person with historical project/order activity, when a platform admin confirms deletion, then their login/access records disappear, business records remain, and the same email can be entered into the normal invite flow again.
- Given the signed-in platform admin's own row, when deletion is attempted through UI or direct action, then it is rejected without mutation.
- Given any non-platform-admin caller, when the server action is invoked directly, then it is rejected regardless of UI visibility.
- Given the confirmation dialog, it clearly states that deletion is permanent and identifies the affected name and email.

## Spec Change Log

- 2026-08-30: Implemented guarded permanent deletion, historical-reference retention migration, self-delete protection, confirmation UI, and regression coverage.

## Design Notes

Deleting an Auth identity alone is insufficient because the portal profile has its own unique email. Historical actor foreign keys must not turn user deletion into deletion of commercial data; they become nullable attribution, while true ownership/access junction rows remain cascading dependants.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check` -- strict TypeScript succeeds.
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- full portal MVP regression gate succeeds.
- `git diff --check` -- patch formatting succeeds.

The local Supabase stack was not running (`supabase_db_timber-world` is absent), so the migration is prepared but was not applied. No staging migration or deployment was performed.

**Manual checks (local):**
- As platform admin, delete a disposable invited user, confirm disappearance, then recreate/invite the same email.
- Confirm self-delete is unavailable or rejected and historical project/order pages still load.

## Suggested Review Order

1. `supabase/migrations/20260830100000_permanent_portal_user_deletion.sql` -- retention and cascade boundary.
2. `apps/portal/src/features/organisations/actions/deletePerson.ts` -- authority, Auth deletion, retry behavior, audit.
3. `apps/portal/src/features/organisations/components/PeopleTable.tsx` -- confirmation and self-delete UX.
4. `apps/portal/src/features/organisations/services/__tests__/personDeletion.test.ts` -- regression contract.
