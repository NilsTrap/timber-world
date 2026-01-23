import { InventoryOverview } from "@/features/shipments/components/InventoryOverview";
import { getShipments, getPackages } from "@/features/shipments/actions";

export default async function InventoryOverviewPage() {
  // TODO: Consider lazy-loading packages data only when Packages tab is active
  // to reduce initial page load queries (currently both tabs' data is fetched upfront)
  const [shipmentsResult, packagesResult] = await Promise.all([
    getShipments(),
    getPackages(),
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
