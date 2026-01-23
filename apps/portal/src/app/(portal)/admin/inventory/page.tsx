import { InventoryOverview } from "@/features/shipments/components/InventoryOverview";
import { getShipments, getPackages, getReferenceDropdowns } from "@/features/shipments/actions";

export default async function InventoryOverviewPage() {
  const [shipmentsResult, packagesResult, dropdownsResult] = await Promise.all([
    getShipments(),
    getPackages(),
    getReferenceDropdowns(),
  ]);

  const shipments = shipmentsResult.success ? shipmentsResult.data : [];
  const packages = packagesResult.success ? packagesResult.data : [];
  const productNames = dropdownsResult.success ? dropdownsResult.data.productNames : [];
  const woodSpecies = dropdownsResult.success ? dropdownsResult.data.woodSpecies : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <InventoryOverview
        shipments={shipments}
        packages={packages}
        productNames={productNames}
        woodSpecies={woodSpecies}
      />
    </div>
  );
}
