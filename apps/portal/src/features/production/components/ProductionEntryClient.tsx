"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@timber/ui";
import type { PackageListItem } from "@/features/shipments/types";
import type { ProductionInput, ProductionOutput, ReferenceDropdowns, WorkFormula } from "../types";
import { validateProduction, restoreProductionSnapshot } from "../actions";
import { ProductionInputsSection } from "./ProductionInputsSection";
import { ProductionOutputsSection } from "./ProductionOutputsSection";
import { ProductionSummary } from "./ProductionSummary";
import { ValidateProductionDialog } from "./ValidateProductionDialog";
import { WorkAmountsSection } from "./WorkAmountsSection";

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
  /** True when admin is editing a validated entry */
  isAdminEdit?: boolean;
  hideMetrics?: boolean;
  /** Process name for print header */
  processName?: string;
  /** Production date (formatted) for print header */
  productionDate?: string;
  /** Work unit for the process (m, m², m³, pkg, h) */
  workUnit?: string | null;
  /** Work formula for auto-calculating planned work */
  workFormula?: WorkFormula;
  /** Initial planned work amount */
  initialPlannedWork?: number | null;
  /** Initial actual work amount */
  initialActualWork?: number | null;
  /** Package numbers that are used in other processes (read-only in edit mode) */
  usedPackageNumbers?: string[];
}

/**
 * Production Entry Client Wrapper
 *
 * Coordinates volume totals between InputsSection, OutputsSection,
 * and ProductionSummary for live calculation updates.
 * Also handles the Validate & Commit flow.
 *
 * In edit mode (isAdminEdit), changes are saved immediately (like drafts),
 * but Cancel restores the original state.
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
  isAdminEdit,
  hideMetrics,
  processName,
  productionDate,
  workUnit,
  workFormula,
  initialPlannedWork,
  initialActualWork,
  usedPackageNumbers = [],
}: ProductionEntryClientProps) {
  const router = useRouter();
  const [inputTotalM3, setInputTotalM3] = useState(initialInputTotal);
  const [outputTotalM3, setOutputTotalM3] = useState(initialOutputTotal);
  const [currentInputs, setCurrentInputs] = useState(initialInputs);
  const [inputCount, setInputCount] = useState(initialInputs.length);
  const [outputCount, setOutputCount] = useState(initialOutputs.length);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currentPlannedWork, setCurrentPlannedWork] = useState<number | null>(initialPlannedWork ?? null);
  const [currentActualWork, setCurrentActualWork] = useState<number | null>(initialActualWork ?? null);

  // Track if validation was successful (to avoid restore on unmount after successful validation)
  const validationSucceededRef = useRef(false);

  // Mark that we're on a draft page (for refreshing list when navigating back)
  useEffect(() => {
    sessionStorage.setItem("production-was-on-draft", "true");
  }, []);

  // Store snapshot of original state for restore on cancel (edit mode only)
  const snapshotRef = useRef<{
    inputs: { id: string; packageId: string; piecesUsed: number | null; volumeM3: number }[];
    outputs: {
      id: string;
      packageNumber: string | null;
      productNameId: string | null;
      woodSpeciesId: string | null;
      humidityId: string | null;
      typeId: string | null;
      processingId: string | null;
      fscId: string | null;
      qualityId: string | null;
      thickness: string | null;
      width: string | null;
      length: string | null;
      pieces: string | null;
      volumeM3: number;
      notes: string | null;
      sortOrder: number;
    }[];
  } | null>(null);

  // Create snapshot on mount (edit mode only)
  useEffect(() => {
    if (isAdminEdit && !snapshotRef.current) {
      snapshotRef.current = {
        inputs: initialInputs.map((i) => ({
          id: i.id,
          packageId: i.packageId,
          piecesUsed: i.piecesUsed,
          volumeM3: i.volumeM3,
        })),
        outputs: initialOutputs.map((o, idx) => ({
          id: o.id,
          packageNumber: o.packageNumber,
          productNameId: o.productNameId,
          woodSpeciesId: o.woodSpeciesId,
          humidityId: o.humidityId,
          typeId: o.typeId,
          processingId: o.processingId,
          fscId: o.fscId,
          qualityId: o.qualityId,
          thickness: o.thickness,
          width: o.width,
          length: o.length,
          pieces: o.pieces,
          volumeM3: o.volumeM3 ?? 0,
          notes: o.notes,
          sortOrder: idx,
        })),
      };
    }
  }, [isAdminEdit, initialInputs, initialOutputs]);

  // Restore snapshot on unmount if in edit mode and validation didn't succeed
  useEffect(() => {
    if (!isAdminEdit) return;

    return () => {
      if (!validationSucceededRef.current && snapshotRef.current) {
        // Fire-and-forget restore - we can't await in cleanup
        restoreProductionSnapshot({
          productionEntryId,
          originalInputs: snapshotRef.current.inputs,
          originalOutputs: snapshotRef.current.outputs,
        }).catch((err) => {
          console.error("Failed to restore snapshot on unmount:", err);
        });
      }
    };
  }, [isAdminEdit, productionEntryId]);

  const canValidate = !readOnly && inputTotalM3 > 0 && outputTotalM3 > 0;

  // Ctrl+Enter keyboard shortcut to open validation dialog (only for drafts, not admin edit)
  useEffect(() => {
    if (readOnly || isAdminEdit) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canValidate) {
        e.preventDefault();
        setDialogOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canValidate, readOnly, isAdminEdit]);

  const handleConfirmValidation = () => {
    startTransition(async () => {
      const result = await validateProduction(productionEntryId);
      if (result.success) {
        validationSucceededRef.current = true;
        toast.success("Production validated successfully");
        router.push(result.data.redirectUrl);
      } else {
        toast.error(result.error);
        setDialogOpen(false);
      }
    });
  };

  const handleCancelEdit = useCallback(() => {
    if (!snapshotRef.current) {
      router.push(`/production/${productionEntryId}`);
      return;
    }

    startTransition(async () => {
      const result = await restoreProductionSnapshot({
        productionEntryId,
        originalInputs: snapshotRef.current!.inputs,
        originalOutputs: snapshotRef.current!.outputs,
      });

      if (result.success) {
        validationSucceededRef.current = true; // Prevent unmount restore
        toast.success("Changes discarded");
        router.push(`/production/${productionEntryId}`);
      } else {
        toast.error(result.error);
      }
    });
  }, [productionEntryId, router]);

  const handleWorkAmountsChange = useCallback((plannedWork: number | null, actualWork: number | null) => {
    setCurrentPlannedWork(plannedWork);
    setCurrentActualWork(actualWork);
  }, []);

  return (
    <div className="space-y-6">
      {isAdminEdit && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          <strong>Edit Mode:</strong> Changes are saved as you make them. Click &quot;Validate&quot; to commit, or &quot;Cancel&quot; to discard all changes.
        </div>
      )}

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
        isAdminEdit={isAdminEdit}
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
        isAdminEdit={isAdminEdit}
        processName={processName}
        productionDate={productionDate}
        usedPackageNumbers={usedPackageNumbers}
      />

      <WorkAmountsSection
        productionEntryId={productionEntryId}
        workUnit={workUnit ?? null}
        workFormula={workFormula ?? null}
        inputs={currentInputs}
        outputCount={outputCount}
        initialPlannedWork={initialPlannedWork ?? null}
        initialActualWork={initialActualWork ?? null}
        readOnly={readOnly}
        onWorkAmountsChange={handleWorkAmountsChange}
      />

      {/* Validate/Cancel Buttons — for draft entries and admin edit mode */}
      {!readOnly && (
        <>
          <div className="flex justify-end gap-3">
            {isAdminEdit && (
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={!canValidate || isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validate
              {!isAdminEdit && (
                <kbd className="ml-2 text-[10px] text-primary-foreground/70 bg-primary-foreground/20 px-1 py-0.5 rounded border border-primary-foreground/30">Ctrl+Enter</kbd>
              )}
            </Button>
          </div>

          <ValidateProductionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            inputTotalM3={inputTotalM3}
            outputTotalM3={outputTotalM3}
            inputCount={inputCount}
            outputCount={outputCount}
            plannedWork={currentPlannedWork}
            actualWork={currentActualWork}
            workUnit={workUnit ?? null}
            onConfirm={handleConfirmValidation}
            isPending={isPending}
          />
        </>
      )}
    </div>
  );
}
