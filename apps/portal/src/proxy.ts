import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Admin-only routes that require admin role
 */
const ADMIN_ONLY_ROUTES = ["/products", "/admin"];

/**
 * Check if a route requires admin role
 */
function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Auth Middleware
 *
 * Protects routes by checking Supabase session:
 * - Unauthenticated users accessing protected routes → redirect to /login
 * - Authenticated users accessing auth pages → redirect to /dashboard
 * - Non-admin users accessing admin routes → redirect to dashboard with access_denied
 * - Users with incomplete setup (status="invited") → redirect to /accept-invite
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Define route groups
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  const isAcceptInviteRoute = pathname.startsWith("/accept-invite");

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/production") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin");

  const isRootPath = pathname === "/";

  // Route protection logic
  if (isProtectedRoute && !user) {
    // Redirect unauthenticated users to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has completed their account setup (for invited users)
  // This prevents users from accessing the app before setting their password
  if (user && (isProtectedRoute || isRootPath)) {
    const { data: portalUser } = await supabase
      .from("portal_users")
      .select("status")
      .eq("auth_user_id", user.id)
      .single();

    if (portalUser?.status === "invited") {
      // User hasn't completed setup - redirect to accept-invite
      const acceptInviteUrl = new URL("/accept-invite", request.url);
      return NextResponse.redirect(acceptInviteUrl);
    }
  }

  // Admin route protection - check role for admin-only routes
  if (user && isAdminOnlyRoute(pathname)) {
    const role = user.user_metadata?.role;
    if (role !== "admin") {
      // Non-admin accessing admin route → redirect to dashboard with access_denied flag
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("access_denied", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if ((isAuthRoute || isAcceptInviteRoute) && user) {
    // Check if user needs to complete invite setup
    const { data: portalUser } = await supabase
      .from("portal_users")
      .select("status")
      .eq("auth_user_id", user.id)
      .single();

    if (portalUser?.status === "invited" && isAcceptInviteRoute) {
      // Allow invited users to access accept-invite page
      return response;
    }

    if (portalUser?.status !== "invited") {
      // Redirect fully authenticated users away from auth pages
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (isRootPath) {
    // Redirect root to appropriate page
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
