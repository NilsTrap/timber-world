"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
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
  Checkbox,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
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
  deleteReferenceOption,
} from "../actions";
import { getOrgRefExclusions } from "@/features/organisations/actions/getOrgRefExclusions";
import { updateOrgRefExclusions } from "@/features/organisations/actions/updateOrgRefExclusions";
import type { ReferenceTableName, ReferenceOption } from "../types";
import { ReferenceOptionForm } from "./ReferenceOptionForm";

interface ReferenceOptionsTableProps {
  tableName: ReferenceTableName;
  /** If true, shows delete button for each row (Super Admin only) */
  canDelete?: boolean;
  /** If provided, shows per-org enable/disable checkboxes */
  organisationId?: string;
}

/**
 * Reference Options Table
 *
 * Displays options for a reference table with CRUD actions.
 * Always sorted alphabetically by value.
 * When organisationId is provided, adds a checkbox column for per-org enable/disable.
 */
export function ReferenceOptionsTable({
  tableName,
  canDelete = false,
  organisationId,
}: ReferenceOptionsTableProps) {
  const isProcesses = tableName === "ref_processes";
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ReferenceOption | null>(
    null
  );

  // Deactivate confirmation state
  const [deactivateOption, setDeactivateOption] = useState<ReferenceOption | null>(null);

  // Delete confirmation state
  const [deleteOption, setDeleteOption] = useState<ReferenceOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Per-org exclusion state
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [originalExcludedIds, setOriginalExcludedIds] = useState<Set<string>>(new Set());
  const [isSavingExclusions, setIsSavingExclusions] = useState(false);

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    // Admin view: include inactive options to allow reactivation
    const result = await getReferenceOptions(tableName, { includeInactive: true });
    if (result.success) {
      setOptions(result.data);
    } else {
      toast.error(result.error);
    }

    // Load org exclusions if organisationId is provided
    if (organisationId) {
      const exclusionsResult = await getOrgRefExclusions(organisationId);
      if (exclusionsResult.success) {
        const tableExclusions = new Set(
          exclusionsResult.data
            .filter((e) => e.refTable === tableName)
            .map((e) => e.refValueId)
        );
        setExcludedIds(tableExclusions);
        setOriginalExcludedIds(new Set(tableExclusions));
      }
    }

    setIsLoading(false);
  }, [tableName, organisationId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Always sort alphabetically by value
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.value.localeCompare(b.value));
  }, [options]);

  // Handle toggle active - shows confirmation for deactivation
  const handleToggleActive = (option: ReferenceOption) => {
    if (option.isActive) {
      setDeactivateOption(option);
    } else {
      performToggleActive(option, true);
    }
  };

  const performToggleActive = async (option: ReferenceOption, newActive: boolean) => {
    const result = await toggleReferenceOption(tableName, option.id, newActive);

    if (result.success) {
      toast.success(newActive ? "Option activated" : "Option deactivated");
      loadOptions();
    } else {
      toast.error(result.error);
    }
  };

  const confirmDeactivate = async () => {
    if (deactivateOption) {
      await performToggleActive(deactivateOption, false);
      setDeactivateOption(null);
    }
  };

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

  // Per-org exclusion handlers
  const toggleExclusion = (valueId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(valueId)) {
        next.delete(valueId);
      } else {
        next.add(valueId);
      }
      return next;
    });
  };

  const hasExclusionChanges = () => {
    if (originalExcludedIds.size !== excludedIds.size) return true;
    for (const id of excludedIds) {
      if (!originalExcludedIds.has(id)) return true;
    }
    return false;
  };

  const handleSaveExclusions = async () => {
    if (!organisationId) return;
    setIsSavingExclusions(true);
    const result = await updateOrgRefExclusions(
      organisationId,
      tableName,
      Array.from(excludedIds)
    );
    if (result.success) {
      toast.success("Organisation reference data updated");
      setOriginalExcludedIds(new Set(excludedIds));
    } else {
      toast.error(result.error);
    }
    setIsSavingExclusions(false);
  };

  const activeOptions = options.filter((o) => o.isActive);
  const enabledCount = organisationId
    ? activeOptions.length - activeOptions.filter((o) => excludedIds.has(o.id)).length
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {organisationId ? (
          <span className="text-sm text-muted-foreground">
            {enabledCount} of {activeOptions.length} enabled for this organisation
          </span>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          {organisationId && (
            <Button
              onClick={handleSaveExclusions}
              disabled={isSavingExclusions || !hasExclusionChanges()}
              size="sm"
            >
              {isSavingExclusions ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Option
          </Button>
        </div>
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
                {organisationId && (
                  <TableHead className="w-16">Enabled</TableHead>
                )}
                <TableHead>Value</TableHead>
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
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOptions.map((option) => {
                const isOrgEnabled = organisationId ? !excludedIds.has(option.id) : true;
                return (
                  <TableRow
                    key={option.id}
                    className={!option.isActive ? "opacity-50" : ""}
                  >
                    {organisationId && (
                      <TableCell>
                        <Checkbox
                          checked={isOrgEnabled && option.isActive}
                          onCheckedChange={() => toggleExclusion(option.id)}
                          disabled={!option.isActive || isSavingExclusions}
                        />
                      </TableCell>
                    )}
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
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleEdit(option)}
                                aria-label={`Edit ${option.value}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
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
                            </TooltipTrigger>
                            <TooltipContent>
                              {option.isActive ? "Deactivate" : "Activate"}
                            </TooltipContent>
                          </Tooltip>
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setDeleteOption(option)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label={`Delete ${option.value}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        organisationId={organisationId}
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
