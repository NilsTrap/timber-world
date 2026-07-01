import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { CounterpartyManager } from "@/features/counterparties/components";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Clients" };
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

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("counterparties.clients")) notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          The Customer address book — records here are kept separate from the supplier side.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CounterpartyManager book="clients" />
        </CardContent>
      </Card>
    </div>
  );
}
