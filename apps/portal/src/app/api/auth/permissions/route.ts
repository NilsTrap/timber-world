import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/getSession";
import { getEffectivePermissions } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/permissions
 *
 * Returns the current user's effective permissions
 * Used by the usePermissions client hook
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get portal user ID
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: portalUser } = await (supabase as any)
      .from("portal_users")
      .select("id")
      .eq("auth_user_id", session.id)
      .single();

    if (!portalUser) {
      return NextResponse.json({
        permissions: [],
        isPlatformAdmin: false,
      });
    }

    const permissions = await getEffectivePermissions(
      portalUser.id,
      session.currentOrganizationId
    );

    return NextResponse.json({
      permissions,
      isPlatformAdmin: session.isPlatformAdmin,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
