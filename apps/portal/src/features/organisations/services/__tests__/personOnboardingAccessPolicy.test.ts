import assert from "node:assert/strict";
import { canOnboardCompanyPerson } from "../personOnboardingAccessPolicy";

const base = {
  platformAdmin: false,
  hasInviteRight: true,
  callerOrgId: "trader-a",
  callerIsTrader: true,
  targetOrgId: "customer-a",
  targetIsCustomer: true,
  targetIsTrader: false,
  directlyAssigned: true,
};

assert.equal(canOnboardCompanyPerson(base), true, "trader can invite into an assigned customer");
assert.equal(canOnboardCompanyPerson({ ...base, directlyAssigned: false }), false, "unassigned customer stays hidden");
assert.equal(canOnboardCompanyPerson({ ...base, hasInviteRight: false }), false, "right is independently revocable");
assert.equal(canOnboardCompanyPerson({ ...base, callerIsTrader: false }), false, "non-trader cannot use trader delegation");
assert.equal(canOnboardCompanyPerson({ ...base, targetOrgId: "supplier-a", targetIsCustomer: false, directlyAssigned: true }), false, "trader cannot invite supplier users");
assert.equal(canOnboardCompanyPerson({ ...base, targetOrgId: "trader-a", targetIsCustomer: false, targetIsTrader: true, directlyAssigned: false }), true, "trader can manage its own company users");
assert.equal(canOnboardCompanyPerson({ ...base, platformAdmin: true, callerOrgId: null, callerIsTrader: false, hasInviteRight: false, directlyAssigned: false }), true, "platform admin can onboard any active company");

console.log("personOnboardingAccessPolicy.test.ts: 7 passed, 0 failed");
