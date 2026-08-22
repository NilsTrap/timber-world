/** Run from apps/portal: ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/counterparties/__tests__/counterparty-access.test.ts */
import {
  canAccessCounterpartyRecord,
  decideCounterpartyBookMode,
  isOrganisationInBook,
  isOrganisationSelfInBook,
  isValidCounterpartyId,
} from "../policy";

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean) {
  if (condition) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

const ORG = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const mode = (book: "clients" | "suppliers" | "traders", grant: boolean, own: Record<string, boolean> | null, admin = false) =>
  decideCounterpartyBookMode({ book, platformAdmin: admin, hasExactBookGrant: grant, callerOrgId: ORG, callerOrg: own });

ok("platform admin sees every customer book", mode("clients", false, null, true) === "admin");
ok("platform admin may manage the Traders book", mode("traders", false, null, true) === "admin");
ok("clients-only trader gets manager mode in Clients", mode("clients", true, {}) === "manager");
ok("clients-only grant does not become Suppliers grant", mode("suppliers", false, {}) === null);
ok("suppliers-only trader gets manager mode in Suppliers", mode("suppliers", true, {}) === "manager");
ok("dual-grant trader resolves independently per exact book", mode("clients", true, {}) === "manager" && mode("suppliers", true, {}) === "manager");
ok("customer member sees own company read-only", mode("clients", false, { is_customer: true }) === "self");
ok("supplier member sees own company read-only", mode("suppliers", false, { is_supplier: true }) === "self");
ok("producer member sees own company read-only", mode("suppliers", false, { is_producer: true }) === "self");
ok("manufacturer member sees own company read-only", mode("suppliers", false, { is_manufacturer: true }) === "self");
ok("role flags do not grant the wrong book", mode("clients", false, { is_supplier: true }) === null && mode("suppliers", false, { is_customer: true }) === null);
ok("missing action/module pair denies a house user", mode("clients", false, {}) === null);
ok("traders book remains admin-only", mode("traders", true, { is_trader: true }) === null);

ok("manager reaches a linked partner", canAccessCounterpartyRecord({ mode: "manager", callerOrgId: ORG, targetOrgId: PARTNER, linked: true, intent: "read" }));
ok("manager cannot reach an unrelated org", !canAccessCounterpartyRecord({ mode: "manager", callerOrgId: ORG, targetOrgId: PARTNER, linked: false, intent: "read" }));
ok("self reaches only current membership org", canAccessCounterpartyRecord({ mode: "self", callerOrgId: ORG, targetOrgId: ORG, linked: false, intent: "read" }) && !canAccessCounterpartyRecord({ mode: "self", callerOrgId: ORG, targetOrgId: PARTNER, linked: true, intent: "read" }));
ok("self cannot mutate contacts, addresses, logo or signee", !canAccessCounterpartyRecord({ mode: "self", callerOrgId: ORG, targetOrgId: ORG, linked: false, intent: "manage" }));
ok("admin may manage", canAccessCounterpartyRecord({ mode: "admin", callerOrgId: null, targetOrgId: PARTNER, linked: false, intent: "manage" }));
ok("malformed direct IDs are rejected", !isValidCounterpartyId("not-an-id") && isValidCounterpartyId(ORG));
ok("book predicates cannot be client-swapped", isOrganisationInBook({ is_customer: true }, "clients") && !isOrganisationInBook({ is_customer: true }, "suppliers") && isOrganisationInBook({ is_supplier: true }, "suppliers"));
ok("manufacturer-only is self context, not a foreign supplier record", !isOrganisationInBook({ is_manufacturer: true }, "suppliers") && isOrganisationSelfInBook({ is_manufacturer: true }, "suppliers"));

console.log(`counterparty-access.test.ts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
