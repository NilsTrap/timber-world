# RLS & performance test harness

Verifies the multi-tenant security boundary and protects against regression while we land security and performance fixes.

## What's here

- **Positive snapshot tests** — for each seeded test user, capture what they can read across orders / inventory / production / shipments. Re-run after any change; differences are flagged. Used to confirm that RLS hardening doesn't accidentally hide rows the user should still see.
- **Cross-tenant negative tests** — explicit probes ("User from Org A reads Org B's data"). Today most of these will *leak* (because RLS is permissive). After RLS hardening, every probe must return `blocked`. This is the test that proves the security work actually worked.

The suites query Supabase directly with the test user's auth token — they don't go through the Next.js server-action plumbing. That keeps them fast and isolates them from app-side changes; what they measure is what the database returns to that user, which is exactly what RLS controls.

## Running

```bash
# From repo root
pnpm install
cd tests/rls-and-perf
cp .env.example .env.local   # then fill in staging Supabase creds
pnpm baseline                 # capture baseline (do this BEFORE RLS changes)
pnpm snapshot                 # capture current (do this AFTER each change)
pnpm diff                     # compare current vs baseline, exit 1 on diff
pnpm negative                 # run cross-tenant probes
```

`pnpm tsx src/run.ts --mode=all` runs everything (CI default).

## Seeding

```bash
pnpm exec tsx src/lib/seed.ts
```

Creates 3 test orgs (IJLA, IJLB, IJLC) and 4 test users (`test-admin@ijl.test`, `test-org-a-full@ijl.test`, `test-org-a-limited@ijl.test`, `test-org-b-full@ijl.test`). Refuses to run against the production Supabase URL.

## Safety rails

- `seed.ts` refuses to run against the known production project ref.
- Test user emails all end in `@ijl.test` — never collide with real customers.
- Negative-test writes (e.g., "Org-A user inserts an order owned by Org-B") clean up after themselves via the admin client.
- CI fails on positive snapshot diffs unconditionally. Negative-test leaks fail CI only when `NEGATIVE_TESTS_FAIL_ON_LEAK=true` — we leave that off during the baseline phase (when leaks are expected) and turn it on after RLS hardening is in place.
