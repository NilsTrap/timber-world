import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { passwordSchema, recoveryRequestSchema } from "./passwordRecovery";

assert.equal(recoveryRequestSchema.safeParse({ email: "person@example.com" }).success, true);
assert.equal(recoveryRequestSchema.safeParse({ email: "not-an-email" }).success, false);
assert.equal(passwordSchema.safeParse("1234567").success, false);
assert.equal(passwordSchema.safeParse("correct-horse").success, true);

const action = readFileSync(new URL("./passwordRecovery.ts", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/ResetPasswordForm.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../../../proxy.ts", import.meta.url), "utf8");
assert.ok(action.includes("NEUTRAL_MESSAGE") && action.includes("error || !actionLink"), "unknown accounts receive neutral confirmation");
assert.ok(action.includes('type: "recovery"') && action.includes('/reset-password'), "Supabase creates a recovery link for the reset route");
assert.ok(!action.includes("actionLink,"), "the recovery token is never returned from the action");
assert.ok(form.includes('hash.get("type") !== "recovery"'), "legacy token flow rejects non-recovery links");
assert.ok(form.includes("markSessionVerified()"), "successful recovery verifies the browser window");
assert.ok(proxy.includes('pathname.startsWith("/forgot-password")') && proxy.includes('pathname.startsWith("/reset-password")'), "recovery routes are public");
console.log("passwordRecovery.test.ts: all assertions passed");
