"use server";

/**
 * K3/Q2 · Bootstrap + typeahead for the "Add person" dialog.
 *
 * Both actions are gated by the SAME Q2 wall (resolveAddPersonScope) as the
 * create/add mutations, so the dialog can never learn (or search) more than the
 * server would let it write. The client uses the returned context only to render
 * (admin picker vs forced group); enforcement always re-runs on the mutation.
 *
 * DTO types live in ../addPersonTypes (a plain, types-only module) — a
 * "use server" file must not export types.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { AddPersonContext, AddablePerson, AddPersonGroupOption } from "../addPersonTypes";
import { resolveAddPersonScope, resolveSystemGroupIdByKey } from "./_addPersonScope";
import { listPortalUsers as listPortalUsersSvc } from "@/features/access/services/groupsRead";

const GROUP_KEY_NAME: Record<"client" | "producer", string> = {
  client: "Client",
  producer: "Producer",
};

/**
 * Dialog bootstrap: the caller's mode for THIS org (admin | scoped | forbidden),
 * the org name, and the group choices — the full assignable list for an admin,
 * or the single forced group for a scoped caller.
 */
export async function getAddPersonContext(
  organisationId: string,
): Promise<ActionResult<AddPersonContext>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ID" };
  }

  const scope = await resolveAddPersonScope(session, organisationId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: org } = await admin
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .maybeSingle();
  const orgName = (org?.name as string | null) ?? null;

  if (!scope.ok) {
    return {
      success: true,
      data: { mode: "forbidden", orgName, groups: [], forcedGroupId: null, forcedGroupName: null },
    };
  }

  if (scope.mode === "scoped") {
    const forcedGroupId = await resolveSystemGroupIdByKey(admin, scope.forcedGroupKey);
    return {
      success: true,
      data: {
        mode: "scoped",
        orgName,
        groups: [],
        forcedGroupId,
        forcedGroupName: GROUP_KEY_NAME[scope.forcedGroupKey],
      },
    };
  }

  // Admin — full assignable group list for the inline picker.
  const { data: groupRows } = await admin
    .from("access_groups")
    .select("id, key, name, is_system, sort_order")
    .order("sort_order", { ascending: true });
  const groups: AddPersonGroupOption[] = ((groupRows ?? []) as Array<{ id: string; key: string; name: string; is_system: boolean }>).map(
    (r) => ({ id: r.id, key: r.key, name: r.name, isSystem: r.is_system === true }),
  );

  return {
    success: true,
    data: { mode: "admin", orgName, groups, forcedGroupId: null, forcedGroupName: null },
  };
}

/**
 * Typeahead over existing platform users for the "add existing" branch. Gated by
 * the same Q2 wall — a caller who may not add people to this org gets nothing.
 * Flags whether each candidate is already an active member of the target org so
 * the UI disables "Add" for them.
 *
 * NOTE (guard relaxation): for a scoped non-admin this exposes the platform user
 * directory (id/name/email) the same way the admin group-member picker already
 * does — acceptable because the caller must already hold book-scoped add rights
 * for this specific org to reach it. Flagged for orchestrator review.
 */
export async function searchAddablePeople(
  organisationId: string,
  query: string,
): Promise<ActionResult<AddablePerson[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ID" };
  }

  const scope = await resolveAddPersonScope(session, organisationId);
  if (!scope.ok) return { success: false, error: scope.error, code: scope.code };

  const q = (query ?? "").trim();
  if (q.length < 2) return { success: true, data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const res = await listPortalUsersSvc(admin, { query: q, limit: 20 });
  if (!res.success) return { success: false, error: res.error, code: res.code };

  const ids = res.data.map((u) => u.id);
  const memberIds = new Set<string>();
  if (ids.length > 0) {
    // Active memberships in this org.
    const { data: mems } = await admin
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", organisationId)
      .eq("is_active", true)
      .in("user_id", ids);
    for (const m of (mems ?? []) as Array<{ user_id: string }>) memberIds.add(m.user_id);
    // Legacy home-org membership.
    const { data: legacy } = await admin
      .from("portal_users")
      .select("id")
      .eq("organisation_id", organisationId)
      .in("id", ids);
    for (const l of (legacy ?? []) as Array<{ id: string }>) memberIds.add(l.id);
  }

  return {
    success: true,
    data: res.data.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      alreadyMember: memberIds.has(u.id),
    })),
  };
}
