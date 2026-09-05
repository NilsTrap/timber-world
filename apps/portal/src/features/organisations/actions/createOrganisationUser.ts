"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { createPersonWithPrimaryMembership, ensureOrganisationRoleModules, getOrganisationRoleGroup, setMembershipGroups } from "../services/personOnboarding";
import { sendPasswordlessInvite } from "../services/passwordlessInvite";
import { ADMIN_DENIED } from "./_platformAdmin";
import { requirePersonOnboardingAccess } from "./_personOnboardingAccess";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  email: z.string().email("Invalid email address").max(255).trim().toLowerCase(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreatedOrganisationUser = OrganisationUser & { inviteSent: boolean; inviteError: string | null };

export async function createOrganisationUser(
  organisationId: string,
  input: CreateUserInput,
): Promise<ActionResult<CreatedOrganisationUser>> {
  if (!isValidUUID(organisationId)) return ADMIN_DENIED;
  const guard = await requirePersonOnboardingAccess(organisationId);
  if (!guard.ok) return ADMIN_DENIED;
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const role = await getOrganisationRoleGroup(admin, organisationId);
  if (!role.ok) {
    return { success: false, error: "Set one company role before inviting people", code: role.code };
  }

  const modules = await ensureOrganisationRoleModules(admin, organisationId, role.group.key);
  if (!modules.ok) return { success: false, error: "Company access could not be configured", code: modules.code };

  const created = await createPersonWithPrimaryMembership(admin, {
    email: parsed.data.email,
    name: parsed.data.name,
    organisationId,
    invitedBy: guard.session.portalUserId,
  });
  if (!created.ok) {
    return created.code === "DUPLICATE_EMAIL"
      ? { success: false, error: "This email cannot be added to this company", code: "EMAIL_UNAVAILABLE" }
      : ADMIN_DENIED;
  }

  const groups = await setMembershipGroups(admin, created.userId, organisationId, [role.group.id]);
  if (!groups.ok) return { success: false, error: "User created but access could not be assigned", code: groups.code };
  updateTag(`user-modules:${created.userId}:${organisationId}`);
  updateTag(`access-profile:${created.userId}:${organisationId}`);

  const invite = await sendPasswordlessInvite(admin, admin, created.userId, organisationId, guard.session.portalUserId);
  const inviteSent = invite.ok;
  const inviteError = invite.ok ? null : "User created; invitation email can be retried";

  const { data } = await admin.from("portal_users")
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at")
    .eq("id", created.userId).single();
  if (!data) return { success: false, error: "Failed to load created user", code: "FETCH_FAILED" };
  const user: CreatedOrganisationUser = {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    organisationId: data.organisation_id,
    authUserId: data.auth_user_id,
    isActive: data.is_active,
    status: data.status,
    invitedAt: data.invited_at,
    invitedBy: data.invited_by,
    invitedByName: null,
    lastLoginAt: data.last_login_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    inviteSent,
    inviteError,
  };
  await logAudit({ action: "portal_user.create", resourceType: "portal_user", resourceId: user.id, organisationId, metadata: { inheritedRole: role.group.key, inviteSent } });
  return { success: true, data: user };
}
