"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { OrgUserInventory } from "./OrgUserInventory";
import { AuditTab } from "./AuditTab";
import { ConsolidatedInventoryTable } from "@/features/dashboard/components/ConsolidatedInventoryTable";
import { getOrgUserConsolidatedInventory } from "@/features/dashboard/actions";
import { getAuditPackages } from "../actions/getAuditPackages";
import type { PackageListItem } from "../types";
import type { DraftPackageInfo } from "@/features/production/actions";
import type { ShipmentDraftPackageInfo } from "@/features/shipments/actions";
import type { ConsolidatedInventoryItem } from "@/features/dashboard/types";
import type { AuditPackageItem } from "../actions/getAuditPackages";

interface OrgUserInventoryPageContentProps {
  packages: PackageListItem[];
  packagesInDrafts: DraftPackageInfo[];
  packagesInShipmentDrafts: ShipmentDraftPackageInfo[];
  initialFilters?: Record<string, string[]>;
}

/**
 * Org User Inventory Page Content
 *
 * Inventory tab data is loaded on the server for instant display.
 * Consolidated and History tabs load on demand when clicked.
 */
export function OrgUserInventoryPageContent({
  packages,
  packagesInDrafts,
  packagesInShipmentDrafts,
  initialFilters,
}: OrgUserInventoryPageContentProps) {
  const [activeTab, setActiveTab] = usePersistedTab("inventory-tab", "inventory");

  // Lazy-loaded tab data
  const [consolidated, setConsolidated] = useState<ConsolidatedInventoryItem[] | null>(null);
  const [auditPackages, setAuditPackages] = useState<AuditPackageItem[] | null>(null);

  const loadTabData = useCallback(async (tab: string) => {
    if (tab === "consolidated" && consolidated === null) {
      const result = await getOrgUserConsolidatedInventory();
      setConsolidated(result.success ? result.data : []);
    } else if (tab === "audit" && auditPackages === null) {
      const result = await getAuditPackages();
      setAuditPackages(result.success ? result.data : []);
    }
  }, [consolidated, auditPackages]);

  // Load data for initial tab if not the default
  useEffect(() => {
    if (activeTab !== "inventory") {
      loadTabData(activeTab);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    loadTabData(value);
  };

  const TabLoading = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
        <TabsTrigger value="audit">History</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory">
        <OrgUserInventory
          packages={packages}
          packagesInDrafts={packagesInDrafts}
          packagesInShipmentDrafts={packagesInShipmentDrafts}
          initialFilters={initialFilters}
        />
      </TabsContent>

      <TabsContent value="consolidated">
        {consolidated === null ? (
          <TabLoading />
        ) : (
          <ConsolidatedInventoryTable data={consolidated} inventoryUrl="/inventory" />
        )}
      </TabsContent>

      <TabsContent value="audit">
        {auditPackages === null ? (
          <TabLoading />
        ) : (
          <AuditTab packages={auditPackages} showOrgColumn={false} />
        )}
      </TabsContent>
    </Tabs>
  );
}
