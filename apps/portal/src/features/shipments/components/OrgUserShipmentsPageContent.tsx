"use client";

import { useMemo, Suspense, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { StartShipmentForm } from "./StartShipmentForm";
import { StartIncomingShipmentForm } from "./StartIncomingShipmentForm";
import { OrgUserShipmentsDraftsTable } from "./OrgUserShipmentsDraftsTable";
import { OrgUserShipmentsCompletedTable } from "./OrgUserShipmentsCompletedTable";
import { getExternalTradingPartners } from "../actions";
import type { OrganisationOption } from "../types";
import type { OrgShipmentListItem } from "../actions";

interface OrgUserShipmentsPageContentProps {
  userOrganisation: OrganisationOption;
  shipments: OrgShipmentListItem[];
  defaultTab?: string;
}

function OrgUserShipmentsPageContentInner({
  userOrganisation,
  shipments,
  defaultTab,
}: OrgUserShipmentsPageContentProps) {
  const [hasExternalPartners, setHasExternalPartners] = useState<boolean | null>(null);

  // Check if there are external partners available
  useEffect(() => {
    getExternalTradingPartners().then((result) => {
      if (result.success) {
        setHasExternalPartners(result.data.length > 0);
      } else {
        setHasExternalPartners(false);
      }
    });
  }, []);

  // Split shipments into drafts, incoming completed, and outgoing completed
  const { draftShipments, incomingCompleted, outgoingCompleted } = useMemo(() => {
    const drafts: OrgShipmentListItem[] = [];
    const incoming: OrgShipmentListItem[] = [];
    const outgoing: OrgShipmentListItem[] = [];

    for (const shipment of shipments) {
      if (shipment.status === "draft") {
        drafts.push(shipment);
      } else if (shipment.direction === "incoming") {
        incoming.push(shipment);
      } else {
        outgoing.push(shipment);
      }
    }

    return {
      draftShipments: drafts,
      incomingCompleted: incoming,
      outgoingCompleted: outgoing,
    };
  }, [shipments]);

  const [activeTab, setActiveTab] = usePersistedTab("shipments-tab", "drafts", defaultTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shipments</h1>
        <p className="text-muted-foreground">Create and manage shipments for your organisation</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="drafts">
            Drafts {draftShipments.length > 0 && `(${draftShipments.length})`}
          </TabsTrigger>
          <TabsTrigger value="in">
            In {incomingCompleted.length > 0 && `(${incomingCompleted.length})`}
          </TabsTrigger>
          <TabsTrigger value="out">
            Out {outgoingCompleted.length > 0 && `(${outgoingCompleted.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          <div className="space-y-6">
            {/* New Shipment Forms */}
            <div className={hasExternalPartners ? "grid md:grid-cols-2 gap-6" : ""}>
              {/* Incoming Shipment Form - only show if external partners exist */}
              {hasExternalPartners && (
                <div className="rounded-lg border bg-card p-6 shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">New In</h2>
                  <StartIncomingShipmentForm />
                </div>
              )}

              {/* Outgoing Shipment Form */}
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">New Out</h2>
                <StartShipmentForm />
              </div>
            </div>

            {/* Draft Shipments List */}
            {draftShipments.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Shipment Drafts</h2>
                <OrgUserShipmentsDraftsTable shipments={draftShipments} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="in">
          {incomingCompleted.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No completed shipments yet
            </div>
          ) : (
            <OrgUserShipmentsCompletedTable shipments={incomingCompleted} />
          )}
        </TabsContent>

        <TabsContent value="out">
          {outgoingCompleted.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No completed shipments yet
            </div>
          ) : (
            <OrgUserShipmentsCompletedTable shipments={outgoingCompleted} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function OrgUserShipmentsPageContent(props: OrgUserShipmentsPageContentProps) {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
      <OrgUserShipmentsPageContentInner {...props} />
    </Suspense>
  );
}
