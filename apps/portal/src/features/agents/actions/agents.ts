"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export interface Agent {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  region: string | null;
  commissionTier: string;
  isActive: boolean;
  createdAt: string;
}

function toAgent(row: any): Agent {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    region: row.region,
    commissionTier: row.commission_tier,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getAgents(): Promise<ActionResult<Agent[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("agent_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toAgent) };
}

export interface CreateAgentInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  region?: string;
  commissionTier?: string;
}

export async function createAgent(input: CreateAgentInput): Promise<ActionResult<Agent>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const admin = createAdminClient();

  // Create auth user with confirmed email
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (authError) {
    return { success: false, error: authError.message, code: "AUTH_CREATE_FAILED" };
  }

  // Create agent_users row
  const { data, error } = await (admin as any)
    .from("agent_users")
    .insert({
      auth_user_id: authData.user.id,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone || null,
      region: input.region || null,
      commission_tier: input.commissionTier || "standard",
    })
    .select()
    .single();

  if (error) {
    // Roll back the auth user if profile creation failed
    await admin.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/agents");
  return { success: true, data: toAgent(data) };
}

export interface UpdateAgentInput {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  region?: string | null;
  commissionTier?: string;
  isActive?: boolean;
}

export async function updateAgent(input: UpdateAgentInput): Promise<ActionResult<Agent>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const admin = createAdminClient();
  const payload: any = {};
  if (input.firstName !== undefined) payload.first_name = input.firstName;
  if (input.lastName !== undefined) payload.last_name = input.lastName;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.region !== undefined) payload.region = input.region;
  if (input.commissionTier !== undefined) payload.commission_tier = input.commissionTier;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { data, error } = await (admin as any)
    .from("agent_users")
    .update(payload)
    .eq("id", input.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/agents");
  return { success: true, data: toAgent(data) };
}

export async function deleteAgent(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const admin = createAdminClient();

  // Get the auth_user_id first
  const { data: agent } = await (admin as any)
    .from("agent_users")
    .select("auth_user_id")
    .eq("id", id)
    .single();

  // Delete the agent_users row
  const { error } = await (admin as any).from("agent_users").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  // Delete the auth user
  if (agent?.auth_user_id) {
    await admin.auth.admin.deleteUser(agent.auth_user_id);
  }

  revalidatePath("/admin/agents");
  return { success: true, data: null };
}
