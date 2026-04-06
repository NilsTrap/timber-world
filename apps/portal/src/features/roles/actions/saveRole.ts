"use server";

/**
 * @deprecated Roles have been removed. User permissions are now managed
 * directly via user_modules (per-user module assignment).
 */

export interface SaveRoleInput {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function saveRole(_input?: SaveRoleInput): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  return { success: false, error: "Roles system has been removed" };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteRole(_roleId?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: false, error: "Roles system has been removed" };
}
