"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@timber/ui";
import { ArrowLeft, Plus, Truck, Loader2, X } from "lucide-react";
import { getOrgShipmentDetail } from "@/features/shipments/actions/getOrgShipmentDetail";
import { cancelShipmentSubmission } from "@/features/shipments/actions/submitShipment";
import type { ShipmentDetail, ShipmentStatus } from "@/features/shipments/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ShipmentPackageSelector } from "@/features/shipments/components/ShipmentPackageSelector";
import { SubmitShipmentDialog } from "@/features/shipments/components/SubmitShipmentDialog";
import { AcceptRejectButtons } from "@/features/shipments/components/AcceptRejectButtons";
import { DeleteShipmentDraftButton } from "@/features/shipments/components/DeleteShipmentDraftButton";
import { ShipmentPalletTable } from "@/features/shipments/components/ShipmentPalletTable";
import { IncomingShipmentPackageEditor } from "@/features/shipments/components/IncomingShipmentPackageEditor";

const statusColors: Record<ShipmentStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-orange-100 text-orange-800",
  accepted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<ShipmentStatus, string> = {
  draft: "Draft",
  pending: "On The Way",
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
  const [isFromExternal, setIsFromExternal] = useState(false);

  const fetchShipment = useCallback(async () => {
    const result = await getOrgShipmentDetail(shipmentId);
    if (result.success) {
      setShipment(result.data.shipment);
      setIsOwner(result.data.isOwner);
      setIsReceiver(result.data.isReceiver);
      setIsFromExternal(result.data.isFromExternal);
    } else {
      toast.error(result.error);
      router.push("/shipments");
    }
    setLoading(false);
  }, [shipmentId, router]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

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
  // For incoming shipments from external orgs, the receiver can edit the draft
  const isIncomingFromExternal = isFromExternal && isReceiver;
  const canEdit = isDraft && (isOwner || isIncomingFromExternal);
  const canSubmit = isDraft && (isOwner || isIncomingFromExternal) && shipment.packages.length > 0;
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          {shipment.shipmentCode}
        </h1>
        <div className="flex items-center gap-3">
          {isDraft && (isOwner || isIncomingFromExternal) && (
            <DeleteShipmentDraftButton
              shipmentId={shipment.id}
              shipmentCode={shipment.shipmentCode}
            />
          )}
          {canSubmit && (
            <Button onClick={() => setShowSubmitDialog(true)}>
              <Truck className="h-4 w-4 mr-2" />
              On The Way
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

      {/* Packages Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Packages</h2>

        {/* For incoming external shipments: show editable package table */}
        {isIncomingFromExternal && isDraft ? (
          <IncomingShipmentPackageEditor
            shipmentId={shipment.id}
            shipmentCode={shipment.shipmentCode}
            packages={shipment.packages}
            onRefresh={fetchShipment}
          />
        ) : (
          <>
            {/* Header with package count and add button */}
            <div className="flex items-center justify-between">
              <div>
                {shipment.packages.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total: {formatVolume(totalVolume)} m³
                  </p>
                )}
              </div>
              {canEdit && !isIncomingFromExternal && (
                <Button variant="outline" size="sm" onClick={() => setShowPackageSelector(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Packages
                </Button>
              )}
            </div>

            {shipment.packages.length === 0 ? (
              <div
                className={`rounded-lg border bg-card p-6 text-center ${canEdit && !isIncomingFromExternal ? "cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors" : ""}`}
                onClick={canEdit && !isIncomingFromExternal ? () => setShowPackageSelector(true) : undefined}
              >
                <p className="text-sm text-muted-foreground">
                  {canEdit && !isIncomingFromExternal
                    ? "No packages added yet. Click here to select packages from inventory."
                    : "No packages in this shipment."}
                </p>
              </div>
            ) : (
              <ShipmentPalletTable
                shipmentId={shipment.id}
                packages={shipment.packages}
                pallets={shipment.pallets}
                canEdit={canEdit && !isIncomingFromExternal}
                onRefresh={fetchShipment}
              />
            )}
          </>
        )}
      </div>

      {/* Package Selector Dialog (for outgoing shipments) */}
      {showPackageSelector && !isIncomingFromExternal && (
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
