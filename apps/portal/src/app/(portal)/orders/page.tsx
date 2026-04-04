import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { OrdersTable } from "@/features/orders/components";

export const metadata = {
  title: "Orders | Timber World",
};

// Org types that act as salesperson (can pick customer org)
const SALESPERSON_ORG_TYPES = ["principal", "trader"];

export default async function OrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);
  const userOrgId = session.currentOrganizationId || session.organisationId || null;

  // For non-admin users, check if their organization has the orders feature enabled
  if (!userIsAdmin) {
    const hasOrdersModule = await orgHasModule(userOrgId, "orders.view");
    if (!hasOrdersModule) {
      notFound();
    }
  }

  const userOrgName = session.currentOrganizationName || session.organisationName || null;

  // Determine if user's org is a salesperson type (can pick customer)
  let canSelectCustomer = userIsAdmin;
  if (!userIsAdmin && userOrgId) {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: typeAssignment } = await (supabase as any)
      .from("organization_type_assignments")
      .select("organization_types(name)")
      .eq("organization_id", userOrgId)
      .limit(1)
      .single();

    if (typeAssignment?.organization_types?.name) {
      canSelectCustomer = SALESPERSON_ORG_TYPES.includes(typeAssignment.organization_types.name);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          {userIsAdmin
            ? "Manage customer orders"
            : "View and create orders for your organisation"}
        </p>
      </div>

      <OrdersTable
        isAdmin={userIsAdmin}
        canSelectCustomer={canSelectCustomer}
        userOrganisationId={userOrgId}
        userOrganisationName={userOrgName}
      />
    </div>
  );
}
