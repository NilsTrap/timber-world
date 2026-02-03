"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@timber/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { ArrowLeft, Plus, Trash2, Send, Loader2, X } from "lucide-react";
import { getOrgShipmentDetail } from "@/features/shipments/actions/getOrgShipmentDetail";
import { removePackageFromShipment } from "@/features/shipments/actions/shipmentPackages";
import { cancelShipmentSubmission } from "@/features/shipments/actions/submitShipment";
import type { ShipmentDetail, ShipmentStatus } from "@/features/shipments/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ShipmentPackageSelector } from "@/features/shipments/components/ShipmentPackageSelector";
import { SubmitShipmentDialog } from "@/features/shipments/components/SubmitShipmentDialog";
import { AcceptRejectButtons } from "@/features/shipments/components/AcceptRejectButtons";
import { DeleteShipmentDraftButton } from "@/features/shipments/components/DeleteShipmentDraftButton";

const statusColors: Record<ShipmentStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-orange-100 text-orange-800",
  accepted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<ShipmentStatus, string> = {
  draft: "Draft",
  pending: "Pending Acceptance",
  accepted: "Accepted",
  completed: "Completed",
  rejected: "Rejected",
};

function formatVolume(vol: number | null): string {
  if (vol === null || vol === 0) return "-";
  return vol.toLocaleString("de-DE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Shipment Detail Page
 *
 * Shows shipment details and allows managing packages for drafts.
 * For pending shipments (incoming), shows accept/reject buttons.
 */
export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPackageSelector, setShowPackageSelector] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isReceiver, setIsReceiver] = useState(false);

  const fetchShipment = useCallback(async () => {
    const result = await getOrgShipmentDetail(shipmentId);
    if (result.success) {
      setShipment(result.data.shipment);
      setIsOwner(result.data.isOwner);
      setIsReceiver(result.data.isReceiver);
    } else {
      toast.error(result.error);
      router.push("/shipments");
    }
    setLoading(false);
  }, [shipmentId, router]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  const handleRemovePackage = async (packageId: string) => {
    if (!shipment) return;

    const result = await removePackageFromShipment(shipment.id, packageId);
    if (result.success) {
      toast.success("Package removed");
      fetchShipment();
    } else {
      toast.error(result.error);
    }
  };

  const handlePackagesAdded = () => {
    setShowPackageSelector(false);
    fetchShipment();
  };

  const handleSubmitSuccess = () => {
    setShowSubmitDialog(false);
    fetchShipment();
  };

  const handleCancelSubmission = async () => {
    if (!shipment) return;
    setCanceling(true);
    const result = await cancelShipmentSubmission(shipment.id);
    if (result.success) {
      toast.success("Submission cancelled - shipment returned to draft");
      fetchShipment();
    } else {
      toast.error(result.error);
    }
    setCanceling(false);
  };

  const totalVolume = shipment?.packages.reduce(
    (sum, pkg) => sum + (pkg.volumeM3 ?? 0),
    0
  ) ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shipment) {
    return null;
  }

  const isDraft = shipment.status === "draft";
  const isPending = shipment.status === "pending";
  const canEdit = isDraft && isOwner;
  const canSubmit = isDraft && isOwner && shipment.packages.length > 0;
  const canReview = isPending && isReceiver;
  const canCancel = isPending && isOwner;

  return (
    <div className="space-y-6">
      {/* Back Link - same style as production */}
      <Link
        href={isDraft ? "/shipments" : "/shipments?tab=completed"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Header - same layout as production */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {shipment.shipmentCode}
          </h1>
          <p className="text-muted-foreground">
            {isOwner ? "To" : "From"}: {isOwner ? shipment.toOrganisationName : shipment.fromOrganisationName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && isOwner && (
            <DeleteShipmentDraftButton
              shipmentId={shipment.id}
              shipmentCode={shipment.shipmentCode}
            />
          )}
          {canSubmit && (
            <Button onClick={() => setShowSubmitDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Submit
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={handleCancelSubmission} disabled={canceling}>
              {canceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </>
              )}
            </Button>
          )}
          {canReview && (
            <AcceptRejectButtons
              shipmentId={shipment.id}
              packageCount={shipment.packages.length}
              totalVolume={totalVolume}
              fromOrgName={shipment.fromOrganisationName}
              onSuccess={fetchShipment}
            />
          )}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[shipment.status]}`}
          >
            {statusLabels[shipment.status]}
          </span>
        </div>
      </div>

      {/* Summary Cards - same style as ProductionSummary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">From</p>
          <p className="text-xl font-semibold truncate">{shipment.fromOrganisationName}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">To</p>
          <p className="text-xl font-semibold truncate">{shipment.toOrganisationName}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="text-xl font-semibold">{formatDate(shipment.shipmentDate)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Volume</p>
          <p className="text-xl font-semibold">{formatVolume(totalVolume)} m³</p>
        </div>
      </div>

      {/* Notes & Rejection Reason */}
      {(shipment.notes || (shipment.status === "rejected" && shipment.rejectionReason)) && (
        <div className="rounded-lg border bg-card p-4">
          {shipment.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{shipment.notes}</p>
            </div>
          )}
          {shipment.status === "rejected" && shipment.rejectionReason && (
            <div className={shipment.notes ? "mt-4 pt-4 border-t" : ""}>
              <p className="text-sm text-red-600 font-medium mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{shipment.rejectionReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Packages Section - same style as ProductionInputsSection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Packages</h2>
            {shipment.packages.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: {formatVolume(totalVolume)} m³
              </p>
            )}
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setShowPackageSelector(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Packages
            </Button>
          )}
        </div>

        {shipment.packages.length === 0 ? (
          <div
            className={`rounded-lg border bg-card p-6 text-center ${canEdit ? "cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors" : ""}`}
            onClick={canEdit ? () => setShowPackageSelector(true) : undefined}
          >
            <p className="text-sm text-muted-foreground">
              {canEdit ? "No packages added yet. Click here to select packages from inventory." : "No packages in this shipment."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Species</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead className="text-right">Pieces</TableHead>
                  <TableHead className="text-right">Volume m³</TableHead>
                  {canEdit && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.packageNumber}</TableCell>
                    <TableCell>{pkg.productName ?? "-"}</TableCell>
                    <TableCell>{pkg.woodSpecies ?? "-"}</TableCell>
                    <TableCell>
                      {pkg.thickness && pkg.width && pkg.length
                        ? `${pkg.thickness} × ${pkg.width} × ${pkg.length}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">{pkg.pieces ?? "-"}</TableCell>
                    <TableCell className="text-right">{formatVolume(pkg.volumeM3)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePackage(pkg.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Package Selector Dialog */}
      {showPackageSelector && (
        <ShipmentPackageSelector
          shipmentId={shipment.id}
          existingPackageIds={shipment.packages.map((p) => p.id)}
          onClose={() => setShowPackageSelector(false)}
          onPackagesAdded={handlePackagesAdded}
        />
      )}

      {/* Submit Dialog */}
      {showSubmitDialog && (
        <SubmitShipmentDialog
          shipmentId={shipment.id}
          toOrgName={shipment.toOrganisationName}
          packageCount={shipment.packages.length}
          totalVolume={totalVolume}
          onClose={() => setShowSubmitDialog(false)}
          onSuccess={handleSubmitSuccess}
        />
      )}
    </div>
  );
}
