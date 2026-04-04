"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, Check, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button, DataEntryTable, type ColumnDef, type DataEntryTableHandle } from "@timber/ui";
import { getTrackingSetDetail } from "../actions/tracking";
import { traceProductionPipeline } from "../actions/tracking";
import { removeTrackingPackages } from "../actions/tracking";
import { renameTrackingSet } from "../actions/tracking";
import { getAuditPackages } from "@/features/inventory/actions/getAuditPackages";
import type { TrackingSetDetail, TrackingSetPackage } from "../actions/tracking";
import type { PipelineResult } from "../actions/tracking";
import type { AuditPackageItem } from "@/features/inventory/actions/getAuditPackages";
import { PipelineView, InputOutputTable } from "./PipelineView";
import { TrackingPackageSelector } from "./TrackingPackageSelector";

function formatVol(v: number | null): string {
  if (v == null || v === 0) return "-";
  return v.toFixed(3).replace(".", ",");
}

const TRACKING_LAST_ENTRY_KEY = "production-last-entry";

export function TrackingSetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const trackingSetId = params.id as string;

  const [detail, setDetail] = useState<TrackingSetDetail | null>(null);
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [allPackages, setAllPackages] = useState<AuditPackageItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [packagesExpanded, setPackagesExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const tableRef = useRef<DataEntryTableHandle>(null);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Remember this page for sidebar navigation
  useEffect(() => {
    sessionStorage.setItem(TRACKING_LAST_ENTRY_KEY, pathname);
  }, [pathname]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [detailResult, pipelineResult] = await Promise.all([
      getTrackingSetDetail(trackingSetId),
      traceProductionPipeline(trackingSetId),
    ]);

    if (detailResult.success) {
      setDetail(detailResult.data);
      setNameInput(detailResult.data.name);
    } else {
      toast.error(detailResult.error);
      router.push("/production?tab=tracking");
    }

    if (pipelineResult.success) {
      setPipeline(pipelineResult.data);
    }

    setLoading(false);
  }, [trackingSetId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenSelector = async () => {
    setLoadingPackages(true);
    setShowSelector(true);
    const result = await getAuditPackages();
    if (result.success) {
      setAllPackages(result.data);
    } else {
      toast.error("Failed to load packages");
      setShowSelector(false);
    }
    setLoadingPackages(false);
  };

  const handlePackagesAdded = () => {
    setShowSelector(false);
    setAllPackages([]);
    fetchData();
  };

  const existingPackageIds = useMemo(
    () => new Set(detail?.packages.map((p) => p.id) ?? []),
    [detail?.packages]
  );

  const toggleRemoval = useCallback((id: string) => {
    setSelectedForRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRemoveSelected = async () => {
    if (selectedForRemoval.size === 0) return;
    setRemoving(true);
    const result = await removeTrackingPackages(trackingSetId, [...selectedForRemoval]);
    if (result.success) {
      toast.success(`Removed ${selectedForRemoval.size} package${selectedForRemoval.size !== 1 ? "s" : ""}`);
      setSelectedForRemoval(new Set());
      fetchData();
    } else {
      toast.error(result.error);
    }
    setRemoving(false);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === detail?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const result = await renameTrackingSet(trackingSetId, nameInput.trim());
    if (result.success) {
      setDetail((prev) => prev ? { ...prev, name: nameInput.trim() } : prev);
      toast.success("Name updated");
    } else {
      toast.error(result.error);
      setNameInput(detail?.name ?? "");
    }
    setSavingName(false);
    setEditingName(false);
  };

  const columns: ColumnDef<TrackingSetPackage>[] = useMemo(
    () => [
      {
        key: "selected",
        label: "",
        type: "custom",
        width: "w-[2.5rem]",
        getValue: (row) => selectedForRemoval.has(row.id) ? "1" : "0",
        renderCell: (row) => (
          <button
            type="button"
            onClick={() => toggleRemoval(row.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selectedForRemoval.has(row.id)
                ? "bg-destructive border-destructive text-destructive-foreground"
                : "border-input hover:border-destructive"
            }`}
          >
            {selectedForRemoval.has(row.id) && <Check className="h-3 w-3" />}
          </button>
        ),
      },
      {
        key: "packageNumber",
        label: "Package",
        type: "readonly",
        getValue: (row) => row.packageNumber,
        totalType: "count",
        formatTotal: (v) => String(v),
      },
      {
        key: "status",
        label: "Status",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.status,
      },
      {
        key: "productName",
        label: "Product",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.productName ?? "",
      },
      {
        key: "woodSpecies",
        label: "Species",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.woodSpecies ?? "",
      },
      {
        key: "thickness",
        label: "Thick",
        type: "text",
        isNumeric: true,
        getValue: (row) => row.thickness ?? "",
        width: "w-[4.5rem]",
      },
      {
        key: "width",
        label: "Width",
        type: "text",
        isNumeric: true,
        getValue: (row) => row.width ?? "",
        width: "w-[4.5rem]",
      },
      {
        key: "length",
        label: "Length",
        type: "text",
        isNumeric: true,
        getValue: (row) => row.length ?? "",
        width: "w-[4.5rem]",
      },
      {
        key: "pieces",
        label: "Pieces",
        type: "numeric",
        getValue: (row) => row.pieces && row.pieces !== "0" ? row.pieces : "",
        getDisplayValue: (row) => row.pieces && row.pieces !== "0" ? row.pieces : "-",
        width: "w-[4.5rem]",
        totalType: "sum",
        formatTotal: (v) => String(Math.round(v)),
      },
      {
        key: "volumeM3",
        label: "Vol m³",
        type: "numeric",
        getValue: (row) =>
          row.volumeM3 != null ? row.volumeM3.toFixed(3) : "",
        getDisplayValue: (row) =>
          row.volumeM3 != null ? row.volumeM3.toFixed(3).replace(".", ",") : "",
        totalType: "sum",
        formatTotal: (v) => v.toFixed(3).replace(".", ","),
      },
      {
        key: "sourceType",
        label: "Source",
        type: "dropdown",
        collapsible: true,
        getValue: (row) => row.sourceType,
      },
      {
        key: "sourceDetail",
        label: "Source Detail",
        type: "dropdown",
        getValue: (row) => row.sourceDetail,
      },
    ],
    [selectedForRemoval, toggleRemoval]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) return null;

  const totalVolume = detail.packages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/production?tab=tracking"
        onClick={() => sessionStorage.removeItem(TRACKING_LAST_ENTRY_KEY)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setNameInput(detail.name);
                  }
                }}
                className="text-3xl font-semibold tracking-tight bg-transparent border-b-2 border-primary outline-none"
                autoFocus
                disabled={savingName}
              />
              <Button variant="ghost" size="sm" onClick={handleSaveName} disabled={savingName}>
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingName(false); setNameInput(detail.name); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">{detail.name}</h1>
              <Button variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tracked Packages — collapsible */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPackagesExpanded((v) => !v)}
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${packagesExpanded ? "rotate-90" : ""}`} />
            <h2 className="text-lg font-semibold">Tracked Packages</h2>
            <span className="text-sm text-muted-foreground font-normal">
              {detail.packages.length} package{detail.packages.length !== 1 ? "s" : ""} · {formatVol(totalVolume)} m³
            </span>
          </button>
          <div className="flex items-center gap-2">
            {packagesExpanded && hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => tableRef.current?.clearFilters()}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
            {packagesExpanded && selectedForRemoval.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveSelected}
                disabled={removing}
              >
                {removing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Remove {selectedForRemoval.size}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleOpenSelector}>
              <Plus className="h-4 w-4 mr-1" />
              Add Packages
            </Button>
          </div>
        </div>

        {detail.packages.length === 0 ? (
          <div
            className="rounded-lg border bg-card p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
            onClick={handleOpenSelector}
          >
            <p className="text-sm text-muted-foreground">
              No packages tracked yet. Click here to add packages.
            </p>
          </div>
        ) : packagesExpanded ? (
          <div className="w-fit max-w-full">
            <DataEntryTable<TrackingSetPackage>
              ref={tableRef}
              columns={columns}
              rows={detail.packages}
              getRowKey={(row) => row.id}
              readOnly
              collapseStorageKey="tracking-detail-collapsed"
              filterStorageKey="tracking-detail"
              onFilterActiveChange={setHasActiveFilters}
              getRowClassName={(row) =>
                selectedForRemoval.has(row.id) ? "bg-destructive/5" : undefined
              }
            />
          </div>
        ) : null}
      </div>

      {/* Summary — collapsible, styled like a pipeline stage */}
      {pipeline && (() => {
        // Collect all unique outside packages from all stages (inputs not in the tracked set)
        const outsideMap = new Map<string, typeof pipeline.seedPackages[number]>();
        for (const stage of pipeline.stages) {
          for (const input of stage.inputs) {
            if (!input.isTracked && !outsideMap.has(input.id)) {
              outsideMap.set(input.id, input);
            }
          }
        }
        const outsidePackages = [...outsideMap.values()];
        const allInputs = [...pipeline.seedPackages, ...outsidePackages];
        const allOutput = [...pipeline.finalPackages, ...pipeline.shippedPackages];
        const inputVolume = allInputs.reduce((s, p) => s + (p.volumeM3 ?? 0), 0);
        const outputVolume = allOutput.reduce((s, p) => s + (p.volumeM3 ?? 0), 0);
        const outcomePercentage = inputVolume > 0 ? (outputVolume / inputVolume) * 100 : 0;
        return (
          <div className="rounded-lg border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOutputExpanded((v) => !v)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors"
            >
              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${outputExpanded ? "rotate-90" : ""}`} />
              <span className="font-medium text-sm">Summary</span>
              <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                <span>{allInputs.length} in</span>
                <span>&rarr;</span>
                <span>{allOutput.length} out</span>
                <span className="mx-1">&middot;</span>
                <span>{formatVol(inputVolume)} &rarr; {formatVol(outputVolume)} m³</span>
                <span className="mx-1">&middot;</span>
                <span className="font-medium text-foreground">{outcomePercentage.toFixed(1)}%</span>
                {outsidePackages.length > 0 && (
                  <span className="italic">+{outsidePackages.length} outside</span>
                )}
                {pipeline.shippedPackages.length > 0 && (
                  <span className="italic">{pipeline.shippedPackages.length} shipped</span>
                )}
              </span>
            </button>
            {outputExpanded && (
              <div className="p-4 pt-0 border-t">
                <div className="pt-3">
                  <InputOutputTable
                    sections={[
                      { label: "Tracked Inputs", packages: pipeline.seedPackages, color: "bg-blue-50/50" },
                      ...(outsidePackages.length > 0 ? [{ label: "Outside Inputs", packages: outsidePackages, color: "bg-orange-50/50" }] : []),
                      { label: "Output — Available", packages: pipeline.finalPackages, color: "bg-green-50/50" },
                      { label: "Output — Shipped", packages: pipeline.shippedPackages, color: "bg-purple-50/50" },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Pipeline Visualization */}
      {pipeline && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Production Pipeline</h2>
          <PipelineView pipeline={pipeline} />
        </div>
      )}

      {/* Package Selector Dialog */}
      {showSelector && (
        loadingPackages ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg p-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading packages...</p>
            </div>
          </div>
        ) : (
          <TrackingPackageSelector
            trackingSetId={trackingSetId}
            allPackages={allPackages}
            existingPackageIds={existingPackageIds}
            onClose={() => { setShowSelector(false); setAllPackages([]); }}
            onPackagesAdded={handlePackagesAdded}
          />
        )
      )}
    </div>
  );
}
