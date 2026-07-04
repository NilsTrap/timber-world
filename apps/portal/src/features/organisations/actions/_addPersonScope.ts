/**
 * K3/Q2 · The Q2 wall — server-side, book-scoped "who may add/create a person
 * for this org" decision + the forced-group resolver.
 *
 * Plain server module (NOT "use server") on purpose: it exports a type + sync
 * helpers alongside the async guard, which a "use server" module may not do.
 * Imported only by the add-person server actions.
 *
 * RULES (mirrors counterparties' book model):
 *  - Admin (isAdmin || isSuperAdmin): unrestricted — any org, full group picker.
 *  - Salesperson (holds counterparty:clients + the counterparties.clients module):
 *      may add/create ONLY for orgs in their CLIENTS book — a trading partner of
 *      their org that is is_customer. Forced access group: key='client'.
 *  - Purchasing (holds counterparty:suppliers + counterparties.suppliers module):
 *      SUPPLIERS book — a trading partner that is is_supplier OR is_producer.
 *      Forced access group: key='producer'.
 *  - Trader orgs (is_trader) are ADMIN-ONLY (same as the Traders book): a
 *      non-admin may NEVER add/create for a trader org, even if it also carries
 *      another role flag.
 *
 * The target-org role flags and the trading-partner edge are read server-side
 * (service role) — the client is never trusted for scope or group.
 */

import { updateTag } from "next/cache";
import { isAdmin, isSuperAdmin } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/getSession";
import { getAccessProfile } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateUserAccessGroups as updateUserAccessGroupsSvc } from "@/features/access/services/groupsWrite";

/** Result of the add-person scope decision. `forcedGroupKey` is the ONLY group
 *  a scoped (non-admin) caller may grant — enforced regardless of client input. */
export type AddPersonScope =
  | { ok: true; mode: "admin" }
  | { ok: true; mode: "scoped"; forcedGroupKey: "client" | "producer" }
  | { ok: false; error: string; code: string };

const CLIENTS_ACTION = "counterparty:clients";
const CLIENTS_MODULE = "counterparties.clients";
const SUPPLIERS_ACTION = "counterparty:suppliers";
const SUPPLIERS_MODULE = "counterparties.suppliers";

/**
 * Decide whether `session` may add/create a person for `targetOrgId`, and — for
 * a non-admin — which fixed access group is forced. Admins short-circuit to
 * full rights. Never trusts the client for scope/group; all facts are read
 * server-side with the service-role client (the gate IS the wall — the same
 * deliberate pattern as counterparties' orgContacts).
 */
export async function resolveAddPersonScope(
  session: SessionUser,
  targetOrgId: string,
): Promise<AddPersonScope> {
  // Admins: unrestricted (keep both the isAdmin and legacy isSuperAdmin bypass).
  if (isAdmin(session) || isSuperAdmin(session)) return { ok: true, mode: "admin" };

  const callerOrgId = session.currentOrganizationId || session.organisationId;
  if (!callerOrgId) return { ok: false, error: "Permission denied", code: "FORBIDDEN" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Target org role flags (server-trusted).
  const { data: org } = await admin
    .from("organisations")
    .select("id, is_customer, is_supplier, is_producer, is_trader, is_active")
    .eq("id", targetOrgId)
    .maybeSingle();
  if (!org) return { ok: false, error: "Organisation not found", code: "ORG_NOT_FOUND" };
  if (org.is_active === false) {
    return { ok: false, error: "Organisation is not active", code: "ORG_INACTIVE" };
  }

  // Trader orgs are admin-only — no non-admin path (mirrors the Traders book).
  if (org.is_trader === true) return { ok: false, error: "Permission denied", code: "FORBIDDEN" };

  // The target must be a trading partner of the caller's org (book membership).
  const { data: tp } = await admin
    .from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", callerOrgId)
    .eq("partner_organisation_id", targetOrgId)
    .maybeSingle();
  if (!tp) return { ok: false, error: "Permission denied", code: "FORBIDDEN" };

  // Which book right does the caller hold? (action right AND ceiling-capped module —
  // the same pair counterparties' requireBookAccess demands.)
  const profile = await getAccessProfile(session.portalUserId, callerOrgId);
  const hasClients = profile.actions.has(CLIENTS_ACTION) && profile.modules.has(CLIENTS_MODULE);
  const hasSuppliers = profile.actions.has(SUPPLIERS_ACTION) && profile.modules.has(SUPPLIERS_MODULE);

  // Salesperson → CLIENTS book (customer partner). Forced Client group.
  if (hasClients && org.is_customer === true) {
    return { ok: true, mode: "scoped", forcedGroupKey: "client" };
  }
  // Purchasing → SUPPLIERS book (supplier/producer partner). Forced Producer group.
  if (hasSuppliers && (org.is_supplier === true || org.is_producer === true)) {
    return { ok: true, mode: "scoped", forcedGroupKey: "producer" };
  }

  return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
}

/** Resolve a system access group's id by its stable KEY (ids are not stable —
 *  always resolve by key, per the E4 convention). Returns null if absent. */
export async function resolveSystemGroupIdByKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  key: "client" | "producer",
): Promise<string | null> {
  const { data } = await admin.from("access_groups").select("id").eq("key", key).maybeSingle();
  return (data?.id as string | null) ?? null;
}

/**
 * Apply the inline access-group assignment for a just-added/created person,
 * ENFORCING Q2 server-side:
 *  - scoped caller → grants EXACTLY the forced group (client-supplied group ids
 *    are ignored — the server never trusts the client for the group);
 *  - admin → grants the requested groups, validated against real groups so a bad
 *    id can neither FK-fail the write nor inject an arbitrary id.
 * Busts the affected `user-modules:` + `access-profile:` cache tags so the
 * permission change takes effect immediately (same contract as groups.ts).
 */
export async function applyAddPersonGroups(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  scope: Extract<AddPersonScope, { ok: true }>,
  userId: string,
  organisationId: string,
  requestedGroupIds: string[] | undefined,
): Promise<{ success: true } | { success: false; error: string; code: string }> {
  let groupIds: string[];

  if (scope.mode === "scoped") {
    const forcedId = await resolveSystemGroupIdByKey(admin, scope.forcedGroupKey);
    if (!forcedId) {
      return { success: false, error: `The '${scope.forcedGroupKey}' access group is missing`, code: "GROUP_NOT_FOUND" };
    }
    groupIds = [forcedId]; // forced — requestedGroupIds deliberately ignored
  } else {
    const requested = Array.from(new Set(requestedGroupIds ?? []));
    if (requested.length === 0) {
      groupIds = [];
    } else {
      const { data: valid } = await admin.from("access_groups").select("id").in("id", requested);
      const validIds = new Set(((valid ?? []) as Array<{ id: string }>).map((r) => r.id));
      groupIds = requested.filter((id) => validIds.has(id));
    }
  }

  const res = await updateUserAccessGroupsSvc(admin, userId, organisationId, groupIds);
  if (!res.success) return { success: false, error: res.error, code: res.code ?? "GROUP_ASSIGN_FAILED" };
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);
  return { success: true };
}
