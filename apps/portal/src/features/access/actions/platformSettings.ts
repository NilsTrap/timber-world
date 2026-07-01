"use server";

/**
 * E4 · Platform settings — tiny admin-editable key/value store
 * (platform_settings table). First consumer: purchasing_may_reuse_clients,
 * the spec §9.3 address-book toggle.
 */

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export async function getPlatformSetting(
  key: string,
): Promise<ActionResult<{ key: string; value: unknown }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("platform_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle();
  if (error) return { success: false, error: "Failed to load setting", code: "FETCH_FAILED" };
  return { success: true, data: { key, value: data?.value ?? null } };
}

export async function setPlatformSetting(
  key: string,
  value: unknown,
): Promise<ActionResult<{ key: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { success: false, error: "Failed to save setting", code: "UPDATE_FAILED" };
  return { success: true, data: { key } };
}
