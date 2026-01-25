import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Registration Not Available",
};

/**
 * Registration is disabled - all users must be invited by an administrator.
 * This page explains the process and redirects to login.
 */
export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Registration Not Available
        </h1>
        <p className="text-sm text-muted-foreground">
          Self-registration is not available for the Timber World Portal
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <p className="text-sm text-muted-foreground">
          Access to the Timber World Portal is by invitation only. If you need
          access, please contact your administrator.
        </p>
        <p className="text-sm text-muted-foreground">
          If you have received an invitation email, please click the link in
          that email to set up your account.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
