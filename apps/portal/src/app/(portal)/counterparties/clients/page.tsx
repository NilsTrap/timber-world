import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CounterpartyManager } from "@/features/counterparties/components";
import { getCounterpartyBookContext } from "@/features/counterparties/actions";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

/**
 * Client address book (E4, spec §9.3) — module-gated on
 * `counterparties.clients` (granted via access groups; admins bypass).
 * Walled from the supplier book: Sales staff manage customers here without
 * ever seeing the supplier side.
 */
export default async function CounterpartyClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getCounterpartyBookContext("clients");
  if (!context.success) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          Company profiles available in your customer book.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CounterpartyManager book="clients" canManage={context.data.canManage} accessMode={context.data.accessMode} />
        </CardContent>
      </Card>
    </div>
  );
}
