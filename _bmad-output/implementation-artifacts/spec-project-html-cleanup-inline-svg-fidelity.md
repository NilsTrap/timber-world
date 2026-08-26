---
title: 'Preserve inline DXF drawings during HTML cleanup'
type: 'bugfix'
created: '2026-08-26'
status: 'done'
baseline_commit: 'f257d44f1fea29422a8ab1a4c51e396ac11d4e81'
context:
  - 'CLAUDE.md'
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cleaned manufacturing HTML reports preserve their surrounding layout and raster images but lose inline SVG flat-pattern/DXF drawings, producing blank drawing pages in both reported files.

**Approach:** Preserve inert inline SVG presentation and geometry through the structural cleaner while continuing to remove active, externally loaded, and document-embedding SVG capabilities. Clear the completed cleanup selection automatically.

## Boundaries & Constraints

**Always:** Keep SVG paths, shapes, groups, text, transforms, viewBox, and safe presentation attributes needed for drawing fidelity. Retain the scriptless sandbox/CSP preview boundary. Verify both v10 and v4 report derivatives against their originals. Deselect the batch only after successful cleanup.

**Ask First:** Any change that permits SVG scripts, animation, external resources, foreign HTML, event handlers, or production deployment.

**Never:** Preserve executable SVG, weaken existing HTML/CSS URL filtering, mutate buyer originals, or approve/share regenerated derivatives automatically.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| DXF drawing | Report contains inline SVG paths and labels | Clean preview renders every flat-pattern drawing | Unsupported active SVG nodes are removed |
| Hostile SVG | SVG includes script, animation, foreignObject, external use/image, or handlers | Geometry remains; active/external content does not | Unsafe nodes/attributes are dropped |
| Existing cleanup | Original already has a derivative | Re-clean replaces derivative safely | Original remains untouched |
| Selection state | Selected files clean successfully | All selected-file checkboxes clear | Failed cleanup keeps selection for retry |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/services/fileCleanup.ts` -- structural HTML/SVG sanitation and redaction.
- `apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts` -- sanitizer fidelity and hostile-SVG regression tests.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- cleanup selection lifecycle.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- workspace behavior source guard.

## Tasks & Acceptance

**Execution:**
- [x] `apps/portal/src/features/projects/services/fileCleanup.ts` -- preserve safe inline SVG geometry and presentation while dropping active/external SVG capabilities.
- [x] `apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts` -- prove drawing primitives survive and hostile SVG constructs do not.
- [x] `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- clear selected files after successful cleanup while retaining failures for retry.
- [x] `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- guard cleanup deselection behavior.
- [x] Staging browser -- regenerate and visually compare both HTML derivatives with their originals.

**Acceptance Criteria:**
- Given either reported HTML file, when cleaned, then every original flat-pattern/DXF drawing remains visible in the corresponding cleaned page.
- Given embedded active or remote SVG content, when cleaned, then it cannot execute, embed HTML, animate, or fetch remote resources.
- Given the existing redaction behavior, when the drawing fix is applied, then Jane Masen and Parth Patel still become Nilitto and embedded raster images remain valid.

## Spec Change Log

## Design Notes

Inline SVG is treated as inert document artwork: core geometry and presentation survive, while the cleaner removes SVG elements whose purpose is execution, external loading, animation, or embedded foreign content.

## Verification

**Commands:**
- `pnpm --filter @timber/portal test:timber-mvp-gate` -- expected: all MVP suites pass.
- `pnpm --filter @timber/portal type-check` -- expected: no errors.
- `pnpm --filter @timber/portal build` -- expected: production bundle succeeds.

**Manual checks:**
- Compare original and cleaned v10/v4 previews on staging; SVG and raster counts must match and all drawings must be visible.

## Suggested Review Order

**Drawing preservation and safety**

- Preserve SVG geometry while excluding active and externally loaded constructs.
  [`fileCleanup.ts:55`](../../../apps/portal/src/features/projects/services/fileCleanup.ts#L55)

- Retain safe local paint references while rejecting escaped remote URLs.
  [`fileCleanup.ts:84`](../../../apps/portal/src/features/projects/services/fileCleanup.ts#L84)

**Cleanup interaction**

- Deselect only files whose cleaned derivatives were successfully generated.
  [`ProjectFileWorkspace.tsx:324`](../../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L324)

**Regression coverage**

- Exercise drawing primitives, hostile SVG, local paint references, and URL bypasses.
  [`fileCleanup.test.ts:37`](../../../apps/portal/src/features/projects/services/__tests__/fileCleanup.test.ts#L37)

- Guard successful cleanup selection behavior at the workspace boundary.
  [`projects-workspace.test.ts:147`](../../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L147)
