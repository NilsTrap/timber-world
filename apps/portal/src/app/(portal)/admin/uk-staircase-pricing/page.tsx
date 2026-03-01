import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { UkStaircasePricingManager } from "@/features/uk-staircase-pricing";

export const metadata: Metadata = {
  title: "UK Staircase Pricing",
};

/**
 * UK Staircase Pricing Management Page (Admin Only)
 *
 * Allows admins to manage UK staircase component pricing data.
 */
export default async function UkStaircasePricingPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">
          UK Staircase Pricing
        </h1>
        <p className="text-muted-foreground">
          Manage pricing data for UK staircase components
        </p>
      </div>

      <UkStaircasePricingManager />
    </div>
  );
}
