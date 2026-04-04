"use client";

import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { AdminInventoryViewTab } from "./AdminInventoryViewTab";
import { EditablePackagesTab } from "./EditablePackagesTab";
import { AuditTab } from "./AuditTab";
import { ConsolidatedInventoryTable } from "@/features/dashboard/components/ConsolidatedInventoryTable";
import type { EditablePackageItem } from "@/features/shipments/types";
import type { ConsolidatedInventoryItem } from "@/features/dashboard/types";
import type { AuditPackageItem } from "../actions/getAuditPackages";

interface AdminInventoryPageContentProps {
  packages: EditablePackageItem[];
  consolidated: ConsolidatedInventoryItem[];
  auditPackages?: AuditPackageItem[];
  /** Initial filter values from URL params */
  initialFilters?: Record<string, string[]>;
  /** Default org ID for new packages (when filtered by single org) */
  defaultOrgId?: string;
}

/**
 * Admin Inventory Page Content
 *
 * Three tabs:
 * - Inventory: Read-only view of all packages (same as producer view but with org column)
 * - Consolidated: Grouped view by product attributes
 * - Edit: Full editing capabilities (add, edit, delete, import)
 */
export function AdminInventoryPageContent({ packages, consolidated, auditPackages = [], initialFilters, defaultOrgId }: AdminInventoryPageContentProps) {
  const [activeTab, setActiveTab] = usePersistedTab("admin-inventory-tab", "inventory");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="consolidated">Consolidated</TabsTrigger>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="audit">History</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <AdminInventoryViewTab packages={packages} initialFilters={initialFilters} />
        </Suspense>
      </TabsContent>

      <TabsContent value="consolidated">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <ConsolidatedInventoryTable data={consolidated} inventoryUrl="/admin/inventory" />
        </Suspense>
      </TabsContent>

      <TabsContent value="edit">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <EditablePackagesTab packages={packages} defaultOrgId={defaultOrgId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="audit">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <AuditTab packages={auditPackages} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
