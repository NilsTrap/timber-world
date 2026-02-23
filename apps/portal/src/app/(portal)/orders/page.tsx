import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import { OrdersTable } from "@/features/orders/components";

export const metadata = {
  title: "Orders | Timber World",
};

export default async function OrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);

  // For non-admin users, check if their organization has the orders feature enabled
  if (!userIsAdmin) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasOrdersFeature = await orgHasFeature(orgId, "orders.view");
    if (!hasOrdersFeature) {
      notFound();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          {userIsAdmin
            ? "Manage customer orders"
            : "View orders for your organisation"}
        </p>
      </div>

      <OrdersTable isAdmin={userIsAdmin} />
    </div>
  );
}
