"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { createPartySchema } from "../schemas";
import type { Party, ActionResult } from "../types";

/**
 * Create Party
 *
 * Creates a new party with a 3-letter code and name.
 * Admin only endpoint.
 */
export async function createParty(
  input: { code: string; name: string }
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

  // 3. Validate input with Zod
  const parsed = createPartySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
      code: "VALIDATION_ERROR",
    };
  }

  const { code, name } = parsed.data;
  const supabase = await createClient();

  // 4. Check for duplicate code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("parties")
    .select("id")
    .eq("code", code)
    .single();

  if (existing) {
    return {
      success: false,
      error: "Party code already exists",
      code: "DUPLICATE_CODE",
    };
  }

  // 5. Insert new party
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("parties")
    .insert({
      code,
      name,
      is_active: true,
    })
    .select("id, code, name, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to create party:", error);
    return {
      success: false,
      error: "Failed to create party",
      code: "CREATE_FAILED",
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
