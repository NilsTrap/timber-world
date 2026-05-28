# Write-path testing & error monitoring

- **Date:** 2026-05-28
- **Status:** Accepted (Option A implemented). Error-monitoring choice: pending.
- **Context owner:** IJL (Edgars)

## Context

On 2026-05-28, non-admin org users (e.g. Jānis Siliņš / The Wood and Good) hit
**"Failed to create order"** on every *Add Order* in production. Admins were
unaffected, so it was not reproducible from an admin login and surfaced only via
a customer report.

**Root cause:** `createOrder()` called a non-existent `nextval(seq_name)` RPC and
fell back to `"ORD-" || (count of orders + 1)`. That count runs under the
caller's RLS, so an org user (who can only see their own org's orders) counted
fewer than the true total and regenerated an already-existing code, violating the
`orders_code_key` unique constraint. Admins count all orders, so they always got
a free number. Fixed by moving code generation to a DB `DEFAULT` on `orders.code`
backed by `order_number_seq` (migration `20260528120000_fix_order_code_default`)
and removing the app-side generation.

**Why it slipped through existing tests.** The `tests/rls-and-perf` harness is
solid but covers two things only: (1) positive *read* snapshots and (2)
cross-tenant *negative* probes. It deliberately queries Supabase directly with
the user's token and does **not** exercise the Next.js server actions. So there
was no test that a normal org user can perform the core *writes* their role
allows — which is exactly where this bug lived.

## Options considered

| Option | Runs the real server action? | Would have caught this class? | Build cost | Maintenance |
|---|---|---|---|---|
| **A. DB-direct positive write probes** (extend harness) | No — DB/RLS only | Partially* | Low | Low |
| **B. Playwright golden-path e2e** (log in, click through) | Yes — UI + action + RLS | Yes | Higher | Higher (flaky/slow) |
| **C. Server-action integration tests** (call `createOrder()` in Node) | Yes — action + RLS, no browser | Yes | Medium | Medium |

\* Option A does not run the server action, so it cannot catch app-logic bugs in
general. It *does* guard the specific fix: the `orders.create-own-org` case
inserts an order **without** supplying `code` and asserts the DB returns a valid
unique `ORD-####`, which fails if the `DEFAULT` or the sequence `GRANT` to
`authenticated` regresses. It also guards against future RLS `WITH CHECK`
policies over-blocking legitimate in-org writes.

### Option B notes
Playwright is already a dependency and a few epic specs exist, but it is **not**
wired into CI, needs seeded users + a running target (preview deploy or
`next start`), and e2e is inherently slower/flakier. Highest fidelity; keep any
suite deliberately small (~5–8 golden paths) to limit flake.

### Option C notes
Server actions read `cookies()` (`getSession`) and build a Supabase server client
from them. Calling them in Node requires faking `next/headers` cookies and
injecting a real authenticated client — one-time plumbing, then cheap to extend.
Faster than B, no browser; the faked context can drift from real Next behavior.

## Decision

**Adopt Option A now.** It is cheap, low-maintenance, reuses the existing harness
(seeded users, `userClient`, admin-client cleanup, CI wiring), and directly
guards the order-code fix plus RLS write-permissions. Implemented as
`tests/rls-and-perf/src/suites/positive-write.ts` (`--mode=positive`, included in
`--mode=all`; any failure is exit-1 in CI).

**Defer B and C.** Revisit if/when we want true end-to-end confidence that app
logic + RLS + UI work together for the core flows. Preference order if pursued:
C (cheaper, no browser) unless we specifically want UI-level coverage, then B.

### Explicitly out of scope for Option A
- App-layer module gating (e.g. `orders.create`) — enforced in the server action,
  invisible to a DB-level test.
- Any bug that lives in server-action logic rather than the DB/RLS layer.
- Production entries — `portal_production_entries` requires a valid `process_id`;
  add a positive case once a per-org seed process exists.

## Error monitoring (related, decision pending)

**Current state: none.** No Sentry / Logflare / OpenTelemetry / Vercel log drain.
152 of 219 server-action files `console.error` on failure; those land only in
Vercel's ephemeral runtime logs — unsearchable, unalerted, unwatched. The order
bug was discovered by a customer report, not by us.

**Recommendation:** add error monitoring (Sentry for Next.js is the standard;
self-hosted Sentry or GlitchTip if IJL wants to own it centrally on EU infra —
see separate IJL note). 

**Important nuance for this codebase:** this bug never *threw* — `createOrder`
caught the DB error and returned a graceful `{ success: false }`. Automatic
exception capture would miss it. The real fix is a small convention so
server-action *failure returns* also report to the monitor (a `reportActionError()`
helper or an action wrapper). That converts the 152 silent `console.error`s into
alerted, grouped, searchable signals — and would have surfaced the duplicate-key
error the first time Jānis clicked.

## Follow-ups

- [ ] Decide error-monitoring host (Sentry SaaS vs self-host vs GlitchTip) + EU region.
- [ ] Add `reportActionError()` and route server-action failure returns through it.
- [ ] Add a positive production-entry case once a seed process exists.
- [ ] Consider a thin Option B/C golden-path suite for the top create flows.
