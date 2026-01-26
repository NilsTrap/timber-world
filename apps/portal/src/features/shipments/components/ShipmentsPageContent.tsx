"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NewShipmentForm } from "./NewShipmentForm";
import { ShipmentsTab } from "./ShipmentsTab";
import type { ShipmentListItem } from "../types";

interface ShipmentsPageContentProps {
  shipments: ShipmentListItem[];
  defaultTab?: string;
  /** If true, shows delete button for shipments (Super Admin only) */
  canDelete?: boolean;
}

function ShipmentsPageContentInner({
  shipments,
  defaultTab,
  canDelete = false,
}: ShipmentsPageContentProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    defaultTab || searchParams.get("tab") || "new"
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
      <div className="flex gap-1 border-b" role="tablist" aria-label="Shipment views">
        <button
          role="tab"
          aria-selected={activeTab === "new"}
          aria-controls="panel-new"
          onClick={() => setTab("new")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "new"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          New Shipment
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "list"}
          aria-controls="panel-list"
          onClick={() => setTab("list")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "list"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Shipments
        </button>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id={`panel-${activeTab}`}>
        {activeTab === "new" ? (
          <NewShipmentForm />
        ) : (
          <ShipmentsTab shipments={shipments} canDelete={canDelete} />
        )}
      </div>
    </div>
  );
}

export function ShipmentsPageContent(props: ShipmentsPageContentProps) {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
      <ShipmentsPageContentInner {...props} />
    </Suspense>
  );
}
