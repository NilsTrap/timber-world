import type { LineFieldValue } from "../../catalog/services/lineFieldValues";

export type ProcessAssignmentSnapshot = {
  sort_order?: number | null;
  is_required?: boolean | null;
  catalog_fields?: { field_key?: string; field_label?: string } | null;
};

export function buildProcessRequirements(
  assignments: readonly ProcessAssignmentSnapshot[],
  productFields: Readonly<Record<string, LineFieldValue>>,
): Array<{ field_key: string; name: string; value: string; unit: string | null; sort_order: number }> {
  return assignments.flatMap((assignment) => {
    const key = assignment.catalog_fields?.field_key;
    const field = key ? productFields[key] : undefined;
    if (!key) return [];
    if (!field || !field.value.trim()) {
      if (assignment.is_required) throw new Error(`Missing required process field: ${assignment.catalog_fields?.field_label ?? key}`);
      return [];
    }
    const suffix = field.unit ? ` ${field.unit}` : "";
    const value = suffix && field.value.endsWith(suffix)
      ? field.value.slice(0, -suffix.length)
      : field.value;
    return [{
      field_key: key,
      name: field.label,
      value,
      unit: field.unit,
      sort_order: Number(assignment.sort_order ?? 0),
    }];
  });
}
