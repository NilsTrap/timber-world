import assert from "node:assert/strict";
import { canManageManualPassword } from "./manualPasswordEligibility";

const eligible = { status: "active" as const, authUserId: "auth-a", isActive: true };
assert.equal(canManageManualPassword(eligible, true), true);
assert.equal(canManageManualPassword({ ...eligible, status: "invited" }, true), true);
assert.equal(canManageManualPassword({ ...eligible, status: "created", authUserId: null }, true), true);
assert.equal(canManageManualPassword({ ...eligible, status: "created", authUserId: "auth-a" }, true), true);
assert.equal(canManageManualPassword({ ...eligible, status: "invited", authUserId: null }, true), true);
assert.equal(canManageManualPassword({ ...eligible, authUserId: null }, true), true);
assert.equal(canManageManualPassword({ ...eligible, authUserId: "   " }, true), true);
assert.equal(canManageManualPassword({ ...eligible, isActive: false }, true), false);
assert.equal(canManageManualPassword(eligible, false), false);
console.log("manualPasswordEligibility.test.ts: 9 passed, 0 failed");
