"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Organization Type
 */
export interface OrganizationType {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  defaultFeatures: string[];
  sortOrder: number;
}

/**
 * Get all organization types
 */
export async function getOrganisationTypes(): Promise<ActionResult<OrganizationType[]>> {
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
    .from("organization_types")
    .select("id, name, description, icon, default_features, sort_order")
    .order("sort_order");

  if (error) {
    console.error("Failed to fetch organization types:", error);
    return { success: false, error: "Failed to fetch organization types", code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const types: OrganizationType[] = (data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    defaultFeatures: t.default_features || [],
    sortOrder: t.sort_order,
  }));

  return { success: true, data: types };
}

/**
 * Get organization's assigned types
 */
export async function getOrganisationAssignedTypes(
  organisationId: string
): Promise<ActionResult<string[]>> {
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
    .from("organization_type_assignments")
    .select("type_id")
    .eq("organization_id", organisationId);

  if (error) {
    console.error("Failed to fetch assigned types:", error);
    return { success: false, error: "Failed to fetch assigned types", code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typeIds = (data || []).map((d: any) => d.type_id);
  return { success: true, data: typeIds };
}

/**
 * Update organization's assigned types
 */
export async function updateOrganisationTypes(
  organisationId: string,
  typeIds: string[]
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Delete existing assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("organization_type_assignments")
    .delete()
    .eq("organization_id", organisationId);

  if (deleteError) {
    console.error("Failed to delete type assignments:", deleteError);
    return { success: false, error: "Failed to update types", code: "DELETE_FAILED" };
  }

  // Insert new assignments
  if (typeIds.length > 0) {
    const assignments = typeIds.map((typeId) => ({
      organization_id: organisationId,
      type_id: typeId,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("organization_type_assignments")
      .insert(assignments);

    if (insertError) {
      console.error("Failed to insert type assignments:", insertError);
      return { success: false, error: "Failed to update types", code: "INSERT_FAILED" };
    }
  }

  return { success: true, data: undefined };
}
