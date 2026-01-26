"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@timber/ui";
import { ShipmentHeader } from "./ShipmentHeader";
import { PackageEntryTable } from "./PackageEntryTable";
import { getShipmentDestinations, getReferenceDropdowns, createOrgShipment } from "../actions";
import type { OrganisationOption, ReferenceDropdowns, PackageRow, PackageInput } from "../types";

interface ProducerNewShipmentFormProps {
  /** The current user's organization (locked as From) */
  userOrganisation: OrganisationOption;
}

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

/** Get today's date in YYYY-MM-DD format */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

const DRAFT_STORAGE_KEY = "producer-new-shipment-draft";

interface DraftState {
  toOrganisationId: string;
  shipmentDate: string;
  transportCostEur: string;
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
 * Producer New Shipment Form
 *
 * Client component for producers to create shipments.
 * The "From" organisation is locked to the user's organisation.
 */
export function ProducerNewShipmentForm({ userOrganisation }: ProducerNewShipmentFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Data loaded from server
  const [destinations, setDestinations] = useState<OrganisationOption[]>([]);
  const [dropdowns, setDropdowns] = useState<ReferenceDropdowns | null>(null);

  // Form state (restored from sessionStorage draft if available)
  const [draft] = useState(loadDraft);
  const [toOrganisationId, setToOrganisationId] = useState(draft?.toOrganisationId ?? "");
  const [shipmentDate, setShipmentDate] = useState(draft?.shipmentDate ?? getTodayDate());
  const [transportCostEur, setTransportCostEur] = useState(draft?.transportCostEur ?? "");
  const [packageRows, setPackageRows] = useState<PackageRow[]>(
    draft?.packageRows?.length ? draft.packageRows : [createEmptyRow(0)]
  );

  // Persist form state to sessionStorage on changes
  useEffect(() => {
    saveDraft({ toOrganisationId, shipmentDate, transportCostEur, packageRows });
  }, [toOrganisationId, shipmentDate, transportCostEur, packageRows]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      const [destsResult, dropsResult] = await Promise.all([
        getShipmentDestinations(),
        getReferenceDropdowns(),
      ]);

      if (destsResult.success) {
        setDestinations(destsResult.data);
      } else {
        toast.error(destsResult.error);
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
    // Validate header
    if (!toOrganisationId) {
      toast.error("Please select destination organisation");
      return;
    }
    if (!shipmentDate) {
      toast.error("Please select a date");
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

    const result = await createOrgShipment({
      toOrganisationId,
      shipmentDate,
      transportCostEur: transportCostEur ? parseFloat(transportCostEur) : null,
      packages,
    });

    if (result.success) {
      clearDraft();
      toast.success(`Shipment created with ${result.data.packageCount} packages`);
      router.push("/shipments?tab=list");
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  }, [toOrganisationId, shipmentDate, transportCostEur, packageRows, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Combine destinations with user's org for the ShipmentHeader (it filters internally)
  const allOrganisations = [userOrganisation, ...destinations];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">New Shipment</h2>
      </div>

      <ShipmentHeader
        organisations={allOrganisations}
        fromOrganisationId={userOrganisation.id}
        toOrganisationId={toOrganisationId}
        shipmentDate={shipmentDate}
        transportCostEur={transportCostEur}
        onFromOrganisationChange={() => {}} // No-op, From is locked
        onToOrganisationChange={setToOrganisationId}
        onDateChange={setShipmentDate}
        onTransportCostChange={setTransportCostEur}
        lockedFromOrganisation={userOrganisation}
      />

      {dropdowns && (
        <PackageEntryTable
          rows={packageRows}
          dropdowns={dropdowns}
          onRowsChange={setPackageRows}
          shipmentCode=""
        />
      )}

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/shipments?tab=list")}
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
            "Save Shipment"
          )}
        </Button>
      </div>
    </div>
  );
}
