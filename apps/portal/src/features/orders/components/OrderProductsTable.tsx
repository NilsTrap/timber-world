"use client";

import { useCallback, useMemo } from "react";
import { DataEntryTable, type ColumnDef } from "@timber/ui";
import type { OrderProductRow } from "../types";
import type { StaircaseCode } from "../actions/getStaircaseCodes";
import {
  generateClientId,
  createEmptyOrderProductRow,
  calculateVolume,
  calculateTransportPerPiece,
} from "../helpers/order-product-helpers";

interface ReferenceOption {
  id: string;
  value: string;
}

interface ReferenceDropdowns {
  productNames: ReferenceOption[];
  woodSpecies: ReferenceOption[];
  types: ReferenceOption[];
  quality: ReferenceOption[];
}

// Map staircase pricing product_type to ref_types value
const PRODUCT_TYPE_TO_REF: Record<string, string> = {
  FJ: "FJ",
  FS: "Full stave",
};

/** Column keys that can be hidden */
export type ProductColumnKey =
  | "staircaseCodeId" | "productNameId" | "woodSpeciesId" | "typeId" | "qualityId"
  | "thickness" | "width" | "length" | "pieces"
  | "volumeM3" | "totalVolume" | "kgPerPiece" | "totalKg" | "eurPerM3" | "eurPerPiece" | "totalEurPerPiece"
  | "workPerPiece" | "totalWork" | "transportPerPiece" | "totalTransport"
  | "unitPrice" | "totalPrice";

interface OrderProductsTableProps {
  rows: OrderProductRow[];
  dropdowns: ReferenceDropdowns;
  staircaseCodes: StaircaseCode[];
  onRowsChange: (rows: OrderProductRow[]) => void;
  readOnly?: boolean;
  /** Columns to hide from the table */
  hiddenColumns?: ProductColumnKey[];
}

function formatVolumeDisplay(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(num);
}

function formatEurDisplay(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function calcTotal(perPiece: string, pieces: string): string {
  const pp = parseFloat(perPiece) || 0;
  const pcs = parseInt(pieces, 10) || 0;
  return pp > 0 && pcs > 0 ? (pp * pcs).toFixed(2) : "";
}

export function OrderProductsTable({
  rows,
  dropdowns,
  staircaseCodes,
  onRowsChange,
  readOnly,
  hiddenColumns = [],
}: OrderProductsTableProps) {
  const codeOptions = useMemo(
    () => staircaseCodes.map((c) => ({ id: c.id, value: c.code.replace(/^Step/, "Tread") })),
    [staircaseCodes]
  );

  const columns: ColumnDef<OrderProductRow>[] = useMemo(() => {
    const cols: ColumnDef<OrderProductRow>[] = [
      // Staircase code (auto-fill trigger)
      {
        key: "staircaseCodeId",
        label: "Code",
        type: "dropdown",
        options: codeOptions,
        getValue: (row) => row.staircaseCodeId,
        width: "w-[10rem]",
      },
      // Product name
      {
        key: "productNameId",
        label: "Product",
        type: "dropdown",
        collapsible: true,
        options: dropdowns.productNames.map((o) => ({ id: o.id, value: o.value })),
        getValue: (row) => row.productNameId,
      },
      // Species
      {
        key: "woodSpeciesId",
        label: "Species",
        type: "dropdown",
        collapsible: true,
        options: dropdowns.woodSpecies.map((o) => ({ id: o.id, value: o.value })),
        getValue: (row) => row.woodSpeciesId,
      },
      // Type
      {
        key: "typeId",
        label: "Type",
        type: "dropdown",
        collapsible: true,
        options: dropdowns.types.map((o) => ({ id: o.id, value: o.value })),
        getValue: (row) => row.typeId,
      },
      // Quality
      {
        key: "qualityId",
        label: "Quality",
        type: "dropdown",
        collapsible: true,
        options: dropdowns.quality.map((o) => ({ id: o.id, value: o.value })),
        getValue: (row) => row.qualityId,
      },
      // Dimensions
      {
        key: "thickness",
        label: ["Thick", "mm"],
        type: "text",
        placeholder: "mm",
        width: "w-[4rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.thickness,
      },
      {
        key: "width",
        label: ["Width", "mm"],
        type: "text",
        placeholder: "mm",
        width: "w-[4rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.width,
      },
      {
        key: "riser",
        label: ["Riser", "mm"],
        type: "text",
        placeholder: "mm",
        width: "w-[4rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.riser,
      },
      {
        key: "length",
        label: ["Length", "mm"],
        type: "text",
        placeholder: "mm",
        width: "w-[4rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.length,
      },
      // Pieces
      {
        key: "pieces",
        label: "Pcs",
        type: "text",
        placeholder: "qty",
        width: "w-[3.5rem]",
        isNumeric: true,
        navigable: true,
        totalType: "sum",
        getValue: (row) => row.pieces,
      },
      // m³/piece
      {
        key: "volumeM3",
        label: ["m³", "/pc"],
        type: "text",
        placeholder: "0.0000",
        width: "w-[4.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.volumeM3,
        getDisplayValue: (row) => formatVolumeDisplay(row.volumeM3),
      },
      // Total m³ (readonly: vol × pcs)
      {
        key: "totalVolume",
        label: ["Tot", "m³"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (value) => value > 0 ? formatVolumeDisplay(value.toFixed(4)) : "-",
        getValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const pcs = parseInt(row.pieces, 10) || 0;
          return vol > 0 && pcs > 0 ? (vol * pcs).toFixed(4) : "";
        },
        getDisplayValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const pcs = parseInt(row.pieces, 10) || 0;
          return vol > 0 && pcs > 0 ? formatVolumeDisplay((vol * pcs).toFixed(4)) : "-";
        },
      },
      // kg/piece (readonly: m³ × 700)
      {
        key: "kgPerPiece",
        label: ["kg", "/pc"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4rem]",
        getValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          return vol > 0 ? (vol * 700).toFixed(2) : "";
        },
        getDisplayValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          return vol > 0 ? formatEurDisplay((vol * 700).toFixed(2)) : "-";
        },
      },
      // Total kg (readonly: kg/pc × pcs)
      {
        key: "totalKg",
        label: ["Tot", "kg"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (value) => value > 0 ? formatEurDisplay(value.toFixed(2)) : "-",
        getValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const pcs = parseInt(row.pieces, 10) || 0;
          const kg = vol * 700;
          return kg > 0 && pcs > 0 ? (kg * pcs).toFixed(2) : "";
        },
        getDisplayValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const pcs = parseInt(row.pieces, 10) || 0;
          const kg = vol * 700;
          return kg > 0 && pcs > 0 ? formatEurDisplay((kg * pcs).toFixed(2)) : "-";
        },
      },
      // EUR per m³
      {
        key: "eurPerM3",
        label: ["€", "/m³"],
        type: "text",
        placeholder: "0.00",
        width: "w-[4.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.eurPerM3,
        getDisplayValue: (row) => formatEurDisplay(row.eurPerM3),
      },
      // EUR per piece (readonly: m³/pc × €/m³)
      {
        key: "eurPerPiece",
        label: ["€", "/pc"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        getValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const rate = parseFloat(row.eurPerM3) || 0;
          return vol > 0 && rate > 0 ? (vol * rate).toFixed(2) : "";
        },
        getDisplayValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const rate = parseFloat(row.eurPerM3) || 0;
          return vol > 0 && rate > 0 ? formatEurDisplay((vol * rate).toFixed(2)) : "-";
        },
      },
      // Total EUR per piece (readonly: €/pc × pcs)
      {
        key: "totalEurPerPiece",
        label: ["Tot €", "/pc"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (value) => value > 0 ? formatEurDisplay(value.toFixed(2)) : "-",
        getValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const rate = parseFloat(row.eurPerM3) || 0;
          const pcs = parseInt(row.pieces, 10) || 0;
          const perPiece = vol * rate;
          return perPiece > 0 && pcs > 0 ? (perPiece * pcs).toFixed(2) : "";
        },
        getDisplayValue: (row) => {
          const vol = parseFloat(row.volumeM3) || 0;
          const rate = parseFloat(row.eurPerM3) || 0;
          const pcs = parseInt(row.pieces, 10) || 0;
          const perPiece = vol * rate;
          return perPiece > 0 && pcs > 0 ? formatEurDisplay((perPiece * pcs).toFixed(2)) : "-";
        },
      },
      // Work per piece
      {
        key: "workPerPiece",
        label: ["Work", "€/pc"],
        type: "text",
        placeholder: "0.00",
        width: "w-[4.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.workPerPiece,
        getDisplayValue: (row) => formatEurDisplay(row.workPerPiece),
      },
      // Total work (readonly: work × pcs)
      {
        key: "totalWork",
        label: ["Tot Work", "€"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (value) => value > 0 ? formatEurDisplay(value.toFixed(2)) : "-",
        getValue: (row) => calcTotal(row.workPerPiece, row.pieces),
        getDisplayValue: (row) => {
          const t = calcTotal(row.workPerPiece, row.pieces);
          return t ? formatEurDisplay(t) : "-";
        },
      },
      // Transport per piece
      {
        key: "transportPerPiece",
        label: ["Transp", "€/pc"],
        type: "text",
        placeholder: "0.00",
        width: "w-[4.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.transportPerPiece,
        getDisplayValue: (row) => formatEurDisplay(row.transportPerPiece),
      },
      // Total transport (readonly: transport × pcs)
      {
        key: "totalTransport",
        label: ["Tot Transp", "€"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (value) => value > 0 ? formatEurDisplay(value.toFixed(2)) : "-",
        getValue: (row) => calcTotal(row.transportPerPiece, row.pieces),
        getDisplayValue: (row) => {
          const t = calcTotal(row.transportPerPiece, row.pieces);
          return t ? formatEurDisplay(t) : "-";
        },
      },
      // Price per piece (GBP)
      {
        key: "unitPrice",
        label: ["Price", "£/pc"],
        type: "text",
        placeholder: "0.00",
        width: "w-[4.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.unitPrice,
        getDisplayValue: (row) => formatEurDisplay(row.unitPrice),
      },
      // Total price (readonly: price × pcs)
      {
        key: "totalPrice",
        label: ["Total", "£"],
        type: "readonly",
        isNumeric: true,
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (value) => value > 0 ? formatEurDisplay(value.toFixed(2)) : "-",
        getValue: (row) => calcTotal(row.unitPrice, row.pieces),
        getDisplayValue: (row) => {
          const t = calcTotal(row.unitPrice, row.pieces);
          return t ? formatEurDisplay(t) : "-";
        },
      },
    ];
    if (hiddenColumns.length > 0) {
      return cols.filter((c) => !hiddenColumns.includes(c.key as ProductColumnKey));
    }
    return cols;
  }, [codeOptions, dropdowns, hiddenColumns]);

  const handleCellChange = useCallback(
    (row: OrderProductRow, columnKey: string, value: string): OrderProductRow => {
      const updated: OrderProductRow = { ...row, [columnKey]: value };

      // When staircase code changes, auto-fill fields
      if (columnKey === "staircaseCodeId" && value) {
        const code = staircaseCodes.find((c) => c.id === value);
        if (code) {
          // Product name
          const matchingProduct = dropdowns.productNames.find(
            (p) => p.value.toLowerCase() === code.name.toLowerCase()
          );
          if (matchingProduct) updated.productNameId = matchingProduct.id;

          // Species (all staircase = Oak)
          const oakSpecies = dropdowns.woodSpecies.find(
            (s) => s.value.toLowerCase() === "oak"
          );
          if (oakSpecies) updated.woodSpeciesId = oakSpecies.id;

          // Type
          const refTypeName = PRODUCT_TYPE_TO_REF[code.productType];
          if (refTypeName) {
            const matchingType = dropdowns.types.find(
              (t) => t.value.toLowerCase() === refTypeName.toLowerCase()
            );
            if (matchingType) updated.typeId = matchingType.id;
          }

          // Quality (all staircase = Prime)
          const primeQuality = dropdowns.quality.find(
            (q) => q.value.toLowerCase() === "prime"
          );
          if (primeQuality) updated.qualityId = primeQuality.id;

          // Dimensions
          updated.thickness = String(code.thicknessMm);
          updated.width = String(code.widthMm);
          updated.riser = code.riserMm ? String(code.riserMm) : "";
          updated.length = String(code.lengthMm);

          // Volume per piece (width + riser, with 0.8 factor for winders)
          const vol = calculateVolume(
            String(code.thicknessMm),
            String(code.widthMm),
            String(code.lengthMm),
            code.riserMm ? String(code.riserMm) : undefined,
            code.name
          );
          if (vol !== null) {
            updated.volumeM3 = vol.toFixed(4);
          }

          // Transport per piece: base cost from pricing + 11 EUR flat fee
          if (code.transportCostCents != null) {
            updated.transportPerPiece = (code.transportCostCents / 100 + 11).toFixed(2);
          } else if (vol !== null) {
            updated.transportPerPiece = calculateTransportPerPiece(vol).toFixed(2);
          }

          // EUR per m³
          if (code.eurPerM3Cents != null) {
            updated.eurPerM3 = (code.eurPerM3Cents / 100).toFixed(2);
          }

          // Work per piece (cents → EUR)
          updated.workPerPiece = (code.workCostCents / 100).toFixed(2);

          // Price per piece (GBP)
          if (code.finalPriceCents != null) {
            updated.unitPrice = (code.finalPriceCents / 100).toFixed(2);
          }
        }
      }

      // Auto-recalculate volume and transport when dimensions change
      if (["thickness", "width", "riser", "length"].includes(columnKey)) {
        const prodName = dropdowns.productNames.find((p) => p.id === updated.productNameId)?.value;
        const vol = calculateVolume(updated.thickness, updated.width, updated.length, updated.riser, prodName);
        if (vol !== null) {
          updated.volumeM3 = vol.toFixed(4);
          updated.transportPerPiece = calculateTransportPerPiece(vol).toFixed(2);
        }
      }

      return updated;
    },
    [staircaseCodes, dropdowns]
  );

  const handleCreateRow = useCallback(
    (index: number) => createEmptyOrderProductRow(index),
    []
  );

  const handleCopyRow = useCallback(
    (source: OrderProductRow): OrderProductRow => ({
      ...source,
      clientId: generateClientId(),
      dbId: null,
    }),
    []
  );

  const renumberRows = useCallback(
    (updatedRows: OrderProductRow[]): OrderProductRow[] => updatedRows,
    []
  );

  return (
    <DataEntryTable<OrderProductRow>
      columns={columns}
      rows={rows}
      onRowsChange={onRowsChange}
      getRowKey={(row) => row.clientId}
      createRow={handleCreateRow}
      copyRow={handleCopyRow}
      renumberRows={renumberRows}
      onCellChange={handleCellChange}
      title="Ordered Products"
      addRowLabel="Add Product"
      allowEmpty
      collapseStorageKey="order-products-collapsed"
      filterStorageKey="order-products"
      idPrefix="op"
      readOnly={readOnly}
    />
  );
}
