"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@timber/ui";
import { saveProductionOutputs } from "../actions";
import { ProductionOutputsTable } from "./ProductionOutputsTable";
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbOutputToRow(output: ProductionOutput, index: number, code: string): OutputRow {
  return {
    clientId: generateClientId(),
    dbId: output.id,
    packageNumber: output.packageNumber || generateOutputNumber(index, code),
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
}: ProductionOutputsSectionProps) {
  const [rows, setRows] = useState<OutputRow[]>(() =>
    initialOutputs.map((o, i) => dbOutputToRow(o, i, processCode))
  );
  const [isPending, startTransition] = useTransition();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // ─── Save Logic ─────────────────────────────────────────────────────────────

  const performSave = useCallback(
    (currentRows: OutputRow[]) => {
      startTransition(async () => {
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
        }));

        const result = await saveProductionOutputs(productionEntryId, rowInputs);

        if (!result.success) {
          toast.error(result.error);
          return;
        }

        // Update rows with newly assigned dbIds
        if (Object.keys(result.data.insertedIds).length > 0) {
          setRows((prev) =>
            prev.map((row, i) => {
              const newId = result.data.insertedIds[i];
              if (newId && !row.dbId) {
                return { ...row, dbId: newId };
              }
              return row;
            })
          );
        }
      });
    },
    [productionEntryId]
  );

  const debouncedSave = useCallback(
    (currentRows: OutputRow[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        performSave(currentRows);
      }, 800);
    },
    [performSave]
  );

  // ─── Row Change Handler ─────────────────────────────────────────────────────

  const handleRowsChange = useCallback(
    (newRows: OutputRow[]) => {
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

  // ─── Keyboard Shortcut: Ctrl+O ─────────────────────────────────────────────

  const handleAddRow = useCallback(() => {
    const newRow = createEmptyOutputRow(rows.length, processCode);
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    debouncedSave(updatedRows);
  }, [rows, debouncedSave, processCode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        handleAddRow();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleAddRow]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
        {inputs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoGenerate}
            disabled={isPending}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Auto-Generate from Inputs
          </Button>
        )}
      </div>

      <ProductionOutputsTable
        rows={rows}
        dropdowns={dropdowns}
        onRowsChange={handleRowsChange}
        processCode={processCode}
      />
    </div>
  );
}
