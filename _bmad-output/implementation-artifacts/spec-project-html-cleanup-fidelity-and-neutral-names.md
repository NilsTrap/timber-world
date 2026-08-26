---
title: 'Preserve HTML cleanup fidelity and neutralize clean filenames'
type: 'bugfix'
created: '2026-08-26'
status: 'done'
baseline_commit: 'd77dbf65634b64b9200da3d7871a334c4e6844cc'
context:
  - 'CLAUDE.md'
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cleaned HTML reports lose their visual layout because embedded styles are removed, even though the original safe preview preserves them. Clean derivatives also retain identifying names such as `Jane Masen` in their filenames.

**Approach:** Preserve inert embedded styling while continuing to remove executable/document-affecting markup, and assign every generated derivative a neutral, unique filename that retains only a broad file-purpose label and extension.

## Boundaries & Constraints

**Always:** Keep the original file and filename unchanged for the buyer. Keep original and cleaned HTML previews visually equivalent except for removed identifiers and unsafe active content. Maintain the current sandboxed/CSP preview boundary. Use neutral derivative filenames for preview, download, and downstream sharing.

**Ask First:** Any attempt to preserve executable JavaScript, load remote stylesheets/resources, alter original files, or deploy to production.

**Never:** Reintroduce `jsdom` on the server, copy the original identifying filename to the derivative, weaken authorization, or expose original files downstream.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Styled HTML | Self-contained report with embedded `<style>` rules | Clean preview retains layout and styling while scripts remain absent | Unsupported active content is removed |
| Identifying name | `S04739 - Jane Masen - Metal_ v10_Report.html` | Derivative uses a neutral unique `.html` name | Original name remains untouched |
| Re-clean | Existing derivative is regenerated | Neutral filename and content are updated consistently | Old stored derivative is removed only after replacement succeeds |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/services/fileCleanup.ts` -- structural HTML sanitation and deterministic redaction.
- `apps/portal/src/features/projects/actions/projectFileCleanupActions.ts` -- derivative naming, storage, and persistence.
- `apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts` -- sanitizer fidelity tests.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- cleanup workflow source-contract checks.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/projects/services/fileCleanup.ts` -- retain embedded style elements while stripping executable and document-affecting content.
- [x] `apps/portal/src/features/projects/actions/projectFileCleanupActions.ts` -- generate a neutral unique filename and use it for derivative metadata/storage.
- [x] Cleanup tests -- verify CSS preservation, script removal, sensitive-term redaction, and neutral derivative naming.

**Acceptance Criteria:**
- Given the reported HTML file, when original and clean previews are opened, then their layout remains materially equivalent.
- Given an identifying original filename, when cleanup completes, then the clean preview/download exposes no original person or customer name.
- Given the existing sandboxed preview, when cleaned HTML is displayed, then scripts and executable URLs remain disabled.

## Spec Change Log

## Design Notes

Neutral names use a purpose label plus a short random suffix, such as `Cleaned report a1b2c3d4.html`, avoiding collisions without preserving identifying source tokens. Visible identifiers are replaced with `Nilitto`.

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- expected: all MVP suites pass.
- `pnpm --filter @timber/portal type-check` -- expected: no errors.
- `pnpm --filter @timber/portal build` -- expected: production bundle succeeds.

**Manual checks:**
- On staging, clean the reported HTML file, compare original/clean previews, and confirm the neutral derivative name.

## Suggested Review Order

**Cleanup boundary**

- Preserve embedded layout CSS while removing active and remote content.
  [`fileCleanup.ts:42`](../../../apps/portal/src/features/projects/services/fileCleanup.ts#L42)

- Neutralize identifying filename terms and CSS identifier variants.
  [`fileCleanup.ts:9`](../../../apps/portal/src/features/projects/services/fileCleanup.ts#L9)

**Derivative persistence**

- Add filename-derived terms and persist only neutral derivative names and paths.
  [`projectFileCleanupActions.ts:30`](../../../apps/portal/src/features/projects/actions/projectFileCleanupActions.ts#L30)

**Regression coverage**

- Exercise layout retention, escaped CSS blocking, redaction, and neutral naming.
  [`fileCleanup.test.ts:5`](../../../apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts#L5)

- Guard neutral derivative metadata at the workspace contract boundary.
  [`projects-workspace.test.ts:147`](../../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L147)
