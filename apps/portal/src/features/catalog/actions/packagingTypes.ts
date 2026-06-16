"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";

export interface PackagingType {
  id: string;
  name: string;
  piecesPerPackage: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

function toType(row: any): PackagingType {
  return {
    id: row.id,
    name: row.name,
    piecesPerPackage: row.pieces_per_package,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export async function getPackagingTypes(): Promise<ActionResult<PackagingType[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_packaging_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toType) };
}

export interface SavePackagingTypeInput {
  id?: string;
  name: string;
  piecesPerPackage: number;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function savePackagingType(input: SavePackagingTypeInput): Promise<ActionResult<PackagingType>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const payload = {
    name: input.name,
    pieces_per_package: input.piecesPerPackage,
    description: input.description ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  let result;
  if (input.id) {
    result = await (supabase as any).from("catalog_packaging_types").update(payload).eq("id", input.id).select().single();
  } else {
    result = await (supabase as any).from("catalog_packaging_types").insert(payload).select().single();
  }

  if (result.error) return { success: false, error: result.error.message };
  revalidatePath("/admin/settings/packaging");
  return { success: true, data: toType(result.data) };
}

export async function deletePackagingType(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!(mods.has("settings.view") || mods.has("catalogue.view"))) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_packaging_types").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/settings/packaging");
  return { success: true, data: null };
}
