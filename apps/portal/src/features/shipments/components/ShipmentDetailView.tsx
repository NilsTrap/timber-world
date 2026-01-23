"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";
import { PackageEntryTable } from "./PackageEntryTable";
import { getReferenceDropdowns, getActiveOrganisations, updateShipmentPackages } from "../actions";
import type {
  ShipmentDetail,
  ReferenceDropdowns,
  OrganisationOption,
  PackageRow,
  PackageInput,
} from "../types";

interface ShipmentDetailViewProps {
  shipment: ShipmentDetail;
}

/** Create a PackageRow from a PackageDetail for editing */
function packageDetailToRow(
  pkg: ShipmentDetail["packages"][number],
  index: number
): PackageRow {
  return {
    clientId: `pkg-${pkg.id}`,
    packageNumber: `PKG-${String(index + 1).padStart(3, "0")}`,
    productNameId: pkg.productNameId ?? "",
    woodSpeciesId: pkg.woodSpeciesId ?? "",
    humidityId: pkg.humidityId ?? "",
    typeId: pkg.typeId ?? "",
    processingId: pkg.processingId ?? "",
    fscId: pkg.fscId ?? "",
    qualityId: pkg.qualityId ?? "",
    thickness: pkg.thickness ?? "",
    width: pkg.width ?? "",
    length: pkg.length ?? "",
    pieces: pkg.pieces ?? "",
    volumeM3: pkg.volumeM3 != null ? String(pkg.volumeM3) : "",
    volumeIsCalculated: pkg.volumeIsCalculated,
  };
}

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

export function ShipmentDetailView({ shipment }: ShipmentDetailViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dropdowns, setDropdowns] = useState<ReferenceDropdowns | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [transportCostEur, setTransportCostEur] = useState(
    shipment.transportCostEur != null ? shipment.transportCostEur.toFixed(2) : ""
  );
  const [packageRows, setPackageRows] = useState<PackageRow[]>(
    shipment.packages.map((pkg, i) => packageDetailToRow(pkg, i))
  );

  useEffect(() => {
    async function loadData() {
      const [dropsResult, orgsResult] = await Promise.all([
        getReferenceDropdowns(),
        getActiveOrganisations(),
      ]);
      if (dropsResult.success) setDropdowns(dropsResult.data);
      if (orgsResult.success) setOrganisations(orgsResult.data);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleSave = useCallback(async () => {
    if (packageRows.length === 0) {
      toast.error("At least one package is required");
      return;
    }

    setIsSaving(true);

    const packages: PackageInput[] = packageRows.map((row) => ({
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

    const costNum = transportCostEur ? parseFloat(transportCostEur) : null;

    const result = await updateShipmentPackages({
      shipmentId: shipment.id,
      transportCostEur: costNum != null && !isNaN(costNum) ? costNum : null,
      packages,
    });

    setIsSaving(false);

    if (result.success) {
      toast.success(`Shipment updated with ${result.data.packageCount} packages`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }, [packageRows, transportCostEur, shipment.id, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/admin/inventory")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Overview
      </Button>

      {/* Shipment Header (read-only) */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          Shipment: <span className="font-mono">{shipment.shipmentCode}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">From:</span>{" "}
            <span className="font-medium">{shipment.fromPartyName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">To:</span>{" "}
            <span className="font-medium">{shipment.toPartyName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Date:</span>{" "}
            <span className="font-medium">{shipment.shipmentDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Transport Cost:</span>{" "}
            <span className="font-medium">
              {shipment.transportCostEur != null
                ? `€${shipment.transportCostEur.toFixed(2)}`
                : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Editable Package Table */}
      {dropdowns && (
        <PackageEntryTable
          dropdowns={dropdowns}
          rows={packageRows}
          onRowsChange={setPackageRows}
        />
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/inventory")}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
