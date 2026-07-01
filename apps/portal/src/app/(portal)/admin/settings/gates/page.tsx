import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { GateConfigManager } from "@/features/orders/components";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Deal Gates" };
export const dynamic = "force-dynamic";

/**
 * Deal Gate configuration (Admin only) — edit the requirements that gate each
 * deal-lifecycle transition (deal-kind × from-stage). Gates are edited in-app,
 * never in code (Timber spec §6).
 */
export default async function DealGatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Deal Gates</h1>
        <p className="text-muted-foreground">
          Configure the requirements that must be met to advance a deal from each lifecycle stage.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <GateConfigManager />
        </CardContent>
      </Card>
    </div>
  );
}
