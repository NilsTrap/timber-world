"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SESSION_VERIFIED_KEY = "portal_session_verified";

/**
 * Session Verification Guard
 *
 * Ensures users must log in for each new browser window/tab.
 * Uses sessionStorage (tab-specific) to track if user has authenticated
 * in the current window, even if a Supabase session cookie exists.
 *
 * This provides an extra layer of security by preventing automatic
 * session reuse across browser windows.
 */
export function SessionVerificationGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check once per component lifecycle
    if (hasChecked.current) return;
    if (isSigningOut) return;

    hasChecked.current = true;

    // Check if this window/tab has verified the session
    const verified = sessionStorage.getItem(SESSION_VERIFIED_KEY);

    if (verified) {
      setIsVerified(true);
      return;
    }

    // No verification in this window - sign out and redirect to login
    setIsSigningOut(true);

    const signOutAndRedirect = async () => {
      try {
        // Sign out to clear the Supabase session cookie
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Error signing out:", error);
      }

      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(pathname);
      window.location.replace(`/login?returnUrl=${returnUrl}`);
    };

    signOutAndRedirect();
  }, [pathname, isSigningOut]);

  // Show loading state while checking verification status or signing out
  if (isVerified === null || isSigningOut) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">
          {isSigningOut ? "Session expired. Redirecting to login..." : "Loading..."}
        </div>
      </div>
    );
  }

  // Only render children if session is verified in this window
  return <>{children}</>;
}

/**
 * Mark the current window/tab session as verified.
 * Call this after successful login.
 */
export function markSessionVerified(): void {
  sessionStorage.setItem(SESSION_VERIFIED_KEY, "true");
}

/**
 * Clear the session verification for the current window.
 * Call this on logout.
 */
export function clearSessionVerification(): void {
  sessionStorage.removeItem(SESSION_VERIFIED_KEY);
}
