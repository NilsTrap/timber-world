"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deleteProductionEntry } from "../actions";
import type { ProductionListItem } from "../types";

interface DraftProductionTableProps {
  entries: ProductionListItem[];
  showOrganisation?: boolean;
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
  | "actualWork";

/**
 * Draft Production Table
 *
 * Displays draft production entries in a table format matching the
 * completed production history table, with per-column sort/filter.
 */
export function DraftProductionTable({
  entries,
  showOrganisation = false,
}: DraftProductionTableProps) {
  const router = useRouter();
  const [sortState, setSortState] = useState<ColumnSortState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState(entries);
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>({});

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId);
    const result = await deleteProductionEntry(entryId);
    if (result.success) {
      toast.success("Draft entry deleted");
      setLocalEntries((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

  // Compute display value for each column (used for filtering)
  const getDisplayValue = (entry: ProductionListItem, col: ColumnKey): string => {
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

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...localEntries];

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
        const aVal = a[col];
        const bVal = b[col];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        return asc ? aNum - bNum : bNum - aNum;
      });
    } else {
      // Default sort: newest first by production date
      result.sort((a, b) => b.productionDate.localeCompare(a.productionDate));
    }

    return result;
  }, [localEntries, filterState, sortState]);

  // Empty state
  if (localEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No draft entries</p>
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
  ];

  // Filter out organisation column if not needed
  const columns = showOrganisation
    ? allColumns
    : allColumns.filter((c) => c.key !== "organisationCode");

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium select-none ${col.align}`}
              >
                <span className="inline-flex items-center gap-1.5">
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
            <th className="px-4 py-3 font-medium select-none text-center w-24">
              Status
            </th>
            <th className="px-4 py-3 font-medium select-none text-center w-16">
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No entries match your filters
              </td>
            </tr>
          ) : (
            filteredEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/production/${entry.id}`)}
              >
                <td className="px-4 py-3">
                  {formatDate(entry.productionDate)}
                </td>
                {showOrganisation && (
                  <td className="px-4 py-3">
                    {entry.organisationCode ?? ""}
                  </td>
                )}
                <td className="px-4 py-3">{entry.processName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.createdByName ?? "-"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt3(entry.totalInputM3)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt3(entry.totalOutputM3)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt1(entry.outcomePercentage)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmt1(entry.wastePercentage)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {entry.plannedWork !== null
                    ? `${fmt2(entry.plannedWork)} ${entry.workUnit || ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {entry.actualWork !== null
                    ? `${fmt2(entry.actualWork)} ${entry.workUnit || ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">
                    Draft
                  </span>
                </td>
                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === entry.id}
                        title="Delete draft"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete draft entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{entry.processName}&rdquo; ({formatDate(entry.productionDate)}) and all its
                          inputs and outputs. This action cannot be undone.
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
                </td>
              </tr>
            ))
          )}
        </tbody>
        {filteredEntries.length > 0 && (
          <tfoot>
            <tr className="border-t bg-muted/30 font-bold">
              <td className="px-4 py-3" />
              {showOrganisation && <td className="px-4 py-3" />}
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right tabular-nums">
                {fmt3(filteredEntries.reduce((sum, e) => sum + e.totalInputM3, 0))}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {fmt3(filteredEntries.reduce((sum, e) => sum + e.totalOutputM3, 0))}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {(() => {
                  const totalInput = filteredEntries.reduce((sum, e) => sum + e.totalInputM3, 0);
                  if (totalInput === 0) return "-";
                  return fmt1(filteredEntries.reduce((sum, e) => sum + e.outcomePercentage * e.totalInputM3, 0) / totalInput) + "%";
                })()}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {(() => {
                  const totalInput = filteredEntries.reduce((sum, e) => sum + e.totalInputM3, 0);
                  if (totalInput === 0) return "-";
                  return fmt1(filteredEntries.reduce((sum, e) => sum + e.wastePercentage * e.totalInputM3, 0) / totalInput) + "%";
                })()}
              </td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
