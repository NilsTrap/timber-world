"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Power,
  PowerOff,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@timber/ui";
import {
  getReferenceOptions,
  toggleReferenceOption,
  reorderReferenceOptions,
  deleteReferenceOption,
} from "../actions";
import type { ReferenceTableName, ReferenceOption } from "../types";
import { ReferenceOptionForm } from "./ReferenceOptionForm";

interface ReferenceOptionsTableProps {
  tableName: ReferenceTableName;
  /** If true, shows delete button for each row (Super Admin only) */
  canDelete?: boolean;
}

type SortColumn = "sortOrder" | "value" | "isActive";
type SortDirection = "asc" | "desc";

/**
 * Reference Options Table
 *
 * Displays options for a reference table with CRUD actions and sortable columns.
 */
export function ReferenceOptionsTable({
  tableName,
  canDelete = false,
}: ReferenceOptionsTableProps) {
  const isProcesses = tableName === "ref_processes";
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ReferenceOption | null>(
    null
  );

  // Deactivate confirmation state
  const [deactivateOption, setDeactivateOption] = useState<ReferenceOption | null>(null);

  // Delete confirmation state
  const [deleteOption, setDeleteOption] = useState<ReferenceOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sorting state - default to alphabetical by value
  const [sortColumn, setSortColumn] = useState<SortColumn>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    // Admin view: include inactive options to allow reactivation
    const result = await getReferenceOptions(tableName, { includeInactive: true });
    if (result.success) {
      setOptions(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, [tableName]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Sort options based on current sort state
  const sortedOptions = useMemo(() => {
    const sorted = [...options].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "sortOrder":
          comparison = a.sortOrder - b.sortOrder;
          break;
        case "value":
          comparison = a.value.localeCompare(b.value);
          break;
        case "isActive":
          // Active items first when ascending
          comparison = (a.isActive === b.isActive) ? 0 : a.isActive ? -1 : 1;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [options, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Render sort indicator
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Handle toggle active - shows confirmation for deactivation
  const handleToggleActive = (option: ReferenceOption) => {
    if (option.isActive) {
      // Show confirmation dialog before deactivating
      setDeactivateOption(option);
    } else {
      // Reactivate immediately (no confirmation needed)
      performToggleActive(option, true);
    }
  };

  // Actually perform the toggle
  const performToggleActive = async (option: ReferenceOption, newActive: boolean) => {
    const result = await toggleReferenceOption(tableName, option.id, newActive);

    if (result.success) {
      toast.success(newActive ? "Option activated" : "Option deactivated");
      loadOptions();
    } else {
      toast.error(result.error);
    }
  };

  // Confirm deactivation
  const confirmDeactivate = async () => {
    if (deactivateOption) {
      await performToggleActive(deactivateOption, false);
      setDeactivateOption(null);
    }
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (deleteOption) {
      setIsDeleting(true);
      const result = await deleteReferenceOption(tableName, deleteOption.id);
      if (result.success) {
        toast.success("Option deleted");
        setOptions((prev) => prev.filter((o) => o.id !== deleteOption.id));
      } else {
        toast.error(result.error);
      }
      setIsDeleting(false);
      setDeleteOption(null);
    }
  };

  const handleMoveUp = async (option: ReferenceOption) => {
    // Find the option with the next lower sortOrder
    const currentOrder = option.sortOrder;
    const lowerOptions = options.filter(o => o.sortOrder < currentOrder);
    if (lowerOptions.length === 0 || isReordering) return;

    const swapWith = lowerOptions.reduce((prev, curr) =>
      curr.sortOrder > prev.sortOrder ? curr : prev
    );

    setIsReordering(true);

    // Swap sort orders
    const newOptions = options.map(o => {
      if (o.id === option.id) return { ...o, sortOrder: swapWith.sortOrder };
      if (o.id === swapWith.id) return { ...o, sortOrder: currentOrder };
      return o;
    });

    // Optimistic update
    setOptions(newOptions);

    // Only send the two swapped items (M2 optimization)
    const items = [
      { id: option.id, sortOrder: swapWith.sortOrder },
      { id: swapWith.id, sortOrder: currentOrder },
    ];

    const result = await reorderReferenceOptions(tableName, items);
    if (!result.success) {
      toast.error(result.error);
      loadOptions(); // Revert on error
    }
    setIsReordering(false);
  };

  const handleMoveDown = async (option: ReferenceOption) => {
    // Find the option with the next higher sortOrder
    const currentOrder = option.sortOrder;
    const higherOptions = options.filter(o => o.sortOrder > currentOrder);
    if (higherOptions.length === 0 || isReordering) return;

    const swapWith = higherOptions.reduce((prev, curr) =>
      curr.sortOrder < prev.sortOrder ? curr : prev
    );

    setIsReordering(true);

    // Swap sort orders
    const newOptions = options.map(o => {
      if (o.id === option.id) return { ...o, sortOrder: swapWith.sortOrder };
      if (o.id === swapWith.id) return { ...o, sortOrder: currentOrder };
      return o;
    });

    // Optimistic update
    setOptions(newOptions);

    // Only send the two swapped items (M2 optimization)
    const items = [
      { id: option.id, sortOrder: swapWith.sortOrder },
      { id: swapWith.id, sortOrder: currentOrder },
    ];

    const result = await reorderReferenceOptions(tableName, items);
    if (!result.success) {
      toast.error(result.error);
      loadOptions(); // Revert on error
    }
    setIsReordering(false);
  };

  const handleEdit = (option: ReferenceOption) => {
    setEditingOption(option);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingOption(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadOptions();
  };

  // Get min/max sortOrder for disabling move buttons
  const minSortOrder = Math.min(...options.map(o => o.sortOrder));
  const maxSortOrder = Math.max(...options.map(o => o.sortOrder));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Option
        </Button>
      </div>

      {options.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No options yet</p>
          <Button onClick={handleAdd} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First Option
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">
                  <button
                    onClick={() => handleSort("sortOrder")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by order"
                  >
                    Order
                    <SortIndicator column="sortOrder" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("value")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by value"
                  >
                    Value
                    <SortIndicator column="value" />
                  </button>
                </TableHead>
                {isProcesses && (
                  <TableHead className="w-24">Code</TableHead>
                )}
                {isProcesses && (
                  <TableHead className="w-24">Work Unit</TableHead>
                )}
                {isProcesses && (
                  <TableHead className="w-36">Formula</TableHead>
                )}
                {isProcesses && (
                  <TableHead className="w-24">Price</TableHead>
                )}
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("isActive")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by status"
                  >
                    Status
                    <SortIndicator column="isActive" />
                  </button>
                </TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOptions.map((option) => (
                <TableRow
                  key={option.id}
                  className={!option.isActive ? "opacity-50" : ""}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    {option.sortOrder}
                  </TableCell>
                  <TableCell className="font-medium">{option.value}</TableCell>
                  {isProcesses && (
                    <TableCell className="font-mono text-sm">{option.code || "-"}</TableCell>
                  )}
                  {isProcesses && (
                    <TableCell className="text-sm">{option.workUnit || "-"}</TableCell>
                  )}
                  {isProcesses && (
                    <TableCell className="text-xs text-muted-foreground">
                      {option.workFormula ? option.workFormula.replace(/_/g, " ") : "-"}
                    </TableCell>
                  )}
                  {isProcesses && (
                    <TableCell className="text-sm">
                      {option.price != null ? (
                        <span>
                          {option.price.toFixed(2).replace('.', ',')}
                          {option.workUnit && <span className="text-muted-foreground text-xs ml-1">/ {option.workUnit}</span>}
                        </span>
                      ) : "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={option.isActive ? "success" : "secondary"}>
                      {option.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleMoveUp(option)}
                        disabled={option.sortOrder === minSortOrder || isReordering}
                        aria-label="Move option up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleMoveDown(option)}
                        disabled={option.sortOrder === maxSortOrder || isReordering}
                        aria-label="Move option down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(option)}
                        aria-label={`Edit ${option.value}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleActive(option)}
                        aria-label={option.isActive ? `Deactivate ${option.value}` : `Activate ${option.value}`}
                      >
                        {option.isActive ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteOption(option)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${option.value}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ReferenceOptionForm
        tableName={tableName}
        option={editingOption}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivateOption} onOpenChange={(open) => !open && setDeactivateOption(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Option</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &quot;{deactivateOption?.value}&quot;?
              This option will no longer appear in dropdown selectors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOption} onOpenChange={(open) => !open && setDeleteOption(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Option</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete &quot;{deleteOption?.value}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
