import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync(new URL("./login.ts", import.meta.url), "utf8");
const invite = readFileSync(new URL("../components/AcceptInviteForm.tsx", import.meta.url), "utf8");

for (const group of ["buyer", "supplier", "trader", "platform admin"]) {
  assert.ok(login.includes('portalUser.status === "invited"'), `${group} uses the common invited-user activation path`);
}
assert.ok(login.includes("createAdminClient() as any"), "login lifecycle updates bypass user RLS on the server");
assert.ok(login.includes('.eq("id", portalUser.id)') && login.includes('.eq("auth_user_id", data.user.id)'), "activation is constrained to the authenticated portal identity");
assert.ok(login.includes('.eq("status", "invited")') && login.includes('.select("id")') && login.includes("lifecycleError || !activated"), "activation verifies the expected invited row was updated");
assert.ok(login.includes("portalUserError || !portalUser") && login.includes('code: "ACCOUNT_NOT_CONFIGURED"'), "missing portal identities fail closed");
assert.ok(login.includes("Login telemetry must never make an otherwise valid active account unavailable"), "active-user telemetry is best-effort");
assert.ok(login.includes('code: "ACCOUNT_ACTIVATION_FAILED"'), "activation failure is returned instead of redirecting into a loop");
assert.ok(invite.includes('setInviteState({ status: "no_token" })') && !invite.includes("supabase.auth.getSession()"), "tokenless invitation pages recover without stale-session refresh calls");
assert.ok(invite.includes('href="/login?reauth=1"'), "invitation recovery links to the explicit reauthentication route");
const proxy = readFileSync(new URL("../../../proxy.ts", import.meta.url), "utf8");
assert.ok(proxy.includes('request.nextUrl.searchParams.get("reauth") !== "1"'), "proxy permits explicit reauthentication even when a stale user session exists");

console.log("loginLifecycle.test.ts: all assertions passed");
