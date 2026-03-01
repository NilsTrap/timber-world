"use server";

import { createClient } from "@timber/database/server";
import type { ActionResult } from "../types";

/**
 * Person with organisation info for the People table
 */
export interface Person {
  id: string;
  email: string;
  name: string;
  role: "admin" | "producer";
  organisationId: string | null;
  organisationName: string;
  organisationCode: string;
  isActive: boolean;
  status: "created" | "invited" | "active";
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * Get all people (portal users) across all organisations
 */
export async function getAllPeople(): Promise<ActionResult<Person[]>> {
  const supabase = await createClient();

  // Fetch users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error: usersError } = await (supabase as any)
    .from("portal_users")
    .select(`
      id,
      email,
      name,
      role,
      organisation_id,
      is_active,
      status,
      last_login_at,
      created_at
    `)
    .order("name", { ascending: true });

  if (usersError) {
    console.error("Error fetching people:", usersError);
    return { success: false, error: usersError.message };
  }

  // Fetch all organisations for lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgs, error: orgsError } = await (supabase as any)
    .from("organisations")
    .select("id, name, code");

  if (orgsError) {
    console.error("Error fetching organisations:", orgsError);
    return { success: false, error: orgsError.message };
  }

  // Create organisation lookup map
  const orgMap = new Map<string, { name: string; code: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (orgs || []).forEach((org: any) => {
    orgMap.set(org.id, { name: org.name, code: org.code });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const people: Person[] = (users || []).map((row: any) => {
    const org = row.organisation_id ? orgMap.get(row.organisation_id) : null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      organisationId: row.organisation_id,
      organisationName: org?.name || "Unknown",
      organisationCode: org?.code || "-",
      isActive: row.is_active,
      status: row.status,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    };
  });

  return { success: true, data: people };
}
