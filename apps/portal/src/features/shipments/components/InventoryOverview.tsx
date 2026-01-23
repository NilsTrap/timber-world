"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShipmentsTab } from "./ShipmentsTab";
import { PackagesTab } from "./PackagesTab";
import type { ShipmentListItem, PackageListItem } from "../types";

interface InventoryOverviewProps {
  shipments: ShipmentListItem[];
  packages: PackageListItem[];
}

function InventoryOverviewInner({
  shipments,
  packages,
}: InventoryOverviewProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "inventory"
  );

  const setTab = useCallback((tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b" role="tablist" aria-label="Inventory views">
        <button
          role="tab"
          aria-selected={activeTab === "inventory"}
          aria-controls="panel-inventory"
          onClick={() => setTab("inventory")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "inventory"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Inventory
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "shipments"}
          aria-controls="panel-shipments"
          onClick={() => setTab("shipments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "shipments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Shipments
        </button>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id={`panel-${activeTab}`}>
        {activeTab === "inventory" ? (
          <PackagesTab packages={packages} />
        ) : (
          <ShipmentsTab shipments={shipments} />
        )}
      </div>
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
