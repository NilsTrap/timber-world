import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { Package } from "lucide-react";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getOrgUserPackages } from "@/features/inventory/actions";
import { getPackagesInDrafts } from "@/features/production/actions";
import { getPackagesInShipmentDrafts } from "@/features/shipments/actions";
import { OrgUserInventoryPageContent } from "@/features/inventory/components/OrgUserInventoryPageContent";

type InventoryParams = {
  product?: string;
  species?: string;
  humidity?: string;
  type?: string;
  processing?: string;
  quality?: string;
};

function InventoryHeader() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
      <p className="text-muted-foreground">View current inventory at your facility</p>
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="h-4 w-32 bg-muted rounded mb-4 animate-pulse" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-muted/60 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

async function InventoryData({ params }: { params: InventoryParams }) {
  const [result, draftsResult, shipmentDraftsResult] = await Promise.all([
    getOrgUserPackages(),
    getPackagesInDrafts(),
    getPackagesInShipmentDrafts(),
  ]);

  if (!result.success) {
    return (
      <div className="rounded-lg border bg-card p-12 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Unable to load inventory</h2>
          <p className="text-muted-foreground max-w-md">{result.error}</p>
        </div>
      </div>
    );
  }

  if (result.data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No inventory available</h2>
          <p className="text-muted-foreground max-w-md">
            Contact Admin to record incoming shipments
          </p>
        </div>
      </div>
    );
  }

  const initialFilters: Record<string, string[]> = {};
  if (params.product) initialFilters.productName = [params.product];
  if (params.species) initialFilters.woodSpecies = [params.species];
  if (params.humidity) initialFilters.humidity = [params.humidity];
  if (params.type) initialFilters.typeName = [params.type];
  if (params.processing) initialFilters.processing = [params.processing];
  if (params.quality) initialFilters.quality = [params.quality];

  return (
    <OrgUserInventoryPageContent
      packages={result.data}
      packagesInDrafts={draftsResult.success ? draftsResult.data : []}
      packagesInShipmentDrafts={shipmentDraftsResult.success ? shipmentDraftsResult.data : []}
      initialFilters={Object.keys(initialFilters).length > 0 ? initialFilters : undefined}
    />
  );
}

export const metadata: Metadata = {
  title: "Inventory",
};

// Disable caching to always show fresh inventory when navigating back
export const dynamic = "force-dynamic";

/**
 * Inventory Page
 *
 * Shows inventory based on user role:
 * - Admin: Redirects to /admin/inventory (full management view)
 * - Org User: Read-only view of facility inventory (Epic 3)
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventoryParams>;
}) {
  const params = await searchParams;
  const session = await getSession();

  if (!session) redirect("/login");
  if (isAdmin(session)) redirect("/admin/inventory");

  // Module gate must run before render so notFound() can trigger.
  // Non-admin only (admins redirected to /admin/inventory above); org∩user check.
  const orgId = session.currentOrganizationId || session.organisationId;
  const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
  if (!mods.has("inventory.view")) notFound();

  // Header paints immediately; package data streams in via Suspense.
  return (
    <div className="space-y-6">
      <InventoryHeader />
      <Suspense fallback={<InventorySkeleton />}>
        <InventoryData params={params} />
      </Suspense>
    </div>
  );
}
