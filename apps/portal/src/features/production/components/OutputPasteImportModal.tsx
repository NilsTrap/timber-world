"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
} from "@timber/ui";
import type { ReferenceDropdowns } from "../types";
import type { OutputRow } from "../types";
import { generateClientId, calculateVolume, shouldAutoCalculate } from "../helpers/output-helpers";

// Fields that can be mapped from spreadsheet (no package number - auto-generated)
const MAPPABLE_FIELDS = [
  { key: "skip", label: "(Skip this column)" },
  { key: "productName", label: "Product Name" },
  { key: "woodSpecies", label: "Wood Species" },
  { key: "humidity", label: "Humidity" },
  { key: "type", label: "Type" },
  { key: "processing", label: "Processing" },
  { key: "fsc", label: "FSC" },
  { key: "quality", label: "Quality" },
  { key: "thickness", label: "Thickness" },
  { key: "width", label: "Width" },
  { key: "length", label: "Length" },
  { key: "pieces", label: "Pieces" },
  { key: "volumeM3", label: "Volume m³" },
] as const;

type FieldKey = (typeof MAPPABLE_FIELDS)[number]["key"];

// Auto-detect column mapping based on header text
function autoDetectMapping(header: string): FieldKey {
  const h = header.toLowerCase().trim();

  if (h.includes("product") || h === "name") return "productName";
  if (h.includes("species") || h.includes("wood") || h === "sp") return "woodSpecies";
  if (h.includes("humid") || h === "hum" || h === "h") return "humidity";
  if (h.includes("type") || h === "t") return "type";
  if (h.includes("process") || h === "proc" || h === "p") return "processing";
  if (h.includes("fsc") || h.includes("cert")) return "fsc";
  if (h.includes("quality") || h.includes("qual") || h === "q") return "quality";
  if (h.includes("thick") || h === "th") return "thickness";
  if (h.includes("width") || h === "w") return "width";
  if (h.includes("length") || h.includes("len") || h === "l") return "length";
  if (h.includes("piece") || h.includes("pcs") || h === "qty" || h.includes("amount")) return "pieces";
  if (h.includes("volume") || h.includes("vol") || h === "m3" || h === "m³" || h.includes("cubic")) return "volumeM3";

  return "skip";
}

/** Partial row data with only the mapped fields */
export type PartialOutputRow = Partial<OutputRow>;

interface OutputPasteImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropdowns: ReferenceDropdowns;
  processCode: string;
  /** Called with partial rows (only mapped fields) and list of mapped field keys */
  onImport: (rows: PartialOutputRow[], mappedFields: string[]) => void;
}

export function OutputPasteImportModal({
  open,
  onOpenChange,
  dropdowns,
  processCode,
  onImport,
}: OutputPasteImportModalProps) {
  const [pastedText, setPastedText] = useState("");
  const [hasHeaders, setHasHeaders] = useState(true);
  const [columnMappings, setColumnMappings] = useState<FieldKey[]>([]);

  // Parse the pasted data
  const parsedData: { headers: string[]; rows: string[][] } = useMemo(() => {
    if (!pastedText.trim()) return { headers: [], rows: [] };

    const lines = pastedText.trim().split("\n");
    if (lines.length === 0) return { headers: [], rows: [] };

    // Split by tabs (Google Sheets format)
    const allRows = lines.map((line) => line.split("\t"));

    if (hasHeaders && allRows.length > 0) {
      const headers = allRows[0] ?? [];
      const rows = allRows.slice(1);
      return { headers, rows };
    }

    // No headers - generate column names
    const maxCols = Math.max(...allRows.map((r) => r.length));
    const headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
    return { headers, rows: allRows };
  }, [pastedText, hasHeaders]);

  // Initialize column mappings when headers change
  useEffect(() => {
    if (parsedData.headers.length > 0 && columnMappings.length !== parsedData.headers.length) {
      const autoMappings = parsedData.headers.map((h) => autoDetectMapping(h));
      setColumnMappings(autoMappings);
    }
  }, [parsedData.headers, columnMappings.length]);

  const handleMappingChange = useCallback((colIndex: number, fieldKey: FieldKey) => {
    setColumnMappings((prev) => {
      const next = [...prev];
      next[colIndex] = fieldKey;
      return next;
    });
  }, []);

  // Find reference ID by value (case-insensitive)
  const findRefId = useCallback(
    (value: string, options: Array<{ id: string; value: string }>): string => {
      if (!value.trim()) return "";
      const lower = value.toLowerCase().trim();
      const match = options.find((o) => o.value.toLowerCase() === lower);
      return match?.id ?? "";
    },
    []
  );

  // Get list of mapped field keys (OutputRow field names, not display names)
  const getMappedFields = useCallback((): string[] => {
    const fieldMap: Record<string, string> = {
      productName: "productNameId",
      woodSpecies: "woodSpeciesId",
      humidity: "humidityId",
      type: "typeId",
      processing: "processingId",
      fsc: "fscId",
      quality: "qualityId",
      thickness: "thickness",
      width: "width",
      length: "length",
      pieces: "pieces",
      volumeM3: "volumeM3",
    };

    const mapped = new Set<string>();
    for (const mapping of columnMappings) {
      if (mapping && mapping !== "skip" && fieldMap[mapping]) {
        mapped.add(fieldMap[mapping]);
      }
    }
    return [...mapped];
  }, [columnMappings]);

  // Convert parsed rows to partial OutputRow[] (only mapped fields)
  const convertToPartialRows = useCallback((): PartialOutputRow[] => {
    return parsedData.rows.map((row) => {
      const output: PartialOutputRow = {};

      row.forEach((cellValue, colIndex) => {
        const mapping = columnMappings[colIndex];
        if (!mapping || mapping === "skip") return;

        const value = cellValue?.trim() ?? "";
        if (!value) return;

        switch (mapping) {
          case "productName":
            output.productNameId = findRefId(value, dropdowns.productNames);
            break;
          case "woodSpecies":
            output.woodSpeciesId = findRefId(value, dropdowns.woodSpecies);
            break;
          case "humidity":
            output.humidityId = findRefId(value, dropdowns.humidity);
            break;
          case "type":
            output.typeId = findRefId(value, dropdowns.types);
            break;
          case "processing":
            output.processingId = findRefId(value, dropdowns.processing);
            break;
          case "fsc":
            output.fscId = findRefId(value, dropdowns.fsc);
            break;
          case "quality":
            output.qualityId = findRefId(value, dropdowns.quality);
            break;
          case "thickness":
            output.thickness = value.replace(",", ".");
            break;
          case "width":
            output.width = value.replace(",", ".");
            break;
          case "length":
            output.length = value.replace(",", ".");
            break;
          case "pieces":
            output.pieces = value.replace(",", ".");
            break;
          case "volumeM3": {
            const num = parseFloat(value.replace(",", "."));
            output.volumeM3 = isNaN(num) ? "" : num.toFixed(3);
            output.volumeIsCalculated = false;
            break;
          }
        }
      });

      return output;
    });
  }, [parsedData.rows, columnMappings, dropdowns, findRefId]);

  const handleImport = useCallback(() => {
    const partialRows = convertToPartialRows();
    const mappedFields = getMappedFields();
    onImport(partialRows, mappedFields);
    setPastedText("");
    setColumnMappings([]);
    onOpenChange(false);
  }, [convertToPartialRows, getMappedFields, onImport, onOpenChange]);

  const handleClose = useCallback(() => {
    setPastedText("");
    setColumnMappings([]);
    onOpenChange(false);
  }, [onOpenChange]);

  const headers = parsedData.headers;
  const rows = parsedData.rows;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Outputs from Spreadsheet</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Paste Area */}
          <div className="space-y-2">
            <Label>Paste data from Google Sheets (Ctrl+V)</Label>
            <textarea
              className="w-full h-32 p-2 border rounded-md font-mono text-xs resize-none bg-background"
              placeholder="Copy rows from Google Sheets and paste here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasHeaders}
                onChange={(e) => setHasHeaders(e.target.checked)}
                className="rounded"
              />
              First row contains headers
            </label>
            {rows.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {rows.length} row{rows.length !== 1 ? "s" : ""} detected
              </span>
            )}
          </div>

          {/* Column Mapping */}
          {headers.length > 0 && (
            <div className="space-y-2">
              <Label>Column Mapping</Label>
              <div className="border rounded-md overflow-auto">
                <table className="w-full text-xs [&_th]:h-8 [&_th]:px-1 [&_th]:py-0 [&_th]:text-xs [&_td]:px-1 [&_td]:py-0.5 [&_td]:text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">Spreadsheet Column</th>
                      <th className="p-2 text-left font-medium">Map to Field</th>
                      <th className="p-2 text-left font-medium">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2 font-mono">{header}</td>
                        <td className="p-2">
                          <select
                            value={columnMappings[index] || "skip"}
                            onChange={(e) => handleMappingChange(index, e.target.value as FieldKey)}
                            className="h-7 text-xs w-[160px] rounded-md border border-input bg-background px-2 py-1"
                          >
                            {MAPPABLE_FIELDS.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-muted-foreground truncate max-w-[200px]">
                          {rows[0]?.[index] ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 5 rows)</Label>
              <div className="border rounded-md overflow-auto max-h-48">
                <table className="w-full text-xs [&_th]:h-8 [&_th]:px-1 [&_th]:py-0 [&_th]:text-xs [&_td]:px-1 [&_td]:py-0.5 [&_td]:text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="p-1.5 text-left font-medium whitespace-nowrap">
                          {columnMappings[i] !== "skip"
                            ? MAPPABLE_FIELDS.find((f) => f.key === columnMappings[i])?.label ?? h
                            : <span className="text-muted-foreground line-through">{h}</span>
                          }
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`p-1.5 whitespace-nowrap ${
                              columnMappings[cellIndex] === "skip" ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            {cell || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={rows.length === 0}>
            Import {rows.length} row{rows.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
