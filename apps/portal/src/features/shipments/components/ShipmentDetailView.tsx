"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { PackageEntryTable } from "./PackageEntryTable";
import { getReferenceDropdowns, updateShipmentPackages } from "../actions";
import type {
  ShipmentDetail,
  ReferenceDropdowns,
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
    volumeM3: pkg.volumeM3 != null ? pkg.volumeM3.toFixed(3) : "",
    volumeIsCalculated: pkg.volumeIsCalculated,
  };
}

export function ShipmentDetailView({ shipment }: ShipmentDetailViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dropdowns, setDropdowns] = useState<ReferenceDropdowns | null>(null);
  const [transportCostEur, setTransportCostEur] = useState(
    shipment.transportCostEur != null ? shipment.transportCostEur.toFixed(2).replace(".", ",") : ""
  );
  const [packageRows, setPackageRows] = useState<PackageRow[]>(
    shipment.packages.map((pkg, i) => packageDetailToRow(pkg, i))
  );

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const result = await getReferenceDropdowns();
      if (result.success) {
        setDropdowns(result.data);
      } else {
        setLoadError(result.error);
        toast.error("Failed to load reference data");
      }
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

    const costNum = transportCostEur ? parseFloat(transportCostEur.replace(",", ".")) : null;

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
        onClick={() => router.push("/admin/inventory?tab=shipments")}
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
            <span className="text-muted-foreground block mb-1">Transport Cost (€)</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Transport cost in euros"
              value={transportCostEur}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^[\d.,]*$/.test(val)) {
                  setTransportCostEur(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={() => {
                const num = parseFloat(transportCostEur.replace(",", "."));
                if (!isNaN(num)) {
                  setTransportCostEur(num.toFixed(2).replace(".", ","));
                }
              }}
              className="w-32 h-8"
            />
          </div>
        </div>
      </div>

      {/* Editable Package Table */}
      {loadError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load reference data: {loadError}
        </div>
      )}
      {dropdowns && (
        <PackageEntryTable
          dropdowns={dropdowns}
          rows={packageRows}
          onRowsChange={setPackageRows}
          shipmentCode={shipment.shipmentCode}
        />
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/inventory?tab=shipments")}
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
