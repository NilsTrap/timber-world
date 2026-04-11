"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { Loader2 } from "lucide-react";
import { tracePackageHistory } from "@/features/production/actions/tracking";
import type { PipelineResult } from "@/features/production/actions/tracking";
import { PackageList, StageRow } from "@/features/production/components/PipelineView";

interface PackageHistoryDialogProps {
  packageId: string | null;
  packageNumber: string | null;
  onClose: () => void;
}

export function PackageHistoryDialog({ packageId, packageNumber, onClose }: PackageHistoryDialogProps) {
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history when packageId changes (dialog opens)
  useEffect(() => {
    if (!packageId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPipeline(null);

    tracePackageHistory(packageId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setPipeline(result.data);
      } else {
        setError(result.error ?? "Failed to load package history");
      }
    }).catch(() => {
      if (!cancelled) setError("An unexpected error occurred");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [packageId]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
        setPipeline(null);
        setError(null);
      }
    },
    [onClose]
  );

  const isOpen = packageId !== null;
  const hasHistory = pipeline && pipeline.stages.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-[98vw] w-fit max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            Production History — {packageNumber ?? "Package"}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading production history...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && pipeline && !hasHistory && (
          <div className="rounded-lg border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No production history found for this package. It may have been added directly via shipment or manual entry.
            </p>
          </div>
        )}

        {!loading && !error && hasHistory && (
          <div className="space-y-4">
            {/* Origin packages (raw material) */}
            {pipeline.seedPackages.length > 0 && (
              <PackageList
                packages={pipeline.seedPackages}
                label="Origin Packages (Raw Material)"
                color="bg-blue-50/50"
              />
            )}

            {/* Production stages */}
            <div className="grid gap-2">
              {pipeline.stages.map((stage) => (
                <StageRow key={stage.entryId} stage={stage} highlightId={packageId} hideMissing />
              ))}
            </div>

            {/* Final output split by status */}
            {pipeline.finalPackages.length > 0 && (
              <PackageList
                packages={pipeline.finalPackages}
                label="Final Output — In Warehouse"
                color="bg-green-50/50"
                highlightId={packageId}
              />
            )}
            {pipeline.onTheWayPackages.length > 0 && (
              <PackageList
                packages={pipeline.onTheWayPackages}
                label="Final Output — On The Way"
                color="bg-amber-50/50"
                highlightId={packageId}
              />
            )}
            {pipeline.shippedPackages.length > 0 && (
              <PackageList
                packages={pipeline.shippedPackages}
                label="Final Output — Shipped"
                color="bg-purple-50/50"
                highlightId={packageId}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
