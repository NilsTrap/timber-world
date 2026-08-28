import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validQuantityForUnit } from "../../projects/services/specificationQuantity";

const categoryUi = readFileSync("src/features/catalog/components/CategoryDetailTabs.tsx", "utf8");
const productUi = readFileSync("src/features/catalog/components/ProductDetailContent.tsx", "utf8");
const productPage = readFileSync("src/app/(portal)/admin/catalog/[categoryId]/products/[productId]/page.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260828140000_catalog_process_fields.sql", "utf8");
const kgMigration = readFileSync("../../supabase/migrations/20260828150000_project_specification_kg_unit.sql", "utf8");
const kgConstraintMigration = readFileSync("../../supabase/migrations/20260828151000_order_line_items_kg_unit.sql", "utf8");
const metalStairsSeed = readFileSync("../../supabase/seeds/metal_stairs_catalog.sql", "utf8");
const fieldActions = readFileSync("src/features/catalog/actions/fields.ts", "utf8");
const catalogAdmin = readFileSync("src/features/catalog/services/catalogAdmin.ts", "utf8");
const specificationActions = readFileSync("src/features/projects/actions/projectSpecificationActions.ts", "utf8");
const projectLoader = readFileSync("src/features/projects/actions/getProject.ts", "utf8");
const projectEditor = readFileSync("src/features/projects/components/ProjectSpecificationEditor.tsx", "utf8");
const packageJson = readFileSync("package.json", "utf8");

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
assert.match(migration, /REVOKE ALL ON TABLE public\.order_line_item_process_requirements FROM anon,authenticated/);
assert.doesNotMatch(migration, /CREATE POLICY[^;]+process_requirements[\s\S]+FOR (INSERT|UPDATE|DELETE)/);
assert.doesNotMatch(migration, /process_requirements_write/);
assert.match(migration, /create_project_specification_line_with_processes/);
assert.match(migration, /WHERE id=p_order_id FOR UPDATE/);
assert.match(migration, /d\.lifecycle_stage<>'draft'/);
assert.match(migration, /d\.deal_kind NOT IN \('buy_sell','sale_only'\)/);
assert.match(migration, /p_catalog_variant_id UUID,p_quantity NUMERIC,p_unit TEXT,p_notes TEXT/);
assert.doesNotMatch(migration, /p_requirements/);
assert.match(migration, /catalog_variants WHERE id=p_catalog_variant_id AND is_active/);
assert.match(migration, /a\.category_id=category\.id AND a\.applies_to='process'/);
assert.match(migration, /TOO_MANY_PROCESS_FIELDS/);
assert.match(migration, /INVALID_QUANTITY_FOR_UNIT/);
assert.match(migration, /btrim\(value\)<>''/);
assert.match(migration, /REQUIRED_PROCESS_VALUE_MISSING/);
assert.match(migration, /WITH RECURSIVE ancestry/);
assert.match(migration, /INVALID_LINE_ANCESTRY/);
assert.match(migration, /UNSUPPORTED_PROCESS_FIELD_TYPE/);
assert.match(migration, /'processRequirements',coalesce/);
assert.doesNotMatch(migration, /unit_cost|total_cost/);

assert.match(fieldActions, /\["product", "variant", "process"\]\.includes\(input\.appliesTo\)/);
assert.match(fieldActions, /getUserEnabledModules/);
assert.match(catalogAdmin, /\["product", "variant", "process"\]\.includes\(input\.appliesTo\)/);
assert.match(specificationActions, /create_project_specification_line_with_processes/);
assert.doesNotMatch(specificationActions, /ROLLBACK_FAILED/);
assert.match(specificationActions, /strict: true/);
assert.match(specificationActions, /p_catalog_variant_id: input\.catalogVariantId/);
assert.doesNotMatch(specificationActions, /p_requirements/);
assert.match(specificationActions, /p_quantity: input\.quantity/);
assert.match(projectLoader, /normalizeCandidateLines/);
assert.match(projectLoader, /Array\.isArray\(line\.processRequirements\)/);
assert.match(projectEditor, /line\.processRequirements \?\? \[\]/);
assert.match(projectEditor, /LINE_UNITS = \["kg",/);
assert.match(packageJson, /test:timber-mvp-gate[^\n]+process-fields\.test\.ts/);

assert.equal(validQuantityForUnit("piece", 1_000_000), true);
assert.equal(validQuantityForUnit("piece", 1_000_001), false);
assert.equal(validQuantityForUnit("piece", 1.5), false);
assert.equal(validQuantityForUnit("m3", 100_000_000), true);
assert.equal(validQuantityForUnit("m3", 100_000_001), false);
assert.equal(validQuantityForUnit("kg", 7_223.56), true);
assert.equal(validQuantityForUnit("crate", 0), false);

assert.match(kgMigration, /p_unit NOT IN \('kg','m3'/);
assert.match(kgConstraintMigration, /CHECK \(unit IN \('kg', 'm3'/);
for (const slug of [
  "metal-sheets", "round-tube", "square-tube", "rectangular-tube",
  "flat-bar", "angle-profile", "channel-profile", "structural-profile",
]) assert.match(metalStairsSeed, new RegExp(`'${slug}'`));
for (const scope of ["product", "variant", "process"]) {
  assert.match(metalStairsSeed, new RegExp(`'${scope}'`));
}
assert.match(metalStairsSeed, /'Custom dimensions'/);
assert.match(metalStairsSeed, /price_eur_cents[\s\S]+NULL/);
assert.doesNotMatch(metalStairsSeed, /net_weight_kg|gross_weight_kg/);
assert.doesNotMatch(metalStairsSeed, /ON CONFLICT \(field_key\) DO UPDATE/);
assert.doesNotMatch(metalStairsSeed, /ON CONFLICT \(category_id, field_id\) DO UPDATE/);
assert.match(metalStairsSeed, /pg_advisory_xact_lock/);

console.log("catalog process field tests passed");
