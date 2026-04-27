"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveOrderProducts } from "../actions/saveOrderProducts";
import { OrderProductsTable, type ProductColumnKey } from "./OrderProductsTable";
import { generateClientId } from "../helpers/order-product-helpers";
import type { OrderProductRow } from "../types";
import type { OrderPackage } from "../actions/getOrderPackages";
import type { StaircaseCode } from "../actions/getStaircaseCodes";

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

interface OrderProductsSectionProps {
  orderId: string;
  organisationId: string;
  initialPackages: OrderPackage[];
  dropdowns: ReferenceDropdowns;
  staircaseCodes: StaircaseCode[];
  readOnly?: boolean;
  /** Columns to hide from the products table */
  hiddenColumns?: ProductColumnKey[];
  /** Current tab context for activity logging */
  tab?: string;
}

/** Sort rows: Tread → Winder → Quarter, then by length ascending */
function sortProductRows(rows: OrderProductRow[], productNames: { id: string; value: string }[]): OrderProductRow[] {
  const productOrder: Record<string, number> = { tread: 0, step: 0, winder: 1, quarter: 2 };
  const nameById = new Map(productNames.map((p) => [p.id, p.value.toLowerCase()]));

  return [...rows].sort((a, b) => {
    const aName = nameById.get(a.productNameId) ?? "";
    const bName = nameById.get(b.productNameId) ?? "";
    const aOrder = productOrder[aName] ?? 99;
    const bOrder = productOrder[bName] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aLen = parseInt(a.length, 10) || 0;
    const bLen = parseInt(b.length, 10) || 0;
    return aLen - bLen;
  });
}

function dbToRow(pkg: OrderPackage, staircaseCodes: StaircaseCode[]): OrderProductRow {
  const volumeM3 = pkg.volumeM3 !== null ? pkg.volumeM3 : 0;
  const code = pkg.staircaseCodeId
    ? staircaseCodes.find((c) => c.id === pkg.staircaseCodeId)
    : undefined;

  // Use stored values if available, otherwise derive from staircase code
  const eurPerM3 = pkg.eurPerM3 !== null ? pkg.eurPerM3 : (code?.eurPerM3Cents ? code.eurPerM3Cents / 100 : 0);
  const workPerPiece = pkg.workPerPiece !== null ? pkg.workPerPiece : (code?.workCostCents ? code.workCostCents / 100 : 0);
  const transportPerPiece = pkg.transportPerPiece !== null ? pkg.transportPerPiece : (code?.transportCostCents != null ? code.transportCostCents / 100 + 11 : (volumeM3 > 0 ? volumeM3 * 300 + 11 : 0));
  const eurPerPiece = volumeM3 * eurPerM3;

  return {
    clientId: generateClientId(),
    dbId: pkg.id,
    staircaseCodeId: pkg.staircaseCodeId || "",
    productNameId: "",
    woodSpeciesId: "",
    typeId: "",
    qualityId: "",
    thickness: pkg.thickness || "",
    width: pkg.width || "",
    riser: pkg.riser || "",
    length: pkg.length || "",
    pieces: pkg.pieces || "",
    volumeM3: volumeM3 !== 0 ? volumeM3.toFixed(4) : "",
    workPerPiece: workPerPiece ? workPerPiece.toFixed(2) : "",
    transportPerPiece: transportPerPiece ? transportPerPiece.toFixed(2) : "",
    eurPerM3: eurPerM3 ? eurPerM3.toFixed(2) : "",
    eurPerPiece: eurPerPiece ? eurPerPiece.toFixed(2) : "",
    unitPrice: pkg.unitPricePiece !== null ? pkg.unitPricePiece.toFixed(2) : "",
  };
}

export function OrderProductsSection({
  orderId,
  organisationId,
  initialPackages,
  dropdowns,
  staircaseCodes,
  readOnly,
  hiddenColumns,
  tab,
}: OrderProductsSectionProps) {
  // We need to resolve display values → IDs from the initial data
  // Since OrderPackage has display values, we need the raw IDs from DB
  // We'll fetch them separately or use a smarter initializer
  const [rows, setRows] = useState<OrderProductRow[]>(() => {
    const mapped = initialPackages.map((pkg) => {
      const row = dbToRow(pkg, staircaseCodes);
      // Resolve IDs from display values
      if (pkg.productName) {
        const match = dropdowns.productNames.find((p) => p.value === pkg.productName);
        if (match) row.productNameId = match.id;
      }
      if (pkg.woodSpecies) {
        const match = dropdowns.woodSpecies.find((s) => s.value === pkg.woodSpecies);
        if (match) row.woodSpeciesId = match.id;
      }
      if (pkg.typeName) {
        const match = dropdowns.types.find((t) => t.value === pkg.typeName);
        if (match) row.typeId = match.id;
      }
      if (pkg.quality) {
        const match = dropdowns.quality.find((q) => q.value === pkg.quality);
        if (match) row.qualityId = match.id;
      }
      return row;
    });
    return sortProductRows(mapped, dropdowns.productNames);
  });

  const [isPending, startTransition] = useTransition();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRowsRef = useRef<OrderProductRow[] | null>(null);
  const latestRowsRef = useRef<OrderProductRow[]>(rows);
  const saveInProgressRef = useRef(false);
  const saveQueuedRef = useRef(false);

  useEffect(() => {
    latestRowsRef.current = rows;
  }, [rows]);

  const totalM3 = useMemo(() => {
    return rows.reduce((sum, row) => {
      const vol = parseFloat(row.volumeM3);
      return sum + (isNaN(vol) ? 0 : vol);
    }, 0);
  }, [rows]);

  const totalPrice = useMemo(() => {
    return rows.reduce((sum, row) => {
      const price = parseFloat(row.unitPrice) || 0;
      const pcs = parseInt(row.pieces, 10) || 0;
      return sum + price * pcs;
    }, 0);
  }, [rows]);

  // Save logic
  const performSaveAsync = useCallback(
    async (currentRows: OrderProductRow[]): Promise<boolean> => {
      if (saveInProgressRef.current) {
        saveQueuedRef.current = true;
        return true;
      }

      saveInProgressRef.current = true;

      const rowInputs = currentRows.map((r) => ({
        dbId: r.dbId,
        staircaseCodeId: r.staircaseCodeId,
        productNameId: r.productNameId,
        woodSpeciesId: r.woodSpeciesId,
        typeId: r.typeId,
        qualityId: r.qualityId,
        thickness: r.thickness,
        width: r.width,
        riser: r.riser,
        length: r.length,
        pieces: r.pieces,
        volumeM3: parseFloat(r.volumeM3) || 0,
        unitPrice: parseFloat(r.unitPrice) || 0,
        workPerPiece: parseFloat(r.workPerPiece) || 0,
        transportPerPiece: parseFloat(r.transportPerPiece) || 0,
        eurPerM3: parseFloat(r.eurPerM3) || 0,
      }));

      const result = await saveOrderProducts(orderId, organisationId, rowInputs, tab);

      if (!result.success) {
        toast.error(result.error);
        saveInProgressRef.current = false;
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          setTimeout(() => performSaveAsync(latestRowsRef.current), 50);
        }
        return false;
      }

      pendingRowsRef.current = null;

      // Update rows with newly assigned dbIds
      const hasInserts = Object.keys(result.data.insertedIds).length > 0;
      if (hasInserts) {
        setRows((prev) => {
          const updated = prev.map((row, i) => {
            const newId = result.data.insertedIds[i];
            if (newId && !row.dbId) {
              return { ...row, dbId: newId };
            }
            return row;
          });
          latestRowsRef.current = updated;
          return updated;
        });
      }

      saveInProgressRef.current = false;

      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        setTimeout(() => performSaveAsync(latestRowsRef.current), 50);
      }

      return true;
    },
    [orderId, organisationId]
  );

  const performSave = useCallback(
    (currentRows: OrderProductRow[]) => {
      startTransition(() => {
        performSaveAsync(currentRows);
      });
    },
    [performSaveAsync]
  );

  const debouncedSave = useCallback(
    (rowsToSave?: OrderProductRow[]) => {
      if (rowsToSave) {
        latestRowsRef.current = rowsToSave;
      }
      pendingRowsRef.current = latestRowsRef.current;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        performSave(latestRowsRef.current);
      }, 800);
    },
    [performSave]
  );

  const handleRowsChange = useCallback(
    (newRows: OrderProductRow[]) => {
      const sorted = sortProductRows(newRows, dropdowns.productNames);
      setRows(sorted);
      debouncedSave(sorted);
    },
    [debouncedSave, dropdowns.productNames]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      const pendingRows = pendingRowsRef.current;
      if (pendingRows) {
        const rowInputs = pendingRows.map((r) => ({
          dbId: r.dbId,
          staircaseCodeId: r.staircaseCodeId,
          productNameId: r.productNameId,
          woodSpeciesId: r.woodSpeciesId,
          typeId: r.typeId,
          qualityId: r.qualityId,
          thickness: r.thickness,
          width: r.width,
          riser: r.riser,
          length: r.length,
          pieces: r.pieces,
          volumeM3: parseFloat(r.volumeM3) || 0,
          unitPrice: parseFloat(r.unitPrice) || 0,
          workPerPiece: parseFloat(r.workPerPiece) || 0,
          transportPerPiece: parseFloat(r.transportPerPiece) || 0,
          eurPerM3: parseFloat(r.eurPerM3) || 0,
        }));
        saveOrderProducts(orderId, organisationId, rowInputs, tab).catch(console.error);
        pendingRowsRef.current = null;
      }
    };
  }, [orderId, organisationId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Ordered Products</h2>
        <span className="text-sm text-muted-foreground">
          {rows.length > 0 && (
            <>
              {rows.length} products
              {totalM3 > 0 && <> · {totalM3.toFixed(4)} m³</>}
              {tab !== "production" && totalPrice > 0 && <> · £{totalPrice.toFixed(2)}</>}
            </>
          )}
        </span>
        {isPending && (
          <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
        )}
      </div>

      <OrderProductsTable
        rows={rows}
        dropdowns={dropdowns}
        staircaseCodes={staircaseCodes}
        onRowsChange={handleRowsChange}
        readOnly={readOnly}
        hiddenColumns={hiddenColumns}
      />
    </div>
  );
}
