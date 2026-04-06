import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { OrdersPageClient } from "@/features/orders/components";

export const metadata = {
  title: "Orders | Timber World",
};

export default async function OrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session);
  const userOrgId = session.currentOrganizationId || session.organisationId || null;

  // For non-admin users, check if their organization has the orders module enabled
  if (!userIsAdmin) {
    const hasOrdersModule = await orgHasModule(userOrgId, "orders.view");
    if (!hasOrdersModule) {
      notFound();
    }
  }

  const userOrgName = session.currentOrganizationName || session.organisationName || null;

  // Determine if user can select a customer organisation for orders
  let canSelectCustomer = userIsAdmin;
  if (!userIsAdmin && userOrgId) {
    canSelectCustomer = await orgHasModule(userOrgId, "orders.customer-select");
  }

  // Determine which tabs the user can see (admins see all)
  const allTabs = ["list", "prices", "sales", "production", "analytics"] as const;
  let visibleTabs: string[];
  if (userIsAdmin) {
    visibleTabs = [...allTabs];
  } else {
    const tabChecks = await Promise.all(
      allTabs.map(async (tab) => ({
        tab,
        allowed: await orgHasModule(userOrgId, `orders.tab.${tab}`),
      }))
    );
    visibleTabs = tabChecks.filter((t) => t.allowed).map((t) => t.tab);
    // If no tabs explicitly enabled, default to list
    if (visibleTabs.length === 0) visibleTabs = ["list"];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          {userIsAdmin
            ? "Manage customer orders"
            : "View and create orders for your organisation"}
        </p>
      </div>

      <OrdersPageClient
        isAdmin={userIsAdmin}
        canSelectCustomer={canSelectCustomer}
        userOrganisationId={userOrgId}
        userOrganisationName={userOrgName}
        visibleTabs={visibleTabs}
      />
    </div>
  );
}
