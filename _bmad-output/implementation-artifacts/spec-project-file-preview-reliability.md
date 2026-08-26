---
title: 'Project file preview reliability'
type: 'bugfix'
created: '2026-08-26T14:20:00+03:00'
status: 'done'
baseline_commit: 'df194d9c5beb3c612d6161da88ff32b02b0f3d44'
context:
  - '{project-root}/docs/nils-agent-onboarding.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Project PDF previews open an empty frame, STEP previews create an enormously wide canvas that pushes the model off-screen, and file rows themselves do not open supported previews. These failures make the new project workspace impractical for reviewing real engineering files.

**Approach:** Make native PDF rendering compatible with the browser viewer, constrain STEP canvas sizing so camera fitting operates inside the visible dialog, and make previewable desktop and mobile rows accessible preview triggers while preserving every explicit file action.

## Boundaries & Constraints

**Always:** Reuse the existing RLS-authorized temporary signed URL; keep unsupported files such as `.DS_Store` and NC1 download-only; preserve checkbox selection and info/download/rename/delete buttons without accidental preview opening; support mouse and keyboard row activation; keep heavy engineering viewers lazy; dispose STEP/WebGL resources when closed; keep all work and verification local until Edgars explicitly authorizes staging.

**Ask First:** Adding a conversion service, changing storage/database schemas or preview allowlists, committing, pushing, or deploying to staging.

**Never:** Expose storage paths or permanent URLs; make unsupported rows appear previewable; allow a row action to trigger both its own operation and preview; deploy to production or staging during this workflow.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| PDF preview | Ready PDF with a valid signed URL | Browser PDF viewer renders inside the dialog | Expired/unavailable URL retains the existing fresh-link retry |
| STEP preview | Valid model with extreme or ordinary coordinates | Canvas stays within the dialog and the model is centered and visible after load or Fit model | Invalid geometry retains the existing retryable error state |
| Previewable row | Click, Enter, or Space on a PDF/image/HTML/DXF/STEP row | Opens the same preview as the eye action | Repeated requests remain race-safe |
| Explicit row action | Checkbox, info, preview, download, rename, or delete is used | Only the selected action runs | Event propagation cannot open an extra preview |
| Unsupported row | `.DS_Store`, NC1, archive, or unknown file | Row remains non-interactive for preview; download/actions still work | No empty or misleading preview dialog |

</frozen-after-approval>

## Code Map

- `apps/portal/src/features/projects/components/ProjectFilePreview.tsx` -- native PDF/image dispatch and temporary signed-URL retry behavior.
- `apps/portal/src/features/projects/components/viewers/StepFileViewer.tsx` -- Three.js canvas lifecycle, responsive sizing, camera target, and fit calculation.
- `apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx` -- desktop/mobile file rows, preview actions, checkboxes, and row-level event boundaries.
- `apps/portal/src/features/projects/__tests__/projects-workspace.test.ts` -- lightweight regression guards for preview routing and source-level UI contracts.

## Tasks & Acceptance

**Execution:**
- [x] `ProjectFilePreview.tsx` -- separate PDF handling from the scriptless uploaded-HTML boundary so browser-native PDF rendering works without weakening HTML isolation; retain loading and retry behavior.
- [x] `StepFileViewer.tsx` -- give the renderer a fixed CSS footprint inside a min-width-safe container, prevent ResizeObserver feedback, and fit camera distance from visible horizontal/vertical field of view.
- [x] `ProjectFileWorkspace.tsx` -- open previewable desktop/mobile rows on pointer or keyboard activation and stop propagation from selection/action controls.
- [x] `projects-workspace.test.ts` -- add regression assertions for PDF rendering mode, bounded STEP canvas sizing, row activation, and unsupported-row exclusion.

**Acceptance Criteria:**
- Given the supplied project and current local account, when the PDF and `WOOD.step` are opened, then the PDF is visible and the STEP canvas/model remain centered within the dialog without horizontal page expansion.
- Given a supported file row, when the row is activated by mouse, Enter, or Space, then exactly one preview opens; given an explicit action or unsupported row, no unintended preview opens.

## Spec Change Log

## Design Notes

The reproduced STEP defect is a layout feedback loop: `renderer.setSize(..., false)` changes the canvas intrinsic width while the canvas remains auto-sized inside a grid/dialog with an unconstrained minimum, causing each ResizeObserver pass to enlarge the next. Make the canvas CSS box `100% × 100%`, constrain ancestors with `min-width: 0`, and compute render-buffer dimensions from that stable box. PDF content remains cross-origin behind a temporary Supabase URL; uploaded HTML continues to use the separate sanitized, empty-sandbox viewer.

## Verification

**Commands:**
- `pnpm --filter @timber/portal type-check` -- expected: no TypeScript errors.
- `cd apps/portal && ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/projects/__tests__/projects-workspace.test.ts` -- expected: all workspace preview regressions pass.
- `pnpm --filter @timber/portal build` -- expected: production build succeeds with engineering viewers still emitted lazily.

**Manual checks (local production build):**
- Open the supplied project in the browser; verify the marked PDF renders, `WOOD.step` starts centered and remains bounded after Fit model/resize, supported rows open previews, and `.DS_Store` plus all explicit row actions do not open unintended previews.

## Suggested Review Order

**Preview entry points**

- File rows remain pointer targets while semantic buttons provide keyboard access.
  [`ProjectFileWorkspace.tsx:408`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L408)

- Desktop name cells expose preview without nesting other file actions.
  [`ProjectFileWorkspace.tsx:458`](../../apps/portal/src/features/projects/components/ProjectFileWorkspace.tsx#L458)

**Viewer reliability**

- PDF-only sandbox relaxation restores the browser viewer; other native content stays isolated.
  [`ProjectFilePreview.tsx:87`](../../apps/portal/src/features/projects/components/ProjectFilePreview.tsx#L87)

- Stable canvas sizing eliminates the ResizeObserver width feedback loop.
  [`StepFileViewer.tsx:93`](../../apps/portal/src/features/projects/components/viewers/StepFileViewer.tsx#L93)

- Aspect-aware fitting centers models and refits after container resize.
  [`StepFileViewer.tsx:127`](../../apps/portal/src/features/projects/components/viewers/StepFileViewer.tsx#L127)

**Regression coverage**

- Source guards cover PDF, STEP bounds, resizing, row activation, and propagation.
  [`projects-workspace.test.ts:150`](../../apps/portal/src/features/projects/__tests__/projects-workspace.test.ts#L150)
