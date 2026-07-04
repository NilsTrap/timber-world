"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { resolveAddPersonScope, applyAddPersonGroups } from "./_addPersonScope";

/**
 * Create Organisation User Schema
 */
const createUserSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must be 255 characters or less")
    .trim()
    .toLowerCase(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Create Organisation User (K3 · Q2 book-scoped)
 *
 * Creates a new user within an organisation:
 * - role = 'user', status = 'created' (no auth credentials yet), is_active = true
 * Status flow: created → invited (after credentials sent) → active (after first login)
 *
 * AUTHORISATION (Q2): admins may create for ANY org and pass `groupIds` (full
 * picker). A book-scoped non-admin (salesperson/purchasing) may create ONLY for
 * an org in their clients/suppliers book — enforced by resolveAddPersonScope —
 * and the access group is FORCED server-side (client group / producer group);
 * any `groupIds` they pass are ignored. Trader orgs are admin-only.
 *
 * The gate is the wall: after it passes, writes run on the service-role client
 * (bypassing RLS) — the same deliberate pattern as counterparties' orgContacts.
 */
export async function createOrganisationUser(
  organisationId: string,
  input: CreateUserInput,
  groupIds?: string[],
): Promise<ActionResult<OrganisationUser>> {
  // 1. Authentication
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // 2. Validate organisation ID
  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ID" };
  }

  // 3. Q2 wall — may this caller create a user for this org? (admin | scoped | no)
  const scope = await resolveAddPersonScope(session, organisationId);
  if (!scope.ok) {
    return { success: false, error: scope.error, code: scope.code };
  }

  // 4. Validate input with Zod
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { name, email } = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 5. Duplicate email (globally unique across all portal_users)
  const { data: existingUser } = await supabase
    .from("portal_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return { success: false, error: "Email already registered", code: "DUPLICATE_EMAIL" };
  }

  // 6. Verify organisation exists
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", organisationId)
    .maybeSingle();

  if (!org) {
    return { success: false, error: "Organisation not found", code: "ORG_NOT_FOUND" };
  }

  // 7. Insert new user (invited_at/invited_by are set later, when credentials
  //    are sent; auth_user_id stays NULL until then).
  const { data, error } = await supabase
    .from("portal_users")
    .insert({
      email,
      name,
      role: "user",
      organisation_id: organisationId,
      is_active: true,
      status: "created",
    })
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to create organisation user:", error);
    return { success: false, error: "Failed to create user", code: "CREATE_FAILED" };
  }

  // 8. Inline access-group assignment (Q2: forced group for scoped callers;
  //    validated picker for admins) + cache-tag bust.
  const groupRes = await applyAddPersonGroups(
    supabase,
    scope,
    data.id as string,
    organisationId,
    groupIds,
  );
  if (!groupRes.success) {
    // The user row exists; surface the group failure so the admin can retry via
    // the Groups action rather than silently leaving them un-grouped.
    return { success: false, error: `User created but group assignment failed: ${groupRes.error}`, code: "GROUP_ASSIGN_FAILED" };
  }

  // 9. Transform and return
  const user: OrganisationUser = {
    id: data.id as string,
    email: data.email as string,
    name: data.name as string,
    role: data.role as "admin" | "user",
    organisationId: data.organisation_id as string,
    authUserId: data.auth_user_id as string | null,
    isActive: data.is_active as boolean,
    status: data.status as "created" | "invited" | "active",
    invitedAt: data.invited_at as string | null,
    invitedBy: data.invited_by as string | null,
    invitedByName: null,
    lastLoginAt: data.last_login_at as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return { success: true, data: user };
}
