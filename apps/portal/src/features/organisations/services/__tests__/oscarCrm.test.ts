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

// Field mapping to the confirmed Oscar CRM contract (reg_number/bank_iban/bank_swift/external_id/role flags)
const p = orgToCrmPayload(org);
eq("name", p.name, "Somms Ltd");
eq("external_id = Timber code", p.external_id, "SOM");
eq("legal_address", p.legal_address, "1 High St");
eq("vat_number", p.vat_number, "GB123");
eq("reg_number (not registration_number)", p.reg_number, "R1");
eq("bank_iban (not bank_account_number)", p.bank_iban, "GB00");
eq("bank_swift (not bank_swift_code)", p.bank_swift, "BARC");
eq("is_customer flag", p.is_customer, true);
eq("is_manufacturer flag", p.is_manufacturer, false);
eq("is_producer flag", p.is_producer, true);
ok("no legacy 'roles' array", !("roles" in p));
ok("no legacy 'code' field", !("code" in p));
ok("business_id NOT in pure payload (added by caller)", !("business_id" in p));

const empty = orgToCrmPayload({ ...org, vatNumber: null });
eq("null vat passes through", empty.vat_number, null);

// gating — requires URL + TOKEN + BUSINESS_ID
const url = process.env.OSCAR_CRM_URL, tok = process.env.OSCAR_CRM_TOKEN, biz = process.env.OSCAR_BUSINESS_ID;
delete process.env.OSCAR_CRM_URL; delete process.env.OSCAR_CRM_TOKEN; delete process.env.OSCAR_BUSINESS_ID;
ok("disabled when env unset", isCrmEnabled() === false);
process.env.OSCAR_CRM_URL = "https://timber.agentwave.app/api/crm-mcp";
process.env.OSCAR_CRM_TOKEN = "mcp_x_secret";
ok("still disabled without business_id", isCrmEnabled() === false);
process.env.OSCAR_BUSINESS_ID = "timber";
ok("enabled when all three set", isCrmEnabled() === true);
// restore
for (const [k, v] of [["OSCAR_CRM_URL", url], ["OSCAR_CRM_TOKEN", tok], ["OSCAR_BUSINESS_ID", biz]] as const) {
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
