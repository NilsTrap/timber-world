import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nilitto Trading Platform
        </h1>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <LoginForm />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account? Contact your administrator for an invitation.
      </p>
    </div>
  );
}
