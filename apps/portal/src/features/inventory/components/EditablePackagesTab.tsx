"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DataEntryTable,
  Input,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ColumnDef,
} from "@timber/ui";
import { Truck } from "lucide-react";
import { SummaryCards } from "@/features/shipments/components/SummaryCards";
import { deleteInventoryPackage, saveInventoryPackages, updateShipmentCode } from "../actions";
import { getReferenceDropdowns } from "@/features/shipments/actions";
import { getOrganisations } from "@/features/organisations/actions";
import { PasteImportModal } from "./PasteImportModal";
import type { EditablePackageItem, ReferenceDropdowns } from "@/features/shipments/types";

// ─── Volume Helpers ───────────────────────────────────────────────────────────

/** Check if value is a range like "40-50" (contains "-" but not at position 0) */
function isRange(val: string | null): boolean {
  if (!val) return false;
  return val.includes("-") && val.indexOf("-") > 0;
}

/** Calculate volume only if all dimensions and pieces are valid single numbers */
function calculateVolume(
  thickness: string | null,
  width: string | null,
  length: string | null,
  pieces: string | null
): number | null {
  if (!thickness || !width || !length || !pieces) return null;
  // Check for ranges (like "40-50")
  if (isRange(thickness) || isRange(width) || isRange(length)) return null;
  // Check for empty or hyphen-only pieces
  if (pieces === "-" || pieces.trim() === "") return null;

  const t = parseFloat(thickness.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const l = parseFloat(length.replace(",", "."));
  const p = parseFloat(pieces.replace(",", "."));

  if (isNaN(t) || isNaN(w) || isNaN(l) || isNaN(p)) return null;
  if (t <= 0 || w <= 0 || l <= 0 || p <= 0) return null;

  return (t * w * l * p) / 1_000_000_000;
}

/** Determine if volume should be auto-calculated (read-only) or manually editable */
function shouldAutoCalculate(
  thickness: string | null,
  width: string | null,
  length: string | null,
  pieces: string | null
): boolean {
  if (!thickness || !width || !length || !pieces) return false;
  if (isRange(thickness) || isRange(width) || isRange(length)) return false;
  if (pieces === "-" || pieces.trim() === "") return false;

  // Also check if pieces is a valid number
  const p = parseFloat(pieces.replace(",", "."));
  if (isNaN(p) || p <= 0) return false;

  return true;
}

interface OrganisationOption {
  id: string;
  code: string;
  name: string;
}

// Custom dropdown that shows code in cell but full name in dropdown
function OrgDropdown({
  value,
  displayValue,
  options,
  onChange,
}: {
  value: string | null;
  displayValue: string | null;
  options: OrganisationOption[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-7 text-xs w-[3.5rem] rounded-md border border-input bg-transparent px-1 py-0.5 text-left shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center justify-between gap-0.5"
        >
          <span>{displayValue || "-"}</span>
          <svg className="h-3 w-3 opacity-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1" align="start">
        <div className="flex flex-col">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`px-2 py-1 text-xs text-left hover:bg-accent rounded whitespace-nowrap ${
                value === o.id ? "bg-accent" : ""
              }`}
            >
              {o.code} - {o.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface EditablePackagesTabProps {
  packages: EditablePackageItem[];
}

export function EditablePackagesTab({ packages }: EditablePackagesTabProps) {
  const router = useRouter();
  const [localPackages, setLocalPackages] = useState(packages);
  const [originalPackages, setOriginalPackages] = useState(packages);
  const [dropdowns, setDropdowns] = useState<ReferenceDropdowns | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [pendingShipmentCodeUpdates, setPendingShipmentCodeUpdates] = useState<Map<string, string>>(new Map());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const previousPackageIds = useRef<Set<string>>(new Set(packages.map(p => p.id)));

  // Sync local state when packages prop changes (e.g., org filter changed)
  useEffect(() => {
    setLocalPackages(packages);
    setOriginalPackages(packages);
    setDeletedIds(new Set());
    setPendingShipmentCodeUpdates(new Map());
    previousPackageIds.current = new Set(packages.map(p => p.id));
  }, [packages]);

  // Load dropdowns and organisations on mount
  useEffect(() => {
    async function loadData() {
      const [dropdownsResult, orgsResult] = await Promise.all([
        getReferenceDropdowns(),
        getOrganisations(),
      ]);

      if (dropdownsResult.success) {
        setDropdowns(dropdownsResult.data);
      } else {
        toast.error("Failed to load reference data");
      }

      if (orgsResult.success) {
        setOrganisations(orgsResult.data.map(o => ({ id: o.id, code: o.code, name: o.name })));
      } else {
        toast.error("Failed to load organisations");
      }
    }
    loadData();
  }, []);

  // Check for dirty state whenever local packages change
  useEffect(() => {
    const hasChanges = JSON.stringify(localPackages) !== JSON.stringify(originalPackages) ||
      deletedIds.size > 0 ||
      pendingShipmentCodeUpdates.size > 0;
    setIsDirty(hasChanges);
  }, [localPackages, originalPackages, deletedIds, pendingShipmentCodeUpdates]);

  // Create a new empty row
  const createRow = useCallback((): EditablePackageItem => {
    const clientId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: clientId,
      isNew: true,
      packageNumber: "",
      shipmentCode: "",
      shipmentId: "",
      organisationId: organisations[0]?.id || null,
      organisationCode: organisations[0]?.code || null,
      organisationName: organisations[0]?.name || null,
      productNameId: null,
      productName: null,
      woodSpeciesId: null,
      woodSpecies: null,
      humidityId: null,
      humidity: null,
      typeId: null,
      typeName: null,
      processingId: null,
      processing: null,
      fscId: null,
      fsc: null,
      qualityId: null,
      quality: null,
      thickness: null,
      width: null,
      length: null,
      pieces: null,
      volumeM3: null,
      volumeIsCalculated: false,
      notes: null,
    };
  }, [organisations]);

  // Copy a row - explicitly preserve all editable fields to avoid stale closure issues
  const copyRow = useCallback((row: EditablePackageItem): EditablePackageItem => {
    const clientId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: clientId,
      isNew: true,
      packageNumber: row.packageNumber,
      shipmentCode: row.shipmentCode, // Explicitly preserve the current shipment code
      shipmentId: "", // Clear shipment ID so it's treated as new
      organisationId: row.organisationId,
      organisationCode: row.organisationCode,
      organisationName: row.organisationName,
      productNameId: row.productNameId,
      productName: row.productName,
      woodSpeciesId: row.woodSpeciesId,
      woodSpecies: row.woodSpecies,
      humidityId: row.humidityId,
      humidity: row.humidity,
      typeId: row.typeId,
      typeName: row.typeName,
      processingId: row.processingId,
      processing: row.processing,
      fscId: row.fscId,
      fsc: row.fsc,
      qualityId: row.qualityId,
      quality: row.quality,
      thickness: row.thickness,
      width: row.width,
      length: row.length,
      pieces: row.pieces,
      volumeM3: row.volumeM3,
      volumeIsCalculated: row.volumeIsCalculated,
      notes: row.notes,
    };
  }, []);

  const handleCellChange = useCallback((
    row: EditablePackageItem,
    columnKey: string,
    value: string
  ): EditablePackageItem => {
    // Handle shipment code changes - track for later save
    if (columnKey === "shipmentCode") {
      const newCode = value.toUpperCase();
      const updated = { ...row, shipmentCode: newCode };

      // Track shipment code update for packages with existing shipmentId
      if (row.shipmentId && !row.isNew) {
        setPendingShipmentCodeUpdates(prev => new Map(prev).set(row.shipmentId, newCode));
      }

      return updated;
    }

    // Handle organisation changes
    if (columnKey === "organisationId") {
      const org = organisations.find(o => o.id === value);
      return {
        ...row,
        organisationId: value || null,
        organisationCode: org?.code || null,
        organisationName: org?.name || null,
      };
    }

    // Handle manual volume entry
    if (columnKey === "volumeM3") {
      const num = parseFloat(value);
      return {
        ...row,
        volumeM3: isNaN(num) ? null : num,
        volumeIsCalculated: false, // Manual entry
      };
    }

    const updated = { ...row, [columnKey]: value || null };

    // Update display value when ID changes
    if (dropdowns) {
      if (columnKey === "productNameId") {
        updated.productName = dropdowns.productNames.find(o => o.id === value)?.value ?? null;
      } else if (columnKey === "woodSpeciesId") {
        updated.woodSpecies = dropdowns.woodSpecies.find(o => o.id === value)?.value ?? null;
      } else if (columnKey === "humidityId") {
        updated.humidity = dropdowns.humidity.find(o => o.id === value)?.value ?? null;
      } else if (columnKey === "typeId") {
        updated.typeName = dropdowns.types.find(o => o.id === value)?.value ?? null;
      } else if (columnKey === "processingId") {
        updated.processing = dropdowns.processing.find(o => o.id === value)?.value ?? null;
      } else if (columnKey === "fscId") {
        updated.fsc = dropdowns.fsc.find(o => o.id === value)?.value ?? null;
      } else if (columnKey === "qualityId") {
        updated.quality = dropdowns.quality.find(o => o.id === value)?.value ?? null;
      }
    }

    // Recalculate volume when dimensions change
    if (["thickness", "width", "length", "pieces"].includes(columnKey)) {
      if (shouldAutoCalculate(updated.thickness, updated.width, updated.length, updated.pieces)) {
        const vol = calculateVolume(
          updated.thickness,
          updated.width,
          updated.length,
          updated.pieces
        );
        if (vol !== null) {
          updated.volumeM3 = vol;
          updated.volumeIsCalculated = true;
        }
      } else {
        // Can't auto-calculate - allow manual entry
        updated.volumeIsCalculated = false;
      }
    }

    return updated;
  }, [dropdowns, organisations]);

  const handleRowsChange = useCallback((rows: EditablePackageItem[]) => {
    // Detect deleted rows
    const currentIds = new Set(rows.map(r => r.id));
    const newlyDeletedIds = [...previousPackageIds.current].filter(id =>
      !currentIds.has(id) && !id.startsWith("new-")
    );

    if (newlyDeletedIds.length > 0) {
      setDeletedIds(prev => {
        const next = new Set(prev);
        newlyDeletedIds.forEach(id => next.add(id));
        return next;
      });
    }

    previousPackageIds.current = currentIds;
    setLocalPackages(rows);
  }, []);

  // Save all changes
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      // 1. Delete any packages that were removed
      for (const deletedId of deletedIds) {
        const result = await deleteInventoryPackage(deletedId);
        if (!result.success) {
          toast.error(`Failed to delete package: ${result.error}`);
        }
      }

      // 2. Update shipment codes
      for (const [shipmentId, newCode] of pendingShipmentCodeUpdates) {
        const result = await updateShipmentCode(shipmentId, newCode);
        if (!result.success) {
          toast.error(`Failed to update shipment code: ${result.error}`);
        }
      }

      // 3. Save all packages (new and modified)
      const packagesToSave = localPackages.map(pkg => ({
        id: pkg.id,
        isNew: pkg.isNew,
        packageNumber: pkg.packageNumber,
        shipmentCode: pkg.shipmentCode, // Include shipment code for new packages
        organisationId: pkg.organisationId,
        productNameId: pkg.productNameId,
        woodSpeciesId: pkg.woodSpeciesId,
        humidityId: pkg.humidityId,
        typeId: pkg.typeId,
        processingId: pkg.processingId,
        fscId: pkg.fscId,
        qualityId: pkg.qualityId,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: pkg.pieces,
        volumeM3: pkg.volumeM3,
        volumeIsCalculated: pkg.volumeIsCalculated,
      }));

      const result = await saveInventoryPackages(packagesToSave);

      if (result.success) {
        const { updated, created, errors } = result.data;
        if (errors.length > 0) {
          toast.warning(`Saved with warnings: ${errors.join("; ")}`);
        } else {
          toast.success(`Saved: ${updated} updated, ${created} created`);
        }

        // Reset dirty state
        setDeletedIds(new Set());
        setPendingShipmentCodeUpdates(new Map());

        // If new packages were created, refresh to get real database IDs
        if (created > 0) {
          router.refresh();
        } else {
          // Just update local state for updates only
          const savedPackages = localPackages.map(pkg => ({ ...pkg, isNew: false }));
          setLocalPackages(savedPackages);
          setOriginalPackages(savedPackages);
        }
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Failed to save changes");
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [localPackages, deletedIds, pendingShipmentCodeUpdates, router]);

  // Discard changes
  const handleDiscard = useCallback(() => {
    setLocalPackages(originalPackages);
    setDeletedIds(new Set());
    setPendingShipmentCodeUpdates(new Map());
    previousPackageIds.current = new Set(originalPackages.map(p => p.id));
  }, [originalPackages]);

  // Import packages from spreadsheet paste
  const handleImport = useCallback((importedPackages: EditablePackageItem[]) => {
    setLocalPackages(prev => [...prev, ...importedPackages]);
    // Update tracking for new packages
    const newIds = new Set(importedPackages.map(p => p.id));
    previousPackageIds.current = new Set([...previousPackageIds.current, ...newIds]);
    toast.success(`Imported ${importedPackages.length} package${importedPackages.length !== 1 ? "s" : ""}`);
  }, []);

  const columns: ColumnDef<EditablePackageItem>[] = useMemo(
    () => {
      if (!dropdowns || organisations.length === 0) return [];

      return [
        {
          key: "organisationId",
          label: "Org",
          type: "custom",
          navigable: true,
          options: organisations.map(o => ({ id: o.id, value: `${o.code} - ${o.name}` })),
          getValue: (row) => row.organisationId ?? "",
          getDisplayValue: (row) => row.organisationCode ?? "",
          width: "w-[3.5rem]",
          renderCell: (row, _renderIndex, _originalIndex, onChange) => {
            if (row.isOnTheWay) {
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Truck className="h-4 w-4 text-amber-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">On The Way</p>
                      <p className="text-xs text-muted-foreground">{row.onTheWayFrom} → {row.onTheWayTo}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return (
              <OrgDropdown
                value={row.organisationId}
                displayValue={row.organisationCode}
                options={organisations}
                onChange={onChange}
              />
            );
          },
        },
        {
          key: "shipmentCode",
          label: "Shipment",
          type: "text",
          navigable: true,
          getValue: (row) => row.shipmentCode,
          width: "w-[6rem]",
        },
        {
          key: "packageNumber",
          label: "Package",
          type: "text",
          navigable: true,
          getValue: (row) => row.packageNumber,
          totalType: "count",
          formatTotal: (v) => String(v),
          width: "w-[8rem]",
        },
        {
          key: "productNameId",
          label: "Product",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.productNames.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.productNameId ?? "",
          getDisplayValue: (row) => row.productName ?? "",
        },
        {
          key: "woodSpeciesId",
          label: "Species",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.woodSpecies.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.woodSpeciesId ?? "",
          getDisplayValue: (row) => row.woodSpecies ?? "",
        },
        {
          key: "humidityId",
          label: "Humidity",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.humidity.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.humidityId ?? "",
          getDisplayValue: (row) => row.humidity ?? "",
        },
        {
          key: "typeId",
          label: "Type",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.types.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.typeId ?? "",
          getDisplayValue: (row) => row.typeName ?? "",
        },
        {
          key: "processingId",
          label: "Processing",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.processing.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.processingId ?? "",
          getDisplayValue: (row) => row.processing ?? "",
        },
        {
          key: "fscId",
          label: "FSC",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.fsc.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.fscId ?? "",
          getDisplayValue: (row) => row.fsc ?? "",
        },
        {
          key: "qualityId",
          label: "Quality",
          type: "dropdown",
          collapsible: true,
          navigable: true,
          options: dropdowns.quality.map(o => ({ id: o.id, value: o.value })),
          getValue: (row) => row.qualityId ?? "",
          getDisplayValue: (row) => row.quality ?? "",
        },
        {
          key: "thickness",
          label: "Thick",
          type: "text",
          isNumeric: true,
          navigable: true,
          getValue: (row) => row.thickness ?? "",
          width: "w-[4rem]",
        },
        {
          key: "width",
          label: "Width",
          type: "text",
          isNumeric: true,
          navigable: true,
          getValue: (row) => row.width ?? "",
          width: "w-[4rem]",
        },
        {
          key: "length",
          label: "Length",
          type: "text",
          isNumeric: true,
          navigable: true,
          getValue: (row) => row.length ?? "",
          width: "w-[5rem]",
        },
        {
          key: "pieces",
          label: "Pcs",
          type: "text",
          isNumeric: true,
          navigable: true,
          getValue: (row) => row.pieces ?? "",
          width: "w-[4rem]",
          totalType: "sum",
          formatTotal: (v) => String(Math.round(v)),
        },
        {
          key: "volumeM3",
          label: "Vol m³",
          type: "custom",
          isNumeric: true,
          getValue: (row) => {
            const vol = typeof row.volumeM3 === "number" ? row.volumeM3 : parseFloat(String(row.volumeM3 ?? ""));
            return !isNaN(vol) ? vol.toFixed(3) : "";
          },
          getDisplayValue: (row) => {
            const vol = typeof row.volumeM3 === "number" ? row.volumeM3 : parseFloat(String(row.volumeM3 ?? ""));
            return !isNaN(vol) ? vol.toFixed(3).replace(".", ",") : "";
          },
          totalType: "sum",
          formatTotal: (v) => v.toFixed(3).replace(".", ","),
          renderCell: (row, renderIndex, originalIndex, onChange, onKeyDown) => {
            const vol = typeof row.volumeM3 === "number" ? row.volumeM3 : parseFloat(String(row.volumeM3 ?? ""));
            const hasValidVolume = !isNaN(vol) && vol > 0;
            const displayValue = hasValidVolume ? vol.toFixed(3).replace(".", ",") : "";

            // Volume is read-only (auto-calculated) when all dimensions and pieces are valid numbers
            // Otherwise it's editable for manual entry
            const isAutoCalculated = shouldAutoCalculate(row.thickness, row.width, row.length, row.pieces);

            if (isAutoCalculated) {
              return (
                <span className="inline-flex items-center h-7 text-xs w-[5rem] px-1 whitespace-nowrap" title="Auto-calculated">
                  {displayValue}
                </span>
              );
            }
            return (
              <Input
                id={`det-${renderIndex}-volumeM3`}
                className="h-7 text-xs w-[5rem] px-1"
                placeholder="0,000"
                value={displayValue}
                onChange={(e) => {
                  const val = e.target.value.replace(",", ".");
                  const num = parseFloat(val);
                  onChange(isNaN(num) ? "" : num.toFixed(3));
                }}
                onKeyDown={onKeyDown}
              />
            );
          },
        },
      ];
    },
    [dropdowns, organisations]
  );

  const [displayedPackages, setDisplayedPackages] = useState<EditablePackageItem[]>(packages);

  const handleDisplayRowsChange = useCallback((rows: EditablePackageItem[]) => {
    setDisplayedPackages(rows);
  }, []);

  const summaryItems = useMemo(
    () => [
      {
        label: "Total m³",
        value: displayedPackages
          .reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0)
          .toFixed(3)
          .replace(".", ","),
      },
      { label: "Total Packages", value: displayedPackages.length },
      {
        label: "Total Pieces",
        value: displayedPackages.reduce((sum, p) => {
          const n = p.pieces ? parseInt(p.pieces, 10) : 0;
          return sum + (isNaN(n) ? 0 : n);
        }, 0),
      },
    ],
    [displayedPackages]
  );

  if (!dropdowns || organisations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <SummaryCards items={summaryItems} />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            Import from Spreadsheet
          </Button>
          {isDirty && (
            <>
              <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      <DataEntryTable<EditablePackageItem>
        columns={columns}
        rows={localPackages}
        onRowsChange={handleRowsChange}
        getRowKey={(row) => row.id}
        getRowClassName={(row) => row.isOnTheWay ? "bg-amber-50" : undefined}
        onCellChange={handleCellChange}
        createRow={createRow}
        copyRow={copyRow}
        collapseStorageKey="editable-inventory-collapsed"
        onDisplayRowsChange={handleDisplayRowsChange}
      />

      <PasteImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        dropdowns={dropdowns}
        organisations={organisations}
        onImport={handleImport}
      />
    </div>
  );
}
