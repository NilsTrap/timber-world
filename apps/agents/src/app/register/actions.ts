"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  website?: string; // honeypot — must stay empty
}

export type RegisterResult = { success: true } | { success: false; error: string };

export async function registerAgent(input: RegisterInput): Promise<RegisterResult> {
  // Honeypot: bots fill hidden fields. Pretend success without doing anything.
  if (input.website && input.website.trim() !== "") return { success: true };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  if (!firstName || !lastName || !email || !phone) return { success: false, error: "All fields are required." };
  if (!phone) return { success: false, error: "Phone number is required." };
  if (input.password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  const admin = createAdminClient();

  // Confirmed user (no email verification step), so they can log in immediately
  // but will sit behind the approval gate until an admin approves them.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authError || !authData?.user) {
    const msg = authError?.message ?? "Could not create account.";
    if (/already.*registered|exists/i.test(msg)) {
      return { success: false, error: "An account with this email already exists." };
    }
    return { success: false, error: msg };
  }

  const { error: profileError } = await (admin as any).from("agent_users").insert({
    auth_user_id: authData.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    phone,
    application_status: "pending",
    is_active: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id); // roll back
    return { success: false, error: profileError.message };
  }

  return { success: true };
}
