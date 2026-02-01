"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import { revalidatePath } from "next/cache";

const VIEW_AS_ORG_COOKIE = "timber-view-as-org";
const VIEW_AS_USER_COOKIE = "timber-view-as-user";
const VIEW_AS_READ_ONLY_COOKIE = "timber-view-as-readonly";

export interface ViewAsOrganization {
  id: string;
  code: string;
  name: string;
}

export interface ViewAsUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Start viewing as an organization (Story 10.14)
 */
export async function startViewAsOrg(organizationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getSession();

    if (!session?.isPlatformAdmin) {
      return { success: false, error: "Only platform admins can use View As" };
    }

    const supabase = await createClient();

    // Verify organization exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error } = await (supabase as any)
      .from("organisations")
      .select("id, code, name")
      .eq("id", organizationId)
      .single();

    if (error || !org) {
      return { success: false, error: "Organization not found" };
    }

    // Log impersonation start
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: portalUser } = await (supabase as any)
      .from("portal_users")
      .select("id")
      .eq("auth_user_id", session.id)
      .single();

    if (portalUser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("audit_log").insert({
        event_type: "impersonation_start",
        actual_user_id: portalUser.id,
        target_org_id: organizationId,
        metadata: { org_code: org.code, org_name: org.name },
      });
    }

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set(VIEW_AS_ORG_COOKIE, organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4, // 4 hours
      path: "/",
    });
    cookieStore.set(VIEW_AS_READ_ONLY_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4,
      path: "/",
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error starting View As:", error);
    return { success: false, error: "Failed to start View As" };
  }
}

/**
 * Start viewing as a specific user (Story 10.15)
 */
export async function startViewAsUser(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getSession();

    if (!session?.isPlatformAdmin) {
      return { success: false, error: "Only platform admins can use View As" };
    }

    const supabase = await createClient();

    // Verify user exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: targetUser, error } = await (supabase as any)
      .from("portal_users")
      .select("id, name, email, organisation_id")
      .eq("id", userId)
      .single();

    if (error || !targetUser) {
      return { success: false, error: "User not found" };
    }

    // Log impersonation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: portalUser } = await (supabase as any)
      .from("portal_users")
      .select("id")
      .eq("auth_user_id", session.id)
      .single();

    if (portalUser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("audit_log").insert({
        event_type: "impersonation_start",
        actual_user_id: portalUser.id,
        target_org_id: targetUser.organisation_id,
        target_user_id: userId,
        metadata: { user_name: targetUser.name, user_email: targetUser.email },
      });
    }

    // Set cookies
    const cookieStore = await cookies();
    if (targetUser.organisation_id) {
      cookieStore.set(VIEW_AS_ORG_COOKIE, targetUser.organisation_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 4,
        path: "/",
      });
    }
    cookieStore.set(VIEW_AS_USER_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4,
      path: "/",
    });
    cookieStore.set(VIEW_AS_READ_ONLY_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4,
      path: "/",
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error starting View As user:", error);
    return { success: false, error: "Failed to start View As" };
  }
}

/**
 * Exit View As mode
 */
export async function exitViewAs(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getSession();
    const supabase = await createClient();
    const cookieStore = await cookies();

    // Log impersonation end
    if (session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: portalUser } = await (supabase as any)
        .from("portal_users")
        .select("id")
        .eq("auth_user_id", session.id)
        .single();

      if (portalUser) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("audit_log").insert({
          event_type: "impersonation_end",
          actual_user_id: portalUser.id,
        });
      }
    }

    // Delete cookies
    cookieStore.delete(VIEW_AS_ORG_COOKIE);
    cookieStore.delete(VIEW_AS_USER_COOKIE);
    cookieStore.delete(VIEW_AS_READ_ONLY_COOKIE);

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error exiting View As:", error);
    return { success: false, error: "Failed to exit View As" };
  }
}

/**
 * Toggle read-only mode in View As
 */
export async function toggleViewAsReadOnly(readOnly: boolean): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();

    if (readOnly) {
      cookieStore.set(VIEW_AS_READ_ONLY_COOKIE, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 4,
        path: "/",
      });
    } else {
      cookieStore.delete(VIEW_AS_READ_ONLY_COOKIE);
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error toggling read-only:", error);
    return { success: false, error: "Failed to toggle read-only" };
  }
}

/**
 * Get current View As context
 */
export async function getViewAsContext(): Promise<{
  isViewingAs: boolean;
  organizationId?: string;
  userId?: string;
  isReadOnly: boolean;
}> {
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get(VIEW_AS_ORG_COOKIE);
  const userCookie = cookieStore.get(VIEW_AS_USER_COOKIE);
  const readOnlyCookie = cookieStore.get(VIEW_AS_READ_ONLY_COOKIE);

  return {
    isViewingAs: !!(orgCookie?.value || userCookie?.value),
    organizationId: orgCookie?.value,
    userId: userCookie?.value,
    isReadOnly: readOnlyCookie?.value === "true",
  };
}
