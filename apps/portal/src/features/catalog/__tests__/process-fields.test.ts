import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProcessRequirements } from "../../projects/services/processRequirements";

const categoryUi = readFileSync("src/features/catalog/components/CategoryDetailTabs.tsx", "utf8");
const productUi = readFileSync("src/features/catalog/components/ProductDetailContent.tsx", "utf8");
const productPage = readFileSync("src/app/(portal)/admin/catalog/[categoryId]/products/[productId]/page.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260828140000_catalog_process_fields.sql", "utf8");
const fieldActions = readFileSync("src/features/catalog/actions/fields.ts", "utf8");
const catalogAdmin = readFileSync("src/features/catalog/services/catalogAdmin.ts", "utf8");

assert.match(categoryUi, /option value="process">Process/);
assert.match(categoryUi, /title="Process fields" which="process"/);
assert.match(productPage, /const processFields = allFields\.filter/);
assert.match(productPage, /processFields=\{processFields\}/);
assert.match(productUi, /<h2 className="font-semibold">Processes<\/h2>/);
assert.match(productUi, /processFields\.map/);

for (const key of [
  "sheets", "metal", "cutting", "bending", "straightening", "countersinking",
  "rolling", "welding", "galvanizing", "tubes", "painting", "shot_blasting",
  "powder_priming", "powder_coating", "wet_priming", "wet_painting", "packaging", "transport",
]) assert.match(migration, new RegExp(`\\('${key}',`));
assert.match(migration, /ON CONFLICT \(field_key\) DO NOTHING/);
assert.match(migration, /CHECK \(applies_to IN \('product', 'variant', 'process'\)\)/);
assert.match(migration, /FOR INSERT TO authenticated/);
assert.doesNotMatch(migration, /process_requirements_write/);

const populated = buildProcessRequirements([
  { sort_order: 20, catalog_fields: { field_key: "cutting" } },
  { sort_order: 30, catalog_fields: { field_key: "painting" } },
], {
  cutting: { label: "Cutting", value: "12 mm", type: "number", unit: "mm" },
  painting: { label: "Painting", value: "   ", type: "number", unit: null },
});
assert.deepEqual(populated, [{ field_key: "cutting", name: "Cutting", value: "12", unit: "mm", sort_order: 20 }]);
assert.deepEqual(buildProcessRequirements(
  [{ catalog_fields: { field_key: "cutting" } }],
  {},
), []);
assert.match(fieldActions, /\["product", "variant", "process"\]\.includes\(input\.appliesTo\)/);
assert.match(fieldActions, /getUserEnabledModules/);
assert.match(catalogAdmin, /\["product", "variant", "process"\]\.includes\(input\.appliesTo\)/);

console.log("catalog process field tests passed");
