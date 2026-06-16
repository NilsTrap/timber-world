/**
 * Pure-logic tests for the Oscar CRM client mapper + gating (no network/DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/organisations/services/__tests__/oscarCrm.test.ts`
 */
import { orgToCrmPayload, isCrmEnabled, type OrgCardForCrm } from "../oscarCrm";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`); }
}
function ok(label: string, cond: boolean) { if (cond) passed++; else { failed++; console.error(`✗ ${label}`); } }

const org: OrgCardForCrm = {
  timberOrgId: "org-1", code: "SOM", name: "Somms Ltd",
  legalAddress: "1 High St", vatNumber: "GB123", registrationNumber: "R1", country: "GB",
  phone: "+44", email: "a@b.com", website: "x.com",
  bankName: "Barclays", bankAccountNumber: "GB00", bankSwiftCode: "BARC",
  isCustomer: true, isManufacturer: false, isProducer: true,
};

const p = orgToCrmPayload(org);
eq("name", p.name, "Somms Ltd");
eq("code", p.code, "SOM");
eq("legal_address", p.legal_address, "1 High St");
eq("vat_number", p.vat_number, "GB123");
eq("bank_swift_code", p.bank_swift_code, "BARC");
eq("roles filter nulls (customer+producer)", p.roles, ["customer", "producer"]);
eq("external_ref back-link", p.external_ref, { system: "timber", org_id: "org-1", code: "SOM" });

const empty = orgToCrmPayload({ ...org, isCustomer: false, isManufacturer: false, isProducer: false, vatNumber: null });
eq("roles empty when no flags", empty.roles, []);
eq("null vat passes through", empty.vat_number, null);

// gating — depends on env
const url = process.env.OSCAR_CRM_URL, tok = process.env.OSCAR_CRM_TOKEN;
delete process.env.OSCAR_CRM_URL; delete process.env.OSCAR_CRM_TOKEN;
ok("disabled when env unset", isCrmEnabled() === false);
process.env.OSCAR_CRM_URL = "https://timber.agentwave.app/api/crm-mcp";
ok("still disabled with only URL", isCrmEnabled() === false);
process.env.OSCAR_CRM_TOKEN = "secret";
ok("enabled when URL + token set", isCrmEnabled() === true);
// restore
if (url === undefined) delete process.env.OSCAR_CRM_URL; else process.env.OSCAR_CRM_URL = url;
if (tok === undefined) delete process.env.OSCAR_CRM_TOKEN; else process.env.OSCAR_CRM_TOKEN = tok;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
