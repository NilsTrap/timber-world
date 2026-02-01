import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/getSession";
import { createClient } from "@/lib/supabase/server";

const CURRENT_ORG_COOKIE = "timber-current-org";

/**
 * POST /api/auth/switch-organization
 *
 * Switches the current user's organization context
 * Sets a cookie to persist the selection across requests
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      );
    }

    // Verify user has membership in this organization
    const supabase = await createClient();

    // Get portal user ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: portalUser } = await (supabase as any)
      .from("portal_users")
      .select("id, is_platform_admin")
      .eq("auth_user_id", session.id)
      .single();

    if (!portalUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Platform admins can switch to any org
    if (!portalUser.is_platform_admin) {
      // Check membership
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from("organization_memberships")
        .select("id")
        .eq("user_id", portalUser.id)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: "No membership in this organization" },
          { status: 403 }
        );
      }
    }

    // Set cookie for current organization
    const cookieStore = await cookies();
    cookieStore.set(CURRENT_ORG_COOKIE, organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({ success: true, organizationId });
  } catch (error) {
    console.error("Error switching organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
