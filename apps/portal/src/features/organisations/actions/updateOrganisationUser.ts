"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logAudit } from "@/features/audit/logAudit";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

/**
 * Update Organisation User Schema (Q4 · name / email / phone).
 *
 * name is required; email + phone are optional so existing callers that pass only
 * a name keep working. email/phone are person-level attributes on portal_users.
 */
const updateUserSchema = z.object({
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
    .toLowerCase()
    .optional(),
  phone: z
    .string()
    .max(40, "Phone must be 40 characters or less")
    .trim()
    .nullable()
    .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Update Organisation User (Q4)
 *
 * Updates a person's profile fields: name (required), and optionally email and
 * phone. email is globally unique across portal_users, so a change is checked for
 * collisions. Fields are person-level, so the update is NOT bound to one org —
 * `organisationId` is accepted for the per-org callers but no longer required to
 * match the user's home org (this action also serves the person-centric detail
 * where the person may belong to several orgs).
 *
 * NOTE: this updates portal_users.email only; it does NOT change the Supabase
 * auth login email. Keeping them in sync (if ever needed) is a separate concern.
 *
 * Super Admin only endpoint.
 */
export async function updateOrganisationUser(
  userId: string,
  organisationId: string,
  input: UpdateUserInput
): Promise<ActionResult<OrganisationUser>> {
  // 1. Check authentication
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return ADMIN_DENIED;

  // 3. Validate IDs
  if (!isValidUUID(userId)) {
    return ADMIN_DENIED;
  }

  // organisationId is advisory here (person-level edit) — validate only if given.
  if (organisationId && !isValidUUID(organisationId)) {
    return ADMIN_DENIED;
  }

  // 4. Validate input with Zod
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { name, email, phone } = parsed.data;
  const supabase = createAdminClient();

  // 5. Verify the user exists (person-level edit — not bound to one org).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingUser } = await (supabase as any)
    .from("portal_users")
    .select("id, email")
    .eq("id", userId)
    .single();

  if (!existingUser) {
    return {
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    };
  }

  // 5b. Build the update payload (name always; email/phone only when supplied).
  const updatePayload: Record<string, unknown> = { name };

  if (email !== undefined && email !== existingUser.email) {
    // Email is globally unique — reject a collision with another portal user.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clash } = await (supabase as any)
      .from("portal_users")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .maybeSingle();
    if (clash) {
      return { success: false, error: "Email already registered", code: "DUPLICATE_EMAIL" };
    }
    updatePayload.email = email;
  }

  if (phone !== undefined) {
    updatePayload.phone = phone === "" ? null : phone;
  }

  // 6. Update user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_users")
    .update(updatePayload)
    .eq("id", userId)
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to update organisation user:", error);
    return {
      success: false,
      error: "Failed to update user",
      code: "UPDATE_FAILED",
    };
  }

  // 7. Transform and return
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
    invitedByName: null, // Not fetched on update, will be populated on list
    lastLoginAt: data.last_login_at as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  await logAudit({
    action: "portal_user.update",
    resourceType: "portal_user",
    resourceId: userId,
    organisationId: organisationId || null,
    metadata: { fields: Object.keys(updatePayload), email: user.email },
  });

  return {
    success: true,
    data: user,
  };
}
