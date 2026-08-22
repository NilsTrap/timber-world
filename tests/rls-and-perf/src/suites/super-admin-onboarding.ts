import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_USERS } from "../config.js";
import { adminClient, anonClient, userClient } from "../lib/supabase.js";

type MembershipRow = {
  organization_id: string;
  is_active: boolean;
  is_primary: boolean;
};

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Onboarding canary failed: ${message}`);
}

async function expectRpcDenied(client: SupabaseClient, userId: string, orgId: string, actor: string) {
  const { error } = await client.rpc("admin_set_primary_membership", {
    p_user_id: userId,
    p_organization_id: orgId,
  });
  expect(error, `${actor} unexpectedly executed a service-role membership mutation`);
}

/**
 * Destructive integration coverage for the onboarding migration. This suite is
 * staging-target guarded by run.ts and owns every row it creates. Cleanup is
 * unconditional so a failed assertion cannot leave a login person behind.
 */
export async function runSuperAdminOnboardingCanary(): Promise<string[]> {
  const admin = adminClient();
  const anonymous = anonClient();
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `onboarding-canary-${stamp}@ijl.test`;
  let userId: string | null = null;
  let canaryGroupId: string | null = null;
  const checks: string[] = [];

  try {
    const { data: orgRows, error: orgError } = await admin
      .from("organisations")
      .select("id, code")
      .in("code", ["JLA", "JLB", "JLC"]);
    expect(!orgError, `fixture organisations could not be loaded: ${orgError?.message}`);
    const orgByCode = new Map((orgRows ?? []).map((row) => [row.code as string, row.id as string]));
    const orgA = orgByCode.get("JLA");
    const orgB = orgByCode.get("JLB");
    const orgC = orgByCode.get("JLC");
    expect(orgA && orgB && orgC, "JLA/JLB/JLC canary organisations are required; run the staging seed");

    const { data: groupRows, error: groupError } = await admin
      .from("access_groups")
      .select("id, key")
      .in("key", ["salesperson", "client"]);
    expect(!groupError, `fixture groups could not be loaded: ${groupError?.message}`);
    const groupByKey = new Map((groupRows ?? []).map((row) => [row.key as string, row.id as string]));
    const salespersonGroup = groupByKey.get("salesperson");
    const clientGroup = groupByKey.get("client");
    expect(salespersonGroup && clientGroup, "salesperson/client groups are required; run migrations");

    const { data: createdId, error: createError } = await admin.rpc("admin_create_portal_user", {
      p_email: email,
      p_name: "Onboarding Canary",
      p_organization_id: orgA,
      p_invited_by: null,
    });
    expect(!createError && createdId, `create failed: ${createError?.message}`);
    userId = String(createdId);

    const { data: initialMemberships, error: initialError } = await admin
      .from("organization_memberships")
      .select("organization_id, is_active, is_primary")
      .eq("user_id", userId);
    expect(!initialError, `initial membership could not be loaded: ${initialError?.message}`);
    expect(initialMemberships?.length === 1 && initialMemberships[0]?.is_active && initialMemberships[0]?.is_primary,
      "create must make exactly one active primary membership");
    checks.push("create → one active primary");

    for (const targetOrg of [orgB, orgC]) {
      const { error } = await admin.rpc("admin_upsert_user_membership", {
        p_user_id: userId,
        p_organization_id: targetOrg,
        p_make_primary: false,
        p_invited_by: null,
      });
      expect(!error, `attach to ${targetOrg} failed: ${error?.message}`);
    }

    const [{ error: groupsAError }, { error: groupsBError }] = await Promise.all([
      admin.rpc("admin_set_membership_groups", {
        p_user_id: userId, p_organization_id: orgA, p_group_ids: [salespersonGroup],
      }),
      admin.rpc("admin_set_membership_groups", {
        p_user_id: userId, p_organization_id: orgB, p_group_ids: [clientGroup],
      }),
    ]);
    expect(!groupsAError && !groupsBError, `per-org group assignment failed: ${groupsAError?.message ?? groupsBError?.message}`);

    const { data: isolatedGroups, error: isolatedError } = await admin
      .from("user_access_groups")
      .select("organization_id, group_id")
      .eq("user_id", userId);
    expect(!isolatedError, `group isolation rows could not be loaded: ${isolatedError?.message}`);
    expect(isolatedGroups?.some((row) => row.organization_id === orgA && row.group_id === salespersonGroup),
      "org A group assignment is missing");
    expect(isolatedGroups?.some((row) => row.organization_id === orgB && row.group_id === clientGroup),
      "org B group assignment is missing");
    expect(!isolatedGroups?.some((row) => row.organization_id === orgA && row.group_id === clientGroup),
      "org B group leaked into org A");
    checks.push("attach → per-org groups isolated");

    const concurrentResults = await Promise.all([
      admin.rpc("admin_set_primary_membership", { p_user_id: userId, p_organization_id: orgA }),
      admin.rpc("admin_set_primary_membership", { p_user_id: userId, p_organization_id: orgB }),
      admin.rpc("admin_set_primary_membership", { p_user_id: userId, p_organization_id: orgA }),
    ]);
    expect(concurrentResults.every((result) => !result.error),
      `concurrent primary update failed: ${concurrentResults.find((result) => result.error)?.error?.message}`);

    const [{ data: memberships, error: membershipsError }, { data: portalUser, error: portalUserError }] = await Promise.all([
      admin.from("organization_memberships").select("organization_id, is_active, is_primary").eq("user_id", userId),
      admin.from("portal_users").select("organisation_id").eq("id", userId).single(),
    ]);
    expect(!membershipsError && !portalUserError, `primary result could not be loaded: ${membershipsError?.message ?? portalUserError?.message}`);
    const primaries = (memberships as MembershipRow[]).filter((row) => row.is_active && row.is_primary);
    expect(primaries.length === 1, `expected exactly one active primary, found ${primaries.length}`);
    expect(portalUser?.organisation_id === primaries[0]?.organization_id, "portal_users.organisation_id is not synchronized");
    checks.push("concurrent primary changes → exactly one synchronized primary");

    const primaryOrg = primaries[0]!.organization_id;
    const { error: primaryDeactivateError } = await admin.rpc("admin_set_membership_active", {
      p_user_id: userId, p_organization_id: primaryOrg, p_is_active: false,
    });
    expect(primaryDeactivateError?.message.includes("PRIMARY_OR_ONLY_MEMBERSHIP"),
      "primary membership deactivation was not refused");

    const otherAssignedOrg = primaryOrg === orgA ? orgB : orgA;
    const preservedOrg = primaryOrg;
    const { error: deactivateError } = await admin.rpc("admin_set_membership_active", {
      p_user_id: userId, p_organization_id: otherAssignedOrg, p_is_active: false,
    });
    expect(!deactivateError, `non-primary membership deactivation failed: ${deactivateError?.message}`);
    const { data: groupsAfterDeactivate } = await admin
      .from("user_access_groups")
      .select("organization_id")
      .eq("user_id", userId);
    expect(!groupsAfterDeactivate?.some((row) => row.organization_id === otherAssignedOrg), "deactivated org retained access groups");
    expect(groupsAfterDeactivate?.some((row) => row.organization_id === preservedOrg), "another org's access groups were revoked");

    const { error: reactivateError } = await admin.rpc("admin_set_membership_active", {
      p_user_id: userId, p_organization_id: otherAssignedOrg, p_is_active: true,
    });
    expect(!reactivateError, `membership reactivation failed: ${reactivateError?.message}`);
    const { data: groupsAfterReactivate } = await admin
      .from("user_access_groups")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", otherAssignedOrg);
    expect(groupsAfterReactivate?.length === 0, "reactivation restored historical access");
    checks.push("deactivate/reactivate → only target access revoked; none restored");

    const { data: group, error: canaryGroupError } = await admin
      .from("access_groups")
      .insert({ key: `onboarding-canary-${stamp}`, name: "Onboarding ceiling canary", is_system: false })
      .select("id")
      .single();
    expect(!canaryGroupError && group?.id, `ceiling canary group could not be created: ${canaryGroupError?.message}`);
    canaryGroupId = group.id as string;
    const { error: rightError } = await admin.from("access_group_rights").insert({
      group_id: canaryGroupId,
      right_type: "module",
      resource: "portal",
      key: "shipments.view",
      value: {},
    });
    expect(!rightError, `ceiling canary right could not be created: ${rightError?.message}`);
    const { error: ceilingError } = await admin.rpc("admin_set_membership_groups", {
      p_user_id: userId, p_organization_id: orgC, p_group_ids: [canaryGroupId],
    });
    expect(ceilingError?.message.includes("ACCESS_ABOVE_ORG_CEILING"), "above-ceiling group assignment was accepted");
    checks.push("group above org ceiling → rejected");

    await expectRpcDenied(anonymous, userId, orgA, "anonymous client");
    const nonAdminDef = TEST_USERS.find((user) => user.userKey === "org-a-full");
    expect(nonAdminDef, "org-a-full non-admin fixture is required");
    const nonAdmin = await userClient(nonAdminDef);
    try {
      await expectRpcDenied(nonAdmin, userId, orgA, "non-admin member");
    } finally {
      await nonAdmin.auth.signOut();
    }
    checks.push("anonymous/non-admin RPC mutations → denied");

    return checks;
  } finally {
    if (userId) await admin.from("portal_users").delete().eq("id", userId);
    if (canaryGroupId) await admin.from("access_groups").delete().eq("id", canaryGroupId);
  }
}
