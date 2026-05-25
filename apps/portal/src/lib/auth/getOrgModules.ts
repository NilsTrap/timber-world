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
 * toggles user_modules.
 */
const fetchUserModules = (userId: string, organizationId: string) =>
  unstable_cache(
    async (uid: string, oid: string): Promise<string[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = adminClient as any;
      const [orgResult, userResult] = await Promise.all([
        client
          .from("organization_modules")
          .select("module_code")
          .eq("organization_id", oid)
          .eq("enabled", true),
        client
          .from("user_modules")
          .select("module_code")
          .eq("user_id", uid)
          .eq("organization_id", oid)
          .eq("enabled", true),
      ]);
      const orgSet = new Set(
        (orgResult.data || []).map((m: { module_code: string }) => m.module_code),
      );
      return ((userResult.data || []) as Array<{ module_code: string }>)
        .map((m) => m.module_code)
        .filter((code) => orgSet.has(code));
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
