"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Set Organisation Role Flag
 *
 * Toggles one of an organisation's supply-chain role flags
 * (is_customer / is_manufacturer / is_producer). Roles are independent —
 * an organisation can have any combination of them.
 */

/** Whitelist mapping role keys to DB columns — never interpolate from input. */
const ROLE_COLUMN_MAP: Record<
  "customer" | "manufacturer" | "producer",
  "is_customer" | "is_manufacturer" | "is_producer"
> = {
  customer: "is_customer",
  manufacturer: "is_manufacturer",
  producer: "is_producer",
};

export async function setOrganisationRole(
  id: string,
  role: "customer" | "manufacturer" | "producer",
  enabled: boolean
): Promise<ActionResult<{ role: string; enabled: boolean }>> {
  // 1. Validate input
  if (!id || !isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_INPUT",
    };
  }

  const column = ROLE_COLUMN_MAP[role];
  if (!column) {
    return {
      success: false,
      error: "Invalid role",
      code: "INVALID_INPUT",
    };
  }

  // 2. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 3. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // 4. Update organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("organisations")
    .update({ [column]: enabled })
    .eq("id", id)
    .select(column)
    .single();

  if (error) {
    console.error("Failed to update organisation:", error);
    return {
      success: false,
      error: "Failed to update organisation",
      code: "UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: { role, enabled },
  };
}
