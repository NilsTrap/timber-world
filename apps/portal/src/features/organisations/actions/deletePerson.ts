"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import { mayPermanentlyDeletePerson } from "../services/personDeletion";
import type { ActionResult } from "../types";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

const deletePersonSchema = z.string().uuid();

export async function deletePersonPermanently(personId: string): Promise<ActionResult<{ id: string; email: string }>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return ADMIN_DENIED;
  const parsedPersonId = deletePersonSchema.safeParse(personId);
  if (!parsedPersonId.success) return ADMIN_DENIED;
  if (!mayPermanentlyDeletePerson(guard.session.portalUserId, personId)) {
    return { success: false, error: "You cannot permanently delete your own account", code: "FORBIDDEN" };
  }

  const admin = createAdminClient();
  // portal_users predates the generated database package types used by this app.
  // Keep the cast local and narrow instead of widening the complete admin client.
  const portalUsers = admin.from("portal_users" as never);
  const { data: personRow, error: readError } = await portalUsers
    .select("id, email, auth_user_id")
    .eq("id", personId)
    .maybeSingle();
  if (readError) return { success: false, error: "Could not load person", code: "FETCH_FAILED" };
  if (!personRow) return { success: false, error: "Person not found", code: "NOT_FOUND" };
  const person = personRow as { id: string; email: string; auth_user_id: string | null };

  if (person.auth_user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(person.auth_user_id);
    if (authError) return { success: false, error: "Could not remove the person's login account", code: "DELETE_FAILED" };
  }

  const { data: deleted, error: deleteError } = await admin
    .from("portal_users" as never)
    .delete()
    .eq("id", personId)
    .select("id")
    .maybeSingle();
  if (deleteError || !deleted) {
    return {
      success: false,
      error: person.auth_user_id
        ? "Login was removed, but profile cleanup failed. Retry permanent deletion."
        : "Could not permanently delete person",
      code: "DELETE_FAILED",
    };
  }

  await logAudit({
    action: "portal_user.delete_permanently",
    resourceType: "portal_user",
    resourceId: personId,
    metadata: { email: person.email },
  });
  revalidatePath("/admin/organisations");
  revalidatePath("/admin/people");
  return { success: true, data: { id: personId, email: person.email } };
}
