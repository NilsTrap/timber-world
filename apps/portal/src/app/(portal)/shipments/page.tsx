import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getUserOrganisation, getAllOrgShipments, getActiveOrganisations } from "@/features/shipments/actions";
import { getAllPendingShipmentCount } from "@/features/shipments/actions/getAllShipments";
import { ProducerShipmentsPageContent, AllShipmentsTab } from "@/features/shipments/components";

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { tab } = await searchParams;
  const isSuperAdminUser = isSuperAdmin(session);
  const isOrgUser = !!session.organisationId;

  // Super Admin without org context - show the All Shipments admin view
  if (isSuperAdminUser && !isOrgUser) {
    const [orgsResult, pendingResult] = await Promise.all([
      getActiveOrganisations(),
      getAllPendingShipmentCount(),
    ]);

    const organizations = orgsResult.success ? orgsResult.data : [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">All Shipments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and monitor shipments across all organizations
            </p>
          </div>
        </div>

        <AllShipmentsTab organizations={organizations} />
      </div>
    );
  }

  // Organisation user - show the producer shipments page
  if (!isOrgUser) {
    redirect("/dashboard");
  }

  // Fetch user's organisation and shipments in parallel
  const [userOrgResult, shipmentsResult] = await Promise.all([
    getUserOrganisation(),
    getAllOrgShipments(),
  ]);

  if (!userOrgResult.success || !userOrgResult.data) {
    redirect("/dashboard");
  }

  const shipments = shipmentsResult.success ? shipmentsResult.data : [];

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProducerShipmentsPageContent
        userOrganisation={userOrgResult.data}
        shipments={shipments}
        defaultTab={tab}
      />
    </Suspense>
  );
}
