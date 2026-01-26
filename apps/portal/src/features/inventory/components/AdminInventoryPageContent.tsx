"use client";

import { Suspense } from "react";
import { EditablePackagesTab } from "./EditablePackagesTab";
import type { EditablePackageItem } from "@/features/shipments/types";

interface AdminInventoryPageContentProps {
  packages: EditablePackageItem[];
}

export function AdminInventoryPageContent({ packages }: AdminInventoryPageContentProps) {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
      <EditablePackagesTab packages={packages} />
    </Suspense>
  );
}
