import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CounterpartyManager } from "@/features/counterparties/components";
import { getCounterpartyBookContext } from "@/features/counterparties/actions";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

/**
 * Supplier address book (E4, spec §9.3) — module-gated on
 * `counterparties.suppliers` (granted via access groups; admins bypass).
 * Covers suppliers and Producers; walled from the client side so Purchasing
 * staff never see customer records (unless the reuse setting allows it).
 */
export default async function CounterpartySuppliersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getCounterpartyBookContext("suppliers");
  if (!context.success) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground">
          Company profiles available in your supplier book.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CounterpartyManager book="suppliers" canManage={context.data.canManage} accessMode={context.data.accessMode} />
        </CardContent>
      </Card>
    </div>
  );
}
