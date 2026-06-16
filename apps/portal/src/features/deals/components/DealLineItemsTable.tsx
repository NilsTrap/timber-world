"use client";

import { DataEntryTable, type ColumnDef } from "@timber/ui";

export interface LineRow {
  clientId: string;
  lineNo: number;
  productName: string;
  woodSpecies: string;
  processing: string;
  quality: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: string;
  unitPrice: string; // major units, e.g. "120.50"
}

export function newLineRow(index: number): LineRow {
  return {
    clientId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `row-${index}-${Math.round(Math.random() * 1e9)}`,
    lineNo: index + 1,
    productName: "",
    woodSpecies: "",
    processing: "",
    quality: "",
    thickness: "",
    width: "",
    length: "",
    pieces: "",
    volumeM3: "",
    unitPrice: "",
  };
}

const COLUMNS: ColumnDef<LineRow>[] = [
  { key: "lineNo", label: "#", type: "readonly", getValue: (r) => String(r.lineNo), width: "w-10" },
  { key: "productName", label: "Product", type: "text", getValue: (r) => r.productName, placeholder: "Product" },
  { key: "woodSpecies", label: "Species", type: "text", getValue: (r) => r.woodSpecies },
  { key: "processing", label: "Processing", type: "text", getValue: (r) => r.processing },
  { key: "quality", label: "Quality", type: "text", getValue: (r) => r.quality, width: "w-20" },
  { key: "thickness", label: "Thick", type: "text", getValue: (r) => r.thickness, width: "w-16" },
  { key: "width", label: "Width", type: "text", getValue: (r) => r.width, width: "w-16" },
  { key: "length", label: "Length", type: "text", getValue: (r) => r.length, width: "w-20" },
  { key: "pieces", label: "Pcs", type: "numeric", getValue: (r) => r.pieces, width: "w-16" },
  {
    key: "volumeM3",
    label: "m³",
    type: "numeric",
    getValue: (r) => r.volumeM3,
    width: "w-20",
    totalType: "sum",
    formatTotal: (v) => v.toFixed(3),
  },
  { key: "unitPrice", label: "Unit price", type: "numeric", getValue: (r) => r.unitPrice, width: "w-24" },
];

export function DealLineItemsTable({
  rows,
  onRowsChange,
}: {
  rows: LineRow[];
  onRowsChange: (rows: LineRow[]) => void;
}) {
  return (
    <DataEntryTable<LineRow>
      columns={COLUMNS}
      rows={rows}
      onRowsChange={onRowsChange}
      getRowKey={(r) => r.clientId}
      createRow={(index) => newLineRow(index)}
      copyRow={(source, newIndex) => ({ ...source, clientId: newLineRow(newIndex).clientId, lineNo: newIndex + 1 })}
      renumberRows={(rs) => rs.map((r, i) => ({ ...r, lineNo: i + 1 }))}
      onCellChange={(row, columnKey, value) => ({ ...row, [columnKey]: value }) as LineRow}
      addRowLabel="Add line"
      allowEmpty
    />
  );
}
