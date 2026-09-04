---
title: 'Login email password recovery and staging release'
type: 'feature'
created: '2026-09-04'
status: 'complete'
baseline_commit: 'adfa597df6d414c0630142dc6e00c318775bffab'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The public login screen has no self-service password recovery. Users who forget a password must depend on an administrator even though Supabase supports secure, expiring recovery links.

**Approach:** Add a login-linked recovery request form that sends an application-branded email without revealing whether an account exists, and reuse the token-aware password setup surface to let the recipient choose a new password. After local and browser verification, commit the current approved workspace changes and deploy only to the existing Nilitto staging project.

## Boundaries & Constraints

**Always:** Use Supabase-generated one-time recovery links; deliver branded email through the existing Resend/Mailpit boundary; validate email and passwords with Zod; keep responses enumeration-safe; make recovery links resolve to the configured local origin in development and `https://staging.nilitto.com` in staging; mark the browser window verified after a successful password change; preserve admin-generated-password recovery as an alternative; preserve all current approved project/RFQ changes in the release.

**Ask First:** Any production deployment, DNS change, Supabase production configuration, or sender-domain change.

**Never:** Send or log passwords, recovery tokens, or live links; disclose whether an email is registered; start a local database; deploy to `www.nilitto.com`; weaken the per-window session guard; overwrite unrelated concurrent changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Recovery request | Valid email, active account | Branded recovery email contains a one-time link to the password form | Show the same neutral confirmation used for unknown addresses |
| Unknown/malformed email | Unknown valid address or malformed value | Unknown valid address receives no disclosure; malformed value is rejected locally | Generic confirmation for unknown account; field validation for malformed input |
| Recovery link | Valid recovery code/token | User sets and confirms a policy-compliant password, session becomes verified, then navigates to Projects | Expired or invalid links show a clear return-to-login path |
| Conflicting password input | Passwords differ or are too short | Submission is blocked | Inline validation explains the correction |
| Mail provider failure | Resend/Mailpit unavailable | No token is exposed and request does not crash | Generic safe failure message and structured server-side result |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/auth/components/LoginForm.tsx` -- add the visible Forgot password entry point.
- `apps/portal/src/features/auth/actions/` -- public, validated recovery-request action and password-update action using portal Supabase clients.
- `apps/portal/src/features/auth/components/AcceptInviteForm.tsx` -- existing PKCE/implicit recovery-token parser and password form; separate recovery copy/lifecycle behavior from invitation activation.
- `apps/portal/src/app/(auth)/accept-invite/page.tsx` -- existing token landing route; retain compatibility or generalize its recovery presentation.
- `apps/portal/src/lib/email/sendNilittoInviteEmail.ts` and `apps/portal/src/features/organisations/services/passwordlessInvite.ts` -- reuse sender, Mailpit/Resend transport patterns, and safe app-origin resolution without returning tokens.
- `apps/portal/src/proxy.ts` -- public auth-route allowlist must permit the recovery request/landing routes.
- `supabase/config.toml` -- local redirect allowlist evidence; hosted staging redirect configuration must be verified separately.
- `.vercel/project.json` -- deployment target must remain the saved staging project.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/auth/` and auth routes -- implement request, email delivery, recovery-token processing, password update, neutral feedback, accessibility, and tests.
- [x] `apps/portal/src/proxy.ts` and `supabase/config.toml` -- ensure recovery routes and redirect origins are accepted without changing protected-route behavior.
- [x] Current approved project/RFQ and authentication changes -- run focused regression checks, inspect the release diff, and commit without generated reports or local secrets.
- [x] Staging Supabase/Vercel -- verify required migrations/config, deploy the saved staging frontend, inspect deployment health, and run browser acceptance on `staging.nilitto.com` without exposing the live recovery link.

**Acceptance Criteria:**
- Given a signed-out user on Login, when they choose Forgot password and submit a valid email, then they see neutral confirmation and a branded recovery email is requested.
- Given a valid recovery link, when the user submits matching valid passwords, then the password changes and the user reaches the authenticated Projects area in the same window.
- Given a recovery request for an unknown account, when it completes, then the UI does not reveal account existence.
- Given the staging release completes, when the login and recovery surfaces are opened on `staging.nilitto.com`, then the deployed UI and redirect target match this flow while production remains unchanged.

## Spec Change Log

## Design Notes

Supabase should remain the authority for recovery-token issuance and password mutation. The application controls presentation and email delivery so local Mailpit tests remain private and staging email remains branded. Recovery must not reuse invitation lifecycle updates: an active user stays active, while an invited user still follows the invitation activation rules.

## Verification

Completed 2026-09-04: recovery and email tests, the full Timber MVP regression gate, portal type-check, production build, and `git diff --check` passed. Browser checks passed locally and on the staging alias for login entry, recovery request presentation, and invalid/expired-link handling. Vercel deployment `dpl_HqsXk3s26MUrZhiEYjAtLneyXQBi` is Ready and aliased to `https://staging.nilitto.com`.

**Commands:**
- `pnpm --filter @timber/portal exec tsx <focused auth tests>` -- expected: request validation, neutral responses, redirect safety, and recovery lifecycle pass.
- `pnpm --filter @timber/portal exec tsc --noEmit --pretty false` -- expected: no new errors beyond separately identified pre-existing failures.
- `git diff --check` -- expected: clean.
- Authenticated/local Playwright flow with Mailpit -- expected: email captured privately, link opens password form, password update succeeds, and login works.
- Vercel staging deployment inspection and hosted browser smoke test -- expected: Ready deployment and working staging login/recovery UI.
