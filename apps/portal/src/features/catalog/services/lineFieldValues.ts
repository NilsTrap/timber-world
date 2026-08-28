/**
 * S2 · Line-item catalog field-value reader.
 *
 * The general reader the document assembler needs: given an order line's catalog
 * linkage (variantId / productId), resolve EVERY custom catalog field value
 * (glulam's extras, coatings, certificates, …) to a display string, so a document
 * can place `attr.<field_key>` columns that were previously impossible (order
 * lines carried only the 6 classic attribute option-ids).
 *
 * Resolution per value (mirrors catalog/dealPricing.ts + getVariants embeds):
 *   • option_id   → catalog_field_options.label
 *   • value_text  → the text verbatim
 *   • value_number→ `value_number + " " + catalog_fields.unit`
 * Product ∪ variant, with the VARIANT winning (UNIQUE(variant_id, field_id) /
 * UNIQUE(product_id, field_id)). Also returns the variant's DEFAULT packaging
 * (best-effort) for reserved attr keys.
 *
 * PURE-ISH: no auth / no I/O beyond the caller-supplied client (the assembler
 * passes the admin client, matching fetchPartyCard). Not a "use server" module.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

export interface LineFieldValue {
  /** Field label (e.g. "Glulam grade"). */
  label: string;
  /** Ready-to-show display string (option label / text / number+unit). */
  value: string;
  /** catalog FieldType: "select" | "number" | "text" | "boolean" | "file". */
  type: string;
  unit: string | null;
}

export interface LineFieldValues {
  /** field_key → resolved value. */
  fields: Record<string, LineFieldValue>;
  /** The variant's default packaging (best-effort; null when none assigned). */
  packaging: { name: string; piecesPerPackage: number } | null;
}

const EMPTY: LineFieldValues = { fields: {}, packaging: null };

const FV_SELECT =
  "field_id, option_id, value_text, value_number, " +
  "catalog_fields(field_key, field_label, field_type, unit), " +
  "catalog_field_options(label)";

/** Resolve one EAV row to its display string, or null when it carries no value. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(row: any): string | null {
  const optLabel = row?.catalog_field_options?.label as string | undefined;
  if (optLabel != null && optLabel !== "") return optLabel;
  const text = row?.value_text as string | null | undefined;
  if (text != null && text !== "") return text;
  const num = row?.value_number as number | null | undefined;
  if (num != null) {
    const unit = (row?.catalog_fields?.unit as string | null | undefined) ?? null;
    return unit ? `${num} ${unit}` : String(num);
  }
  return null;
}

/**
 * Read a line's resolved custom catalog field values (+ default packaging).
 * Returns empty when the line has no catalog linkage. Never throws — a bad read
 * yields the empty set so document generation is never blocked by catalog data.
 */
export async function readLineFieldValues(
  db: DbClient,
  ids: { variantId?: string | null; productId?: string | null },
  options: { strict?: boolean } = {},
): Promise<LineFieldValues> {
  const variantId = ids.variantId ?? null;
  const productId = ids.productId ?? null;
  if (!variantId && !productId) return EMPTY;

  try {
    const [prodRes, varRes, packRes] = await Promise.all([
      productId
        ? db.from("catalog_product_field_values").select(FV_SELECT).eq("product_id", productId)
        : Promise.resolve({ data: [] }),
      variantId
        ? db.from("catalog_variant_field_values").select(FV_SELECT).eq("variant_id", variantId)
        : Promise.resolve({ data: [] }),
      variantId
        ? db
            .from("catalog_variant_packaging_assignments")
            .select("is_default, catalog_packaging_types(name, pieces_per_package)")
            .eq("variant_id", variantId)
        : Promise.resolve({ data: [] }),
    ]);

    const fieldReadError = prodRes?.error ?? varRes?.error;
    if (fieldReadError) throw fieldReadError;
    const fields: Record<string, LineFieldValue> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (rows: any[] | null | undefined) => {
      for (const row of rows ?? []) {
        const f = row?.catalog_fields;
        const key = f?.field_key as string | undefined;
        if (!key) continue;
        const display = resolveDisplay(row);
        if (display == null) continue;
        fields[key] = {
          label: (f.field_label as string | undefined) ?? key,
          value: display,
          type: (f.field_type as string | undefined) ?? "text",
          unit: (f.unit as string | null | undefined) ?? null,
        };
      }
    };
    // Product first, then variant — the variant overrides on any shared field.
    apply(prodRes?.data);
    apply(varRes?.data);

    const packRows = (packRes?.error ? [] : (packRes?.data ?? [])) as Array<{
      is_default?: boolean;
      catalog_packaging_types?: { name?: string | null; pieces_per_package?: number | null } | null;
    }>;
    const def = packRows.find((p) => p.is_default) ?? packRows[0] ?? null;
    const packaging = def?.catalog_packaging_types
      ? {
          name: def.catalog_packaging_types.name ?? "",
          piecesPerPackage: Number(def.catalog_packaging_types.pieces_per_package ?? 0),
        }
      : null;

    return { fields, packaging };
  } catch (error) {
    if (options.strict) throw error;
    return EMPTY;
  }
}
