import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import { OrdersPageClient } from "@/features/orders/components";
import type { SessionUser } from "@/lib/auth/getSession";
import { perfLog } from "@/lib/debug/perfLog";

export const metadata = {
  title: "Orders | Timber World",
};

function OrdersSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex gap-2 mb-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-muted/60 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

async function OrdersBody({ session }: { session: SessionUser }) {
  const userIsAdmin = isAdmin(session);
  const userOrgId = session.currentOrganizationId || session.organisationId || null;
  const userOrgName = session.currentOrganizationName || session.organisationName || null;

  // Determine visibility + permissions. All module lookups dedupe via
  // React.cache, so this Promise.all costs one query plus one round-trip.
  const allTabs = ["list", "prices", "sales", "production", "analytics"] as const;

  let canSelectCustomer = userIsAdmin;
  let visibleTabs: string[];

  if (userIsAdmin) {
    visibleTabs = [...allTabs];
  } else {
    const [customerSelect, ...tabChecks] = await perfLog(
      "orders.tab-permission-checks",
      () =>
        Promise.all([
          orgHasModule(userOrgId, "orders.customer-select"),
          ...allTabs.map((tab) => orgHasModule(userOrgId, `orders.tab.${tab}`)),
        ]),
    );
    canSelectCustomer = customerSelect;
    visibleTabs = allTabs.filter((_, i) => tabChecks[i]);
    if (visibleTabs.length === 0) visibleTabs = ["list"];
  }

  return (
    <OrdersPageClient
      isAdmin={userIsAdmin}
      canSelectCustomer={canSelectCustomer}
      userOrganisationId={userOrgId}
      userOrganisationName={userOrgName}
      visibleTabs={visibleTabs}
    />
  );
}

export default async function OrdersPage() {
  const session = await perfLog("orders.getSession", () => getSession());

  if (!session) redirect("/login");

  const userIsAdmin = isAdmin(session);
  const userOrgId = session.currentOrganizationId || session.organisationId || null;

  // Module gate runs before render so notFound() can trigger early.
  if (!userIsAdmin) {
    const hasOrdersModule = await perfLog("orders.orgHasModule", () =>
      orgHasModule(userOrgId, "orders.view"),
    );
    if (!hasOrdersModule) notFound();
  }

  // Header paints immediately; the rest streams in via Suspense.
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
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersBody session={session} />
      </Suspense>
    </div>
  );
}
