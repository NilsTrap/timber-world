"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@timber/ui";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput } from "../types";
import { getAvailablePackages, getProductionInputs } from "../actions";
import { PackageSelector } from "./PackageSelector";
import { ProductionInputsTable } from "./ProductionInputsTable";

interface ProductionInputsSectionProps {
  productionEntryId: string;
  initialPackages: PackageListItem[];
  initialInputs: ProductionInput[];
}

/**
 * Production Inputs Section
 *
 * Client component wrapper for the inputs area on the production entry page.
 * Manages opening the package selector and refreshing inputs after changes.
 */
export function ProductionInputsSection({
  productionEntryId,
  initialPackages,
  initialInputs,
}: ProductionInputsSectionProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [packages, setPackages] = useState<PackageListItem[]>(initialPackages);
  const [inputs, setInputs] = useState<ProductionInput[]>(initialInputs);
  const [, startTransition] = useTransition();

  const refreshData = useCallback(() => {
    startTransition(async () => {
      const [pkgResult, inputResult] = await Promise.all([
        getAvailablePackages(productionEntryId),
        getProductionInputs(productionEntryId),
      ]);
      if (pkgResult.success) setPackages(pkgResult.data);
      if (inputResult.success) setInputs(inputResult.data);
    });
  }, [productionEntryId]);

  // Ctrl+I keyboard shortcut to open package selector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        setSelectorOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalVolumeM3 = inputs.reduce((sum, i) => sum + i.volumeM3, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inputs</h2>
          {inputs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Total: {totalVolumeM3.toFixed(3).replace(".", ",")} m³
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelectorOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Input
          <kbd className="ml-2 text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded border">Ctrl+I</kbd>
        </Button>
      </div>

      {inputs.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No inputs added yet. Click &quot;+ Add Input&quot; to select packages from inventory.
          </p>
        </div>
      ) : (
        <ProductionInputsTable
          inputs={inputs}
          onInputsChanged={refreshData}
        />
      )}

      <PackageSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        productionEntryId={productionEntryId}
        packages={packages}
        onInputAdded={refreshData}
      />
    </div>
  );
}
