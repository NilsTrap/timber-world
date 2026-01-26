import type { Metadata } from "next";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getShipments } from "@/features/shipments/actions";
import { ShipmentsPageContent } from "@/features/shipments/components/ShipmentsPageContent";

export const metadata: Metadata = {
  title: "Shipments",
};

/**
 * Shipments Management Page (Admin)
 *
 * Two tabs:
 * - New Shipment: Form to create a new shipment
 * - Shipments: List of all shipments with sort/filter
 */
export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; org?: string }>;
}) {
  const { tab, org: selectedOrgId } = await searchParams;
  const session = await getSession();

  // Pass org filter to queries for Super Admin
  const orgFilter = isSuperAdmin(session) ? selectedOrgId : undefined;

  const shipmentsResult = await getShipments(orgFilter);
  const shipments = shipmentsResult.success ? shipmentsResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shipments</h1>
        <p className="text-muted-foreground">
          Create and manage inventory shipments
        </p>
      </div>

      <ShipmentsPageContent
        shipments={shipments}
        defaultTab={tab}
        canDelete={isSuperAdmin(session)}
      />
    </div>
  );
}
