"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { updatePartySchema } from "../schemas";
import { isValidUUID } from "../types";
import type { Party, ActionResult } from "../types";

/**
 * Update Party
 *
 * Updates an existing party's name. Code is immutable.
 * Admin only endpoint.
 */
export async function updateParty(
  id: string,
  input: { name: string }
): Promise<ActionResult<Party>> {
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

  // 3. Validate party ID
  if (!isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid party ID",
      code: "INVALID_ID",
    };
  }

  // 4. Validate input with Zod
  const parsed = updatePartySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { name } = parsed.data;
  const supabase = await createClient();

  // 5. Update party
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("parties")
    .update({ name })
    .eq("id", id)
    .select("id, code, name, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to update party:", error);
    return {
      success: false,
      error: "Failed to update party",
      code: "UPDATE_FAILED",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Party not found",
      code: "NOT_FOUND",
    };
  }

  // 6. Transform and return
  const party: Party = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return {
    success: true,
    data: party,
  };
}
