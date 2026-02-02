"use client";

import { useState, useCallback, useMemo, useTransition, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@timber/ui";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput } from "../types";
import { getAvailablePackages, getProductionInputs, getPackagesInDrafts } from "../actions";
import type { DraftPackageInfo } from "../actions";
import { PackageSelector } from "./PackageSelector";
import { ProductionInputsTable, type ProductionInputsTableHandle } from "./ProductionInputsTable";
import { PrintInputsButton } from "./PrintInputsButton";

interface ProductionInputsSectionProps {
  productionEntryId: string;
  initialPackages: PackageListItem[];
  initialInputs: ProductionInput[];
  onTotalChange?: (totalM3: number) => void;
  onCountChange?: (count: number) => void;
  onInputsChange?: (inputs: ProductionInput[]) => void;
  readOnly?: boolean;
  /** True when admin is editing a validated entry */
  isAdminEdit?: boolean;
  /** Process name for print header */
  processName?: string;
  /** Production date for print header (formatted) */
  productionDate?: string;
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
  onTotalChange,
  onCountChange,
  onInputsChange,
  readOnly,
  isAdminEdit,
  processName,
  productionDate,
}: ProductionInputsSectionProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [packages, setPackages] = useState<PackageListItem[]>(initialPackages);
  const [inputs, setInputs] = useState<ProductionInput[]>(initialInputs);
  const [packagesInDrafts, setPackagesInDrafts] = useState<DraftPackageInfo[]>([]);
  const [, startTransition] = useTransition();
  const [inputsFilterActive, setInputsFilterActive] = useState(false);
  const tableRef = useRef<ProductionInputsTableHandle>(null);

  const refreshData = useCallback(() => {
    startTransition(async () => {
      const [pkgResult, inputResult, draftsResult] = await Promise.all([
        getAvailablePackages(productionEntryId),
        getProductionInputs(productionEntryId),
        getPackagesInDrafts(),
      ]);
      if (pkgResult.success) setPackages(pkgResult.data);
      if (inputResult.success) setInputs(inputResult.data);
      if (draftsResult.success) {
        // Filter out packages from the current draft
        setPackagesInDrafts(draftsResult.data.filter(d => d.draftId !== productionEntryId));
      }
    });
  }, [productionEntryId]);

  // Initial fetch of packages in drafts
  useEffect(() => {
    startTransition(async () => {
      const draftsResult = await getPackagesInDrafts();
      if (draftsResult.success) {
        setPackagesInDrafts(draftsResult.data.filter(d => d.draftId !== productionEntryId));
      }
    });
  }, [productionEntryId]);

  // Ctrl+I keyboard shortcut to open package selector
  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        setSelectorOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [readOnly]);

  const totalVolumeM3 = useMemo(() => inputs.reduce((sum, i) => sum + i.volumeM3, 0), [inputs]);

  useEffect(() => {
    onTotalChange?.(totalVolumeM3);
  }, [totalVolumeM3, onTotalChange]);

  useEffect(() => {
    onCountChange?.(inputs.length);
  }, [inputs.length, onCountChange]);

  useEffect(() => {
    onInputsChange?.(inputs);
  }, [inputs, onInputsChange]);

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
        <div className="flex items-center gap-2">
          {inputsFilterActive && (
            <Button variant="ghost" size="sm" onClick={() => tableRef.current?.clearFilters()} className="text-xs h-7">
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
          <PrintInputsButton
            inputs={inputs}
            processName={processName}
            productionDate={productionDate}
          />
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setSelectorOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Input
              <kbd className="ml-2 text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded border">Ctrl+I</kbd>
            </Button>
          )}
        </div>
      </div>

      {inputs.length === 0 ? (
        <div
          className={`rounded-lg border bg-card p-6 text-center ${!readOnly ? "cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors" : ""}`}
          onClick={!readOnly ? () => setSelectorOpen(true) : undefined}
        >
          <p className="text-sm text-muted-foreground">
            {readOnly ? "No inputs were used in this production." : "No inputs added yet. Click here to select packages from inventory."}
          </p>
        </div>
      ) : (
        <ProductionInputsTable
          ref={tableRef}
          inputs={inputs}
          onInputsChanged={refreshData}
          onFilterActiveChange={setInputsFilterActive}
          readOnly={readOnly}
        />
      )}

      {!readOnly && (
        <PackageSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          productionEntryId={productionEntryId}
          packages={packages}
          packagesInDrafts={packagesInDrafts}
          onInputAdded={refreshData}
        />
      )}
    </div>
  );
}
