"use server";

import { createClient } from "@/lib/supabase/server";

export async function setShowCommissions(value: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await (supabase as any)
    .from("agent_users")
    .update({ show_commissions: value })
    .eq("auth_user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
