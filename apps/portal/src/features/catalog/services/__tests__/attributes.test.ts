/**
 * Pure-logic tests for the attribute service mappers (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/catalog/services/__tests__/attributes.test.ts`
 */
import { normalizeKey, mapOption, mapDefinition, sortOptions } from "../attributes";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// normalizeKey — trims, keeps case (field_key is case-sensitive)
eq("normalizeKey trims", normalizeKey("  wood_species  "), "wood_species");
eq("normalizeKey keeps case", normalizeKey("WoodSpecies"), "WoodSpecies");
eq("normalizeKey null", normalizeKey(null), "");
eq("normalizeKey undefined", normalizeKey(undefined), "");

// mapOption
eq(
  "mapOption full row",
  mapOption({ id: "o1", field_id: "f1", value: "oak", label: "Oak", description: "Quercus", sort_order: 2, is_active: true, ref_value_id: "r1" }),
  { id: "o1", fieldId: "f1", value: "oak", label: "Oak", description: "Quercus", sortOrder: 2, isActive: true, refValueId: "r1" }
);
eq(
  "mapOption defaults",
  mapOption({ id: "o2", field_id: "f1", value: "ash", label: "Ash" }),
  { id: "o2", fieldId: "f1", value: "ash", label: "Ash", description: null, sortOrder: 0, isActive: true, refValueId: null }
);

// mapDefinition — optionCount counts only ACTIVE embedded options
eq(
  "mapDefinition counts active options",
  mapDefinition({
    id: "f1", field_key: "wood_species", field_label: "Species", field_type: "select",
    unit: null, ref_table: "ref_species", is_system: false, dimension_role: null,
    catalog_field_options: [{ id: "a", is_active: true }, { id: "b", is_active: false }, { id: "c", is_active: true }],
  }),
  { id: "f1", key: "wood_species", label: "Species", type: "select", unit: null, refTable: "ref_species", isSystem: false, dimensionRole: null, optionCount: 2 }
);
eq(
  "mapDefinition system dimension, no options",
  mapDefinition({ id: "f2", field_key: "thickness", field_label: "Thickness", field_type: "number", unit: "mm", ref_table: null, is_system: true, dimension_role: "thickness" }),
  { id: "f2", key: "thickness", label: "Thickness", type: "number", unit: "mm", refTable: null, isSystem: true, dimensionRole: "thickness", optionCount: 0 }
);

// sortOptions — by sortOrder then label, stable, non-mutating
const unsorted = [
  { id: "1", fieldId: "f", value: "c", label: "C", description: null, sortOrder: 2, isActive: true, refValueId: null },
  { id: "2", fieldId: "f", value: "a", label: "A", description: null, sortOrder: 1, isActive: true, refValueId: null },
  { id: "3", fieldId: "f", value: "b", label: "B", description: null, sortOrder: 1, isActive: true, refValueId: null },
];
eq("sortOptions order", sortOptions(unsorted).map((o) => o.value), ["a", "b", "c"]);
eq("sortOptions does not mutate input", unsorted.map((o) => o.value), ["c", "a", "b"]);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
