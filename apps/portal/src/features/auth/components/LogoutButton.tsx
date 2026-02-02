"use client";

/**
 * Logout Button Component
 *
 * Uses form action to call the logout Server Action.
 * Clears session verification before logout to ensure
 * re-authentication is required in new browser windows.
 * TODO [i18n]: Replace hardcoded text with useTranslations().
 */

import { Button } from "@timber/ui";
import { logoutUser } from "../actions/logout";
import { clearSessionVerification } from "@/components/SessionVerificationGuard";

export function LogoutButton() {
  const handleLogout = async () => {
    // Clear the window-specific session verification
    clearSessionVerification();
    // Then call the server action to sign out
    await logoutUser();
  };

  return (
    <form action={handleLogout}>
      <Button type="submit" variant="ghost" size="sm" aria-label="Log out of your account">
        Logout
      </Button>
    </form>
  );
}
