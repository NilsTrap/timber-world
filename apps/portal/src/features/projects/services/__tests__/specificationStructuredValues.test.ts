import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { structuredSpecificationPayload, structuredSpecificationValuesSchema } from "../specificationStructuredValues";

const ids = {
  projectId: "11111111-1111-4111-8111-111111111111",
  lineId: "22222222-2222-4222-8222-222222222222",
  version: "2026-08-30T10:30:00.000Z",
};

const parsed = structuredSpecificationValuesSchema.parse({
  ...ids,
  basicValues: [{ key: "grade", value: "S355", active: true }, { key: "coated", value: "false", active: false }],
  processValues: [{ key: "welding", value: "0", active: false }, { key: "cutting", value: "12.5", active: true }],
});
assert.deepEqual(structuredSpecificationPayload(parsed), {
  p_order_id: ids.projectId,
  p_line_id: ids.lineId,
  p_version: ids.version,
  p_basic_values: parsed.basicValues,
  p_process_values: parsed.processValues,
});
assert.equal(structuredSpecificationValuesSchema.safeParse({ ...parsed, processValues: [{ key: "welding", value: "-1" }] }).success, false);
assert.equal(structuredSpecificationValuesSchema.safeParse({ ...parsed, processValues: [{ key: "welding", value: "0", active: false }] }).success, true);
assert.equal(structuredSpecificationValuesSchema.safeParse({ ...parsed, processValues: [{ key: "welding", value: "0" }] }).success, false);
assert.equal(structuredSpecificationValuesSchema.safeParse({ ...parsed, basicValues: [{ key: "grade", value: "A", active: true }, { key: "grade", value: "B", active: true }] }).success, false);
assert.equal(structuredSpecificationValuesSchema.safeParse({ ...parsed, basicValues: [{ key: "grade", value: "A" }] }).success, false);
assert.equal(structuredSpecificationValuesSchema.safeParse({ ...parsed, version: null }).success, false);

const migration = readFileSync("../../supabase/migrations/20260830110000_catalogue_assigned_field_snapshots.sql", "utf8");
assert.match(migration, /catalogue_basic_field_snapshot/);
assert.match(migration, /coalesce\(vo\.label,\s*vv\.value_text,\s*vv\.value_number::text,\s*po\.label,\s*pv\.value_text,\s*pv\.value_number::text,\s*''\)/);
assert.match(migration, /update_project_specification_structured_values/);
assert.match(migration, /ON CONFLICT\(order_line_item_id,field_key\) DO NOTHING/);
assert.match(migration, /STALE_SPECIFICATION/);
assert.match(migration, /READ_ONLY_FILE_FIELD/);
assert.match(migration, /INVALID_SELECT_VALUE/);
assert.match(migration, /_catalogue_snapshot_backfill_lines/);
assert.match(migration, /l\.specification_fields='\[\]'::jsonb AND o\.lifecycle_stage='draft'/);
assert.match(migration, /child\.specification_fields='\[\]'::jsonb/);
assert.match(migration, /p_basic_values IS NULL OR p_process_values IS NULL OR p_version IS NULL/);
assert.match(migration, /BASIC_SNAPSHOT_TOO_LARGE/);
assert.match(migration, /vv\.value_file_name/);
assert.match(migration, /'allowedOptions'/);

const applicabilityMigration = readFileSync("../../supabase/migrations/20260831120000_project_process_applicability.sql", "utf8");
assert.match(applicabilityMigration, /is_active BOOLEAN NOT NULL DEFAULT true/);
assert.match(applicabilityMigration, /update_project_spec_values_and_applicability/);
assert.match(applicabilityMigration, /guard_inactive_project_rfq_process_entries/);
assert.match(applicabilityMigration, /'active',pr\.is_active/);
const directMigration = readFileSync("../../supabase/migrations/20260901130000_project_property_applicability_direct_quotation.sql", "utf8");
assert.match(directMigration, /p_basic_states JSONB/);
assert.match(directMigration, /RETURNS TIMESTAMPTZ/);
assert.match(directMigration, /initialize_direct_project_quotation/);
assert.match(directMigration, /seller_organisation_id<>c\.organization_id/);

const tables = readFileSync("src/features/projects/components/ProjectSpecificationTables.tsx", "utf8");
assert.match(tables, /useEffect\(\(\) =>/);
assert.match(tables, /field\.type === "file"/);
assert.match(tables, /field\.allowedOptions\.map/);
assert.match(tables, /version: versionRef\.current/);
assert.match(tables, /queueRef\.current = queueRef\.current\.then/);
assert.match(tables, /lastQueuedStructuredRef\.current/);
assert.match(tables, /lastQueuedLineRef\.current/);
assert.match(tables, /queueHadErrorRef\.current/);
assert.match(tables, /onBlur=\{\(\) => saveStructuredFields\(/);
assert.match(tables, /onBlur=\{\(\) => saveLine\(\)\}/);
assert.match(tables, /queueMicrotask\(onCommit\)/);
assert.match(tables, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/);
assert.match(tables, /field\.type === "select"/);
assert.match(tables, /field\.type === "boolean"/);
assert.match(tables, /type=\{numeric \? "text" : type\}/);
assert.match(tables, /Show inactive properties/);
assert.match(tables, /Create supplier quotation/);
assert.match(tables, /Select existing RFQ candidate/);
assert.match(tables, /correctProjectQuotation/);
assert.match(tables, /Quotation unit price/);
assert.doesNotMatch(tables, /w-max min-w-full table-auto/);
assert.match(tables, /aria-live="polite"/);
assert.match(tables, /\}, \[line\.id\]\);/);
assert.doesNotMatch(tables, />Save line</);
assert.doesNotMatch(tables, />Save fields</);
assert.doesNotMatch(tables, /router\.refresh\(\)/);

const actions = readFileSync("src/features/projects/actions/projectSpecificationActions.ts", "utf8");
assert.match(actions, /select\("id, updated_at"\)/);
assert.match(actions, /guardedUpdate\.eq\("updated_at", input\.version\)/);
assert.match(actions, /data: \{ id: input\.lineId, version: version\.data \}/);
assert.match(actions, /p_basic_states/);
assert.match(actions, /data: \{ id: parsed\.data\.lineId, version: version\.data \}/);
const autosaveActions = actions.slice(actions.indexOf("export async function updateProjectSpecificationLine"), actions.indexOf("export async function deleteProjectSpecificationLine"));
assert.doesNotMatch(autosaveActions, /refreshProject\(/);

console.log("specification structured values tests passed");
