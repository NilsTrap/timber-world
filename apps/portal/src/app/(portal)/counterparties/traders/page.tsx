import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCounterpartyBookContext } from "@/features/counterparties/actions";
import { CounterpartyManager } from "@/features/counterparties/components";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Traders" };
export const dynamic = "force-dynamic";

/**
 * L2 · Traders address book — the house's own trading companies (Timber
 * International, The Wood and Good, …). ADMIN-ONLY: salespeople/purchasing never
 * need a traders book (they are bound to their own trader via membership), so
 * this book is walled to platform admins. The action layer enforces the same
 * (requireBookAccess rejects non-admins for the "traders" book).
 */
export default async function CounterpartyTradersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getCounterpartyBookContext("traders");
  if (!context.success) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Traders</h1>
        <p className="text-muted-foreground">
          The house&apos;s own trading companies — the seller side of a deal. Admin-only.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CounterpartyManager book="traders" canManage={context.data.canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
