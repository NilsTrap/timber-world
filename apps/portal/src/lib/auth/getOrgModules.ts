import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@timber/database/admin";

// Service-role client shared across cached calls (no per-request state).
const adminClient = createAdminClient();

const fetchOrgModules = (organizationId: string) =>
  unstable_cache(
    async (orgId: string): Promise<string[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (adminClient as any)
        .from("organization_modules")
        .select("module_code")
        .eq("organization_id", orgId)
        .eq("enabled", true);
      return (data || []).map((m: { module_code: string }) => m.module_code);
    },
    ["org-modules", organizationId],
    { revalidate: 300, tags: [`org-modules:${organizationId}`] },
  )(organizationId);

export const getOrgEnabledModules = cache(async (
  organizationId: string | null
): Promise<Set<string>> => {
  if (!organizationId) {
    return new Set();
  }
  const codes = await fetchOrgModules(organizationId);
  return new Set(codes);
});

/**
 * Check if an organization has a specific module enabled
 */
export async function orgHasModule(
  organizationId: string | null,
  moduleCode: string
): Promise<boolean> {
  const modules = await getOrgEnabledModules(organizationId);
  return modules.has(moduleCode);
}

/**
 * Cross-request cached fetch of a (user, org) module set. Same caching
 * strategy as getOrgEnabledModules — 5-min TTL, revalidate via the
 * `user-modules:<userId>:<orgId>` tag from any admin action that
 * changes group rights or assignments.
 *
 * E4: groups subsume user_modules — module grants now come from the user's
 * access groups in this org (union), still capped by the org ceiling:
 *   effective = organization_modules ∩ (∪ module rights of assigned groups)
 * The signature and the 109 call sites are unchanged.
 */
const fetchUserModules = (userId: string, organizationId: string) =>
  unstable_cache(
    async (uid: string, oid: string): Promise<string[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = adminClient as any;
      const [orgResult, assignmentResult] = await Promise.all([
        client
          .from("organization_modules")
          .select("module_code")
          .eq("organization_id", oid)
          .eq("enabled", true),
        client
          .from("user_access_groups")
          .select("group_id")
          .eq("user_id", uid)
          .eq("organization_id", oid),
      ]);
      const groupIds = ((assignmentResult.data || []) as Array<{ group_id: string }>).map(
        (r) => r.group_id,
      );
      if (groupIds.length === 0) return [];
      const { data: rightRows } = await client
        .from("access_group_rights")
        .select("key")
        .in("group_id", groupIds)
        .eq("right_type", "module")
        .eq("resource", "portal");
      const orgSet = new Set(
        (orgResult.data || []).map((m: { module_code: string }) => m.module_code),
      );
      const codes = new Set<string>();
      for (const row of (rightRows || []) as Array<{ key: string }>) {
        if (orgSet.has(row.key)) codes.add(row.key);
      }
      return Array.from(codes);
    },
    ["user-modules", userId, organizationId],
    { revalidate: 300, tags: [`user-modules:${userId}:${organizationId}`] },
  )(userId, organizationId);

export const getUserEnabledModules = cache(async (
  userId: string,
  organizationId: string | null
): Promise<Set<string>> => {
  if (!organizationId || !userId) {
    return new Set();
  }
  const codes = await fetchUserModules(userId, organizationId);
  return new Set(codes);
});
