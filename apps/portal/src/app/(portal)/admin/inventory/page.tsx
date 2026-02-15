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
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: orgParam } = await searchParams;
  const session = await getSession();

  // Parse comma-separated org IDs for multi-select filter (Super Admin only)
  const orgFilter = isSuperAdmin(session) && orgParam
    ? orgParam.split(",").filter(Boolean)
    : undefined;

  const packagesResult = await getEditablePackages(orgFilter);
  const packages = packagesResult.success ? packagesResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          View and manage inventory packages
        </p>
      </div>

      <AdminInventoryPageContent packages={packages} />
    </div>
  );
}
