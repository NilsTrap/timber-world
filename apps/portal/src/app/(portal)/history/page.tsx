import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Production History",
};

/**
 * Production History Page
 *
 * Producer page for viewing and editing past production entries.
 * Accessible to both admin and producer roles.
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export default async function HistoryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Production History</h1>
        <p className="text-muted-foreground">
          Review and edit past production entries
        </p>
      </div>

      <div className="rounded-lg border bg-card p-12 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Production History</h2>
          <p className="text-muted-foreground max-w-md">
            View your production history with detailed entries showing inputs, outputs, and efficiency metrics.
            This feature will be implemented in Stories 5.1 - 5.2.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Coming in Epic 5: Production Insights & History
          </p>
        </div>
      </div>
    </div>
  );
}
