/**
 * Seed test users + minimal data into the target Supabase.
 * Idempotent: re-running updates passwords if needed, doesn't duplicate orgs.
 *
 * Run with: pnpm --filter @timber/tests-rls-and-perf exec tsx src/lib/seed.ts
 * Or via the orchestrator: pnpm --filter @timber/tests-rls-and-perf seed
 *
 * Designed to run against the STAGING Supabase only. The seed script refuses
 * to run if TEST_SUPABASE_URL looks like the known production URL.
 */

import { adminClient } from "./supabase.js";
import { config, TEST_ORGS, TEST_USERS, type TestUserDef, type TestOrgDef } from "../config.js";

const PROD_URL_SUBSTR = "psmramegggsciirwldjz";

function assertNotProd(): void {
  if (config.supabaseUrl.includes(PROD_URL_SUBSTR)) {
    throw new Error(
      `Refusing to seed: TEST_SUPABASE_URL points at production (${config.supabaseUrl}). ` +
        `The seed script is for staging only.`,
    );
  }
}

async function upsertOrg(supabase: ReturnType<typeof adminClient>, def: TestOrgDef): Promise<string> {
  // Check by code (codes are app-managed unique identifiers)
  const { data: existing } = await supabase
    .from("organisations")
    .select("id")
    .eq("code", def.code)
    .maybeSingle();

  if (existing) {
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("organisations")
    .insert({
      code: def.code,
      name: def.name,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create org ${def.code}: ${error?.message}`);
  return data.id as string;
}

async function upsertUser(
  supabase: ReturnType<typeof adminClient>,
  user: TestUserDef,
  orgIdByKey: Record<string, string>,
): Promise<{ authUserId: string; portalUserId: string }> {
  // Check by email in portal_users
  const { data: existingPortal } = await supabase
    .from("portal_users")
    .select("id, auth_user_id")
    .eq("email", user.email)
    .maybeSingle();

  let authUserId: string;

  if (existingPortal?.auth_user_id) {
    authUserId = existingPortal.auth_user_id as string;
    // Refresh password on each run so the harness always has current creds
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password: user.password,
    });
    if (error) {
      console.warn(`Could not refresh password for ${user.email}: ${error.message}`);
    }
  } else {
    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });
    if (authErr || !authData.user) {
      throw new Error(`Failed to create auth user ${user.email}: ${authErr?.message}`);
    }
    authUserId = authData.user.id;
  }

  // Upsert portal_users
  let portalUserId: string;
  if (existingPortal) {
    portalUserId = existingPortal.id as string;
    const { error } = await supabase
      .from("portal_users")
      .update({
        auth_user_id: authUserId,
        name: user.name,
        role: user.isPlatformAdmin ? "admin" : "user",
        is_platform_admin: user.isPlatformAdmin,
        is_active: true,
        status: "active",
        organisation_id: user.orgKeys[0] ? orgIdByKey[user.orgKeys[0]] : null,
      })
      .eq("id", portalUserId);
    if (error) throw new Error(`Failed to update portal_user ${user.email}: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("portal_users")
      .insert({
        auth_user_id: authUserId,
        email: user.email,
        name: user.name,
        role: user.isPlatformAdmin ? "admin" : "user",
        is_platform_admin: user.isPlatformAdmin,
        is_active: true,
        status: "active",
        organisation_id: user.orgKeys[0] ? orgIdByKey[user.orgKeys[0]] : null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Failed to insert portal_user ${user.email}: ${error?.message}`);
    }
    portalUserId = data.id as string;
  }

  return { authUserId, portalUserId };
}

async function syncMembershipsAndModules(
  supabase: ReturnType<typeof adminClient>,
  user: TestUserDef,
  portalUserId: string,
  orgIdByKey: Record<string, string>,
): Promise<void> {
  if (user.isPlatformAdmin) return;

  for (const orgKey of user.orgKeys) {
    const orgId = orgIdByKey[orgKey];
    if (!orgId) continue;

    // organization_memberships — uses US spelling (organization_id) per the
    // table schema. portal_users still uses UK (organisation_id); mixed.
    const { data: existingMembership } = await supabase
      .from("organization_memberships")
      .select("user_id")
      .eq("user_id", portalUserId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!existingMembership) {
      const { error } = await supabase
        .from("organization_memberships")
        .insert({
          user_id: portalUserId,
          organization_id: orgId,
          is_active: true,
          is_primary: true,
        });
      if (error) {
        console.warn(`Could not insert membership ${user.email}→${orgKey}: ${error.message}`);
      }
    }

    // user_modules — enable each module code we want for this user/org
    for (const moduleCode of user.enabledModules) {
      const { error } = await supabase
        .from("user_modules")
        .upsert(
          {
            user_id: portalUserId,
            organization_id: orgId,
            module_code: moduleCode,
            enabled: true,
          },
          { onConflict: "user_id,organization_id,module_code" },
        );
      if (error) {
        console.warn(`Could not enable module ${moduleCode} for ${user.email}: ${error.message}`);
      }
    }
  }
}

async function syncOrgModules(
  supabase: ReturnType<typeof adminClient>,
  org: TestOrgDef,
  orgId: string,
): Promise<void> {
  for (const moduleCode of org.enabledModules) {
    const { error } = await supabase
      .from("organization_modules")
      .upsert(
        { organization_id: orgId, module_code: moduleCode, enabled: true },
        { onConflict: "organization_id,module_code" },
      );
    if (error) {
      console.warn(`Could not enable org-module ${moduleCode} for ${org.code}: ${error.message}`);
    }
  }
}

async function seedSampleOrders(
  supabase: ReturnType<typeof adminClient>,
  orgIdByKey: Record<string, string>,
): Promise<void> {
  // 3 sample orders per org so cross-tenant probes have something concrete
  // to leak (pre-RLS) or correctly block (post-RLS).
  for (const orgKey of ["org-a", "org-b"]) {
    const orgId = orgIdByKey[orgKey];
    if (!orgId) continue;

    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_organisation_id", orgId);
    if ((count ?? 0) > 0) continue;

    const rows = [1, 2, 3].map((i) => ({
      code: `IJL-${orgKey.toUpperCase()}-${i.toString().padStart(3, "0")}`,
      name: `IJL test order ${orgKey} #${i}`,
      customer_organisation_id: orgId,
      status: "draft" as const,
      currency: "EUR",
    }));
    const { error } = await supabase.from("orders").insert(rows);
    if (error) console.warn(`Could not seed orders for ${orgKey}: ${error.message}`);
  }
}

export async function seed(): Promise<{ orgIdByKey: Record<string, string> }> {
  assertNotProd();
  const supabase = adminClient();

  console.log("→ Seeding orgs...");
  const orgIdByKey: Record<string, string> = {};
  for (const org of TEST_ORGS) {
    const id = await upsertOrg(supabase, org);
    orgIdByKey[org.orgKey] = id;
    await syncOrgModules(supabase, org, id);
    console.log(`  ✓ ${org.code} → ${id}`);
  }

  console.log("→ Seeding users...");
  for (const user of TEST_USERS) {
    const { portalUserId } = await upsertUser(supabase, user, orgIdByKey);
    await syncMembershipsAndModules(supabase, user, portalUserId, orgIdByKey);
    console.log(`  ✓ ${user.email}`);
  }

  console.log("→ Seeding sample data (orders)...");
  await seedSampleOrders(supabase, orgIdByKey);

  console.log("✓ Seed complete.");
  return { orgIdByKey };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
