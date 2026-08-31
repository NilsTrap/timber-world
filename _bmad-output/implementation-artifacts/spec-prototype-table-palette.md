---
title: 'Match specification table prototype palette'
type: 'ui'
created: '2026-08-31'
status: 'done'
route: 'one-shot'
---

# Match specification table prototype palette

## Intent

**Problem:** The implemented specification table lacked the prototype’s gray headers and near-white editable rows.

**Approach:** Apply the prototype’s exact light-mode table palette while retaining accessible semantic dark-mode overrides.

## Suggested Review Order

- Review prototype-matched product-table headers, rows, borders, and dark-mode fallbacks.
  [`ProjectSpecificationTables.tsx:22`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L22)

- Review attached-process palette and accessible inactive-row contrast.
  [`ProjectSpecificationTables.tsx:99`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L99)

- Confirm editable focus treatment matches the prototype in both themes.
  [`ProjectSpecificationTables.tsx:119`](../../apps/portal/src/features/projects/components/ProjectSpecificationTables.tsx#L119)
