import { getSession, isSuperAdmin } from "@/lib/auth";
import { InventoryOverview } from "@/features/shipments/components/InventoryOverview";
import { getShipments, getPackages } from "@/features/shipments/actions";

export default async function InventoryOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: selectedOrgId } = await searchParams;
  const session = await getSession();

  // Pass org filter to queries for Super Admin
  const orgFilter = isSuperAdmin(session) ? selectedOrgId : undefined;

  // TODO: Consider lazy-loading packages data only when Packages tab is active
  // to reduce initial page load queries (currently both tabs' data is fetched upfront)
  const [shipmentsResult, packagesResult] = await Promise.all([
    getShipments(orgFilter),
    getPackages(orgFilter),
  ]);

  const shipments = shipmentsResult.success ? shipmentsResult.data : [];
  const packages = packagesResult.success ? packagesResult.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <InventoryOverview
        shipments={shipments}
        packages={packages}
      />
    </div>
  );
}
