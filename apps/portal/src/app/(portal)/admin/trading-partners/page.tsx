import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { Card, CardContent } from "@timber/ui";
import { TradingPartnersLegacyManager } from "@/features/organisations/components/TradingPartnersLegacyManager";

export const metadata: Metadata = { title: "Trading Partners" };
export const dynamic = "force-dynamic";

/**
 * Legacy Trading-Partners admin page (moved out of the Orgs & People org detail).
 * Admin-only. Pick an organisation to manage its trading-partner links.
 */
export default async function TradingPartnersLegacyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Trading Partners</h1>
        <p className="text-muted-foreground">
          Legacy — manage an organisation&apos;s trading-partner links (moved here from the org detail view).
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <TradingPartnersLegacyManager />
        </CardContent>
      </Card>
    </div>
  );
}
