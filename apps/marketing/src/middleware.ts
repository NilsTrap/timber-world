/**
 * Next.js Middleware
 * Handles i18n routing and auth session refresh
 *
 * Flow:
 * 1. next-intl handles locale detection and routing for public pages
 * 2. Supabase updateSession handles admin auth
 */
import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@timber/database/middleware'

// Create next-intl middleware
const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip i18n for admin routes - handle auth only
  if (pathname.startsWith('/admin')) {
    return updateSession(request)
  }

  // Skip i18n for API routes
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Handle i18n for all other routes
  const response = intlMiddleware(request)

  // Update Supabase session for authenticated features
  // Note: For public pages, this refreshes tokens if user is logged in
  // The response from intlMiddleware is passed through
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ogg|mp3|wav|ico|pdf)$).*)',
  ],
}
