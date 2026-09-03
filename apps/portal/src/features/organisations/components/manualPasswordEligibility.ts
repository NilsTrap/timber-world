export interface ManualPasswordEligibilityUser {
  status: "created" | "invited" | "active";
  authUserId: string | null;
  isActive: boolean;
}

export function canManageManualPassword(user: ManualPasswordEligibilityUser, hasActiveMembership: boolean): boolean {
  return user.isActive && hasActiveMembership && !!user.authUserId?.trim()
    && (user.status === "active" || user.status === "invited");
}
