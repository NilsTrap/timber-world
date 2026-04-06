"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface ModulePreset {
  id: string;
  name: string;
  moduleCodes: string[];
  createdAt: string;
}

/**
 * Get all module presets
 */
export async function getModulePresets(): Promise<ActionResult<ModulePreset[]>> {
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
    .from("module_presets")
    .select("id, name, module_codes, created_at")
    .order("name");

  if (error) {
    console.error("Failed to fetch module presets:", error);
    return { success: false, error: "Failed to fetch presets", code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presets: ModulePreset[] = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    moduleCodes: p.module_codes || [],
    createdAt: p.created_at,
  }));

  return { success: true, data: presets };
}

/**
 * Create a new module preset from the current selection
 */
export async function createModulePreset(
  name: string,
  moduleCodes: string[]
): Promise<ActionResult<ModulePreset>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Preset name is required", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("module_presets")
    .insert({ name: trimmedName, module_codes: moduleCodes })
    .select("id, name, module_codes, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "A preset with this name already exists", code: "DUPLICATE" };
    }
    console.error("Failed to create module preset:", error);
    return { success: false, error: "Failed to create preset", code: "INSERT_FAILED" };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      moduleCodes: data.module_codes || [],
      createdAt: data.created_at,
    },
  };
}

/**
 * Delete a module preset
 */
export async function deleteModulePreset(
  id: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("module_presets")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete module preset:", error);
    return { success: false, error: "Failed to delete preset", code: "DELETE_FAILED" };
  }

  return { success: true, data: undefined };
}
