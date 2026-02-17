"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { DataEntryTable, Button, type ColumnDef } from "@timber/ui";
import { Save, Loader2 } from "lucide-react";
import { getReferenceDropdowns } from "../actions";
import { saveIncomingShipmentPackages } from "../actions/saveIncomingShipmentPackages";
import type { PackageDetail, ReferenceDropdowns } from "../types";

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
  if (isRange(thickness) || isRange(width) || isRange(length)) return null;
  if (pieces === "-" || pieces.trim() === "") return null;

  const t = parseFloat(thickness.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const l = parseFloat(length.replace(",", "."));
  const p = parseFloat(pieces.replace(",", "."));

  if (isNaN(t) || isNaN(w) || isNaN(l) || isNaN(p)) return null;
  if (t <= 0 || w <= 0 || l <= 0 || p <= 0) return null;

  return (t * w * l * p) / 1_000_000_000;
}

/** Determine if volume should be auto-calculated */
function shouldAutoCalculate(
  thickness: string | null,
  width: string | null,
  length: string | null,
  pieces: string | null
): boolean {
  if (!thickness || !width || !length || !pieces) return false;
  if (isRange(thickness) || isRange(width) || isRange(length)) return false;
  if (pieces === "-" || pieces.trim() === "") return false;
  const p = parseFloat(pieces.replace(",", "."));
  if (isNaN(p) || p <= 0) return false;
  return true;
}

/** Format volume with German locale */
function formatVolume(vol: number | null): string {
  if (vol === null || vol === 0) return "";
  return vol.toLocaleString("de-DE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/** Parse volume string to number */
function parseVolume(val: string): number | null {
  if (!val || val === "-") return null;
  const parsed = parseFloat(val.replace(",", "."));
  return isNaN(parsed) ? null : parsed;
}

// ─── Row Type ─────────────────────────────────────────────────────────────────

interface PackageRow {
  id: string;
  isNew?: boolean;
  packageNumber: string;
  productNameId: string | null;
  productName: string | null;
  woodSpeciesId: string | null;
  woodSpecies: string | null;
  humidityId: string | null;
  humidity: string | null;
  typeId: string | null;
  typeName: string | null;
  processingId: string | null;
  processing: string | null;
  fscId: string | null;
  fsc: string | null;
  qualityId: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  volumeIsCalculated: boolean;
  palletId: string | null;
}

interface IncomingShipmentPackageEditorProps {
  shipmentId: string;
  shipmentCode: string;
  packages: PackageDetail[];
  onRefresh: () => void;
}

export function IncomingShipmentPackageEditor({
  shipmentId,
  shipmentCode,
  packages,
  onRefresh,
}: IncomingShipmentPackageEditorProps) {
  // Convert PackageDetail to PackageRow
  const initialRows = useMemo(
    () =>
      packages.map((pkg) => ({
        id: pkg.id,
        isNew: false,
        packageNumber: pkg.packageNumber,
        productNameId: pkg.productNameId,
        productName: pkg.productName,
        woodSpeciesId: pkg.woodSpeciesId,
        woodSpecies: pkg.woodSpecies,
        humidityId: pkg.humidityId,
        humidity: pkg.humidity,
        typeId: pkg.typeId,
        typeName: pkg.typeName,
        processingId: pkg.processingId,
        processing: pkg.processing,
        fscId: pkg.fscId,
        fsc: pkg.fsc,
        qualityId: pkg.qualityId,
        quality: pkg.quality,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: pkg.pieces,
        volumeM3: pkg.volumeM3,
        volumeIsCalculated: pkg.volumeIsCalculated,
        palletId: pkg.palletId,
      })),
    [packages]
  );

  const [localPackages, setLocalPackages] = useState<PackageRow[]>(initialRows);
  const [originalPackages, setOriginalPackages] = useState<PackageRow[]>(initialRows);
  const [dropdowns, setDropdowns] = useState<ReferenceDropdowns | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Sync local state when packages prop changes
  useEffect(() => {
    const newRows = packages.map((pkg) => ({
      id: pkg.id,
      isNew: false,
      packageNumber: pkg.packageNumber,
      productNameId: pkg.productNameId,
      productName: pkg.productName,
      woodSpeciesId: pkg.woodSpeciesId,
      woodSpecies: pkg.woodSpecies,
      humidityId: pkg.humidityId,
      humidity: pkg.humidity,
      typeId: pkg.typeId,
      typeName: pkg.typeName,
      processingId: pkg.processingId,
      processing: pkg.processing,
      fscId: pkg.fscId,
      fsc: pkg.fsc,
      qualityId: pkg.qualityId,
      quality: pkg.quality,
      thickness: pkg.thickness,
      width: pkg.width,
      length: pkg.length,
      pieces: pkg.pieces,
      volumeM3: pkg.volumeM3,
      volumeIsCalculated: pkg.volumeIsCalculated,
      palletId: pkg.palletId,
    }));
    setLocalPackages(newRows);
    setOriginalPackages(newRows);
    setDeletedIds(new Set());
  }, [packages]);

  // Load dropdowns on mount
  useEffect(() => {
    async function loadDropdowns() {
      const result = await getReferenceDropdowns();
      if (result.success) {
        setDropdowns(result.data);
      } else {
        toast.error("Failed to load reference data");
      }
    }
    loadDropdowns();
  }, []);

  // Check for dirty state
  useEffect(() => {
    const hasChanges =
      JSON.stringify(localPackages) !== JSON.stringify(originalPackages) ||
      deletedIds.size > 0;
    setIsDirty(hasChanges);
  }, [localPackages, originalPackages, deletedIds]);

  // Track deleted rows
  const handleRowsChange = useCallback(
    (rows: PackageRow[]) => {
      // Find deleted rows
      const currentIds = new Set(rows.map((r) => r.id));
      for (const pkg of localPackages) {
        if (!currentIds.has(pkg.id) && !pkg.isNew && !pkg.id.startsWith("new-")) {
          setDeletedIds((prev) => new Set(prev).add(pkg.id));
        }
      }
      setLocalPackages(rows);
    },
    [localPackages]
  );

  // Create a new empty row
  const createRow = useCallback(
    (index: number): PackageRow => {
      const clientId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const pkgNum = `${shipmentCode}-${String(index + 1).padStart(3, "0")}`;
      return {
        id: clientId,
        isNew: true,
        packageNumber: pkgNum,
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
        palletId: null,
      };
    },
    [shipmentCode]
  );

  // Copy a row
  const copyRow = useCallback((source: PackageRow, newIndex: number): PackageRow => {
    const clientId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...source,
      id: clientId,
      isNew: true,
      packageNumber: "",
    };
  }, []);

  // Renumber rows (auto-generate package numbers for new rows)
  const renumberRows = useCallback(
    (rows: PackageRow[]): PackageRow[] => {
      let seq = 1;
      return rows.map((row) => {
        if (row.isNew && !row.packageNumber) {
          const pkgNum = `${shipmentCode}-${String(seq).padStart(3, "0")}`;
          seq++;
          return { ...row, packageNumber: pkgNum };
        }
        seq++;
        return row;
      });
    },
    [shipmentCode]
  );

  // Handle cell change - returns updated row
  const handleCellChange = useCallback(
    (row: PackageRow, columnKey: string, value: string): PackageRow => {
      const updated = { ...row };

      // Handle dropdown columns - need to update both ID and display value
      if (columnKey === "productNameId" && dropdowns) {
        const opt = dropdowns.productNames.find((o) => o.id === value);
        updated.productNameId = value || null;
        updated.productName = opt?.value ?? null;
      } else if (columnKey === "woodSpeciesId" && dropdowns) {
        const opt = dropdowns.woodSpecies.find((o) => o.id === value);
        updated.woodSpeciesId = value || null;
        updated.woodSpecies = opt?.value ?? null;
      } else if (columnKey === "humidityId" && dropdowns) {
        const opt = dropdowns.humidity.find((o) => o.id === value);
        updated.humidityId = value || null;
        updated.humidity = opt?.value ?? null;
      } else if (columnKey === "typeId" && dropdowns) {
        const opt = dropdowns.types.find((o) => o.id === value);
        updated.typeId = value || null;
        updated.typeName = opt?.value ?? null;
      } else if (columnKey === "processingId" && dropdowns) {
        const opt = dropdowns.processing.find((o) => o.id === value);
        updated.processingId = value || null;
        updated.processing = opt?.value ?? null;
      } else if (columnKey === "fscId" && dropdowns) {
        const opt = dropdowns.fsc.find((o) => o.id === value);
        updated.fscId = value || null;
        updated.fsc = opt?.value ?? null;
      } else if (columnKey === "qualityId" && dropdowns) {
        const opt = dropdowns.quality.find((o) => o.id === value);
        updated.qualityId = value || null;
        updated.quality = opt?.value ?? null;
      } else if (columnKey === "volumeM3") {
        // Manual volume entry
        updated.volumeM3 = parseVolume(value);
        updated.volumeIsCalculated = false;
      } else {
        // Text fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (updated as any)[columnKey] = value || null;

        // Recalculate volume if dimensions/pieces changed
        if (["thickness", "width", "length", "pieces"].includes(columnKey)) {
          const t = columnKey === "thickness" ? value : updated.thickness;
          const w = columnKey === "width" ? value : updated.width;
          const l = columnKey === "length" ? value : updated.length;
          const p = columnKey === "pieces" ? value : updated.pieces;

          if (shouldAutoCalculate(t, w, l, p)) {
            updated.volumeM3 = calculateVolume(t, w, l, p);
            updated.volumeIsCalculated = true;
          }
        }
      }

      return updated;
    },
    [dropdowns]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    // Allow saving empty list (just deletions)
    if (localPackages.length === 0 && deletedIds.size === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);

    const packagesToSave = localPackages.map((pkg) => ({
      id: pkg.id,
      isNew: pkg.isNew,
      packageNumber: pkg.packageNumber,
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
      palletId: pkg.palletId,
    }));

    const result = await saveIncomingShipmentPackages(
      shipmentId,
      packagesToSave,
      Array.from(deletedIds)
    );

    setIsSaving(false);

    if (result.success) {
      const { created, updated, deleted, errors } = result.data;
      const parts: string[] = [];
      if (created > 0) parts.push(`${created} created`);
      if (updated > 0) parts.push(`${updated} updated`);
      if (deleted > 0) parts.push(`${deleted} deleted`);

      if (parts.length > 0) {
        toast.success(`Packages saved: ${parts.join(", ")}`);
      } else if (errors.length > 0) {
        toast.warning(errors.join("; "));
      } else {
        toast.success("Saved");
      }

      setDeletedIds(new Set());
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }, [localPackages, deletedIds, shipmentId, onRefresh]);

  // Build column definitions
  const columns = useMemo((): ColumnDef<PackageRow>[] => {
    const cols: ColumnDef<PackageRow>[] = [
      {
        key: "packageNumber",
        label: "Package",
        type: "text",
        width: "w-[7.5rem]",
        getValue: (row) => row.packageNumber ?? "",
      },
      {
        key: "productNameId",
        label: "Product",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.productNames.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.productNameId ?? "",
        getDisplayValue: (row) => row.productName ?? "",
      },
      {
        key: "woodSpeciesId",
        label: "Species",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.woodSpecies.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.woodSpeciesId ?? "",
        getDisplayValue: (row) => row.woodSpecies ?? "",
      },
      {
        key: "humidityId",
        label: "Humidity",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.humidity.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.humidityId ?? "",
        getDisplayValue: (row) => row.humidity ?? "",
      },
      {
        key: "typeId",
        label: "Type",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.types.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.typeId ?? "",
        getDisplayValue: (row) => row.typeName ?? "",
      },
      {
        key: "processingId",
        label: "Processing",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.processing.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.processingId ?? "",
        getDisplayValue: (row) => row.processing ?? "",
      },
      {
        key: "fscId",
        label: "FSC",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.fsc.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.fscId ?? "",
        getDisplayValue: (row) => row.fsc ?? "",
      },
      {
        key: "qualityId",
        label: "Quality",
        type: "dropdown",
        collapsible: true,
        options: dropdowns?.quality.map((o) => ({ id: o.id, value: o.value })) ?? [],
        getValue: (row) => row.qualityId ?? "",
        getDisplayValue: (row) => row.quality ?? "",
      },
      {
        key: "thickness",
        label: "Thick.",
        type: "text",
        width: "w-[3.5rem]",
        getValue: (row) => row.thickness ?? "",
        isNumeric: true,
      },
      {
        key: "width",
        label: "Width",
        type: "text",
        width: "w-[3.5rem]",
        getValue: (row) => row.width ?? "",
        isNumeric: true,
      },
      {
        key: "length",
        label: "Length",
        type: "text",
        width: "w-[3.5rem]",
        getValue: (row) => row.length ?? "",
        isNumeric: true,
      },
      {
        key: "pieces",
        label: "Pieces",
        type: "text",
        width: "w-[3.5rem]",
        getValue: (row) => row.pieces ?? "",
        isNumeric: true,
        totalType: "sum",
        formatTotal: (val) => (val > 0 ? String(val) : ""),
      },
      {
        key: "volumeM3",
        label: "Vol m\u00b3",
        type: "text",
        width: "w-[4.5rem]",
        getValue: (row) => formatVolume(row.volumeM3),
        isNumeric: true,
        totalType: "sum",
        formatTotal: (val) => (val > 0 ? formatVolume(val) : ""),
      },
    ];
    return cols;
  }, [dropdowns]);

  // Calculate totals for display
  const totalVolume = localPackages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Add packages to this incoming shipment. Use the + button to add rows.
          </p>
          {totalVolume > 0 && (
            <p className="text-sm font-medium mt-1">
              Total: {formatVolume(totalVolume)} m³
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          variant={isDirty ? "default" : "outline"}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Data Entry Table */}
      <DataEntryTable
        rows={localPackages}
        columns={columns}
        onCellChange={handleCellChange}
        onRowsChange={handleRowsChange}
        createRow={createRow}
        copyRow={copyRow}
        renumberRows={renumberRows}
        getRowKey={(row) => row.id}
        collapseStorageKey="incoming-shipment-packages-collapsed"
        allowEmpty
        addRowLabel="Add Package"
      />
    </div>
  );
}
