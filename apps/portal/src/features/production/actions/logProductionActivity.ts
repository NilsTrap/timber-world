/**
 * Log Production Activity
 *
 * Fire-and-forget helper to record actions on production entries.
 * Never throws — logs errors to console so it can't break critical flows.
 */
export async function logProductionActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productionEntryId: string,
  action: string,
  userId: string | null,
  userEmail: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("production_activity_log")
      .insert({
        production_entry_id: productionEntryId,
        action,
        user_id: userId,
        user_email: userEmail,
        metadata: metadata ?? null,
      });
  } catch (err) {
    console.error("[logProductionActivity] Failed to log:", err);
  }
}
