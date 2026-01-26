"use client";

import { useCallback, useMemo } from "react";
import { Input, DataEntryTable, type ColumnDef } from "@timber/ui";
import type { PackageRow, ReferenceDropdowns } from "../types";

interface PackageEntryTableProps {
  rows: PackageRow[];
  dropdowns: ReferenceDropdowns;
  onRowsChange: (rows: PackageRow[]) => void;
  shipmentCode?: string;
  /** If true, package numbers are editable (for admin inventory) */
  editablePackageNumbers?: boolean;
}

/** Dropdown column configuration */
interface DropdownColumnConfig {
  field: keyof PackageRow;
  label: string;
  optionsKey: keyof ReferenceDropdowns;
}

const DROPDOWN_COLUMNS: DropdownColumnConfig[] = [
  { field: "productNameId", label: "Product", optionsKey: "productNames" },
  { field: "woodSpeciesId", label: "Species", optionsKey: "woodSpecies" },
  { field: "humidityId", label: "Humidity", optionsKey: "humidity" },
  { field: "typeId", label: "Type", optionsKey: "types" },
  { field: "processingId", label: "Processing", optionsKey: "processing" },
  { field: "fscId", label: "FSC", optionsKey: "fsc" },
  { field: "qualityId", label: "Quality", optionsKey: "quality" },
];

// ─── Volume Helpers ───────────────────────────────────────────────────────────

function isRange(val: string): boolean {
  return val.includes("-") && val.indexOf("-") > 0;
}

function calculateVolume(
  thickness: string,
  width: string,
  length: string,
  pieces: string
): number | null {
  if (!thickness || !width || !length || !pieces) return null;
  if (isRange(thickness) || isRange(width) || isRange(length)) return null;
  if (pieces === "-" || pieces.trim() === "") return null;

  // Normalize comma decimal separators to dots for parsing
  const t = parseFloat(thickness.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const l = parseFloat(length.replace(",", "."));
  const p = parseFloat(pieces.replace(",", "."));

  if (isNaN(t) || isNaN(w) || isNaN(l) || isNaN(p)) return null;
  if (t <= 0 || w <= 0 || l <= 0 || p <= 0) return null;

  return (t * w * l * p) / 1_000_000_000;
}

function shouldAutoCalculate(row: PackageRow): boolean {
  if (!row.thickness || !row.width || !row.length || !row.pieces) return false;
  if (isRange(row.thickness) || isRange(row.width) || isRange(row.length)) return false;
  if (row.pieces === "-") return false;
  return true;
}

function formatVolumeDisplay(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(num);
}

function normalizeDecimalInput(value: string): string {
  return value.replace(",", ".");
}

function formatVolumeInput(value: string): string {
  if (!value) return "";
  return value.replace(".", ",");
}

function normalizeVolumePrecision(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toFixed(3);
}

// ─── Row Helpers ──────────────────────────────────────────────────────────────

function generateClientId(): string {
  return `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generatePreviewNumber(index: number): string {
  return `PKG-${String(index + 1).padStart(3, "0")}`;
}

function createEmptyRow(index: number): PackageRow {
  return {
    clientId: generateClientId(),
    packageNumber: generatePreviewNumber(index),
    productNameId: "",
    woodSpeciesId: "",
    humidityId: "",
    typeId: "",
    processingId: "",
    fscId: "",
    qualityId: "",
    thickness: "",
    width: "",
    length: "",
    pieces: "",
    volumeM3: "",
    volumeIsCalculated: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PackageEntryTable({
  rows,
  dropdowns,
  onRowsChange,
  shipmentCode,
  editablePackageNumbers = false,
}: PackageEntryTableProps) {
  /** Build column definitions from dropdowns */
  const columns: ColumnDef<PackageRow>[] = useMemo(() => {
    const cols: ColumnDef<PackageRow>[] = [
      // Shipment code (readonly, same for all rows)
      {
        key: "shipmentCode",
        label: "Shipment",
        type: "readonly",
        getValue: () => shipmentCode || "",
        getDisplayValue: () => shipmentCode || "-",
      },
      // Package number (readonly or editable based on prop)
      editablePackageNumbers
        ? {
            key: "packageNumber",
            label: "Package",
            type: "text" as const,
            placeholder: "PKG-001",
            width: "w-[6rem]",
            navigable: true,
            getValue: (row) => row.packageNumber,
            totalType: "count" as const,
          }
        : {
            key: "packageNumber",
            label: "Package",
            type: "readonly" as const,
            getValue: (row) => row.packageNumber,
            totalType: "count" as const,
          },
      // 7 dropdown columns
      ...DROPDOWN_COLUMNS.map((dc): ColumnDef<PackageRow> => ({
        key: dc.field,
        label: dc.label,
        type: "dropdown",
        collapsible: true,
        navigable: true,
        options: dropdowns[dc.optionsKey].map((o) => ({ id: o.id, value: o.value })),
        getValue: (row) => row[dc.field] as string,
      })),
      // Dimension inputs
      {
        key: "thickness",
        label: "Thickness",
        type: "text",
        placeholder: "mm",
        width: "w-[4.5rem]",
        navigable: true,
        getValue: (row) => row.thickness,
      },
      {
        key: "width",
        label: "Width",
        type: "text",
        placeholder: "mm",
        width: "w-[4.5rem]",
        navigable: true,
        getValue: (row) => row.width,
      },
      {
        key: "length",
        label: "Length",
        type: "text",
        placeholder: "mm",
        width: "w-[5.5rem]",
        navigable: true,
        getValue: (row) => row.length,
      },
      // Pieces
      {
        key: "pieces",
        label: "Pieces",
        type: "text",
        placeholder: "qty",
        width: "w-[4.5rem]",
        isNumeric: true,
        navigable: true,
        totalType: "sum",
        getValue: (row) => row.pieces,
      },
      // Volume (custom: either auto-calculated span or manual input)
      {
        key: "volumeM3",
        label: "Vol m³",
        type: "custom",
        isNumeric: true,
        filterable: true,
        navigable: true,
        totalType: "sum",
        formatTotal: (value) => formatVolumeDisplay(value.toFixed(3)),
        getValue: (row) => row.volumeM3,
        renderCell: (row, renderIndex, originalIndex, onChange, onKeyDown) => {
          if (row.volumeIsCalculated) {
            return (
              <span
                className="inline-flex items-center h-7 text-xs md:text-sm w-[5rem] px-1 whitespace-nowrap"
                title="Auto-calculated"
              >
                {formatVolumeDisplay(row.volumeM3)}
              </span>
            );
          }
          return (
            <Input
              id={`pkg-${renderIndex}-volumeM3`}
              className="h-7 text-xs w-[5rem] px-1"
              placeholder="0,000"
              value={formatVolumeInput(row.volumeM3)}
              onChange={(e) => onChange(normalizeDecimalInput(e.target.value))}
              onKeyDown={onKeyDown}
              onBlur={(e) => {
                const raw = normalizeDecimalInput(e.target.value);
                if (raw) {
                  onChange(normalizeVolumePrecision(raw));
                }
              }}
              title="Enter manually"
            />
          );
        },
      },
    ];
    return cols;
  }, [dropdowns, shipmentCode, editablePackageNumbers]);

  /** Handle cell changes with volume auto-calculation */
  const handleCellChange = useCallback(
    (row: PackageRow, columnKey: string, value: string): PackageRow => {
      const updated: PackageRow = { ...row, [columnKey]: value };

      // Recalculate volume when dimensions or pieces change
      if (["thickness", "width", "length", "pieces"].includes(columnKey)) {
        if (shouldAutoCalculate(updated)) {
          const vol = calculateVolume(
            updated.thickness,
            updated.width,
            updated.length,
            updated.pieces
          );
          if (vol !== null) {
            updated.volumeM3 = vol.toFixed(3);
            updated.volumeIsCalculated = true;
          }
        } else {
          updated.volumeIsCalculated = false;
        }
      }

      return updated;
    },
    []
  );

  /** Copy a row (full copy including pieces/volume) */
  const handleCopyRow = useCallback(
    (source: PackageRow): PackageRow => ({
      ...source,
      clientId: generateClientId(),
      packageNumber: "",
    }),
    []
  );

  /** Renumber all rows after reorder/add/delete (skip if package numbers are editable) */
  const renumberRows = useCallback(
    (updatedRows: PackageRow[]): PackageRow[] => {
      if (editablePackageNumbers) {
        // Don't auto-renumber when package numbers are editable
        return updatedRows;
      }
      return updatedRows.map((row, i) => ({
        ...row,
        packageNumber: generatePreviewNumber(i),
      }));
    },
    [editablePackageNumbers]
  );

  return (
    <DataEntryTable<PackageRow>
      columns={columns}
      rows={rows}
      onRowsChange={onRowsChange}
      getRowKey={(row) => row.clientId}
      createRow={createEmptyRow}
      copyRow={handleCopyRow}
      renumberRows={renumberRows}
      onCellChange={handleCellChange}
      title="Packages"
      addRowLabel="Add Row"
      collapseStorageKey="shipment-collapsed-columns"
      idPrefix="pkg"
    />
  );
}
