"use server";

import { createClient } from "@/lib/supabase/server";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  userCount?: number;
}

export async function getRoles(): Promise<{
  success: boolean;
  data?: Role[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roles, error } = await (supabase as any)
      .from("roles")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name");

    if (error) {
      return { success: false, error: error.message };
    }

    // Get user counts per role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userCounts } = await (supabase as any)
      .from("user_roles")
      .select("role_id");

    const countMap = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userCounts?.forEach((ur: any) => {
      countMap.set(ur.role_id, (countMap.get(ur.role_id) || 0) + 1);
    });

    const formattedRoles: Role[] = roles.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions || [],
        isSystem: role.is_system,
        isActive: role.is_active,
        createdAt: role.created_at,
        userCount: countMap.get(role.id) || 0,
      })
    );

    return { success: true, data: formattedRoles };
  } catch (error) {
    console.error("Error fetching roles:", error);
    return { success: false, error: "Failed to fetch roles" };
  }
}
