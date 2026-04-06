"use server";

/**
 * @deprecated Roles have been removed. User permissions are now managed
 * directly via user_modules (per-user module assignment).
 */
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
  // Roles system has been removed — return empty
  return { success: true, data: [] };
}
