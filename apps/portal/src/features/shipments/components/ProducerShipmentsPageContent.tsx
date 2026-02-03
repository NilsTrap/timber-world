"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@timber/ui";
import { NewShipmentDialog } from "./NewShipmentDialog";
import { ProducerShipmentsDraftsTable } from "./ProducerShipmentsDraftsTable";
import { ProducerShipmentsCompletedTable } from "./ProducerShipmentsCompletedTable";
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
    defaultTab || searchParams.get("tab") || "drafts"
  );
  const [showNewDialog, setShowNewDialog] = useState(false);

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

  // Split shipments into drafts and completed
  const { draftShipments, completedShipments } = useMemo(() => {
    const drafts: OrgShipmentListItem[] = [];
    const completed: OrgShipmentListItem[] = [];

    for (const shipment of shipments) {
      if (shipment.status === "draft") {
        drafts.push(shipment);
      } else {
        completed.push(shipment);
      }
    }

    return { draftShipments: drafts, completedShipments: completed };
  }, [shipments]);

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
          aria-selected={activeTab === "drafts"}
          aria-controls="panel-drafts"
          onClick={() => setTab("drafts")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "drafts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Drafts {draftShipments.length > 0 && `(${draftShipments.length})`}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "completed"}
          aria-controls="panel-completed"
          onClick={() => setTab("completed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Completed {completedShipments.length > 0 && `(${completedShipments.length})`}
        </button>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id={`panel-${activeTab}`}>
        {activeTab === "drafts" ? (
          <div className="space-y-6">
            {/* New Shipment Button */}
            <div className="flex justify-start">
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Shipment
              </Button>
            </div>

            {/* Draft Shipments List */}
            {draftShipments.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Draft Shipments</h3>
                <ProducerShipmentsDraftsTable shipments={draftShipments} />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                <p>No draft shipments</p>
                <p className="text-sm mt-1">Click "New Shipment" to create one</p>
              </div>
            )}
          </div>
        ) : (
          <ProducerShipmentsCompletedTable shipments={completedShipments} />
        )}
      </div>

      {/* New Shipment Dialog */}
      <NewShipmentDialog open={showNewDialog} onOpenChange={setShowNewDialog} />
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
