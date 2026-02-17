"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Calendar, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@timber/ui";
import { ColumnHeaderMenu, type ColumnSortState } from "@timber/ui";
import { formatDate } from "@/lib/utils";
import { deleteProductionEntry, cancelProductionEntry, saveInvoiceNumber } from "../actions";
import type { ProductionHistoryItem } from "../types";
import { Input } from "@timber/ui";

interface ProductionHistoryTableProps {
  entries: ProductionHistoryItem[];
  defaultProcess?: string;
  showOrganisation?: boolean;
  /** If true, shows delete button for each row (Super Admin only) */
  canDelete?: boolean;
}

/** Format number with comma decimal separator */
function fmt3(n: number): string {
  return n.toFixed(3).replace(".", ",");
}
function fmt2(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
function fmt1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

type ColumnKey =
  | "productionDate"
  | "organisationCode"
  | "processName"
  | "createdByName"
  | "totalInputM3"
  | "totalOutputM3"
  | "outcomePercentage"
  | "wastePercentage"
  | "plannedWork"
  | "actualWork"
  | "price"
  | "sum"
  | "invoiceNumber";

/**
 * Production History Table
 *
 * Displays validated production entries with per-column sort/filter
 * using ColumnHeaderMenu popovers.
 */
/** Convert DD.MM.YYYY to YYYY-MM-DD for comparison */
function parseEuropeanDate(value: string): string {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return "";
}

export function ProductionHistoryTable({
  entries,
  defaultProcess,
  showOrganisation = false,
  canDelete = false,
}: ProductionHistoryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState(entries);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceValue, setInvoiceValue] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId);
    const result = await deleteProductionEntry(entryId);
    if (result.success) {
      toast.success("Production entry deleted");
      setLocalEntries((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

  const handleCancel = async (entryId: string) => {
    setCancellingId(entryId);
    const result = await cancelProductionEntry(entryId);
    if (result.success) {
      toast.success("Production entry cancelled and inventory restored");
      setLocalEntries((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      toast.error(result.error);
    }
    setCancellingId(null);
  };

  const handleInvoiceEdit = (entry: ProductionHistoryItem) => {
    setEditingInvoiceId(entry.id);
    setInvoiceValue(entry.invoiceNumber ?? "");
  };

  const handleInvoiceSave = async (entryId: string) => {
    setSavingInvoice(true);
    const result = await saveInvoiceNumber(entryId, invoiceValue || null);
    if (result.success) {
      setLocalEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, invoiceNumber: result.data.invoiceNumber } : e
        )
      );
      setEditingInvoiceId(null);
      toast.success("Invoice number saved");
    } else {
      toast.error(result.error);
    }
    setSavingInvoice(false);
  };

  const handleInvoiceCancel = () => {
    setEditingInvoiceId(null);
    setInvoiceValue("");
  };

  const handleInvoiceKeyDown = (e: React.KeyboardEvent, entryId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInvoiceSave(entryId);
    } else if (e.key === "Escape") {
      handleInvoiceCancel();
    }
  };

  const [filterState, setFilterState] = useState<Record<string, Set<string>>>(
    defaultProcess ? { processName: new Set([defaultProcess]) } : {}
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);

  /** Convert YYYY-MM-DD from native picker to DD.MM.YYYY */
  const handleDatePick = (isoValue: string, setter: (v: string) => void) => {
    if (!isoValue) return;
    const [y, m, d] = isoValue.split("-");
    setter(`${d}.${m}.${y}`);
  };

  // Calculate sum for an entry
  const getSum = (entry: ProductionHistoryItem): number | null => {
    if (entry.price != null && entry.actualWork != null) {
      return entry.actualWork * entry.price;
    }
    return null;
  };

  // Compute display value for each column (used for filtering)
  const getDisplayValue = (entry: ProductionHistoryItem, col: ColumnKey): string => {
    switch (col) {
      case "productionDate":
        return formatDate(entry.productionDate);
      case "organisationCode":
        return entry.organisationCode ?? "";
      case "processName":
        return entry.processName;
      case "createdByName":
        return entry.createdByName ?? "";
      case "totalInputM3":
        return fmt3(entry.totalInputM3);
      case "totalOutputM3":
        return fmt3(entry.totalOutputM3);
      case "outcomePercentage":
        return fmt1(entry.outcomePercentage) + "%";
      case "wastePercentage":
        return fmt1(entry.wastePercentage) + "%";
      case "plannedWork":
        return entry.plannedWork !== null ? fmt2(entry.plannedWork) : "—";
      case "actualWork":
        return entry.actualWork !== null ? fmt2(entry.actualWork) : "—";
      case "price":
        return entry.price !== null ? fmt2(entry.price) : "—";
      case "sum":
        const sum = getSum(entry);
        return sum !== null ? fmt2(sum) : "—";
      case "invoiceNumber":
        return entry.invoiceNumber ?? "";
    }
  };

  // Unique values per column for filter checkboxes
  const uniqueValues = useMemo(() => {
    const cols: ColumnKey[] = [
      "productionDate",
      "organisationCode",
      "processName",
      "createdByName",
      "totalInputM3",
      "totalOutputM3",
      "outcomePercentage",
      "wastePercentage",
      "plannedWork",
      "actualWork",
      "price",
      "sum",
      "invoiceNumber",
    ];
    const result: Record<string, string[]> = {};
    for (const col of cols) {
      const values = new Set(localEntries.map((e) => getDisplayValue(e, col)));
      result[col] = Array.from(values);
    }
    return result;
  }, [localEntries]);

  const handleFilterChange = (columnKey: string, values: Set<string>) => {
    setFilterState((prev) => ({ ...prev, [columnKey]: values }));
  };

  const hasActiveFilters =
    Object.values(filterState).some((s) => s.size > 0) || sortState !== null || dateFrom !== "" || dateTo !== "";

  const handleClearAll = () => {
    setFilterState({});
    setSortState(null);
    setDateFrom("");
    setDateTo("");
    // Clear the process filter from URL to prevent it coming back on refresh
    // But preserve the org filter
    const orgParam = searchParams.get("org");
    const url = orgParam ? `/production?tab=history&org=${orgParam}` : "/production?tab=history";
    router.replace(url);
  };

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...localEntries];

    // Date range filter
    const isoFrom = parseEuropeanDate(dateFrom);
    const isoTo = parseEuropeanDate(dateTo);
    if (isoFrom) {
      result = result.filter((e) => e.productionDate >= isoFrom);
    }
    if (isoTo) {
      result = result.filter((e) => e.productionDate <= isoTo);
    }

    // Apply column filters
    const cols: ColumnKey[] = [
      "productionDate",
      "organisationCode",
      "processName",
      "createdByName",
      "totalInputM3",
      "totalOutputM3",
      "outcomePercentage",
      "wastePercentage",
      "plannedWork",
      "actualWork",
      "price",
      "sum",
      "invoiceNumber",
    ];
    for (const col of cols) {
      const filter = filterState[col];
      if (filter && filter.size > 0) {
        result = result.filter((e) => filter.has(getDisplayValue(e, col)));
      }
    }

    // Sort
    if (sortState) {
      const col = sortState.column as ColumnKey;
      const asc = sortState.direction === "asc";
      result.sort((a, b) => {
        // Handle computed 'sum' column specially
        if (col === "sum") {
          const aSum = getSum(a) ?? 0;
          const bSum = getSum(b) ?? 0;
          return asc ? aSum - bSum : bSum - aSum;
        }
        // Handle other columns
        const aVal = col === "price" ? a.price : col === "invoiceNumber" ? a.invoiceNumber : a[col as keyof Omit<ProductionHistoryItem, 'price' | 'invoiceNumber'>];
        const bVal = col === "price" ? b.price : col === "invoiceNumber" ? b.invoiceNumber : b[col as keyof Omit<ProductionHistoryItem, 'price' | 'invoiceNumber'>];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const aNum = Number(aVal ?? 0);
        const bNum = Number(bVal ?? 0);
        return asc ? aNum - bNum : bNum - aNum;
      });
    } else {
      // Default sort: newest first
      result.sort((a, b) => b.productionDate.localeCompare(a.productionDate));
    }

    return result;
  }, [localEntries, filterState, sortState, dateFrom, dateTo]);

  // Empty state — no entries at all
  if (localEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No production history yet</p>
      </div>
    );
  }

  const allColumns: { key: ColumnKey; label: string; numeric: boolean; align: string }[] = [
    { key: "productionDate", label: "Date", numeric: false, align: "text-left" },
    { key: "organisationCode", label: "Organisation", numeric: false, align: "text-left" },
    { key: "processName", label: "Process", numeric: false, align: "text-left" },
    { key: "createdByName", label: "User", numeric: false, align: "text-left" },
    { key: "totalInputM3", label: "Input m³", numeric: true, align: "text-right" },
    { key: "totalOutputM3", label: "Output m³", numeric: true, align: "text-right" },
    { key: "outcomePercentage", label: "Outcome %", numeric: true, align: "text-right" },
    { key: "wastePercentage", label: "Waste %", numeric: true, align: "text-right" },
    { key: "plannedWork", label: "Planned", numeric: true, align: "text-right" },
    { key: "actualWork", label: "Actual", numeric: true, align: "text-right" },
    { key: "price", label: "Price", numeric: true, align: "text-right" },
    { key: "sum", label: "Sum", numeric: true, align: "text-right" },
    { key: "invoiceNumber", label: "Invoice", numeric: false, align: "text-left" },
  ];

  // Filter out organisation column if not needed
  const columns = showOrganisation
    ? allColumns
    : allColumns.filter((c) => c.key !== "organisationCode");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="DD.MM.YYYY"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-[140px] rounded-md border bg-background pl-3 pr-8 text-sm"
              aria-label="Date from"
              maxLength={10}
            />
            <button
              type="button"
              onClick={() => dateFromRef.current?.showPicker()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Pick start date"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={dateFromRef}
              type="date"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => handleDatePick(e.target.value, setDateFrom)}
            />
          </div>
          <span className="text-sm text-muted-foreground">—</span>
          <div className="relative">
            <input
              type="text"
              placeholder="DD.MM.YYYY"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-[140px] rounded-md border bg-background pl-3 pr-8 text-sm"
              aria-label="Date to"
              maxLength={10}
            />
            <button
              type="button"
              onClick={() => dateToRef.current?.showPicker()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Pick end date"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={dateToRef}
              type="date"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => handleDatePick(e.target.value, setDateTo)}
            />
          </div>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs h-7"
          >
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 font-medium select-none ${col.align}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ColumnHeaderMenu
                      columnKey={col.key}
                      isNumeric={col.numeric}
                      uniqueValues={uniqueValues[col.key] || []}
                      activeSort={sortState}
                      activeFilter={filterState[col.key] || new Set()}
                      onSortChange={setSortState}
                      onFilterChange={handleFilterChange}
                    />
                  </span>
                </th>
              ))}
              {canDelete && (
                <th className="px-2 py-2 font-medium select-none text-center w-20">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (canDelete ? 1 : 0)}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No entries match your filters
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => router.push(`/production/${entry.id}`)}>
                  <td className="px-2 py-2">
                    {formatDate(entry.productionDate)}
                  </td>
                  {showOrganisation && (
                    <td className="px-2 py-2">
                      {entry.organisationCode ?? ""}
                    </td>
                  )}
                  <td className="px-2 py-2">
                    {entry.processName}
                    {entry.entryType === "correction" && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Correction
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {entry.createdByName ?? "-"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmt3(entry.totalInputM3)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmt3(entry.totalOutputM3)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmt1(entry.outcomePercentage)}%
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fmt1(entry.wastePercentage)}%
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {entry.plannedWork !== null
                      ? `${fmt2(entry.plannedWork)} ${entry.workUnit || ""}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {entry.actualWork !== null
                      ? `${fmt2(entry.actualWork)} ${entry.workUnit || ""}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {entry.price !== null
                      ? `${fmt2(entry.price)} / ${entry.workUnit || ""}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">
                    {(() => {
                      const sum = getSum(entry);
                      return sum !== null ? fmt2(sum) : "—";
                    })()}
                  </td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    {editingInvoiceId === entry.id ? (
                      <Input
                        value={invoiceValue}
                        onChange={(e) => setInvoiceValue(e.target.value)}
                        onKeyDown={(e) => handleInvoiceKeyDown(e, entry.id)}
                        onBlur={() => handleInvoiceSave(entry.id)}
                        placeholder="Invoice #"
                        className="h-6 w-24 text-xs px-1"
                        disabled={savingInvoice}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInvoiceEdit(entry)}
                        className="text-left w-full min-w-[70px] px-1 py-0.5 -mx-1 -my-0.5 rounded hover:bg-accent/50"
                        title="Click to edit invoice number"
                      >
                        {entry.invoiceNumber || <span className="text-muted-foreground italic">—</span>}
                      </button>
                    )}
                  </td>
                  {canDelete && (
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Cancel button - restores inventory */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600"
                              disabled={cancellingId === entry.id}
                              title="Cancel and restore inventory"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel production and restore inventory?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel the production entry ({entry.processName} - {formatDate(entry.productionDate)}) and restore the inventory to its previous state. Input packages will have their volume restored, and output packages will be removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Entry</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancel(entry.id)}
                                disabled={cancellingId === entry.id}
                                className="bg-amber-600 text-white hover:bg-amber-700"
                              >
                                {cancellingId === entry.id ? "Cancelling..." : "Cancel & Restore"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {/* Delete button - permanent deletion */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === entry.id}
                              title="Delete permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete production entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this production entry ({entry.processName} - {formatDate(entry.productionDate)}) and all its inputs and outputs. This action cannot be undone and will NOT restore inventory.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingId === entry.id}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deletingId === entry.id ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {filteredEntries.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-bold">
                <td className="px-2 py-2" />
                {showOrganisation && <td className="px-2 py-2" />}
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right tabular-nums">
                  {fmt3(filteredEntries.reduce((sum, e) => sum + e.totalInputM3, 0))}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {fmt3(filteredEntries.reduce((sum, e) => sum + e.totalOutputM3, 0))}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(() => {
                    const totalInput = filteredEntries.reduce((sum, e) => sum + e.totalInputM3, 0);
                    if (totalInput === 0) return "-";
                    return fmt1(filteredEntries.reduce((sum, e) => sum + e.outcomePercentage * e.totalInputM3, 0) / totalInput) + "%";
                  })()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {(() => {
                    const totalInput = filteredEntries.reduce((sum, e) => sum + e.totalInputM3, 0);
                    if (totalInput === 0) return "-";
                    return fmt1(filteredEntries.reduce((sum, e) => sum + e.wastePercentage * e.totalInputM3, 0) / totalInput) + "%";
                  })()}
                </td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right tabular-nums">
                  {(() => {
                    const totalSum = filteredEntries.reduce((sum, e) => {
                      const entrySum = getSum(e);
                      return entrySum !== null ? sum + entrySum : sum;
                    }, 0);
                    return totalSum > 0 ? fmt2(totalSum) : "—";
                  })()}
                </td>
                <td className="px-2 py-2" />
                {canDelete && <td className="px-2 py-2" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
