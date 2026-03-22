import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Admin route protection - only block /products (deprecated)
  // /admin/* routes handle their own access control via orgHasFeature checks
  if (user && pathname.startsWith("/products")) {
    const role = user.user_metadata?.role;
    if (role !== "admin") {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("access_denied", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Allow access to /accept-invite for both password reset and invite flows
  // The page handles token validation and shows appropriate UI
  if (isAcceptInviteRoute) {
    return response;
  }

  if (isAuthRoute && user) {
    // Redirect authenticated users away from login/register pages
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
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
