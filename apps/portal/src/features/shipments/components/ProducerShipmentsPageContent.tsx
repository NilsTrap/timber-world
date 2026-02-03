"use client";

import { useMemo, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { StartShipmentForm } from "./StartShipmentForm";
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

      <Tabs defaultValue={defaultTab === "completed" ? "completed" : "drafts"}>
        <TabsList>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          <div className="space-y-6">
            {/* New Shipment Form */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">New Shipment</h2>
              <StartShipmentForm />
            </div>

            {/* Draft Shipments List */}
            {draftShipments.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Shipment Entries</h2>
                <ProducerShipmentsDraftsTable shipments={draftShipments} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <ProducerShipmentsCompletedTable shipments={completedShipments} />
        </TabsContent>
      </Tabs>
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
