"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, Label } from "@timber/ui";
import { PackageEntryTable } from "@/features/shipments/components/PackageEntryTable";
import { getActiveOrganisations, getReferenceDropdowns } from "@/features/shipments/actions";
import { createAdminInventory } from "../actions";
import type { OrganisationOption, ReferenceDropdowns, PackageRow, PackageInput } from "@/features/shipments/types";

/** Create an empty package row */
function createEmptyRow(index: number): PackageRow {
  return {
    clientId: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    packageNumber: `PKG-${String(index + 1).padStart(3, "0")}`,
    productNameId: "",
    woodSpeciesId: "",
    humidityId: "",
    typeId: "",
    processingId: "",
    fscId: "",
    qualityId: "",
    thickness: "",
    width: "",
    length: "",
    pieces: "",
    volumeM3: "",
    volumeIsCalculated: false,
  };
}

const DRAFT_STORAGE_KEY = "admin-add-inventory-draft";

interface DraftState {
  toOrganisationId: string;
  packageRows: PackageRow[];
}

function loadDraft(): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

function saveDraft(state: DraftState) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}

/**
 * Admin Add Inventory Form
 *
 * Simplified form for adding inventory directly to an organization.
 * - No shipment is created - packages go directly to inventory
 * - Just select destination org and packages
 */
export function AdminAddInventoryForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Data loaded from server
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [dropdowns, setDropdowns] = useState<ReferenceDropdowns | null>(null);

  // Form state (restored from sessionStorage draft if available)
  const [draft] = useState(loadDraft);
  const [toOrganisationId, setToOrganisationId] = useState(draft?.toOrganisationId ?? "");
  const [packageRows, setPackageRows] = useState<PackageRow[]>(
    draft?.packageRows?.length ? draft.packageRows : [createEmptyRow(0)]
  );

  // Persist form state to sessionStorage on changes
  useEffect(() => {
    saveDraft({ toOrganisationId, packageRows });
  }, [toOrganisationId, packageRows]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      const [orgsResult, dropsResult] = await Promise.all([
        getActiveOrganisations(),
        getReferenceDropdowns(),
      ]);

      if (orgsResult.success) {
        setOrganisations(orgsResult.data);
      } else {
        toast.error(orgsResult.error);
      }

      if (dropsResult.success) {
        setDropdowns(dropsResult.data);
      } else {
        toast.error(dropsResult.error);
      }

      setIsLoading(false);
    }

    loadData();
  }, []);

  const handleSave = useCallback(async () => {
    // Validate
    if (!toOrganisationId) {
      toast.error("Please select destination organization");
      return;
    }

    // Validate packages - at least one row with some data
    const validPackages = packageRows.filter(
      (row) => row.thickness || row.width || row.length || row.pieces
    );

    if (validPackages.length === 0) {
      toast.error("Please enter at least one package");
      return;
    }

    // Transform rows to server format
    const packages: PackageInput[] = validPackages.map((row) => ({
      packageNumber: row.packageNumber || undefined,
      productNameId: row.productNameId || null,
      woodSpeciesId: row.woodSpeciesId || null,
      humidityId: row.humidityId || null,
      typeId: row.typeId || null,
      processingId: row.processingId || null,
      fscId: row.fscId || null,
      qualityId: row.qualityId || null,
      thickness: row.thickness,
      width: row.width,
      length: row.length,
      pieces: row.pieces,
      volumeM3: row.volumeM3 ? parseFloat(row.volumeM3) : null,
      volumeIsCalculated: row.volumeIsCalculated,
    }));

    setIsSaving(true);

    const result = await createAdminInventory({
      toOrganisationId,
      packages,
    });

    if (result.success) {
      clearDraft();
      toast.success(`Added ${result.data.packageCount} packages to inventory`);
      router.push("/admin/inventory?tab=inventory");
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  }, [toOrganisationId, packageRows, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Add Inventory</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* To Organisation */}
          <div className="space-y-2">
            <Label htmlFor="to-organisation">
              Destination Organization
            </Label>
            <select
              id="to-organisation"
              value={toOrganisationId}
              onChange={(e) => setToOrganisationId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select organization...</option>
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.code} - {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Package Entry Table */}
      {dropdowns && (
        <PackageEntryTable
          rows={packageRows}
          dropdowns={dropdowns}
          onRowsChange={setPackageRows}
          shipmentCode="INV"
          editablePackageNumbers
        />
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/inventory")}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Add to Inventory"
          )}
        </Button>
      </div>
    </div>
  );
}
