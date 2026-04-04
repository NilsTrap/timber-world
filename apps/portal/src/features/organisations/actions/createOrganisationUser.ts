"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { z } from "zod";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";

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
 * Create Organisation User
 *
 * Creates a new user within an organisation.
 * The user is created with:
 * - role = 'user' (default)
 * - status = 'created' (no auth credentials yet)
 * - is_active = true
 *
 * Status flow: created → invited (after credentials sent) → active (after first login)
 *
 * Super Admin only endpoint.
 */
export async function createOrganisationUser(
  organisationId: string,
  input: CreateUserInput
): Promise<ActionResult<OrganisationUser>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check Super Admin role
  if (!isSuperAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate organisation ID
  if (!isValidUUID(organisationId)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ID",
    };
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
  const supabase = await createClient();

  // 5. Check for duplicate email (globally unique across all portal_users)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingUser } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingUser) {
    return {
      success: false,
      error: "Email already registered",
      code: "DUPLICATE_EMAIL",
    };
  }

  // 6. Verify organisation exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase as any)
    .from("organisations")
    .select("id")
    .eq("id", organisationId)
    .single();

  if (!org) {
    return {
      success: false,
      error: "Organisation not found",
      code: "ORG_NOT_FOUND",
    };
  }

  // 7. Get current user's portal_users ID for invited_by
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentPortalUser } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", session.id)
    .single();

  const invitedById = currentPortalUser?.id ?? null;

  // 8. Insert new user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_users")
    .insert({
      email,
      name,
      role: "user",
      organisation_id: organisationId,
      is_active: true,
      status: "created",
      // invited_at and invited_by will be set when credentials are sent
      // auth_user_id is NULL - will be set when credentials are created
    })
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to create organisation user:", error);
    return {
      success: false,
      error: "Failed to create user",
      code: "CREATE_FAILED",
    };
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
    invitedByName: null, // Not fetched on create, will be populated on list
    lastLoginAt: data.last_login_at as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return {
    success: true,
    data: user,
  };
}
