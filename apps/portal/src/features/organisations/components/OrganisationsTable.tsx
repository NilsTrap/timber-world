"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Power,
  PowerOff,
  Plus,
  Trash2,
  Loader2,
  Users,
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
  getOrganisations,
  toggleOrganisation,
  toggleOrganisationExternal,
  deleteOrganisation,
  getOrgShipmentCount,
} from "../actions";
import type { Organisation } from "../types";
import { OrganisationForm } from "./OrganisationForm";

type SortColumn = "code" | "name" | "userCount" | "isActive";
type SortDirection = "asc" | "desc";

/**
 * Sort Indicator Component
 *
 * Displays sort direction arrow for table column headers.
 * Extracted to prevent recreation on every render.
 */
function SortIndicator({
  column,
  sortColumn,
  sortDirection,
}: {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) {
    return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
  }
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  );
}

/**
 * Organisations Table
 *
 * Displays all organisations with sortable columns, CRUD actions, and delete.
 */
export function OrganisationsTable() {
  const router = useRouter();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);

  // Sorting state - default to alphabetical by code
  const [sortColumn, setSortColumn] = useState<SortColumn>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Deactivate confirmation state
  const [deactivateOrg, setDeactivateOrg] = useState<Organisation | null>(null);
  const [shipmentCount, setShipmentCount] = useState<number>(0);
  const [isCheckingShipments, setIsCheckingShipments] = useState(false);

  // Delete confirmation state
  const [deleteOrg, setDeleteOrg] = useState<Organisation | null>(null);
  const [deleteShipmentCount, setDeleteShipmentCount] = useState<number>(0);
  const [isCheckingDeleteShipments, setIsCheckingDeleteShipments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // External toggle state
  const [togglingExternalId, setTogglingExternalId] = useState<string | null>(null);

  const loadOrganisations = useCallback(async () => {
    setIsLoading(true);
    // Admin view: include inactive organisations to allow reactivation
    const result = await getOrganisations({ includeInactive: true });
    if (result.success) {
      setOrganisations(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadOrganisations();
  }, [loadOrganisations]);

  // Sort organisations based on current sort state
  const sortedOrganisations = useMemo(() => {
    const sorted = [...organisations].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "code":
          comparison = a.code.localeCompare(b.code);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "userCount":
          comparison = (a.userCount ?? 0) - (b.userCount ?? 0);
          break;
        case "isActive":
          // Active items first when ascending
          comparison = a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [organisations, sortColumn, sortDirection]);

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

  // Handle toggle active - shows confirmation for deactivation
  const handleToggleActive = async (org: Organisation) => {
    if (org.isActive) {
      // Check for existing shipments before showing confirmation
      setIsCheckingShipments(true);
      setDeactivateOrg(org);

      const result = await getOrgShipmentCount(org.id);
      if (result.success) {
        setShipmentCount(result.data.count);
      } else {
        toast.error(result.error);
        setDeactivateOrg(null);
      }
      setIsCheckingShipments(false);
    } else {
      // Reactivate immediately (no confirmation needed)
      await performToggleActive(org, true);
    }
  };

  // Actually perform the toggle
  const performToggleActive = async (org: Organisation, newActive: boolean) => {
    const result = await toggleOrganisation(org.id, newActive);

    if (result.success) {
      toast.success(newActive ? "Organisation activated" : "Organisation deactivated");
      loadOrganisations();
    } else {
      toast.error(result.error);
    }
  };

  // Confirm deactivation
  const confirmDeactivate = async () => {
    if (deactivateOrg) {
      await performToggleActive(deactivateOrg, false);
      setDeactivateOrg(null);
      setShipmentCount(0);
    }
  };

  // Handle delete - shows confirmation with shipment check
  const handleDelete = async (org: Organisation) => {
    setIsCheckingDeleteShipments(true);
    setDeleteOrg(org);

    const result = await getOrgShipmentCount(org.id);
    if (result.success) {
      setDeleteShipmentCount(result.data.count);
    } else {
      toast.error(result.error);
      setDeleteOrg(null);
    }
    setIsCheckingDeleteShipments(false);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (deleteOrg) {
      setIsDeleting(true);
      const result = await deleteOrganisation(deleteOrg.id);

      if (result.success) {
        toast.success("Organisation deleted");
        loadOrganisations();
      } else {
        toast.error(result.error);
      }

      setDeleteOrg(null);
      setDeleteShipmentCount(0);
      setIsDeleting(false);
    }
  };

  // Handle toggle external
  const handleToggleExternal = async (org: Organisation) => {
    setTogglingExternalId(org.id);
    const result = await toggleOrganisationExternal(org.id, !org.isExternal);
    if (result.success) {
      toast.success(result.data.isExternal ? "Marked as external" : "Marked as internal");
      loadOrganisations();
    } else {
      toast.error(result.error);
    }
    setTogglingExternalId(null);
  };

  const handleEdit = (org: Organisation) => {
    setEditingOrg(org);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingOrg(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadOrganisations();
  };

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
          Add Organisation
        </Button>
      </div>

      {organisations.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No organisations yet</p>
          <Button onClick={handleAdd} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First Organisation
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">
                  <button
                    onClick={() => handleSort("code")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by code"
                  >
                    Code
                    <SortIndicator column="code" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by name"
                  >
                    Name
                    <SortIndicator column="name" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("userCount")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by user count"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Users
                    <SortIndicator column="userCount" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("isActive")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by status"
                  >
                    Status
                    <SortIndicator column="isActive" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrganisations.map((org) => (
                <TableRow
                  key={org.id}
                  className={`cursor-pointer hover:bg-accent/50 transition-colors ${!org.isActive ? "opacity-50" : ""}`}
                  onClick={() => router.push(`/admin/organisations/${org.id}`)}
                >
                  <TableCell className="font-mono font-medium">
                    {org.code}
                  </TableCell>
                  <TableCell>{org.name}</TableCell>
                  <TableCell className="text-center">
                    {org.userCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.isActive ? "success" : "secondary"}>
                      {org.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleExternal(org)}
                      disabled={togglingExternalId === org.id}
                      className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                    >
                      <Badge
                        variant={org.isExternal ? "warning" : "default"}
                        className={`cursor-pointer hover:opacity-80 transition-opacity ${togglingExternalId === org.id ? "opacity-50" : ""}`}
                      >
                        {togglingExternalId === org.id ? "..." : org.isExternal ? "External" : "Internal"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(org)}
                        aria-label={`Edit ${org.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleActive(org)}
                        aria-label={
                          org.isActive
                            ? `Deactivate ${org.name}`
                            : `Activate ${org.name}`
                        }
                      >
                        {org.isActive ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(org)}
                        aria-label={`Delete ${org.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <OrganisationForm
        organisation={editingOrg}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!deactivateOrg}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateOrg(null);
            setShipmentCount(0);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Organisation</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingShipments ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for existing shipments...
                </span>
              ) : shipmentCount > 0 ? (
                <>
                  This organisation has{" "}
                  <strong>
                    {shipmentCount} shipment{shipmentCount !== 1 ? "s" : ""}
                  </strong>
                  .
                  <br />
                  <br />
                  Deactivating will hide it from new forms but preserve existing
                  data.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate &quot;{deactivateOrg?.name}
                  &quot;?
                  <br />
                  <br />
                  This organisation will no longer appear in forms.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCheckingShipments}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              disabled={isCheckingShipments}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteOrg}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteOrg(null);
            setDeleteShipmentCount(0);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organisation</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingDeleteShipments ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for existing shipments...
                </span>
              ) : deleteShipmentCount > 0 ? (
                <>
                  <strong className="text-destructive">Cannot delete.</strong>
                  <br />
                  <br />
                  This organisation has{" "}
                  <strong>
                    {deleteShipmentCount} shipment
                    {deleteShipmentCount !== 1 ? "s" : ""}
                  </strong>{" "}
                  and cannot be deleted.
                  <br />
                  <br />
                  You can deactivate it instead to hide it from new forms.
                </>
              ) : (
                <>
                  Are you sure you want to permanently delete &quot;
                  {deleteOrg?.name}&quot;?
                  <br />
                  <br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            {deleteShipmentCount === 0 && (
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isCheckingDeleteShipments || isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
