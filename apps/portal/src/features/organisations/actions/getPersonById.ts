"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

export interface PersonDetail {
  id: string;
  email: string;
  name: string;
  phone: string | null;
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
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(personId)) return ADMIN_DENIED;
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_users")
    .select(`
      id,
      email,
      name,
      phone,
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
    return ADMIN_DENIED;
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
      phone: data.phone ?? null,
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
