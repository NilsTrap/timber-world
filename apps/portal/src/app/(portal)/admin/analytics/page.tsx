import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { AnalyticsDashboard } from "@/features/analytics";

export const metadata: Metadata = {
  title: "Website Analytics",
};

/**
 * Website Analytics Page (Admin Only)
 *
 * View website traffic, visitor behavior, and quote funnel metrics.
 */
export default async function AnalyticsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    redirect("/dashboard?access_denied=true");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Website Analytics</h1>
        <p className="text-muted-foreground">
          Track visitor behavior, product interest, and quote conversions
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}
