"use server";

/**
 * @deprecated Roles have been removed. User permissions are now managed
 * directly via user_modules. See getUserPermissions.ts for getUserModules/updateUserModules.
 */

export interface UserRoleAssignment {
  roleId: string;
  roleName: string;
  roleDescription: string | null;
  isSystem: boolean;
  assigned: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getUserRoles(_userId?: string, _orgId?: string): Promise<{
  success: boolean;
  data?: UserRoleAssignment[];
  error?: string;
}> {
  return { success: true, data: [] };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function updateUserRoles(_userId?: string, _orgId?: string, _roleIds?: string[]): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: false, error: "Roles system has been removed" };
}
