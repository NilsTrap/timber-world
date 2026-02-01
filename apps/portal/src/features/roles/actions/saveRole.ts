"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SaveRoleInput {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}

export async function saveRole(input: SaveRoleInput): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    if (input.id) {
      // Check if it's a system role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("roles")
        .select("is_system")
        .eq("id", input.id)
        .single();

      // System roles can have permissions updated but not name
      const updateData = existing?.is_system
        ? { permissions: input.permissions, description: input.description }
        : {
            name: input.name,
            description: input.description,
            permissions: input.permissions,
          };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("roles")
        .update(updateData)
        .eq("id", input.id);

      if (error) {
        return { success: false, error: error.message };
      }

      revalidatePath("/admin/roles");
      return { success: true, data: { id: input.id } };
    } else {
      // Create new role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("roles")
        .insert({
          name: input.name,
          description: input.description,
          permissions: input.permissions,
          is_system: false,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      revalidatePath("/admin/roles");
      return { success: true, data: { id: data.id } };
    }
  } catch (error) {
    console.error("Error saving role:", error);
    return { success: false, error: "Failed to save role" };
  }
}

export async function deleteRole(roleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check if it's a system role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: role } = await (supabase as any)
      .from("roles")
      .select("is_system, name")
      .eq("id", roleId)
      .single();

    if (role?.is_system) {
      return { success: false, error: "System roles cannot be deleted" };
    }

    // Delete role (cascades to user_roles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/roles");
    return { success: true };
  } catch (error) {
    console.error("Error deleting role:", error);
    return { success: false, error: "Failed to delete role" };
  }
}
