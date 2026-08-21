/**
 * Company contact action regression checks.
 * Run from apps/portal:
 * ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/counterparties/__tests__/org-contacts-actions.test.ts
 */
import { readFileSync } from "node:fs";
import { canAccessCounterpartyRecord } from "../policy";

let passed = 0;
let failed = 0;
function ok(label: string, condition: boolean) {
  if (condition) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

const ORG = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";

ok("unlinked manager cannot list contacts", !canAccessCounterpartyRecord({
  mode: "manager", callerOrgId: ORG, targetOrgId: TARGET, linked: false, intent: "read",
}));
ok("unlinked manager cannot mutate contacts", !canAccessCounterpartyRecord({
  mode: "manager", callerOrgId: ORG, targetOrgId: TARGET, linked: false, intent: "manage",
}));
ok("self viewer cannot mutate own contacts", !canAccessCounterpartyRecord({
  mode: "self", callerOrgId: ORG, targetOrgId: ORG, linked: false, intent: "manage",
}));
ok("linked manager may manage the partner record", canAccessCounterpartyRecord({
  mode: "manager", callerOrgId: ORG, targetOrgId: TARGET, linked: true, intent: "manage",
}));

const actions = readFileSync("src/features/counterparties/actions/orgContacts.ts", "utf8");
const component = readFileSync("src/features/counterparties/components/OrgContactsSection.tsx", "utf8");

ok("legacy fallback uses the record guard", actions.includes(
  "requireCounterpartyRecordAccess(book, organisationId, intent)",
));
ok("module-only book guard cannot authorize contacts", !actions.includes("requireBookAccess"));
ok("contact denials collapse to not-found", actions.includes(
  'return { ok: false, error: "Not found", code: "NOT_FOUND" };',
));

const companyActions = [
  "listCompanyOrgContacts",
  "createCompanyOrgContact",
  "updateCompanyOrgContact",
  "deleteCompanyOrgContact",
  "setCompanyPrimaryContact",
  "useCompanyContactAsSignee",
];
for (const name of companyActions) {
  ok(`${name} requires a book argument`, actions.includes(
    `export async function ${name}(\n  book: CounterpartyBook,`,
  ));
  ok(`${name} is used by the company UI`, component.includes(`${name}(`));
}

console.log(`org-contacts-actions.test.ts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
