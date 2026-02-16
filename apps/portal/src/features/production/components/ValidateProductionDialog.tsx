"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  Button,
} from "@timber/ui";

interface ValidateProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputTotalM3: number;
  outputTotalM3: number;
  inputCount: number;
  outputCount: number;
  plannedWork: number | null;
  actualWork: number | null;
  workUnit: string | null;
  onConfirm: () => void;
  isPending: boolean;
}

const formatVolume = (value: number): string =>
  new Intl.NumberFormat("lv", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);

const formatPercent = (value: number): string =>
  new Intl.NumberFormat("lv", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

/**
 * Validation Confirmation Dialog
 *
 * Shows production summary metrics and warnings before committing.
 * Confirming triggers the validateProduction server action.
 */
export function ValidateProductionDialog({
  open,
  onOpenChange,
  inputTotalM3,
  outputTotalM3,
  inputCount,
  outputCount,
  plannedWork,
  actualWork,
  workUnit,
  onConfirm,
  isPending,
}: ValidateProductionDialogProps) {
  const outcomePercent = inputTotalM3 > 0 ? (outputTotalM3 / inputTotalM3) * 100 : 0;
  const wastePercent = 100 - outcomePercent;

  const isUnusual = outcomePercent < 50 || outcomePercent > 100;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Validate Production</AlertDialogTitle>
          <AlertDialogDescription>
            This will commit the production entry and update inventory. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Inputs</p>
              <p className="text-sm font-semibold">{inputCount} packages</p>
              <p className="text-sm text-muted-foreground">{formatVolume(inputTotalM3)} m³</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Outputs</p>
              <p className="text-sm font-semibold">{outputCount} packages</p>
              <p className="text-sm text-muted-foreground">{formatVolume(outputTotalM3)} m³</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Outcome</p>
              <p className="text-sm font-semibold">{formatPercent(outcomePercent)}%</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Waste</p>
              <p className="text-sm font-semibold">{formatPercent(wastePercent)}%</p>
            </div>
            {(plannedWork !== null || actualWork !== null) && (
              <>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Planned Work</p>
                  <p className="text-sm font-semibold">
                    {plannedWork !== null ? plannedWork : "—"} {workUnit || ""}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Actual Work</p>
                  <p className="text-sm font-semibold">
                    {actualWork !== null ? actualWork : "—"} {workUnit || ""}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Warning for unusual outcome */}
          {isUnusual && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800">
                {outcomePercent < 50
                  ? "Very low output ratio — are inputs/outputs correct?"
                  : "Output exceeds input — are volumes correct?"}
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Validate & Commit
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
