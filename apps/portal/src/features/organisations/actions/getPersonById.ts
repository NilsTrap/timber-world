"use server";

import { createClient } from "@timber/database/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface PersonDetail {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  organisationId: string | null;
  organisationName: string;
  organisationCode: string;
  authUserId: string | null;
  isActive: boolean;
  status: "created" | "invited" | "active";
  lastLoginAt: string | null;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get a single person (portal user) by ID with their organisation info
 */
export async function getPersonById(
  personId: string
): Promise<ActionResult<PersonDetail>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_users")
    .select(`
      id,
      email,
      name,
      role,
      organisation_id,
      auth_user_id,
      is_active,
      status,
      last_login_at,
      invited_at,
      created_at,
      updated_at
    `)
    .eq("id", personId)
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return { success: false, error: "Person not found", code: "NOT_FOUND" };
    }
    console.error("Error fetching person:", error);
    return { success: false, error: "Failed to fetch person", code: "QUERY_FAILED" };
  }

  // Fetch organisation info
  let organisationName = "No organisation";
  let organisationCode = "-";

  if (data.organisation_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from("organisations")
      .select("name, code")
      .eq("id", data.organisation_id)
      .single();

    if (org) {
      organisationName = org.name;
      organisationCode = org.code;
    }
  }

  return {
    success: true,
    data: {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      organisationId: data.organisation_id,
      organisationName,
      organisationCode,
      authUserId: data.auth_user_id,
      isActive: data.is_active,
      status: data.status,
      lastLoginAt: data.last_login_at,
      invitedAt: data.invited_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}
