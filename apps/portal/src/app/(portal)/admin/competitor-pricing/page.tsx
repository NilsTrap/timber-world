import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { CompetitorPricingManager } from "@/features/competitor-pricing";

export const metadata: Metadata = {
  title: "Competitor Pricing",
};

/**
 * Competitor Pricing Page (Admin Only)
 *
 * Displays pricing data scraped from competitor websites (e.g., mass.ee).
 */
export default async function CompetitorPricingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("competitor-pricing.view")) {
      redirect("/dashboard?access_denied=true");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Competitor Pricing
        </h1>
        <p className="text-muted-foreground">
          View pricing data from competitor websites
        </p>
      </div>

      <CompetitorPricingManager />
    </div>
  );
}
