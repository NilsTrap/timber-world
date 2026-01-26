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
 * - Inventory: View and edit all packages (filtered by sidebar org selector)
 * - Add Inventory: Form to add inventory to organizations
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: selectedOrgId } = await searchParams;
  const session = await getSession();

  // Pass org filter to queries for Super Admin (from sidebar selector)
  const orgFilter = isSuperAdmin(session) ? selectedOrgId : undefined;

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
