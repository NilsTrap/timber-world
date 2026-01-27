"use client";

import { useCallback, useMemo } from "react";
import { Input, DataEntryTable, type ColumnDef } from "@timber/ui";
import type { OutputRow, ReferenceDropdowns } from "../types";
import {
  generateClientId,
  generateOutputNumber,
  isRange,
  shouldAutoCalculate,
  calculateVolume,
  createEmptyOutputRow,
} from "../helpers/output-helpers";

interface ProductionOutputsTableProps {
  rows: OutputRow[];
  dropdowns: ReferenceDropdowns;
  onRowsChange: (rows: OutputRow[]) => void;
  processCode: string;
  readOnly?: boolean;
}

/** Dropdown column configuration */
interface DropdownColumnConfig {
  field: keyof OutputRow;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductionOutputsTable({
  rows,
  dropdowns,
  onRowsChange,
  processCode,
  readOnly,
}: ProductionOutputsTableProps) {
  const columns: ColumnDef<OutputRow>[] = useMemo(() => {
    const cols: ColumnDef<OutputRow>[] = [
      // Package number (readonly, auto-generated)
      {
        key: "packageNumber",
        label: "Package",
        type: "readonly",
        getValue: (row) => row.packageNumber,
        totalType: "count",
      },
      // 7 dropdown columns
      ...DROPDOWN_COLUMNS.map((dc): ColumnDef<OutputRow> => ({
        key: dc.field,
        label: dc.label,
        type: "dropdown",
        collapsible: true,
        options: dropdowns[dc.optionsKey].map((o) => ({ id: o.id, value: o.value })),
        getValue: (row) => row[dc.field] as string,
      })),
      // Dimensions
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
      // Volume (custom: auto-calculated span or manual input)
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
        getDisplayValue: (row) => formatVolumeDisplay(String(row.volumeM3 || 0)),
        renderCell: (row, renderIndex, _originalIndex, onChange, onKeyDown) => {
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
              id={`out-${renderIndex}-volumeM3`}
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
  }, [dropdowns]);

  const handleCellChange = useCallback(
    (row: OutputRow, columnKey: string, value: string): OutputRow => {
      const updated: OutputRow = { ...row, [columnKey]: value };

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

  const handleCopyRow = useCallback(
    (source: OutputRow): OutputRow => ({
      ...source,
      clientId: generateClientId(),
      dbId: null,
      packageNumber: "",
    }),
    []
  );

  const renumberRows = useCallback(
    (updatedRows: OutputRow[]): OutputRow[] =>
      updatedRows.map((row, i) => ({
        ...row,
        packageNumber: generateOutputNumber(i, processCode),
      })),
    [processCode]
  );

  // Create new row with dropdown values inherited from the last row
  const handleCreateRow = useCallback(
    (index: number) => {
      const lastRow = rows.length > 0 ? rows[rows.length - 1] : undefined;
      return createEmptyOutputRow(index, processCode, lastRow);
    },
    [rows, processCode]
  );

  return (
    <DataEntryTable<OutputRow>
      columns={columns}
      rows={rows}
      onRowsChange={onRowsChange}
      getRowKey={(row) => row.clientId}
      createRow={handleCreateRow}
      copyRow={handleCopyRow}
      renumberRows={renumberRows}
      onCellChange={handleCellChange}
      title="Output Packages"
      addRowLabel="Add Row"
      addRowSuffix={<kbd className="ml-2 text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded border">Ctrl+O</kbd>}
      allowEmpty
      collapseStorageKey="production-outputs-collapsed"
      idPrefix="out"
      readOnly={readOnly}
    />
  );
}
