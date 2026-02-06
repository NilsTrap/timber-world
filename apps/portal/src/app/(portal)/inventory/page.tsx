import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getSession, isAdmin } from "@/lib/auth";
import { getProducerPackages } from "@/features/inventory/actions";
import { getPackagesInDrafts } from "@/features/production/actions";
import { getPackagesInShipmentDrafts } from "@/features/shipments/actions";
import { ProducerInventory } from "@/features/inventory/components/ProducerInventory";

export const metadata: Metadata = {
  title: "Inventory",
};

/**
 * Inventory Page
 *
 * Shows inventory based on user role:
 * - Admin: Redirects to /admin/inventory (full management view)
 * - Producer: Read-only view of facility inventory (Epic 3)
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export default async function InventoryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (isAdmin(session)) {
    redirect("/admin/inventory");
  }

  // Producer flow
  const [result, draftsResult, shipmentDraftsResult] = await Promise.all([
    getProducerPackages(),
    getPackagesInDrafts(),
    getPackagesInShipmentDrafts(),
  ]);

  if (!result.success) {
    // Handle error state (e.g., producer not linked to facility)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            View current inventory at your facility
          </p>
        </div>

        <div className="rounded-lg border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              Unable to load inventory
            </h2>
            <p className="text-muted-foreground max-w-md">
              {result.error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const packages = result.data;

  // Empty state
  if (packages.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            View current inventory at your facility
          </p>
        </div>

        <div className="rounded-lg border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No inventory available</h2>
            <p className="text-muted-foreground max-w-md">
              Contact Admin to record incoming shipments
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          View current inventory at your facility
        </p>
      </div>

      <ProducerInventory
        packages={packages}
        packagesInDrafts={draftsResult.success ? draftsResult.data : []}
        packagesInShipmentDrafts={shipmentDraftsResult.success ? shipmentDraftsResult.data : []}
      />
    </div>
  );
}
