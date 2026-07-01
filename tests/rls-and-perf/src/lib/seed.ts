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

import { createHash } from "node:crypto";
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
      // E4 bilateral invariant: buyer == customer on legacy-shaped rows —
      // without it the seller+buyer RLS hides the row from everyone but admins.
      buyer_organisation_id: orgId,
      status: "draft" as const,
      currency: "EUR",
    }));
    const { error } = await supabase.from("orders").insert(rows);
    if (error) console.warn(`Could not seed orders for ${orgKey}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// E4 · access groups

const PRICING_TABS = ["orders.tab.sales", "orders.tab.analytics", "orders.tab.prices"];

/**
 * Ensure the deterministic legacy-parity group for a module set (same key
 * formula + parity rules as migration 20260701000011) and return its id.
 */
async function ensureLegacyParityGroup(
  supabase: ReturnType<typeof adminClient>,
  enabledModules: string[],
  orgCeiling: Set<string>,
): Promise<string | null> {
  // Effective set (org ceiling ∩ user) — matches migration 20260701000011.
  const arr = [...new Set(enabledModules)].filter((c) => orgCeiling.has(c)).sort();
  if (arr.length === 0) return null;
  const sig = arr.join(",");
  const hash = createHash("md5").update(sig).digest("hex").slice(0, 8);
  const key = `legacy-${hash}`;

  const { data: existing } = await supabase
    .from("access_groups")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  let groupId = existing?.id as string | undefined;
  if (!groupId) {
    const { data, error } = await supabase
      .from("access_groups")
      .insert({
        key,
        name: `Legacy modules (${hash})`,
        description: "Harness-seeded legacy-parity group (module set → group).",
        is_system: false,
        sort_order: 5000,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Failed to create group ${key}: ${error?.message}`);
    groupId = data.id as string;
  }

  const hasView = arr.includes("orders.view");
  const hasPricing = arr.some((c) => PRICING_TABS.includes(c));
  const hasProd = arr.includes("orders.tab.production");

  const rights: Array<{ right_type: string; resource: string; key: string; value: unknown }> = [
    ...arr.map((code) => ({ right_type: "module", resource: "portal", key: code, value: {} })),
    ...["side.sell", "side.buy", "legacy.producer"].map((k) => ({
      right_type: "visibility",
      resource: "deal",
      key: k,
      value: {},
    })),
    { right_type: "scope", resource: "deal", key: "deals", value: "company" },
    // Legacy parity: both counterparty action rights (matches migration
    // 20260701000012) so migrated users keep trading-partner org visibility.
    { right_type: "action", resource: "counterparty", key: "clients", value: {} },
    { right_type: "action", resource: "counterparty", key: "suppliers", value: {} },
  ];
  const domain = (key: string, visible: boolean, editable: boolean) => {
    if (visible) rights.push({ right_type: "visibility", resource: "deal_fields", key, value: { visible, editable } });
  };
  domain("general", true, hasView);
  domain("logistics", true, hasView || hasProd);
  domain("production", true, hasView || hasProd);
  domain("customer_identity", true, hasView);
  domain("supplier_identity", true, hasView);
  domain("chain", true, hasView);
  domain("deal_terms", hasPricing, hasPricing && hasView);
  domain("margin", hasPricing, hasPricing && hasView);
  domain("financial_docs", hasPricing, hasPricing && hasView);

  for (const r of rights) {
    const { error } = await supabase
      .from("access_group_rights")
      .upsert(
        { group_id: groupId, ...r },
        { onConflict: "group_id,right_type,resource,key" },
      );
    if (error) console.warn(`Could not upsert right ${r.right_type}/${r.key} on ${key}: ${error.message}`);
  }
  return groupId;
}

/** Assign the user's groups per org (replace semantics so personas converge). */
async function syncAccessGroups(
  supabase: ReturnType<typeof adminClient>,
  user: TestUserDef,
  portalUserId: string,
  orgIdByKey: Record<string, string>,
): Promise<void> {
  if (user.isPlatformAdmin) return;

  for (const orgKey of user.orgKeys) {
    const orgId = orgIdByKey[orgKey];
    if (!orgId) continue;

    const targetGroupIds: string[] = [];
    if (user.groups && user.groups.length > 0) {
      for (const key of user.groups) {
        const { data } = await supabase.from("access_groups").select("id").eq("key", key).maybeSingle();
        if (!data) throw new Error(`Seed: system group '${key}' not found — is migration 20260701000009 applied?`);
        targetGroupIds.push(data.id as string);
      }
    } else {
      // Legacy-parity group over the EFFECTIVE set (org ceiling ∩ user).
      const { data: ceilingRows } = await supabase
        .from("organization_modules")
        .select("module_code")
        .eq("organization_id", orgId)
        .eq("enabled", true);
      const ceiling = new Set(
        ((ceilingRows || []) as Array<{ module_code: string }>).map((r) => r.module_code),
      );
      const legacyId = await ensureLegacyParityGroup(supabase, user.enabledModules, ceiling);
      if (legacyId) targetGroupIds.push(legacyId);
    }

    await supabase
      .from("user_access_groups")
      .delete()
      .eq("user_id", portalUserId)
      .eq("organization_id", orgId);
    for (const groupId of targetGroupIds) {
      const { error } = await supabase
        .from("user_access_groups")
        .insert({ user_id: portalUserId, organization_id: orgId, group_id: groupId });
      if (error) console.warn(`Could not assign group for ${user.email}: ${error.message}`);
    }
  }
}

/**
 * E4 chain fixture: org-a (JLA) is the house. A sell leg JLA→JLB and the
 * upstream buy leg JLD→JLA. The direction-aware wall must keep house-sales
 * out of the buy leg, house-purchasing out of the sell leg, and each
 * counterparty inside its own leg only.
 */
async function seedE4Chain(
  supabase: ReturnType<typeof adminClient>,
  orgIdByKey: Record<string, string>,
): Promise<void> {
  const house = orgIdByKey["org-a"];
  const client = orgIdByKey["org-b"];
  const supplier = orgIdByKey["org-d-supplier"];
  if (!house || !client || !supplier) return;

  // Book flags + partner links (the address-book wall reads these).
  await supabase.from("organisations").update({ is_customer: true }).eq("id", client);
  await supabase
    .from("organisations")
    .update({ is_supplier: true, is_producer: true, is_external: true })
    .eq("id", supplier);
  for (const partner of [client, supplier]) {
    for (const [a, b] of [
      [house, partner],
      [partner, house],
    ]) {
      const { error } = await supabase
        .from("organisation_trading_partners")
        .insert({ organisation_id: a, partner_organisation_id: b });
      if (error && error.code !== "23505") {
        console.warn(`Could not link trading partner: ${error.message}`);
      }
    }
  }

  const upsertLeg = async (row: Record<string, unknown>): Promise<string | null> => {
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("code", row.code as string)
      .maybeSingle();
    if (existing) return existing.id as string;
    const { data, error } = await supabase.from("orders").insert(row).select("id").single();
    if (error) {
      console.warn(`Could not seed E4 leg ${row.code}: ${error.message}`);
      return null;
    }
    return data?.id as string | null;
  };

  const buyLegId = await upsertLeg({
    code: "IJL-E4-BUY-001",
    name: "IJL E4 chain — buy leg (supplier → house)",
    seller_organisation_id: supplier,
    buyer_organisation_id: house,
    customer_organisation_id: house,
    deal_kind: "purchase_only",
    status: "draft",
    currency: "EUR",
  });
  const sellLegId = await upsertLeg({
    code: "IJL-E4-SELL-001",
    name: "IJL E4 chain — sell leg (house → client)",
    seller_organisation_id: house,
    buyer_organisation_id: client,
    customer_organisation_id: client,
    deal_kind: "sale_only",
    status: "draft",
    currency: "EUR",
  });
  if (sellLegId && buyLegId) {
    await supabase.from("orders").update({ upstream_deal_id: buyLegId }).eq("id", sellLegId);
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
    await syncAccessGroups(supabase, user, portalUserId, orgIdByKey);
    console.log(`  ✓ ${user.email}`);
  }

  console.log("→ Seeding sample data (orders)...");
  await seedSampleOrders(supabase, orgIdByKey);

  console.log("→ Seeding E4 chain (house / client / supplier legs)...");
  await seedE4Chain(supabase, orgIdByKey);

  console.log("✓ Seed complete.");
  return { orgIdByKey };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
