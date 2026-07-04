"use client";

/**
 * S1 · Shared, lazily-cached loader for the CATALOG FIELDS the document-template
 * editor needs. Both consumers pull from ONE cached fetch:
 *   • the merge-field pills (S1) — friendly labels for placed `attr.<key>` columns
 *   • the line-items COLUMN DESIGNER (S3) — the pickable custom columns
 *
 * Custom catalog fields are per-line-item, so they surface as dynamic line-item
 * COLUMNS (never scalar mentions). The fetch is module-cached: every mention node
 * / designer instance shares a single server round-trip per page load, and a
 * failure degrades gracefully to an empty set (pills fall back to the static
 * label / base path — the editor never crashes because catalog fields failed).
 */
import * as React from "react";
import {
  catalogFieldLabelLookup,
  type CatalogTemplateField,
} from "@/features/documents/compiler/registry";
import { getCatalogTemplateFields } from "@/features/catalog/actions/fields";

// Module-level cache: one in-flight promise shared across all callers.
let cachedPromise: Promise<CatalogTemplateField[]> | null = null;

function loadCatalogTemplateFields(): Promise<CatalogTemplateField[]> {
  if (!cachedPromise) {
    cachedPromise = getCatalogTemplateFields()
      .then((res) => (res.success ? res.data : []))
      .catch(() => []);
  }
  return cachedPromise;
}

/** Invalidate the cache (e.g. after editing catalog fields) so the next mount refetches. */
export function invalidateCatalogTemplateFields(): void {
  cachedPromise = null;
}

export interface UseCatalogTemplateFields {
  fields: CatalogTemplateField[];
  loading: boolean;
  /** `attr.<fieldKey>` → fieldLabel — compose on top of the static MERGE_FIELD_LABELS. */
  labelMap: Record<string, string>;
}

/**
 * Load the catalog template fields once (cached) and expose them + a derived
 * `attr.<key>` → label map. Safe before the fetch resolves: returns `[]` / `{}`.
 */
export function useCatalogTemplateFields(): UseCatalogTemplateFields {
  const [fields, setFields] = React.useState<CatalogTemplateField[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    loadCatalogTemplateFields().then((f) => {
      if (!alive) return;
      setFields(f);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const labelMap = React.useMemo(() => catalogFieldLabelLookup(fields), [fields]);
  return { fields, loading, labelMap };
}
