"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { updateOrgSchema } from "../schemas";
import { isValidUUID } from "../types";
import type { Organisation, ActionResult } from "../types";

/**
 * Update Organisation
 *
 * Updates an existing organisation's name and optionally code.
 * Admin only endpoint.
 */
export async function updateOrganisation(
  id: string,
  input: { name: string; code?: string }
): Promise<ActionResult<Organisation>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate organisation ID
  if (!isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ID",
    };
  }

  // 4. Validate input with Zod
  const parsed = updateOrgSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { name, code: newCode } = parsed.data;
  const supabase = await createClient();

  // 5. Update organisation
  const updatePayload: Record<string, unknown> = { name };
  if (newCode) {
    updatePayload.code = newCode;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .update(updatePayload)
    .eq("id", id)
    .select("id, code, name, is_active, is_external, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to update organisation:", error);
    return {
      success: false,
      error: "Failed to update organisation",
      code: "UPDATE_FAILED",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Organisation not found",
      code: "NOT_FOUND",
    };
  }

  // 6. Transform and return
  const organisation: Organisation = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    isActive: data.is_active as boolean,
    isExternal: data.is_external as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return {
    success: true,
    data: organisation,
  };
}
