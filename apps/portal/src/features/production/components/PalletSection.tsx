"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@timber/ui";
import { toast } from "sonner";
import { savePalletCount } from "../actions";

interface PalletSectionProps {
  productionEntryId: string;
  /** Pallet unit price configured on the process (ref_processes.pallet_price).
   *  May be null until an admin sets it; the count input still works in that
   *  case, the cost just isn't computed. */
  palletPrice: number | null;
  /** Initial pallet count from DB. */
  initialPalletCount: number | null;
  readOnly?: boolean;
}

/**
 * PalletSection
 *
 * Below WorkAmountsSection on Packing production entries. Lets the user record
 * how many pallets were used and shows the computed pallet cost
 * (count × palletPrice). Rendered only when the process has palletPrice
 * configured (see ProductionEntryClient's gate).
 */
export function PalletSection({
  productionEntryId,
  palletPrice,
  initialPalletCount,
  readOnly,
}: PalletSectionProps) {
  const [palletCount, setPalletCount] = useState<string>(
    initialPalletCount != null ? String(initialPalletCount) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedRef = useRef<number | null>(initialPalletCount);

  useEffect(() => {
    setPalletCount(initialPalletCount != null ? String(initialPalletCount) : "");
    lastSavedRef.current = initialPalletCount;
  }, [initialPalletCount]);

  const persist = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : parseInt(trimmed, 10);
    if (next !== null && (isNaN(next) || next < 0)) {
      toast.error("Pallet count must be a non-negative whole number");
      return;
    }
    if (next === lastSavedRef.current) return;
    setIsSaving(true);
    const result = await savePalletCount({
      productionEntryId,
      palletCount: next,
    });
    if (result.success) {
      lastSavedRef.current = next;
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  }, [productionEntryId]);

  const numericCount = palletCount.trim() === "" ? null : parseInt(palletCount.trim(), 10);
  const cost =
    palletPrice != null && numericCount != null && !isNaN(numericCount) && numericCount > 0
      ? numericCount * palletPrice
      : null;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Pallets
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Pallets used
          </label>
          {readOnly ? (
            <div className="text-sm font-medium tabular-nums">
              {numericCount ?? "—"}
            </div>
          ) : (
            <Input
              type="number"
              min={0}
              step={1}
              value={palletCount}
              onChange={(e) => setPalletCount(e.target.value)}
              onBlur={(e) => persist(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={isSaving}
              className="h-9 text-sm tabular-nums"
              placeholder="0"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Pallet price
          </label>
          {palletPrice != null ? (
            <div className="text-sm font-medium tabular-nums">
              {palletPrice.toFixed(2).replace(".", ",")}{" "}
              <span className="text-muted-foreground text-xs">/ pallet</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Not set — ask admin to configure in Processes reference data.
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Pallet cost
          </label>
          <div className="text-sm font-semibold tabular-nums">
            {cost != null ? cost.toFixed(2).replace(".", ",") : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
