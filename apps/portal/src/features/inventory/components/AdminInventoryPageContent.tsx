"use client";

import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";
import { AdminInventoryViewTab } from "./AdminInventoryViewTab";
import { EditablePackagesTab } from "./EditablePackagesTab";
import type { EditablePackageItem } from "@/features/shipments/types";

interface AdminInventoryPageContentProps {
  packages: EditablePackageItem[];
}

/**
 * Admin Inventory Page Content
 *
 * Two tabs:
 * - View: Read-only view of all packages (same as producer view but with org column)
 * - Edit: Full editing capabilities (add, edit, delete, import)
 */
export function AdminInventoryPageContent({ packages }: AdminInventoryPageContentProps) {
  return (
    <Tabs defaultValue="view">
      <TabsList>
        <TabsTrigger value="view">View</TabsTrigger>
        <TabsTrigger value="edit">Edit</TabsTrigger>
      </TabsList>

      <TabsContent value="view">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <AdminInventoryViewTab packages={packages} />
        </Suspense>
      </TabsContent>

      <TabsContent value="edit">
        <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
          <EditablePackagesTab packages={packages} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
