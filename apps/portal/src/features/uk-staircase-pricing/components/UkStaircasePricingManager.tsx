"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { Button, Input, Label } from "@timber/ui";
import { Save, RefreshCw, Loader2 } from "lucide-react";
import { PricingTable } from "./PricingTable";
import { getPricingItems, savePricingItems, deletePricingItem } from "../actions";
import type { PricingRow, GlobalParams } from "../types";
import { dbToClientRow, clientToUpsertPayload, recalculateRowWithParams, DEFAULT_GLOBAL_PARAMS } from "../types";

export function UkStaircasePricingManager() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Global parameters (applied values)
  const [globalParams, setGlobalParams] = useState<GlobalParams>(DEFAULT_GLOBAL_PARAMS);

  // Local input values (for editing without immediate recalculation)
  const [inputGbpRate, setInputGbpRate] = useState(DEFAULT_GLOBAL_PARAMS.gbpRate.replace(".", ","));
  const [inputTransportRate, setInputTransportRate] = useState(DEFAULT_GLOBAL_PARAMS.transportRate.replace(".", ","));

  // Track original IDs to detect deletions
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());

  // Ref to track if initial load is done
  const initialLoadDone = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getPricingItems();
    if (result.success) {
      const clientRows = result.data.map((db) => dbToClientRow(db, globalParams));
      setRows(clientRows);
      setOriginalIds(new Set(result.data.map((d) => d.id)));
    } else {
      setError(result.error);
    }
    setLoading(false);
    initialLoadDone.current = true;
  }, [globalParams]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      loadData();
    }
  }, [loadData]);

  // Apply global params and recalculate all rows
  const applyParamsAndRecalculate = useCallback((newParams: GlobalParams) => {
    setGlobalParams(newParams);
    setRows((prev) =>
      prev.map((row) => recalculateRowWithParams(row, newParams))
    );
  }, []);

  // Handle blur for GBP rate - apply changes
  const handleGbpRateBlur = useCallback(() => {
    const normalizedValue = inputGbpRate.replace(",", ".");
    const newParams = { ...globalParams, gbpRate: normalizedValue };
    applyParamsAndRecalculate(newParams);
  }, [inputGbpRate, globalParams, applyParamsAndRecalculate]);

  // Handle blur for transport rate - apply changes
  const handleTransportRateBlur = useCallback(() => {
    const normalizedValue = inputTransportRate.replace(",", ".");
    const newParams = { ...globalParams, transportRate: normalizedValue };
    applyParamsAndRecalculate(newParams);
  }, [inputTransportRate, globalParams, applyParamsAndRecalculate]);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    setError(null);

    // Find deleted rows (rows that were in original but not in current)
    const currentIds = new Set(rows.filter((r) => r.id).map((r) => r.id!));
    const deletedIds = [...originalIds].filter((id) => !currentIds.has(id));

    // Delete removed items
    for (const id of deletedIds) {
      const deleteResult = await deletePricingItem(id);
      if (!deleteResult.success) {
        setError(`Failed to delete item: ${deleteResult.error}`);
        return;
      }
    }

    // Prepare items to save (exclude empty rows)
    const validRows = rows.filter((r) => r.code.trim() !== "");
    if (validRows.length === 0) {
      setSaveMessage("No items to save");
      setOriginalIds(new Set());
      return;
    }

    const upsertPayloads = validRows.map(clientToUpsertPayload);
    const result = await savePricingItems(upsertPayloads);

    if (result.success) {
      // Refresh data to get proper IDs for new items
      initialLoadDone.current = false;
      await loadData();
      setSaveMessage(`Saved ${result.data.length} items successfully`);
    } else {
      setError(result.error);
    }
  }, [rows, originalIds, loadData]);

  const handleRefresh = useCallback(() => {
    initialLoadDone.current = false;
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Parameters Card */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Calculation Parameters</h2>
        <div className="flex flex-wrap items-end gap-6">
          {/* GBP Rate */}
          <div className="space-y-1">
            <Label htmlFor="gbpRate" className="text-sm">
              EUR → GBP Rate
            </Label>
            <Input
              id="gbpRate"
              className="w-24 h-9"
              value={inputGbpRate}
              onChange={(e) => setInputGbpRate(e.target.value)}
              onBlur={handleGbpRateBlur}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder="0,90"
            />
          </div>

          {/* Transport Rate */}
          <div className="space-y-1">
            <Label htmlFor="transportRate" className="text-sm">
              Transport (EUR/m³)
            </Label>
            <Input
              id="transportRate"
              className="w-24 h-9"
              value={inputTransportRate}
              onChange={(e) => setInputTransportRate(e.target.value)}
              onBlur={handleTransportRateBlur}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder="300"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
        <Button
          size="sm"
          onClick={() => startTransition(handleSave)}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="rounded-md border border-green-500 bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {saveMessage}
        </div>
      )}

      {/* Table */}
      <PricingTable rows={rows} onRowsChange={setRows} globalParams={globalParams} />
    </div>
  );
}
