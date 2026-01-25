import type { Metadata } from "next";
import { AcceptInviteForm } from "@/features/auth/components/AcceptInviteForm";

export const metadata: Metadata = {
  title: "Accept Invitation",
};

export default function AcceptInvitePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Timber World
        </h1>
        <p className="text-sm text-muted-foreground">
          Set your password to complete your account setup
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <AcceptInviteForm />
      </div>
    </div>
  );
}
