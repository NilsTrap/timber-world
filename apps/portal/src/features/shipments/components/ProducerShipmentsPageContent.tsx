"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProducerNewShipmentForm } from "./ProducerNewShipmentForm";
import { ProducerShipmentsTab } from "./ProducerShipmentsTab";
import type { OrganisationOption } from "../types";
import type { OrgShipmentListItem } from "../actions";

interface ProducerShipmentsPageContentProps {
  userOrganisation: OrganisationOption;
  shipments: OrgShipmentListItem[];
  defaultTab?: string;
}

function ProducerShipmentsPageContentInner({
  userOrganisation,
  shipments,
  defaultTab,
}: ProducerShipmentsPageContentProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    defaultTab || searchParams.get("tab") || "new"
  );

  // Sync activeTab when defaultTab changes (e.g., from navigation)
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const setTab = useCallback((tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shipments</h1>
        <p className="text-muted-foreground">Create and manage shipments for your organisation</p>
      </div>

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
          Shipments ({shipments.length})
        </button>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id={`panel-${activeTab}`}>
        {activeTab === "new" ? (
          <ProducerNewShipmentForm userOrganisation={userOrganisation} />
        ) : (
          <ProducerShipmentsTab shipments={shipments} />
        )}
      </div>
    </div>
  );
}

export function ProducerShipmentsPageContent(props: ProducerShipmentsPageContentProps) {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
      <ProducerShipmentsPageContentInner {...props} />
    </Suspense>
  );
}
