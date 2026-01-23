"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ShipmentsTab } from "./ShipmentsTab";
import { PackagesTab } from "./PackagesTab";
import type { ShipmentListItem, PackageListItem, ReferenceOption } from "../types";

interface InventoryOverviewProps {
  shipments: ShipmentListItem[];
  packages: PackageListItem[];
  productNames: ReferenceOption[];
  woodSpecies: ReferenceOption[];
}

function InventoryOverviewInner({
  shipments,
  packages,
  productNames,
  woodSpecies,
}: InventoryOverviewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "shipments";

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("shipments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "shipments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Shipments
        </button>
        <button
          onClick={() => setTab("packages")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "packages"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Packages
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "shipments" ? (
        <ShipmentsTab shipments={shipments} />
      ) : (
        <PackagesTab
          packages={packages}
          productNames={productNames}
          woodSpecies={woodSpecies}
        />
      )}
    </div>
  );
}

export function InventoryOverview(props: InventoryOverviewProps) {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
      <InventoryOverviewInner {...props} />
    </Suspense>
  );
}
