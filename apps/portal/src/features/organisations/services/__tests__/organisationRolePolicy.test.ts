import assert from "node:assert/strict";
import {
  exclusiveRoleDbUpdate,
  exclusiveRoleUpdateFromFlags,
  organisationRoleFromFlags,
} from "../organisationRolePolicy";

assert.equal(organisationRoleFromFlags({}), "unassigned");
assert.equal(organisationRoleFromFlags({ isTrader: true }), "trader");
assert.equal(organisationRoleFromFlags({ isTrader: true, isCustomer: true }), "multiple");

assert.deepEqual(exclusiveRoleDbUpdate("supplier"), {
  is_customer: false,
  is_manufacturer: false,
  is_producer: false,
  is_supplier: true,
  is_trader: false,
});

assert.deepEqual(exclusiveRoleUpdateFromFlags({ isTrader: true }), {
  success: true,
  update: {
    is_customer: false,
    is_manufacturer: false,
    is_producer: false,
    is_supplier: false,
    is_trader: true,
  },
});
assert.deepEqual(exclusiveRoleUpdateFromFlags({ isTrader: false }), {
  success: true,
  update: { is_trader: false },
});
assert.deepEqual(exclusiveRoleUpdateFromFlags({ isTrader: true, isSupplier: true }), {
  success: false,
  error: "A company can have only one role",
});

console.log("organisationRolePolicy.test.ts: all assertions passed");
