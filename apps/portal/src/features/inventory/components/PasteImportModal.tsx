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
import type { EditablePackageItem, ReferenceDropdowns } from "@/features/shipments/types";

interface OrganisationOption {
  id: string;
  code: string;
  name: string;
}

// Fields that can be mapped from spreadsheet
const MAPPABLE_FIELDS = [
  { key: "skip", label: "(Skip this column)" },
  { key: "packageNumber", label: "Package Number" },
  { key: "shipmentCode", label: "Shipment Code" },
  { key: "organisation", label: "Organisation (code)" },
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

  if (h.includes("package") || h.includes("pkg") || h === "nr" || h === "no") return "packageNumber";
  if (h.includes("shipment") || h === "ship") return "shipmentCode";
  if (h.includes("org") || h.includes("company") || h.includes("client")) return "organisation";
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

interface PasteImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropdowns: ReferenceDropdowns;
  organisations: OrganisationOption[];
  onImport: (packages: EditablePackageItem[]) => void;
}

export function PasteImportModal({
  open,
  onOpenChange,
  dropdowns,
  organisations,
  onImport,
}: PasteImportModalProps) {
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
    (value: string, options: Array<{ id: string; value: string }>): string | null => {
      if (!value.trim()) return null;
      const lower = value.toLowerCase().trim();
      const match = options.find((o) => o.value.toLowerCase() === lower);
      return match?.id ?? null;
    },
    []
  );

  // Find organisation by code (case-insensitive)
  const findOrgId = useCallback(
    (code: string): string | null => {
      if (!code.trim()) return null;
      const upper = code.toUpperCase().trim();
      const match = organisations.find((o) => o.code.toUpperCase() === upper);
      return match?.id ?? null;
    },
    [organisations]
  );

  // Convert parsed rows to EditablePackageItem[]
  const convertToPackages = useCallback((): EditablePackageItem[] => {
    return parsedData.rows.map((row) => {
      const pkg: Partial<EditablePackageItem> = {};

      row.forEach((cellValue, colIndex) => {
        const mapping = columnMappings[colIndex];
        if (!mapping || mapping === "skip") return;

        const value = cellValue?.trim() ?? "";
        if (!value) return;

        switch (mapping) {
          case "packageNumber":
            pkg.packageNumber = value;
            break;
          case "shipmentCode":
            pkg.shipmentCode = value.toUpperCase();
            break;
          case "organisation": {
            const orgId = findOrgId(value);
            if (orgId) {
              const org = organisations.find((o) => o.id === orgId);
              pkg.organisationId = orgId;
              pkg.organisationCode = org?.code ?? null;
              pkg.organisationName = org?.name ?? null;
            }
            break;
          }
          case "productName": {
            const id = findRefId(value, dropdowns.productNames);
            if (id) {
              pkg.productNameId = id;
              pkg.productName = dropdowns.productNames.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "woodSpecies": {
            const id = findRefId(value, dropdowns.woodSpecies);
            if (id) {
              pkg.woodSpeciesId = id;
              pkg.woodSpecies = dropdowns.woodSpecies.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "humidity": {
            const id = findRefId(value, dropdowns.humidity);
            if (id) {
              pkg.humidityId = id;
              pkg.humidity = dropdowns.humidity.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "type": {
            const id = findRefId(value, dropdowns.types);
            if (id) {
              pkg.typeId = id;
              pkg.typeName = dropdowns.types.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "processing": {
            const id = findRefId(value, dropdowns.processing);
            if (id) {
              pkg.processingId = id;
              pkg.processing = dropdowns.processing.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "fsc": {
            const id = findRefId(value, dropdowns.fsc);
            if (id) {
              pkg.fscId = id;
              pkg.fsc = dropdowns.fsc.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "quality": {
            const id = findRefId(value, dropdowns.quality);
            if (id) {
              pkg.qualityId = id;
              pkg.quality = dropdowns.quality.find((o) => o.id === id)?.value ?? null;
            }
            break;
          }
          case "thickness":
            pkg.thickness = value.replace(",", ".");
            break;
          case "width":
            pkg.width = value.replace(",", ".");
            break;
          case "length":
            pkg.length = value.replace(",", ".");
            break;
          case "pieces":
            pkg.pieces = value.replace(",", ".");
            break;
          case "volumeM3": {
            const num = parseFloat(value.replace(",", "."));
            pkg.volumeM3 = isNaN(num) ? null : num;
            pkg.volumeIsCalculated = false;
            break;
          }
        }
      });

      // Generate unique client ID
      const clientId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Return complete package with defaults
      return {
        id: clientId,
        isNew: true,
        packageNumber: pkg.packageNumber ?? "",
        shipmentCode: pkg.shipmentCode ?? "",
        shipmentId: "",
        organisationId: pkg.organisationId ?? organisations[0]?.id ?? null,
        organisationCode: pkg.organisationCode ?? organisations[0]?.code ?? null,
        organisationName: pkg.organisationName ?? organisations[0]?.name ?? null,
        productNameId: pkg.productNameId ?? null,
        productName: pkg.productName ?? null,
        woodSpeciesId: pkg.woodSpeciesId ?? null,
        woodSpecies: pkg.woodSpecies ?? null,
        humidityId: pkg.humidityId ?? null,
        humidity: pkg.humidity ?? null,
        typeId: pkg.typeId ?? null,
        typeName: pkg.typeName ?? null,
        processingId: pkg.processingId ?? null,
        processing: pkg.processing ?? null,
        fscId: pkg.fscId ?? null,
        fsc: pkg.fsc ?? null,
        qualityId: pkg.qualityId ?? null,
        quality: pkg.quality ?? null,
        thickness: pkg.thickness ?? null,
        width: pkg.width ?? null,
        length: pkg.length ?? null,
        pieces: pkg.pieces ?? null,
        volumeM3: pkg.volumeM3 ?? null,
        volumeIsCalculated: pkg.volumeIsCalculated ?? false,
        notes: null,
      };
    });
  }, [parsedData.rows, columnMappings, dropdowns, organisations, findRefId, findOrgId]);

  const handleImport = useCallback(() => {
    const packages = convertToPackages();
    onImport(packages);
    setPastedText("");
    setColumnMappings([]);
    onOpenChange(false);
  }, [convertToPackages, onImport, onOpenChange]);

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
          <DialogTitle>Import from Spreadsheet</DialogTitle>
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
                <table className="w-full text-xs">
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
                <table className="w-full text-xs">
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
