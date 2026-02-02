"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Sparkles, ClipboardPaste, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@timber/ui";
import { saveProductionOutputs, assignPackageNumbers, getNextPackageNumbers } from "../actions";
import type { NextPackageNumber } from "../actions";
import { ProductionOutputsTable } from "./ProductionOutputsTable";
import { OutputPasteImportModal, type PartialOutputRow } from "./OutputPasteImportModal";
import { PrintOutputsButton } from "./PrintOutputsButton";
import {
  generateClientId,
  generateOutputNumber,
  shouldAutoCalculate,
  calculateVolume,
  createEmptyOutputRow,
} from "../helpers/output-helpers";
import type { OutputRow, ProductionInput, ProductionOutput, ReferenceDropdowns } from "../types";

interface ProductionOutputsSectionProps {
  productionEntryId: string;
  initialOutputs: ProductionOutput[];
  dropdowns: ReferenceDropdowns;
  inputs: ProductionInput[];
  processCode: string;
  onTotalChange?: (totalM3: number) => void;
  onCountChange?: (count: number) => void;
  readOnly?: boolean;
  /** True when admin is editing a validated entry */
  isAdminEdit?: boolean;
  /** Process name for print header */
  processName?: string;
  /** Production date for print header */
  productionDate?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbOutputToRow(output: ProductionOutput, index: number, code: string): OutputRow {
  return {
    clientId: generateClientId(),
    dbId: output.id,
    packageNumber: output.packageNumber || "",
    shipmentCode: output.shipmentCode || "",
    productNameId: output.productNameId || "",
    woodSpeciesId: output.woodSpeciesId || "",
    humidityId: output.humidityId || "",
    typeId: output.typeId || "",
    processingId: output.processingId || "",
    fscId: output.fscId || "",
    qualityId: output.qualityId || "",
    thickness: output.thickness || "",
    width: output.width || "",
    length: output.length || "",
    pieces: output.pieces || "",
    volumeM3: output.volumeM3 ? output.volumeM3.toFixed(3) : "",
    volumeIsCalculated: false,
    notes: output.notes || "",
  };
}

// ─── Lookup helpers for resolving ref IDs from display values ─────────────────

function findRefId(options: { id: string; value: string }[], displayValue: string | null): string {
  if (!displayValue) return "";
  const found = options.find((o) => o.value === displayValue);
  return found ? found.id : "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductionOutputsSection({
  productionEntryId,
  initialOutputs,
  dropdowns,
  inputs,
  processCode,
  onTotalChange,
  onCountChange,
  readOnly,
  isAdminEdit,
  processName,
  productionDate,
}: ProductionOutputsSectionProps) {
  const [rows, setRows] = useState<OutputRow[]>(() =>
    initialOutputs.map((o, i) => dbOutputToRow(o, i, processCode))
  );
  const [isPending, startTransition] = useTransition();
  const [isAssigningNumbers, setIsAssigningNumbers] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRowsRef = useRef<OutputRow[] | null>(null); // Track rows with pending save
  const latestRowsRef = useRef<OutputRow[]>(rows); // Always keep latest rows for saves
  const saveInProgressRef = useRef<boolean>(false); // Prevent concurrent saves
  const saveQueuedRef = useRef<boolean>(false); // Track if another save is queued
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Keep latestRowsRef in sync with rows state
  useEffect(() => {
    latestRowsRef.current = rows;
  }, [rows]);
  const [availablePackageNumbers, setAvailablePackageNumbers] = useState<NextPackageNumber[]>([]);

  // Compute which package numbers are "taken" in the current draft rows
  const takenPackageNumbers = useMemo(() => {
    return rows
      .map((r) => r.packageNumber)
      .filter((num) => num && num !== "");
  }, [rows]);

  // Fetch available package numbers on mount and when taken numbers change
  const fetchAvailableNumbers = useCallback(async () => {
    if (readOnly) return;
    const result = await getNextPackageNumbers(productionEntryId, takenPackageNumbers);
    if (result.success) {
      setAvailablePackageNumbers(result.data);
    }
  }, [productionEntryId, takenPackageNumbers, readOnly]);

  useEffect(() => {
    fetchAvailableNumbers();
  }, [fetchAvailableNumbers]);

  // Total output m³
  const totalM3 = useMemo(() => {
    return rows.reduce((sum, row) => {
      const vol = parseFloat(row.volumeM3);
      return sum + (isNaN(vol) ? 0 : vol);
    }, 0);
  }, [rows]);

  useEffect(() => {
    onTotalChange?.(totalM3);
  }, [totalM3, onTotalChange]);

  useEffect(() => {
    onCountChange?.(rows.length);
  }, [rows.length, onCountChange]);

  // ─── Save Logic ─────────────────────────────────────────────────────────────

  // Async version of save that returns a Promise - for use when we need to wait
  const performSaveAsync = useCallback(
    async (currentRows: OutputRow[]): Promise<boolean> => {
      // Prevent concurrent saves - if save is in progress, queue another one
      if (saveInProgressRef.current) {
        saveQueuedRef.current = true;
        return true; // Return true so caller doesn't think it failed
      }

      saveInProgressRef.current = true;

      const rowInputs = currentRows.map((r) => ({
        dbId: r.dbId,
        packageNumber: r.packageNumber,
        productNameId: r.productNameId,
        woodSpeciesId: r.woodSpeciesId,
        humidityId: r.humidityId,
        typeId: r.typeId,
        processingId: r.processingId,
        fscId: r.fscId,
        qualityId: r.qualityId,
        thickness: r.thickness,
        width: r.width,
        length: r.length,
        pieces: r.pieces,
        volumeM3: parseFloat(r.volumeM3) || 0,
        notes: r.notes,
      }));

      const result = await saveProductionOutputs(productionEntryId, rowInputs);

      if (!result.success) {
        toast.error(result.error);
        // Clear save in progress on error too
        saveInProgressRef.current = false;
        // Still process queued saves even on error
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          setTimeout(() => {
            performSaveAsync(latestRowsRef.current);
          }, 50);
        }
        return false;
      }

      // Save completed successfully - clear pending rows
      pendingRowsRef.current = null;

      // Update rows with newly assigned dbIds and server-generated package numbers
      if (Object.keys(result.data.insertedIds).length > 0) {
        setRows((prev) => {
          const updated = prev.map((row, i) => {
            const newId = result.data.insertedIds[i];
            const newPackageNumber = result.data.packageNumbers[i];
            if (newId && !row.dbId) {
              return {
                ...row,
                dbId: newId,
                packageNumber: newPackageNumber || row.packageNumber,
              };
            }
            return row;
          });
          // Also update the ref
          latestRowsRef.current = updated;
          return updated;
        });
      }

      // Mark save as complete
      saveInProgressRef.current = false;

      // If another save was queued while this one was running, trigger it now
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        // Use setTimeout to let state updates settle
        setTimeout(() => {
          performSaveAsync(latestRowsRef.current);
        }, 50);
      }

      return true;
    },
    [productionEntryId]
  );

  const performSave = useCallback(
    (currentRows: OutputRow[]) => {
      startTransition(() => {
        performSaveAsync(currentRows);
      });
    },
    [performSaveAsync]
  );

  const debouncedSave = useCallback(
    (rowsToSave?: OutputRow[]) => {
      // If rows are provided, update the ref immediately (before render)
      if (rowsToSave) {
        latestRowsRef.current = rowsToSave;
      }
      // Mark that we have pending changes
      pendingRowsRef.current = latestRowsRef.current;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        // Use the LATEST rows when the timeout fires, not the captured ones
        const currentRows = latestRowsRef.current;
        performSave(currentRows);
      }, 800);
    },
    [performSave]
  );

  // ─── Assign Package Numbers Handler ──────────────────────────────────────────

  const handleAssignNumbers = useCallback(async () => {
    // Use latest rows from ref, not stale closure
    const currentRows = latestRowsRef.current;

    // Check if there are rows without package numbers
    const rowsNeedingNumbers = currentRows.filter((r) => !r.packageNumber || r.packageNumber === "");
    if (rowsNeedingNumbers.length === 0) {
      toast.info("All outputs already have package numbers assigned");
      return;
    }

    // First, ensure all rows are saved - use async version to actually wait
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const saveSuccess = await performSaveAsync(latestRowsRef.current);
    if (!saveSuccess) {
      toast.error("Failed to save outputs before assigning numbers");
      return;
    }

    setIsAssigningNumbers(true);
    const result = await assignPackageNumbers(productionEntryId);
    setIsAssigningNumbers(false);

    if (!result.success) {
      toast.error(result.error || "Failed to assign package numbers");
      return;
    }

    if (result.assignedNumbers && result.assignedNumbers.length > 0) {
      toast.success(`Assigned ${result.assignedNumbers.length} package number${result.assignedNumbers.length !== 1 ? "s" : ""}`);

      // Update local state with the assigned numbers
      // Use latest rows from ref to avoid stale data
      setRows((prev) => {
        let numberIndex = 0;
        const updated = prev.map((row) => {
          if (!row.packageNumber || row.packageNumber === "") {
            const newNumber = result.assignedNumbers?.[numberIndex];
            numberIndex++;
            return { ...row, packageNumber: newNumber || row.packageNumber };
          }
          return row;
        });
        // Update the ref to keep it in sync
        latestRowsRef.current = updated;
        return updated;
      });
    } else {
      toast.info("No package numbers needed to be assigned");
    }
  }, [productionEntryId, performSaveAsync]);

  // ─── Row Change Handler ─────────────────────────────────────────────────────

  const handleRowsChange = useCallback(
    (newRows: OutputRow[]) => {
      setRows(newRows);
      debouncedSave(newRows);
    },
    [debouncedSave]
  );

  // ─── Note Change Handler ──────────────────────────────────────────────────────

  const handleNoteChange = useCallback(
    (clientId: string, note: string) => {
      const newRows = latestRowsRef.current.map((row) =>
        row.clientId === clientId ? { ...row, notes: note } : row
      );
      setRows(newRows);
      debouncedSave(newRows);
    },
    [debouncedSave]
  );

  // ─── Package Number Change Handler ─────────────────────────────────────────────

  const handlePackageNumberChange = useCallback(
    (clientId: string, packageNumber: string) => {
      const newRows = latestRowsRef.current.map((row) =>
        row.clientId === clientId ? { ...row, packageNumber } : row
      );
      setRows(newRows);
      debouncedSave(newRows);
    },
    [debouncedSave]
  );

  // ─── Auto-Generate from Inputs ──────────────────────────────────────────────

  const handleAutoGenerate = useCallback(() => {
    if (inputs.length === 0) {
      toast.error("No inputs to generate from");
      return;
    }

    // Group inputs by their attribute combination
    const groups = new Map<string, ProductionInput[]>();
    for (const input of inputs) {
      const key = [
        input.productName || "",
        input.woodSpecies || "",
        input.humidity || "",
        input.typeName || "",
        input.processing || "",
        input.fsc || "",
        input.quality || "",
      ].join("|");
      const group = groups.get(key) || [];
      group.push(input);
      groups.set(key, group);
    }

    const startIndex = rows.length;
    const newRows: OutputRow[] = [];
    let idx = 0;

    for (const [, groupInputs] of groups) {
      const first = groupInputs[0]!;
      // Sum pieces across group
      const totalPieces = groupInputs.reduce((sum, inp) => sum + (inp.piecesUsed || 0), 0);
      // Use first input's dimensions
      const thickness = first.thickness || "";
      const width = first.width || "";
      const length = first.length || "";
      const pieces = totalPieces > 0 ? String(totalPieces) : "";

      let volumeM3 = "";
      let volumeIsCalculated = false;

      const tempRow: OutputRow = {
        clientId: "",
        dbId: null,
        packageNumber: "",
        shipmentCode: "",
        productNameId: findRefId(dropdowns.productNames, first.productName),
        woodSpeciesId: findRefId(dropdowns.woodSpecies, first.woodSpecies),
        humidityId: findRefId(dropdowns.humidity, first.humidity),
        typeId: findRefId(dropdowns.types, first.typeName),
        processingId: findRefId(dropdowns.processing, first.processing),
        fscId: findRefId(dropdowns.fsc, first.fsc),
        qualityId: findRefId(dropdowns.quality, first.quality),
        thickness,
        width,
        length,
        pieces,
        volumeM3: "",
        volumeIsCalculated: false,
        notes: "",
      };

      if (shouldAutoCalculate(tempRow)) {
        const vol = calculateVolume(thickness, width, length, pieces);
        if (vol !== null) {
          volumeM3 = vol.toFixed(3);
          volumeIsCalculated = true;
        }
      }

      newRows.push({
        ...tempRow,
        clientId: generateClientId(),
        packageNumber: generateOutputNumber(startIndex + idx, processCode),
        volumeM3,
        volumeIsCalculated,
      });
      idx++;
    }

    const updatedRows = [...rows, ...newRows];
    setRows(updatedRows);
    debouncedSave(updatedRows);
    toast.success(`Generated ${newRows.length} output row${newRows.length > 1 ? "s" : ""} from inputs`);
  }, [inputs, rows, dropdowns, debouncedSave, processCode]);

  // ─── Handle Paste Import ───────────────────────────────────────────────────

  const handleImportRows = useCallback(
    (partialRows: PartialOutputRow[], mappedFields: string[]) => {
      // Merge partial data with existing rows
      // Only update fields that were mapped, keep other fields as they are
      const updatedRows = rows.map((existingRow, index) => {
        if (index >= partialRows.length) {
          // No import data for this row, keep as is
          return existingRow;
        }

        const partialData = partialRows[index]!;
        const merged: OutputRow = { ...existingRow };

        // Only update fields that were actually mapped
        for (const field of mappedFields) {
          if (field in partialData && partialData[field as keyof PartialOutputRow] !== undefined) {
            (merged as unknown as Record<string, unknown>)[field] = partialData[field as keyof PartialOutputRow];
          }
        }

        // Recalculate volume if dimensions changed and volume wasn't explicitly imported
        if (
          (mappedFields.includes("thickness") || mappedFields.includes("width") ||
           mappedFields.includes("length") || mappedFields.includes("pieces")) &&
          !mappedFields.includes("volumeM3")
        ) {
          if (shouldAutoCalculate(merged)) {
            const vol = calculateVolume(merged.thickness, merged.width, merged.length, merged.pieces);
            if (vol !== null) {
              merged.volumeM3 = vol.toFixed(3);
              merged.volumeIsCalculated = true;
            }
          }
        }

        return merged;
      });

      // If import has more rows than existing, add new rows
      if (partialRows.length > rows.length) {
        for (let i = rows.length; i < partialRows.length; i++) {
          const partialData = partialRows[i]!;
          const newRow = createEmptyOutputRow(i, processCode);

          // Apply mapped fields to new row
          for (const field of mappedFields) {
            if (field in partialData && partialData[field as keyof PartialOutputRow] !== undefined) {
              (newRow as unknown as Record<string, unknown>)[field] = partialData[field as keyof PartialOutputRow];
            }
          }

          // Calculate volume for new row if possible
          if (shouldAutoCalculate(newRow) && !mappedFields.includes("volumeM3")) {
            const vol = calculateVolume(newRow.thickness, newRow.width, newRow.length, newRow.pieces);
            if (vol !== null) {
              newRow.volumeM3 = vol.toFixed(3);
              newRow.volumeIsCalculated = true;
            }
          }

          updatedRows.push(newRow);
        }
      }

      setRows(updatedRows);
      debouncedSave(updatedRows);
      toast.success(`Updated ${Math.min(partialRows.length, rows.length)} row${Math.min(partialRows.length, rows.length) !== 1 ? "s" : ""}${partialRows.length > rows.length ? `, added ${partialRows.length - rows.length} new` : ""}`);
    },
    [rows, debouncedSave, processCode]
  );

  // ─── Keyboard Shortcut: Ctrl+O ─────────────────────────────────────────────

  const handleAddRow = useCallback(() => {
    const newRow = createEmptyOutputRow(rows.length, processCode);
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    debouncedSave(updatedRows);
  }, [rows, debouncedSave, processCode]);

  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        handleAddRow();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleAddRow, readOnly]);

  // Cleanup on unmount: save any pending changes immediately (fire-and-forget)
  useEffect(() => {
    const entryId = productionEntryId; // Capture for closure

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // If there are pending changes, save them immediately without waiting
      const pendingRows = pendingRowsRef.current;
      if (pendingRows) {
        // Fire-and-forget save - don't use startTransition or state updates
        const rowInputs = pendingRows.map((r) => ({
          dbId: r.dbId,
          packageNumber: r.packageNumber,
          productNameId: r.productNameId,
          woodSpeciesId: r.woodSpeciesId,
          humidityId: r.humidityId,
          typeId: r.typeId,
          processingId: r.processingId,
          fscId: r.fscId,
          qualityId: r.qualityId,
          thickness: r.thickness,
          width: r.width,
          length: r.length,
          pieces: r.pieces,
          volumeM3: parseFloat(r.volumeM3) || 0,
          notes: r.notes,
        }));
        // Call save without awaiting - the request will complete even after unmount
        saveProductionOutputs(entryId, rowInputs).catch((err) => {
          console.error("Failed to save on unmount:", err);
        });
        pendingRowsRef.current = null;
      }
    };
  }, [productionEntryId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Outputs</h2>
          <span className="text-sm text-muted-foreground">
            {totalM3 > 0 && `${totalM3.toFixed(3).replace(".", ",")} m³`}
          </span>
          {isPending && (
            <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Print button - always visible when there are rows */}
          {rows.length > 0 && (
            <PrintOutputsButton
              rows={rows}
              dropdowns={dropdowns}
              processName={processName}
              productionDate={productionDate}
            />
          )}
          {/* Edit actions - only when not read-only */}
          {!readOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                disabled={isPending || isAssigningNumbers}
              >
                <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                Paste Import
              </Button>
              {inputs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGenerate}
                  disabled={isPending || isAssigningNumbers}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Auto-Generate from Inputs
                </Button>
              )}
              {rows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAssignNumbers}
                  disabled={isPending || isAssigningNumbers}
                >
                  <Hash className="h-3.5 w-3.5 mr-1.5" />
                  {isAssigningNumbers ? "Assigning..." : "Assign Package Numbers"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ProductionOutputsTable
        rows={rows}
        dropdowns={dropdowns}
        onRowsChange={handleRowsChange}
        processCode={processCode}
        readOnly={readOnly}
        onNoteChange={handleNoteChange}
        availablePackageNumbers={availablePackageNumbers}
        onPackageNumberChange={handlePackageNumberChange}
      />

      {!readOnly && (
        <OutputPasteImportModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          dropdowns={dropdowns}
          processCode={processCode}
          onImport={handleImportRows}
        />
      )}
    </div>
  );
}
