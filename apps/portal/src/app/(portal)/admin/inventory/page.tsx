import type { Metadata } from "next";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getEditablePackages } from "@/features/inventory/actions";
import { AdminInventoryPageContent } from "@/features/inventory/components";

export const metadata: Metadata = {
  title: "Inventory",
};

/**
 * Inventory Page (Admin)
 *
 * Two tabs:
 * - View: Read-only view of all packages (includes "on the way" packages)
 * - Edit: Full editing capabilities
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    org?: string;
    product?: string;
    species?: string;
    humidity?: string;
    type?: string;
    processing?: string;
    quality?: string;
  }>;
}) {
  const params = await searchParams;
  const { org: orgParam } = params;
  const session = await getSession();

  // Parse comma-separated org IDs for multi-select filter (Super Admin only)
  const orgFilter = isSuperAdmin(session) && orgParam
    ? orgParam.split(",").filter(Boolean)
    : undefined;

  const packagesResult = await getEditablePackages(orgFilter);
  const packages = packagesResult.success ? packagesResult.data : [];

  // Build initial filters from URL params
  const initialFilters: Record<string, string[]> = {};
  if (params.product) initialFilters.productName = [params.product];
  if (params.species) initialFilters.woodSpecies = [params.species];
  if (params.humidity) initialFilters.humidity = [params.humidity];
  if (params.type) initialFilters.typeName = [params.type];
  if (params.processing) initialFilters.processing = [params.processing];
  if (params.quality) initialFilters.quality = [params.quality];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          View and manage inventory packages
        </p>
      </div>

      <AdminInventoryPageContent
        packages={packages}
        initialFilters={Object.keys(initialFilters).length > 0 ? initialFilters : undefined}
      />
    </div>
  );
}
