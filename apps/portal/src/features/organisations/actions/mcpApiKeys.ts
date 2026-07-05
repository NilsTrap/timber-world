"use server";

/**
 * Epic T / T1 — admin server actions for per-user MCP API keys.
 *
 * Super-admin ONLY (matches the People admin surface). The plaintext key is
 * generated here, shown to the admin ONCE (issue return), and NEVER stored or
 * logged — only its sha256 hash lands in mcp_api_keys. Uses the service-role
 * admin client (mcp_api_keys is platform-admin-RLS; writes go through the
 * service role after the isSuperAdmin gate).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/features/audit/logAudit";
import { generateApiKey, hashApiKey } from "@/lib/mcp/apiKeys";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { McpApiKeyRow, IssuedMcpApiKey } from "./mcpApiKeys.types";

/** Issue a new MCP key for a portal user. Returns the plaintext ONCE.
 *  `isReadonly` (T2/MEDIUM-3) scopes the key to read tools only. */
export async function issueMcpApiKey(
  userId: string,
  label: string | null,
  organisationId: string | null,
  isReadonly = false,
): Promise<ActionResult<IssuedMcpApiKey>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  if (!isValidUUID(userId)) return { success: false, error: "Invalid user ID", code: "INVALID_ID" };
  if (organisationId && !isValidUUID(organisationId)) return { success: false, error: "Invalid organisation ID", code: "INVALID_ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Confirm the target user exists and has a login identity — a key is useless
  // without an auth_user_id (the route can't mint a JWT for them).
  const { data: user } = await admin
    .from("portal_users")
    .select("id, auth_user_id, email")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  if (!user.auth_user_id) {
    return { success: false, error: "This user has no login credentials yet — send credentials before issuing an MCP key.", code: "NO_AUTH_USER" };
  }

  const cleanLabel = (label ?? "").trim() || null;
  const plaintext = generateApiKey();
  const keyHash = hashApiKey(plaintext);

  const { data: inserted, error } = await admin
    .from("mcp_api_keys")
    .insert({
      portal_user_id: userId,
      key_hash: keyHash,
      label: cleanLabel,
      organisation_id: organisationId,
      is_readonly: isReadonly === true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Failed to create key", code: "CREATE_FAILED" };
  }

  // Audit the EVENT only — the plaintext/hash are never recorded.
  await logAudit({
    action: "mcp_api_key.issued",
    resourceType: "mcp_api_key",
    resourceId: inserted.id as string,
    organisationId: organisationId ?? undefined,
    metadata: { portal_user_id: userId, label: cleanLabel, org_pinned: !!organisationId, is_readonly: isReadonly === true },
  });

  return { success: true, data: { id: inserted.id as string, label: cleanLabel, plaintext } };
}

/** List a user's MCP keys (no hashes/plaintext ever leave the DB). */
export async function listMcpApiKeys(userId: string): Promise<ActionResult<McpApiKeyRow[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  if (!isValidUUID(userId)) return { success: false, error: "Invalid user ID", code: "INVALID_ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("mcp_api_keys")
    .select("id, label, organisation_id, is_readonly, created_at, last_used_at, revoked_at, organisation:organisations(name)")
    .eq("portal_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message, code: "LIST_FAILED" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: McpApiKeyRow[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    label: r.label ?? null,
    organisationId: r.organisation_id ?? null,
    organisationName: r.organisation?.name ?? null,
    isReadonly: r.is_readonly === true,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at ?? null,
    revokedAt: r.revoked_at ?? null,
  }));
  return { success: true, data: rows };
}

/** Revoke a key (idempotent — sets revoked_at once). The row is kept for audit. */
export async function revokeMcpApiKey(keyId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  if (!isValidUUID(keyId)) return { success: false, error: "Invalid key ID", code: "INVALID_ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("mcp_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .is("revoked_at", null)
    .select("id, portal_user_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message, code: "REVOKE_FAILED" };
  // Already revoked (no row matched the revoked_at IS NULL filter) — treat as success (idempotent).
  if (!data) return { success: true, data: { id: keyId } };

  await logAudit({
    action: "mcp_api_key.revoked",
    resourceType: "mcp_api_key",
    resourceId: keyId,
    metadata: { portal_user_id: data.portal_user_id },
  });

  return { success: true, data: { id: keyId } };
}
