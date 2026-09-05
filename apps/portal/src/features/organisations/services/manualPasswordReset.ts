import { z } from "zod";

export const passwordPayloadSchema = z.object({
  password: z.string().min(8),
  confirmation: z.string().min(8),
}).refine(({ password, confirmation }) => password === confirmation, {
  path: ["confirmation"],
});

export type ResetUserPasswordPayload = z.infer<typeof passwordPayloadSchema>;

export type PasswordResetQuery = {
  select(columns: string): PasswordResetQuery;
  update(values: Record<string, unknown>): PasswordResetQuery;
  eq(column: string, value: unknown): PasswordResetQuery;
  neq(column: string, value: unknown): PasswordResetQuery;
  is(column: string, value: null): PasswordResetQuery;
  limit(count: number): PasswordResetQuery;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error?: unknown }>;
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
};

export type PasswordResetAdmin = {
  from(table: string): PasswordResetQuery;
  auth: { admin: {
    createUser(attributes: { email: string; password: string; email_confirm: true; user_metadata: { name: string; role: string } }): Promise<{ data: { user: { id: string } | null }; error: unknown | null }>;
    deleteUser(id: string): Promise<{ error: unknown | null }>;
    updateUserById(id: string, attributes: { password: string; email_confirm: true }): Promise<{ error: unknown | null }>;
  } };
};

export type ManualPasswordResetResult =
  | { ok: true }
  | { ok: false; code: "DENIED" | "NO_AUTH_USER" | "RESET_FAILED" };

export const manualPasswordResetAuditMetadata = { method: "manual" } as const;

export async function setManualPassword(
  admin: PasswordResetAdmin,
  userId: string,
  organisationId: string,
  password: string,
  allowPlatformAdminTarget: boolean,
): Promise<ManualPasswordResetResult> {
  try {
    const [membershipResult, userResult, otherMembershipResult] = await Promise.all([
      admin.from("organization_memberships").select("id").eq("user_id", userId)
        .eq("organization_id", organisationId).eq("is_active", true).maybeSingle(),
      admin.from("portal_users").select("id, email, name, role, auth_user_id, is_platform_admin, status").eq("id", userId)
        .eq("is_active", true).maybeSingle(),
      admin.from("organization_memberships").select("id").eq("user_id", userId)
        .eq("is_active", true).neq("organization_id", organisationId).limit(1).maybeSingle(),
    ]);
    if (membershipResult.error || userResult.error || otherMembershipResult.error) {
      return { ok: false, code: "RESET_FAILED" };
    }
    if (!membershipResult.data || !userResult.data) return { ok: false, code: "DENIED" };
    if (userResult.data.status !== "created" && userResult.data.status !== "active" && userResult.data.status !== "invited") {
      return { ok: false, code: "DENIED" };
    }
    if (userResult.data.is_platform_admin === true && !allowPlatformAdminTarget) {
      return { ok: false, code: "DENIED" };
    }
    if (otherMembershipResult.data && !allowPlatformAdminTarget) return { ok: false, code: "DENIED" };
    const existingAuthUserId = userResult.data.auth_user_id;
    let authUserId: string | null = typeof existingAuthUserId === "string" && existingAuthUserId ? existingAuthUserId : null;
    if (!authUserId) {
      const email = userResult.data.email;
      const name = userResult.data.name;
      const role = userResult.data.role;
      if (typeof email !== "string" || typeof name !== "string" || typeof role !== "string") {
        return { ok: false, code: "RESET_FAILED" };
      }
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });
      const createdAuthUserId = created.data.user?.id;
      if (created.error || !createdAuthUserId) return { ok: false, code: "RESET_FAILED" };
      authUserId = createdAuthUserId;

      const linked = await admin.from("portal_users").update({
        auth_user_id: authUserId,
        status: "active",
        updated_at: new Date().toISOString(),
      }).eq("id", userId).eq("is_active", true).is("auth_user_id", null).select("id").maybeSingle();
      if (linked.error || !linked.data) {
        await admin.auth.admin.deleteUser(authUserId);
        return { ok: false, code: "RESET_FAILED" };
      }
      return { ok: true };
    }

    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
    });
    if (error) return { ok: false, code: "RESET_FAILED" };

    const activation = await admin.from("portal_users")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id")
      .maybeSingle();
    return activation.error || !activation.data ? { ok: false, code: "RESET_FAILED" } : { ok: true };
  } catch {
    return { ok: false, code: "RESET_FAILED" };
  }
}
