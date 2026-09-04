import assert from "node:assert/strict";
import {
  assertLocalUiFlowTarget,
  resolveUiFlowFixtureConfig,
  UI_FLOW_CONFIRMATION,
  UI_FLOW_IDS,
  UI_FLOW_PERSONAS,
  UI_FLOW_RFP_CANDIDATES,
} from "./fixtureConfig.js";

const safeEnv: NodeJS.ProcessEnv = {
  NILITTO_UI_FLOW_SUPABASE_URL: "http://127.0.0.1:54321",
  NILITTO_UI_FLOW_CONFIRMATION: UI_FLOW_CONFIRMATION,
  NILITTO_UI_FLOW_RUN_LABEL: "UIFLOW-20260902-01",
  NILITTO_UI_FLOW_SERVICE_ROLE_KEY: "test-only-service-role-placeholder",
  NILITTO_UI_FLOW_TEST_PASSWORD: "test-only-password-placeholder",
};

assert.equal(resolveUiFlowFixtureConfig(safeEnv).runLabel, "UIFLOW-20260902-01");
assert.equal(assertLocalUiFlowTarget("http://localhost:55321/"), "http://localhost:55321");
assert.equal(new Set(Object.values(UI_FLOW_PERSONAS).map((persona) => persona.email)).size, 5);
assert.equal(new Set(Object.values(UI_FLOW_IDS.organisations)).size, 6);
assert.equal(Object.keys(UI_FLOW_PERSONAS).length, 5);
const personaOrganisationKeys = new Set<string | null>(Object.values(UI_FLOW_PERSONAS).map((persona) => persona.organisation));
assert.deepEqual([personaOrganisationKeys.has("metalBackup"), personaOrganisationKeys.has("woodBackup")], [false, false]);
assert.deepEqual(UI_FLOW_RFP_CANDIDATES.metal.organisationIds, [
  UI_FLOW_IDS.organisations.metalSupplier,
  UI_FLOW_IDS.organisations.metalBackup,
]);
assert.deepEqual(UI_FLOW_RFP_CANDIDATES.wood.organisationIds, [
  UI_FLOW_IDS.organisations.woodSupplier,
  UI_FLOW_IDS.organisations.woodBackup,
]);

for (const [label, patch] of [
  ["production target", { NILITTO_UI_FLOW_SUPABASE_URL: "https://production.example.test" }],
  ["staging target", { NILITTO_UI_FLOW_SUPABASE_URL: "https://staging.example.test" }],
  ["loopback without port", { NILITTO_UI_FLOW_SUPABASE_URL: "http://127.0.0.1" }],
  ["loopback with path", { NILITTO_UI_FLOW_SUPABASE_URL: "http://127.0.0.1:54321/rest/v1" }],
  ["missing confirmation", { NILITTO_UI_FLOW_CONFIRMATION: "" }],
  ["invalid confirmation", { NILITTO_UI_FLOW_CONFIRMATION: "yes" }],
  ["invalid label", { NILITTO_UI_FLOW_RUN_LABEL: "UIFLOW-latest" }],
  ["short password", { NILITTO_UI_FLOW_TEST_PASSWORD: "short" }],
  ["missing key", { NILITTO_UI_FLOW_SERVICE_ROLE_KEY: "" }],
] as const) {
  assert.throws(() => resolveUiFlowFixtureConfig({ ...safeEnv, ...patch }), label);
}

console.log("fixtureConfig.test.ts: 17 passed, 0 failed");
