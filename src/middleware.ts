/**
 * Next.js Middleware
 * Handles auth session refresh and protected route checks
 *
 * Auth flow:
 * 1. updateSession() refreshes tokens and checks authentication
 * 2. Admin routes redirect to login if not authenticated
 * 3. Admin layout verifies user is in admin_users table (authorization)
 */
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // updateSession handles:
  // - Token refresh
  // - Auth check for /admin routes
  // - Redirect to /admin/login if unauthenticated
  // - Session expired message in URL params
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
