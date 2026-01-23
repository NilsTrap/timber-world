"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Power,
  PowerOff,
  Plus,
  Loader2,
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
import { getParties, toggleParty, getPartyShipmentCount } from "../actions";
import type { Party } from "../types";
import { PartyForm } from "./PartyForm";

/**
 * Parties Table
 *
 * Displays all parties with CRUD actions.
 */
export function PartiesTable() {
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Deactivate confirmation state
  const [deactivateParty, setDeactivateParty] = useState<Party | null>(null);
  const [shipmentCount, setShipmentCount] = useState<number>(0);
  const [isCheckingShipments, setIsCheckingShipments] = useState(false);

  const loadParties = useCallback(async () => {
    setIsLoading(true);
    // Admin view: include inactive parties to allow reactivation
    const result = await getParties({ includeInactive: true });
    if (result.success) {
      setParties(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  // Handle toggle active - shows confirmation for deactivation
  const handleToggleActive = async (party: Party) => {
    if (party.isActive) {
      // Check for existing shipments before showing confirmation
      setIsCheckingShipments(true);
      setDeactivateParty(party);

      const result = await getPartyShipmentCount(party.id);
      if (result.success) {
        setShipmentCount(result.data.count);
      } else {
        toast.error(result.error);
        setDeactivateParty(null);
      }
      setIsCheckingShipments(false);
    } else {
      // Reactivate immediately (no confirmation needed)
      await performToggleActive(party, true);
    }
  };

  // Actually perform the toggle
  const performToggleActive = async (party: Party, newActive: boolean) => {
    const result = await toggleParty(party.id, newActive);

    if (result.success) {
      toast.success(newActive ? "Party activated" : "Party deactivated");
      loadParties();
    } else {
      toast.error(result.error);
    }
  };

  // Confirm deactivation
  const confirmDeactivate = async () => {
    if (deactivateParty) {
      await performToggleActive(deactivateParty, false);
      setDeactivateParty(null);
      setShipmentCount(0);
    }
  };

  const handleEdit = (party: Party) => {
    setEditingParty(party);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingParty(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadParties();
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
          Add Party
        </Button>
      </div>

      {parties.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No parties yet</p>
          <Button onClick={handleAdd} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First Party
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => (
                <TableRow
                  key={party.id}
                  className={!party.isActive ? "opacity-50" : ""}
                >
                  <TableCell className="font-mono font-medium">
                    {party.code}
                  </TableCell>
                  <TableCell>{party.name}</TableCell>
                  <TableCell>
                    <Badge variant={party.isActive ? "success" : "secondary"}>
                      {party.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(party)}
                        aria-label={`Edit ${party.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleActive(party)}
                        aria-label={party.isActive ? `Deactivate ${party.name}` : `Activate ${party.name}`}
                      >
                        {party.isActive ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PartyForm
        party={editingParty}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleFormSuccess}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!deactivateParty}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateParty(null);
            setShipmentCount(0);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Party</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingShipments ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for existing shipments...
                </span>
              ) : shipmentCount > 0 ? (
                <>
                  This party has <strong>{shipmentCount} shipment{shipmentCount !== 1 ? "s" : ""}</strong> and cannot be deleted.
                  <br /><br />
                  You can deactivate it instead, which will hide it from new shipment forms but preserve existing data.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate &quot;{deactivateParty?.name}&quot;?
                  <br /><br />
                  This party will no longer appear when creating new shipments.
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
    </div>
  );
}
