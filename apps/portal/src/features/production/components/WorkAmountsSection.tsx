"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Input, Label } from "@timber/ui";
import { Calculator } from "lucide-react";
import { saveWorkAmounts } from "../actions";
import { calculatePlannedWork, getFormulaDescription } from "../utils/calculateWorkAmount";
import type { ProductionInput, WorkFormula } from "../types";

/**
 * Format number in European format: comma as decimal separator, 2 decimal places, no thousands separator
 */
function formatEuropean(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

interface WorkAmountsSectionProps {
  productionEntryId: string;
  workUnit: string | null;
  workFormula: WorkFormula;
  inputs: ProductionInput[];
  outputCount?: number;
  initialPlannedWork: number | null;
  initialActualWork: number | null;
  readOnly?: boolean;
  /** Callback when work amounts change */
  onWorkAmountsChange?: (plannedWork: number | null, actualWork: number | null) => void;
}

/**
 * WorkAmountsSection
 *
 * Displays and allows editing of planned and actual work amounts.
 * When a formula is set, planned work is auto-calculated from inputs.
 * Actual work is always manually editable.
 */
export function WorkAmountsSection({
  productionEntryId,
  workUnit,
  workFormula,
  inputs,
  outputCount,
  initialPlannedWork,
  initialActualWork,
  readOnly,
  onWorkAmountsChange,
}: WorkAmountsSectionProps) {
  const [manualPlannedWork, setManualPlannedWork] = useState(initialPlannedWork?.toString() ?? "");
  const [actualWork, setActualWork] = useState(initialActualWork?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [lastSavedPlanned, setLastSavedPlanned] = useState<number | null>(initialPlannedWork);

  // Track if values have changed
  const [hasPlannedChanged, setHasPlannedChanged] = useState(false);
  const [hasActualChanged, setHasActualChanged] = useState(false);

  // Calculate planned work if formula exists
  const calculatedPlannedWork = useMemo(() => {
    if (!workFormula) return null;
    return calculatePlannedWork(workFormula, inputs, outputCount);
  }, [workFormula, inputs, outputCount]);

  // The effective planned work value (calculated or manual)
  const effectivePlannedWork = workFormula ? calculatedPlannedWork : parseFloat(manualPlannedWork) || null;

  // Notify parent of work amounts changes
  useEffect(() => {
    const actualNum = actualWork ? parseFloat(actualWork) : null;
    onWorkAmountsChange?.(effectivePlannedWork, isNaN(actualNum!) ? null : actualNum);
  }, [effectivePlannedWork, actualWork, onWorkAmountsChange]);

  // Auto-save calculated value when it changes
  useEffect(() => {
    if (workFormula && calculatedPlannedWork !== null && calculatedPlannedWork !== lastSavedPlanned && !readOnly) {
      // Save the calculated value
      startTransition(async () => {
        const result = await saveWorkAmounts({
          productionEntryId,
          plannedWork: calculatedPlannedWork,
          actualWork: actualWork ? parseFloat(actualWork) : null,
        });

        if (result.success) {
          setLastSavedPlanned(calculatedPlannedWork);
        }
      });
    }
  }, [calculatedPlannedWork, workFormula, lastSavedPlanned, productionEntryId, actualWork, readOnly]);

  // Reset state when initial values change
  useEffect(() => {
    setManualPlannedWork(initialPlannedWork?.toString() ?? "");
    setActualWork(initialActualWork?.toString() ?? "");
    setLastSavedPlanned(initialPlannedWork);
    setHasPlannedChanged(false);
    setHasActualChanged(false);
  }, [initialPlannedWork, initialActualWork]);

  const handleSave = useCallback((newPlanned?: number | null, newActual?: number | null) => {
    const plannedNum = newPlanned !== undefined ? newPlanned : (manualPlannedWork ? parseFloat(manualPlannedWork) : null);
    const actualNum = newActual !== undefined ? newActual : (actualWork ? parseFloat(actualWork) : null);

    // Validate numbers
    if (manualPlannedWork && !workFormula && isNaN(plannedNum!)) {
      toast.error("Planned work must be a valid number");
      return;
    }
    if (actualWork && isNaN(actualNum!)) {
      toast.error("Actual work must be a valid number");
      return;
    }

    startTransition(async () => {
      const result = await saveWorkAmounts({
        productionEntryId,
        plannedWork: workFormula ? calculatedPlannedWork : plannedNum,
        actualWork: actualNum,
      });

      if (result.success) {
        toast.success("Work amounts saved");
        setHasPlannedChanged(false);
        setHasActualChanged(false);
      } else {
        toast.error(result.error);
      }
    });
  }, [productionEntryId, manualPlannedWork, actualWork, workFormula, calculatedPlannedWork]);

  // Auto-save on blur if value changed
  const handlePlannedBlur = useCallback(() => {
    if (hasPlannedChanged && !workFormula) {
      handleSave();
    }
  }, [hasPlannedChanged, handleSave, workFormula]);

  const handleActualBlur = useCallback(() => {
    if (hasActualChanged) {
      handleSave();
    }
  }, [hasActualChanged, handleSave]);

  const handlePlannedChange = (value: string) => {
    setManualPlannedWork(value);
    setHasPlannedChanged(true);
  };

  const handleActualChange = (value: string) => {
    setActualWork(value);
    setHasActualChanged(true);
  };

  // Handle Enter key to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  const unitLabel = workUnit || "units";
  const hasFormula = !!workFormula;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Work Amounts</h3>
        {hasFormula && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calculator className="h-3 w-3" />
            <span>{getFormulaDescription(workFormula)}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="planned-work" className="text-xs text-muted-foreground">
            Planned
          </Label>
          {readOnly || hasFormula ? (
            <div className="text-sm font-medium">
              {effectivePlannedWork !== null ? `${formatEuropean(effectivePlannedWork)} ${unitLabel}` : "—"}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                id="planned-work"
                type="number"
                step="any"
                value={manualPlannedWork}
                onChange={(e) => handlePlannedChange(e.target.value)}
                onBlur={handlePlannedBlur}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="h-9"
                disabled={isPending}
              />
              <span className="text-sm text-muted-foreground">{unitLabel}</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="actual-work" className="text-xs text-muted-foreground">
            Actual
          </Label>
          {readOnly ? (
            <div className="text-sm font-medium">
              {actualWork ? `${formatEuropean(parseFloat(actualWork))} ${unitLabel}` : "—"}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                id="actual-work"
                type="number"
                step="any"
                value={actualWork}
                onChange={(e) => handleActualChange(e.target.value)}
                onBlur={handleActualBlur}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="h-9"
                disabled={isPending}
              />
              <span className="text-sm text-muted-foreground">{unitLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
