---
title: 'Clarify project margin and image controls'
type: 'ux-fix'
created: '2026-08-30'
status: 'done'
route: 'one-shot'
---

# Clarify project margin and image controls

## Intent

**Problem:** Percentage and amount looked like unrelated actions, while image upload disappeared when the empty Images panel was collapsed.

**Approach:** Use explicit, accessible radio groups for margin mode and keep image upload available beside the collapsed empty-state header.

## Suggested Review Order

**Margin selection**

- Review the commercial-offer radio group and instance-safe accessible naming.
  [`ProjectCommercialRollup.tsx:33`](../../apps/portal/src/features/projects/components/ProjectCommercialRollup.tsx#L33)

- Confirm awarded-quotation margin uses the same interaction pattern.
  [`ProjectRfqCard.tsx:202`](../../apps/portal/src/features/projects/components/ProjectRfqCard.tsx#L202)

**Empty image state**

- Check collapsed upload visibility, responsive wrapping, and read-only behavior.
  [`ProjectOfficialImages.tsx:120`](../../apps/portal/src/features/projects/components/ProjectOfficialImages.tsx#L120)
