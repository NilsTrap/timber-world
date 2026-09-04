---
title: 'Resettable agent UI-flow fixture'
type: 'chore'
created: '2026-09-02'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '1855f9367d306a362fc6e153dd0b7ff252be2b77'
context:
  - '{project-root}/docs/nils-agent-onboarding.md'
  - '{project-root}/docs/agent-ui-flow-testing-procedure.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The portal's Playwright tests depend on pre-existing shared users and data, so an agent cannot establish or reset the five-person Nilitto acceptance scenario safely before customer onboarding.

**Approach:** Add a local-test-only fixture command that creates synthetic personas, two passive backup supplier organisations, current module/access-group assignments, partner links, and one staircase spine split into metal and wood sourcing legs. Every apply converges deterministic fixture-owned records back to a clean baseline and can be followed by an explicit reset or verification.

## Boundaries & Constraints

**Always:** Accept only an explicit loopback HTTP Supabase origin; require a unique `UIFLOW-YYYYMMDD-NN` run label and environment-supplied password/service key; use `.test` identities and deterministic fixture IDs; converge before apply; preserve exactly five browser users (buyer, trader, metal supplier, wood supplier and super-admin); create passive metal and wood backup supplier organisations without auth users; keep metal and wood allocations on separate same-spine purchase legs; fail on missing current modules/groups or incomplete cleanup.

**Ask First:** Any non-loopback target; any change to CI, Playwright global setup, or production/staging execution from this task.

**Never:** Use production, real customer records, checked-in credentials, fallback passwords, broad deletes, `supabase start`, `supabase db reset`, deployment, or edits to the protected invitation/Mailpit work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Apply | Loopback URL, confirmation token, service key, strong test password, valid run label | Five users, six organisations, role grants, relationships, root project and two allocated legs exist at baseline | Abort without widening mutation predicates |
| Reset | Loopback target with a partial or complete fixture | Deterministic fixture state converges to the clean baseline without touching other data | Non-zero exit if baseline verification fails |
| Unsafe target | Missing/malformed/production/other URL or missing confirmation | No remote request is made | Explain the failed safety gate without echoing secrets |
| Drift | Required modules/access groups are missing | No partial fixture remains | Fail with the missing non-secret identifiers |

</frozen-after-approval>

## Code Map

- `tests/rls-and-perf/src/lib/targetSafety.ts` -- existing staging-oriented safety precedent; the UI-flow fixture instead uses a stricter loopback-only gate.
- `tests/rls-and-perf/src/lib/seed.ts` -- existing Supabase admin/user/org patterns; read-only precedent, not reused because it has unrelated shared fixtures and no reset contract.
- `supabase/migrations/20260825000001_nilitto_role_navigation.sql` -- authoritative `buyer`, `trader`, and `manufacturer` access groups plus `projects.view` ceilings.
- `supabase/migrations/20260827120000_spine_lego_leg_rfq_award.sql` -- same-spine work-package shape and buyer-only purchase-leg invariant.
- `supabase/migrations/20260901200000_shared_specification_and_process_total_pricing.sql` -- current shared specification behavior.
- `apps/portal/e2e/fixtures/auth.ts` -- existing two-role login fixture; leave unchanged because it uses shared accounts and cannot safely host lifecycle mutation.
- `apps/portal/e2e/fixtures/mailpit.ts` -- protected concurrent work; do not modify.

## Tasks & Acceptance

**Execution:**
- [x] `tests/rls-and-perf/src/ui-flow/fixtureConfig.ts` -- define synthetic identities, deterministic IDs, run-label validation, and strict target/secret gates.
- [x] `tests/rls-and-perf/src/ui-flow/fixture.ts` -- implement reset, apply and verify with narrow ID/email predicates and current schema relationships.
- [x] `tests/rls-and-perf/src/ui-flow/fixtureConfig.test.ts` -- exercise accepted/rejected target, label and credential cases without network calls.
- [x] `tests/rls-and-perf/package.json` -- expose concise fixture and focused-test commands.
- [x] `tests/rls-and-perf/.env.example` -- document variable names/placeholders only.

**Acceptance Criteria:**
- Given safe environment variables and a valid run label, when `apply` runs, then the five isolated personas and split two-material project are verified and no secret is printed.
- Given any earlier partial fixture state, when `apply` or `reset` runs, then only deterministic fixture-owned rows/auth users are removed before the command succeeds.
- Given an unsafe or unconfirmed target, when any command runs, then it fails before constructing a Supabase client.
- Given the repository checkout, when focused tests, package type-check, fixture dry-run safety probes and `git diff --check` run, then they pass without changing protected dirty files.

## Spec Change Log

- 2026-09-02: Implemented the additive local-only baseline harness; live apply/verify remains gated on explicitly supplied local credentials.
- 2026-09-02: Added passive metal and wood backup organisations so each material leg has two eligible RFP candidates without adding browser identities.

## Design Notes

The harness lives beside the existing isolated RLS tooling because that workspace already owns the Supabase SDK. It deliberately does not start/reset Supabase or auto-wire Playwright global setup: local fixture mutation remains an explicit, serial gate until the full browser flow and cleanup reporter exist.

## Verification

**Commands:**
- `pnpm --filter @timber/tests-rls-and-perf test:ui-flow-fixture` -- all offline safety/config assertions pass.
- `pnpm --filter @timber/tests-rls-and-perf exec tsc --noEmit` -- harness type-checks.
- `pnpm --filter @timber/tests-rls-and-perf ui-flow:fixture -- verify` without env -- exits before network access with a missing-variable safety error.
- `git diff --check` -- no whitespace errors.
