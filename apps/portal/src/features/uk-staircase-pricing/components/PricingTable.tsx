"use client";

import { useCallback, useMemo } from "react";
import { Input, DataEntryTable, type ColumnDef } from "@timber/ui";
import type { PricingRow, ProductType, GlobalParams } from "../types";
import {
  recalculateRowWithParams,
  formatCents,
  formatDecimal,
  centsToEurInput,
  centsToWholeEurInput,
  eurInputToCents,
  DEFAULT_GLOBAL_PARAMS,
} from "../types";

interface PricingTableProps {
  rows: PricingRow[];
  onRowsChange: (rows: PricingRow[]) => void;
  globalParams?: GlobalParams;
}

const PRODUCT_TYPES: { id: ProductType; value: string }[] = [
  { id: "FJ", value: "FJ" },
  { id: "FS", value: "FS" },
  { id: "FJFS", value: "FJFS" },
];

function generateClientId(): string {
  return `price-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createEmptyRow(index: number, params: GlobalParams): PricingRow {
  return recalculateRowWithParams({
    clientId: generateClientId(),
    id: null,
    code: "",
    name: "",
    productType: "FJ",
    thicknessMm: "",
    widthMm: "",
    riserMm: "",
    lengthMm: "",
    eurPerM3Cents: "",
    workCostCents: "0",
    transportCostCents: "0",
    gbpRate: "9000",
    isActive: true,
    sortOrder: index,
    m3PerPiece: "",
    eurPerPiece: "",
    totalEurCents: "",
    priceGbpCents: "",
    finalPriceCents: "0",
    isNew: true,
    isDeleted: false,
  }, params);
}

export function PricingTable({ rows, onRowsChange, globalParams = DEFAULT_GLOBAL_PARAMS }: PricingTableProps) {
  const columns: ColumnDef<PricingRow>[] = useMemo(
    () => [
      // Code (auto-generated: Name + Thickness + Type + Length)
      {
        key: "code",
        label: "Code",
        type: "readonly",
        getValue: (row) => row.code,
        getDisplayValue: (row) => {
          const name = row.name || "";
          const thickness = row.thicknessMm || "";
          const type = row.productType || "";
          const length = row.lengthMm || "";
          if (!name && !thickness && !length) return "-";
          return `${name}${thickness}${type}${length}`;
        },
              },
      // Name
      {
        key: "name",
        label: "Name",
        type: "text",
        placeholder: "Name",
        width: "w-[4.5rem]",
        navigable: true,
        getValue: (row) => row.name,
      },
      // Type (dropdown)
      {
        key: "productType",
        label: "Type",
        type: "dropdown",
        options: PRODUCT_TYPES,
        navigable: true,
        getValue: (row) => row.productType,
      },
      // Thickness
      {
        key: "thicknessMm",
        label: "Thick",
        type: "text",
        placeholder: "mm",
        width: "w-[3.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.thicknessMm,
      },
      // Width
      {
        key: "widthMm",
        label: "Width",
        type: "text",
        placeholder: "mm",
        width: "w-[3.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.widthMm,
      },
      // Riser (nullable)
      {
        key: "riserMm",
        label: "Riser",
        type: "text",
        placeholder: "-",
        width: "w-[3.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.riserMm,
      },
      // Length
      {
        key: "lengthMm",
        label: "Length",
        type: "text",
        placeholder: "mm",
        width: "w-[3.5rem]",
        isNumeric: true,
        navigable: true,
        getValue: (row) => row.lengthMm,
      },
      // m³/piece (calculated, readonly)
      {
        key: "m3PerPiece",
        label: "m³/pc",
        type: "readonly",
        isNumeric: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.m3PerPiece,
        getDisplayValue: (row) => formatDecimal(row.m3PerPiece, 4),
      },
      // EUR/m³ (input, stored in cents, displayed as whole EUR)
      {
        key: "eurPerM3Cents",
        label: "EUR/m³",
        type: "custom",
        isNumeric: true,
        navigable: true,
        width: "w-[3rem]",
        getValue: (row) => row.eurPerM3Cents,
        getDisplayValue: (row) => formatCents(row.eurPerM3Cents, "EUR"),
        renderCell: (row, renderIndex, originalIndex, onChange, onKeyDown) => (
          <Input
            id={`price-${renderIndex}-eurPerM3Cents`}
            className="h-7 text-sm w-full px-1 text-right"
            placeholder="0"
            value={centsToWholeEurInput(row.eurPerM3Cents)}
            onChange={(e) => onChange(eurInputToCents(e.target.value))}
            onKeyDown={onKeyDown}
          />
        ),
      },
      // EUR/piece (calculated, readonly)
      {
        key: "eurPerPiece",
        label: "EUR/pc",
        type: "readonly",
        isNumeric: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.eurPerPiece,
        getDisplayValue: (row) => formatCents(row.eurPerPiece, "EUR"),
      },
      // Work cost (input, stored in cents, displayed as EUR)
      {
        key: "workCostCents",
        label: "Work",
        type: "custom",
        isNumeric: true,
        navigable: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.workCostCents,
        getDisplayValue: (row) => formatCents(row.workCostCents, "EUR"),
        renderCell: (row, renderIndex, originalIndex, onChange, onKeyDown) => (
          <Input
            id={`price-${renderIndex}-workCostCents`}
            className="h-7 text-sm w-full px-1 text-right"
            placeholder="0"
            value={centsToEurInput(row.workCostCents)}
            onChange={(e) => onChange(eurInputToCents(e.target.value))}
            onKeyDown={onKeyDown}
          />
        ),
      },
      // Transport cost (input, stored in cents, displayed as EUR)
      {
        key: "transportCostCents",
        label: "Transp",
        type: "custom",
        isNumeric: true,
        navigable: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.transportCostCents,
        getDisplayValue: (row) => formatCents(row.transportCostCents, "EUR"),
        renderCell: (row, renderIndex, originalIndex, onChange, onKeyDown) => (
          <Input
            id={`price-${renderIndex}-transportCostCents`}
            className="h-7 text-sm w-full px-1 text-right"
            placeholder="0"
            value={centsToEurInput(row.transportCostCents)}
            onChange={(e) => onChange(eurInputToCents(e.target.value))}
            onKeyDown={onKeyDown}
          />
        ),
      },
      // Total EUR (calculated, readonly)
      {
        key: "totalEurCents",
        label: "Total",
        type: "readonly",
        isNumeric: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.totalEurCents,
        getDisplayValue: (row) => formatCents(row.totalEurCents, "EUR"),
      },
      // Price GBP (calculated, readonly)
      {
        key: "priceGbpCents",
        label: "GBP",
        type: "readonly",
        isNumeric: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.priceGbpCents,
        getDisplayValue: (row) => formatCents(row.priceGbpCents, "GBP"),
      },
      // Final Price (from PDF, editable)
      {
        key: "finalPriceCents",
        label: "Price",
        type: "custom",
        isNumeric: true,
        navigable: true,
        width: "w-[3.5rem]",
        getValue: (row) => row.finalPriceCents,
        getDisplayValue: (row) => formatCents(row.finalPriceCents, "GBP"),
        renderCell: (row, renderIndex, originalIndex, onChange, onKeyDown) => (
          <Input
            id={`price-${renderIndex}-finalPriceCents`}
            className="h-7 text-sm w-full px-1 text-right"
            placeholder="0"
            value={centsToEurInput(row.finalPriceCents)}
            onChange={(e) => onChange(eurInputToCents(e.target.value))}
            onKeyDown={onKeyDown}
          />
        ),
      },
    ],
    []
  );

  const handleCellChange = useCallback(
    (row: PricingRow, columnKey: string, value: string): PricingRow => {
      const updated = { ...row, [columnKey]: value };
      // Recalculate derived fields when relevant inputs change
      if (
        [
          "name",
          "productType",
          "thicknessMm",
          "widthMm",
          "lengthMm",
          "eurPerM3Cents",
          "workCostCents",
          "transportCostCents",
        ].includes(columnKey)
      ) {
        return recalculateRowWithParams(updated, globalParams);
      }
      return updated;
    },
    [globalParams]
  );

  const handleCreateRow = useCallback(
    (index: number) => createEmptyRow(index, globalParams),
    [globalParams]
  );

  const handleCopyRow = useCallback(
    (source: PricingRow): PricingRow => ({
      ...source,
      clientId: generateClientId(),
      id: null,
      code: `${source.code}-copy`,
      isNew: true,
    }),
    []
  );

  const renumberRows = useCallback((updatedRows: PricingRow[]): PricingRow[] => {
    return updatedRows.map((row, i) => ({
      ...row,
      sortOrder: i,
    }));
  }, []);

  return (
    <DataEntryTable<PricingRow>
      columns={columns}
      rows={rows}
      onRowsChange={onRowsChange}
      getRowKey={(row) => row.clientId}
      createRow={handleCreateRow}
      copyRow={handleCopyRow}
      renumberRows={renumberRows}
      onCellChange={handleCellChange}
      title="UK Staircase Pricing"
      addRowLabel="Add Product"
      collapseStorageKey="uk-staircase-pricing-collapsed"
      idPrefix="price"
      allowEmpty={true}
    />
  );
}
