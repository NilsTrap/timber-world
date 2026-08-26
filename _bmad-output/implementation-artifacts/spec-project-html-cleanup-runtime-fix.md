---
title: 'Repair staging HTML file cleanup'
type: 'bugfix'
created: '2026-08-26'
status: 'done'
baseline_commit: '41cfbf783f1bca025f6de0f54e1a868808ec559c'
context:
  - 'CLAUDE.md'
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cleaning a single HTML project file fails in staging while loading `jsdom`, and the client remains indefinitely busy because the rejected server action is not handled.

**Approach:** Remove the incompatible DOM runtime from the cleanup execution path, retain the MVP HTML safety and sensitive-term redaction behavior with server-compatible logic, and guarantee that the UI exits its busy state with a useful error if cleanup throws.

## Boundaries & Constraints

**Always:** Preserve the original file; create or update only the linked clean derivative. Keep the current deterministic cleanup and optional term-detection model. Return visible completion or failure feedback and retain existing authorization checks.

**Ask First:** Any database migration, production deployment, or redesign into a durable job queue.

**Never:** Touch production, weaken project authorization, expose original files to downstream parties, or leave the UI permanently busy after a request failure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HTML success | Ready original HTML with scripts and sensitive terms | Dangerous active content is removed, sensitive terms are redacted, and a clean derivative becomes ready for review | N/A |
| Server failure | Cleanup action rejects or returns failure | Busy indicator stops and an error is displayed | No indefinite spinner |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/services/fileCleanup.ts` -- format-specific deterministic cleanup.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- cleanup invocation and busy/message state.
- `apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts` -- cleanup behavior regression tests.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/projects/services/fileCleanup.ts` -- replace the `jsdom`-dependent HTML sanitizer with server-runtime-compatible cleanup.
- [x] `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- handle thrown cleanup errors and always clear busy state.
- [x] `apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts` -- cover active-content removal and sensitive-term redaction.

**Acceptance Criteria:**
- Given a selected HTML file on staging, when cleanup runs, then it completes without the `jsdom` module error and exposes the clean derivative for review.
- Given an unexpected cleanup exception, when the request settles, then the spinner stops and the user sees a failure message.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- expected: all MVP regression suites pass.
- `pnpm --filter @timber/portal type-check` -- expected: no TypeScript errors.
- `pnpm --filter @timber/portal build` -- expected: production bundle succeeds without a `jsdom` runtime dependency in cleanup.

**Manual checks:**
- Deploy only to `staging.nilitto.com`, run HTML cleanup, and confirm completion and clean preview.

## Suggested Review Order

**Server cleanup boundary**

- Parse and sanitize structurally without the incompatible jsdom runtime.
  [`fileCleanup.ts:25`](../../apps/portal/src/features/projects/services/fileCleanup.ts#L25)

- Remove active elements, event handlers, and executable URL schemes.
  [`fileCleanup.ts:38`](../../apps/portal/src/features/projects/services/fileCleanup.ts#L38)

**Client failure recovery**

- Always clear the busy state after success, returned failure, or rejection.
  [`ProjectFileWorkspace.tsx:324`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L324)

**Regression coverage and dependency**

- Exercise malformed, encoded, unquoted, and SVG-based active content.
  [`fileCleanup.test.ts:8`](../../apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts#L8)

- Declare the server-compatible parser as a direct portal dependency.
  [`package.json:104`](../../apps/portal/package.json#L104)
