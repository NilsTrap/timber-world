"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@timber/ui";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput, ProductionOutput, ReferenceDropdowns } from "../types";
import { validateProduction } from "../actions";
import { ProductionInputsSection } from "./ProductionInputsSection";
import { ProductionOutputsSection } from "./ProductionOutputsSection";
import { ProductionSummary } from "./ProductionSummary";
import { ValidateProductionDialog } from "./ValidateProductionDialog";

interface ProductionEntryClientProps {
  productionEntryId: string;
  initialPackages: PackageListItem[];
  initialInputs: ProductionInput[];
  initialOutputs: ProductionOutput[];
  dropdowns: ReferenceDropdowns;
  processCode: string;
  initialInputTotal: number;
  initialOutputTotal: number;
  readOnly?: boolean;
  hideMetrics?: boolean;
  /** Process name for print header */
  processName?: string;
  /** Production date (formatted) for print header */
  productionDate?: string;
}

/**
 * Production Entry Client Wrapper
 *
 * Coordinates volume totals between InputsSection, OutputsSection,
 * and ProductionSummary for live calculation updates.
 * Also handles the Validate & Commit flow.
 */
export function ProductionEntryClient({
  productionEntryId,
  initialPackages,
  initialInputs,
  initialOutputs,
  dropdowns,
  processCode,
  initialInputTotal,
  initialOutputTotal,
  readOnly,
  hideMetrics,
  processName,
  productionDate,
}: ProductionEntryClientProps) {
  const router = useRouter();
  const [inputTotalM3, setInputTotalM3] = useState(initialInputTotal);
  const [outputTotalM3, setOutputTotalM3] = useState(initialOutputTotal);
  const [currentInputs, setCurrentInputs] = useState(initialInputs);
  const [inputCount, setInputCount] = useState(initialInputs.length);
  const [outputCount, setOutputCount] = useState(initialOutputs.length);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canValidate = !readOnly && inputTotalM3 > 0 && outputTotalM3 > 0;

  // Ctrl+Enter keyboard shortcut to open validation dialog
  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canValidate) {
        e.preventDefault();
        setDialogOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canValidate, readOnly]);

  const handleConfirmValidation = () => {
    startTransition(async () => {
      const result = await validateProduction(productionEntryId);
      if (result.success) {
        toast.success("Production validated successfully");
        router.push(result.data.redirectUrl);
      } else {
        toast.error(result.error);
        setDialogOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {!hideMetrics && (
        <ProductionSummary
          inputTotalM3={inputTotalM3}
          outputTotalM3={outputTotalM3}
        />
      )}

      <ProductionInputsSection
        productionEntryId={productionEntryId}
        initialPackages={initialPackages}
        initialInputs={initialInputs}
        onTotalChange={setInputTotalM3}
        onCountChange={setInputCount}
        onInputsChange={setCurrentInputs}
        readOnly={readOnly}
        processName={processName}
        productionDate={productionDate}
      />

      <ProductionOutputsSection
        productionEntryId={productionEntryId}
        initialOutputs={initialOutputs}
        dropdowns={dropdowns}
        inputs={currentInputs}
        processCode={processCode}
        onTotalChange={setOutputTotalM3}
        onCountChange={setOutputCount}
        readOnly={readOnly}
      />

      {/* Validate Button — only for draft entries */}
      {!readOnly && (
        <>
          <div className="flex justify-end">
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={!canValidate}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validate
              <kbd className="ml-2 text-[10px] text-primary-foreground/70 bg-primary-foreground/20 px-1 py-0.5 rounded border border-primary-foreground/30">Ctrl+Enter</kbd>
            </Button>
          </div>

          <ValidateProductionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            inputTotalM3={inputTotalM3}
            outputTotalM3={outputTotalM3}
            inputCount={inputCount}
            outputCount={outputCount}
            onConfirm={handleConfirmValidation}
            isPending={isPending}
          />
        </>
      )}
    </div>
  );
}
