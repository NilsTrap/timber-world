import assert from "node:assert/strict";
import { visibilityGroupsForCompany } from "../companyVisibilityPolicy";

const source = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

assert.deepEqual(visibilityGroupsForCompany({ id: source, is_trader: true }, source), []);
assert.deepEqual(visibilityGroupsForCompany({ id: target, is_customer: true }, source), ["customers"]);
assert.deepEqual(visibilityGroupsForCompany({ id: target, is_trader: true }, source), ["traders"]);
assert.deepEqual(visibilityGroupsForCompany({ id: target, is_manufacturer: true }, source), ["suppliers"]);
assert.deepEqual(
  visibilityGroupsForCompany({ id: target, is_supplier: true, is_producer: true }, source),
  ["suppliers"],
);
assert.deepEqual(
  visibilityGroupsForCompany(
    { id: target, is_customer: true, is_trader: true, is_supplier: true },
    source,
  ),
  ["customers", "traders", "suppliers"],
);

console.log("companyVisibilityPolicy.test.ts: all assertions passed");
