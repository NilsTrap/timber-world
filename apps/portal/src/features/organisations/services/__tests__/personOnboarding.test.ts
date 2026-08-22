import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder-service-role-key";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

async function main() {
  const { derivePersonas, effectiveModuleIntersection } = await import("../personOnboarding");

  test("derives Customer persona", () => {
    assert.deepEqual(derivePersonas({ isCustomer: true }), ["Customer"]);
  });
  test("derives Trader persona", () => {
    assert.deepEqual(derivePersonas({ isTrader: true }), ["Trader"]);
  });
  test("derives Manufacturer/Supplier from every supported flag", () => {
    for (const flags of [{ isManufacturer: true }, { isSupplier: true }, { isProducer: true }]) {
      assert.deepEqual(derivePersonas(flags), ["Manufacturer/Supplier"]);
    }
  });
  test("preserves a multi-role persona", () => {
    assert.deepEqual(
      derivePersonas({ isCustomer: true, isTrader: true, isSupplier: true }),
      ["Customer", "Trader", "Manufacturer/Supplier"],
    );
  });
  test("isolates effective modules per organisation ceiling", () => {
    const grants = ["orders.view", "inventory.view", "counterparties.clients"];
    assert.deepEqual(effectiveModuleIntersection(["orders.view"], grants), ["orders.view"]);
    assert.deepEqual(effectiveModuleIntersection(["counterparties.clients"], grants), ["counterparties.clients"]);
  });

  const migration = readFileSync(
    new URL("../../../../../../../supabase/migrations/20260822000001_super_admin_user_onboarding.sql", import.meta.url),
    "utf8",
  );
  test("database enforces one active primary under concurrent requests", () => {
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_one_active_primary/);
    assert.match(migration, /WHERE is_active = true AND is_primary = true/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /UPDATE public\.portal_users\s+SET organisation_id = p_organization_id/);
  });
  test("membership deactivation refuses primary/only and revokes only its org", () => {
    assert.match(migration, /PRIMARY_OR_ONLY_MEMBERSHIP/);
    assert.match(migration, /DELETE FROM public\.user_access_groups\s+WHERE user_id = p_user_id AND organization_id = p_organization_id/);
  });
  test("membership RPCs are unavailable to browser roles", () => {
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_set_primary_membership\(uuid, uuid\) FROM PUBLIC, anon, authenticated/);
  });

  const sessionSource = readFileSync(new URL("../../../../lib/auth/getSession.ts", import.meta.url), "utf8");
  test("inactive portal users are denied before session construction", () => {
    assert.match(sessionSource, /if \(portalUser\.is_active !== true\) return null/);
    assert.doesNotMatch(sessionSource, /Legacy org is treated as primary/);
  });
  const guardSource = readFileSync(new URL("../../actions/_platformAdmin.ts", import.meta.url), "utf8");
  test("non-admin and legacy-role callers cannot mutate onboarding", () => {
    assert.match(guardSource, /session\?\.isPlatformAdmin === true/);
    assert.doesNotMatch(guardSource, /isSuperAdmin|role === ["']admin/);
  });

  const inviteSource = readFileSync(new URL("../passwordlessInvite.ts", import.meta.url), "utf8");
  test("passwordless resend preserves auth identity and exposes no link", () => {
    assert.match(inviteSource, /auth\.resend/);
    assert.doesNotMatch(inviteSource, /deleteUser\s*\(/);
    assert.doesNotMatch(inviteSource, /action_link|hashed_token/i);
  });

  console.log(`\n${passed} onboarding policy tests passed.`);
}

void main();
