import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@timber/database/admin";
import {
  type AccessProfile,
  type DealScope,
  type FieldDomain,
  type FieldGrant,
  emptyAccessProfile,
} from "./types";

// Service-role client shared across cached calls (no per-request state).
const adminClient = createAdminClient();

interface RightRow {
  right_type: string;
  resource: string;
  key: string;
  value: Record<string, unknown> | string | null;
}

/** JSON-serializable shape stored in the cross-request cache. */
interface CachedProfile {
  groupIds: string[];
  modules: string[];
  dealVisibility: string[];
  fieldDomains: Partial<Record<FieldDomain, FieldGrant>>;
  fieldOverrides: Record<string, FieldGrant>;
  scope: DealScope;
  actions: string[];
}

function asGrant(value: RightRow["value"]): FieldGrant {
  const v = (value ?? {}) as Record<string, unknown>;
  return { visible: v.visible !== false, editable: v.editable === true };
}

const SCOPE_RANK: Record<DealScope, number> = { mine: 1, company: 2, all: 3 };

/**
 * Cross-request cached fetch of a (user, org) access profile. Mirrors the
 * getUserEnabledModules caching contract: 5-min TTL, busted by the
 * `access-profile:<userId>:<orgId>` tag from every group/assignment
 * mutation (group edits enumerate member (user, org) pairs and bust each).
 */
const fetchAccessProfile = (userId: string, organizationId: string) =>
  unstable_cache(
    async (uid: string, oid: string): Promise<CachedProfile> => {
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
      if (groupIds.length === 0) {
        return {
          groupIds: [],
          modules: [],
          dealVisibility: [],
          fieldDomains: {},
          fieldOverrides: {},
          scope: "company",
          actions: [],
        };
      }

      const { data: rightRows } = await client
        .from("access_group_rights")
        .select("right_type, resource, key, value")
        .in("group_id", groupIds);

      const orgCeiling = new Set(
        ((orgResult.data || []) as Array<{ module_code: string }>).map((m) => m.module_code),
      );

      const modules = new Set<string>();
      const dealVisibility = new Set<string>();
      const fieldDomains: Partial<Record<FieldDomain, FieldGrant>> = {};
      const fieldOverrides: Record<string, FieldGrant> = {};
      const actions = new Set<string>();
      let scope: DealScope = "company";
      let scopeSeen = false;

      for (const row of (rightRows || []) as RightRow[]) {
        switch (row.right_type) {
          case "module":
            if (orgCeiling.has(row.key)) modules.add(row.key);
            break;
          case "visibility":
            if (row.resource === "deal") {
              dealVisibility.add(row.key);
            } else if (row.resource === "deal_fields") {
              // Union across groups: visible/editable if ANY group grants it.
              const grant = asGrant(row.value);
              const domain = row.key as FieldDomain;
              const prev = fieldDomains[domain];
              fieldDomains[domain] = prev
                ? {
                    visible: prev.visible || grant.visible,
                    editable: prev.editable || grant.editable,
                  }
                : grant;
            }
            break;
          case "field": {
            const grant = asGrant(row.value);
            const prev = fieldOverrides[row.key];
            fieldOverrides[row.key] = prev
              ? {
                  visible: prev.visible || grant.visible,
                  editable: prev.editable || grant.editable,
                }
              : grant;
            break;
          }
          case "scope": {
            const v = typeof row.value === "string" ? row.value : null;
            if (v === "mine" || v === "company" || v === "all") {
              scope = scopeSeen && SCOPE_RANK[scope] >= SCOPE_RANK[v] ? scope : v;
              scopeSeen = true;
            }
            break;
          }
          case "action":
            actions.add(`${row.resource}:${row.key}`);
            break;
        }
      }

      return {
        groupIds,
        modules: Array.from(modules),
        dealVisibility: Array.from(dealVisibility),
        fieldDomains,
        fieldOverrides,
        scope,
        actions: Array.from(actions),
      };
    },
    ["access-profile", userId, organizationId],
    { revalidate: 300, tags: [`access-profile:${userId}:${organizationId}`] },
  )(userId, organizationId);

/**
 * The effective access profile of a portal user in an organisation.
 * React-cached per request on top of the 5-min cross-request cache.
 * NOT admin-aware: callers bypass for admins (isAdmin(session)) with
 * fullAccessProfile(), exactly like the module gates do.
 */
export const getAccessProfile = cache(
  async (userId: string | null, organizationId: string | null): Promise<AccessProfile> => {
    if (!userId || !organizationId) return emptyAccessProfile();
    const cached = await fetchAccessProfile(userId, organizationId);
    return {
      groupIds: cached.groupIds,
      modules: new Set(cached.modules),
      dealVisibility: new Set(cached.dealVisibility),
      fieldDomains: cached.fieldDomains,
      fieldOverrides: cached.fieldOverrides,
      scope: cached.scope,
      actions: new Set(cached.actions),
    };
  },
);
