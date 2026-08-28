import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const categoryUi = readFileSync("src/features/catalog/components/CategoryDetailTabs.tsx", "utf8");
const productUi = readFileSync("src/features/catalog/components/ProductDetailContent.tsx", "utf8");
const productPage = readFileSync("src/app/(portal)/admin/catalog/[categoryId]/products/[productId]/page.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260828140000_catalog_process_fields.sql", "utf8");
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
assert.match(migration, /p_catalog_variant_id UUID/);
assert.doesNotMatch(migration, /p_requirements/);
assert.match(migration, /catalog_variants WHERE id=p_catalog_variant_id AND is_active/);
assert.match(migration, /a\.category_id=category\.id AND a\.applies_to='process'/);
assert.match(migration, /TOO_MANY_PROCESS_FIELDS/);
assert.match(migration, /NOT BETWEEN 0\.0001 AND 1000000000/);
assert.match(migration, /btrim\(value\)<>''/);
assert.match(migration, /REQUIRED_PROCESS_VALUE_MISSING/);
assert.match(migration, /WITH RECURSIVE ancestry/);
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
assert.match(projectLoader, /normalizeCandidateLines/);
assert.match(projectLoader, /Array\.isArray\(line\.processRequirements\)/);
assert.match(projectEditor, /line\.processRequirements \?\? \[\]/);
assert.match(packageJson, /test:timber-mvp-gate[^\n]+process-fields\.test\.ts/);

console.log("catalog process field tests passed");
