"use client";

import { useCallback, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import {
  Input,
  DataEntryTable,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  Button,
  type ColumnDef,
} from "@timber/ui";
import type { OutputRow, ReferenceDropdowns } from "../types";
import type { NextPackageNumber } from "../actions";
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
  onNoteChange?: (clientId: string, note: string) => void;
  availablePackageNumbers?: NextPackageNumber[];
  onPackageNumberChange?: (clientId: string, packageNumber: string) => void;
  createRow?: (index: number) => OutputRow;
  /** Package numbers that are used in other processes (read-only even in edit mode) */
  usedPackageNumbers?: string[];
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

// ─── Note Popover ─────────────────────────────────────────────────────────────

interface NotePopoverProps {
  note: string;
  hasNote: boolean;
  onSave: (note: string) => void;
}

function NotePopover({ note, hasNote, onSave }: NotePopoverProps) {
  const [open, setOpen] = useState(false);
  const [editValue, setEditValue] = useState(note);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setEditValue(note);
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    onSave(editValue);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`p-0.5 rounded hover:bg-muted transition-colors flex-shrink-0 ${
            hasNote ? "text-blue-500" : "text-muted-foreground/40 hover:text-muted-foreground"
          }`}
          title={hasNote ? "View/edit note" : "Add note"}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-2">
          <label className="text-sm font-medium">Package Note</label>
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note for this package..."
            className="min-h-[80px] text-sm"
            autoFocus
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Ctrl+Enter to save</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductionOutputsTable({
  rows,
  dropdowns,
  onRowsChange,
  processCode,
  readOnly,
  onNoteChange,
  availablePackageNumbers,
  onPackageNumberChange,
  createRow: createRowProp,
  usedPackageNumbers = [],
}: ProductionOutputsTableProps) {
  // Create a Set for fast lookup of used package numbers
  const usedPackageNumbersSet = useMemo(
    () => new Set(usedPackageNumbers),
    [usedPackageNumbers]
  );

  // Helper to check if a row is read-only because it's used elsewhere
  const isRowUsedElsewhere = useCallback(
    (row: OutputRow): boolean => Boolean(row.packageNumber && usedPackageNumbersSet.has(row.packageNumber)),
    [usedPackageNumbersSet]
  );
  const columns: ColumnDef<OutputRow>[] = useMemo(() => {
    const cols: ColumnDef<OutputRow>[] = [
      // Shipment code (readonly, only populated for validated outputs that have been shipped)
      ...(readOnly
        ? [
            {
              key: "shipmentCode",
              label: "Shipment",
              type: "readonly" as const,
              getValue: (row: OutputRow) => row.shipmentCode || "-",
            },
          ]
        : []),
      // Package number with dropdown for selecting from available numbers
      {
        key: "packageNumber",
        label: "Package",
        type: "custom",
        width: "w-[9rem]",
        getValue: (row) => row.packageNumber,
        totalType: "count",
        renderCell: (row, renderIndex, _originalIndex, onChange, onKeyDown) => {
          const hasNote = !!row.notes;
          const isUsedElsewhere = isRowUsedElsewhere(row);

          // Read-only mode OR package is used elsewhere: show the value and note icon
          if (readOnly || isUsedElsewhere) {
            return (
              <div className="flex items-center gap-1 whitespace-nowrap">
                {isUsedElsewhere ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs md:text-sm text-amber-600 cursor-help">
                          {row.packageNumber || "-"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs bg-amber-50 text-amber-800 border-amber-200">
                        <p className="text-sm font-medium">Used in another process</p>
                        <p className="text-xs">This package is used as input in another production entry and cannot be modified.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="text-xs md:text-sm">{row.packageNumber || "-"}</span>
                )}
                {hasNote && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MessageSquare className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          }

          // Edit mode: show dropdown with available numbers + note popover
          // Build options: current value (if any) + all available numbers
          const options: { value: string; label: string }[] = [];

          // Add current value as first option if it exists
          if (row.packageNumber) {
            options.push({
              value: row.packageNumber,
              label: row.packageNumber,
            });
          }

          // Add available numbers (these are the "next" numbers for each process)
          for (const avail of availablePackageNumbers ?? []) {
            // Don't add duplicates
            if (!options.some((o) => o.value === avail.nextNumber)) {
              options.push({
                value: avail.nextNumber,
                label: avail.nextNumber,
              });
            }
          }

          return (
            <div className="flex items-center gap-1 whitespace-nowrap">
              <select
                value={row.packageNumber || ""}
                onChange={(e) => {
                  onPackageNumberChange?.(row.clientId, e.target.value);
                }}
                className="h-7 text-xs rounded-md border border-input bg-transparent px-1 py-0.5 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-[7rem]"
              >
                <option value="">-</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <NotePopover
                note={row.notes}
                hasNote={hasNote}
                onSave={(newNote) => {
                  onNoteChange?.(row.clientId, newNote);
                }}
              />
            </div>
          );
        },
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
  }, [dropdowns, readOnly, onNoteChange, availablePackageNumbers, onPackageNumberChange]);

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
      shipmentCode: "",
    }),
    []
  );

  const renumberRows = useCallback(
    (updatedRows: OutputRow[]): OutputRow[] =>
      updatedRows.map((row, i) => ({
        ...row,
        // Preserve existing package numbers, only generate for new rows without one
        packageNumber: row.packageNumber || generateOutputNumber(i, processCode),
      })),
    [processCode]
  );

  // Use provided createRow or fall back to default
  const effectiveCreateRow = createRowProp ?? ((index: number) => createEmptyOutputRow(index, processCode));

  return (
    <DataEntryTable<OutputRow>
      columns={columns}
      rows={rows}
      onRowsChange={onRowsChange}
      getRowKey={(row) => row.clientId}
      createRow={effectiveCreateRow}
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
      isRowDisabled={isRowUsedElsewhere}
      getDisabledTooltip={() => "This package is used as input in another production entry and cannot be modified"}
    />
  );
}
