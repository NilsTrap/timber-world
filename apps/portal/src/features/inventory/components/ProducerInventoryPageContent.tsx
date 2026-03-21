"use client";

import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { ProducerInventory } from "./ProducerInventory";
import { AuditTab } from "./AuditTab";
import { ConsolidatedInventoryTable } from "@/features/dashboard/components/ConsolidatedInventoryTable";
import type { PackageListItem } from "../types";
import type { DraftPackageInfo } from "@/features/production/actions";
import type { ShipmentDraftPackageInfo } from "@/features/shipments/actions";
import type { ConsolidatedInventoryItem } from "@/features/dashboard/types";
import type { AuditPackageItem } from "../actions/getAuditPackages";

interface ProducerInventoryPageContentProps {
  packages: PackageListItem[];
  packagesInDrafts: DraftPackageInfo[];
  packagesInShipmentDrafts: ShipmentDraftPackageInfo[];
  consolidated: ConsolidatedInventoryItem[];
  auditPackages?: AuditPackageItem[];
  initialFilters?: Record<string, string[]>;
}

/**
 * Producer Inventory Page Content
 *
 * Two tabs:
 * - Inventory: Full package list with filters
 * - Consolidated: Grouped view by product attributes
 */
export function ProducerInventoryPageContent({
  packages,
  packagesInDrafts,
  packagesInShipmentDrafts,
  consolidated,
  auditPackages = [],
  initialFilters,
}: ProducerInventoryPageContentProps) {
  const [activeTab, setActiveTab] = usePersistedTab("inventory-tab", "inventory");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <ProducerInventory
            packages={packages}
            packagesInDrafts={packagesInDrafts}
            packagesInShipmentDrafts={packagesInShipmentDrafts}
            initialFilters={initialFilters}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="consolidated">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <ConsolidatedInventoryTable data={consolidated} inventoryUrl="/inventory" />
        </Suspense>
      </TabsContent>

      <TabsContent value="audit">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <AuditTab packages={auditPackages} showOrgColumn={false} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
