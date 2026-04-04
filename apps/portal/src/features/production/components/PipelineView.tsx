"use client";

import { useState, useRef, useMemo, useEffect, useCallback, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import type {
  PipelineResult,
  PipelineStage,
  PipelinePackage,
} from "../actions/tracking";

interface PipelineViewProps {
  pipeline: PipelineResult;
}

function formatVol(v: number | null): string {
  if (v == null || v === 0) return "-";
  return v.toFixed(3).replace(".", ",");
}

export function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function PackageList({ packages, label, color }: { packages: PipelinePackage[]; label: string; color: string }) {
  if (packages.length === 0) return null;
  const totalVol = packages.reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
  const totalPieces = packages.reduce((sum, p) => sum + (parseInt(p.pieces || "0", 10) || 0), 0);
  const sorted = [...packages].sort((a, b) => naturalSort(a.packageNumber ?? "", b.packageNumber ?? ""));

  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {packages.length} pkg · {totalPieces} pcs · {formatVol(totalVol)} m³
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[11px] text-muted-foreground border-b">
            <th className="text-left py-0.5 pr-2 font-medium">Package</th>
            <th className="text-left py-0.5 pr-2 font-medium">Status</th>
            <th className="text-left py-0.5 pr-2 font-medium">Product</th>
            <th className="text-left py-0.5 pr-2 font-medium">Species</th>
            <th className="text-left py-0.5 pr-2 font-medium">Quality</th>
            <th className="text-left py-0.5 pr-2 font-medium">Type</th>
            <th className="text-left py-0.5 pr-2 font-medium">Processing</th>
            <th className="text-right py-0.5 pr-2 font-medium">Thick</th>
            <th className="text-right py-0.5 pr-2 font-medium">Width</th>
            <th className="text-right py-0.5 pr-2 font-medium">Length</th>
            <th className="text-right py-0.5 pr-2 font-medium">Pcs</th>
            <th className="text-right py-0.5 font-medium">Vol m³</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pkg) => (
            <tr key={pkg.id} className={`border-b border-border/30 last:border-0 ${!pkg.isTracked ? "text-muted-foreground italic" : ""}`}>
              <td className="py-0.5 pr-2">{pkg.packageNumber}{!pkg.isTracked ? " *" : ""}</td>
              <td className="py-0.5 pr-2">{pkg.status ?? ""}</td>
              <td className="py-0.5 pr-2">{pkg.productName ?? ""}</td>
              <td className="py-0.5 pr-2">{pkg.woodSpecies ?? ""}</td>
              <td className="py-0.5 pr-2">{pkg.quality ?? ""}</td>
              <td className="py-0.5 pr-2">{pkg.typeName ?? ""}</td>
              <td className="py-0.5 pr-2">{pkg.processing ?? ""}</td>
              <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.thickness ?? ""}</td>
              <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.width ?? ""}</td>
              <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.length ?? ""}</td>
              <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.pieces && pkg.pieces !== "0" ? pkg.pieces : "-"}</td>
              <td className="py-0.5 text-right tabular-nums">{formatVol(pkg.volumeM3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COL_COUNT = 12;

function SectionHeader({ label, count, pieces, vol, color }: { label: string; count: number; pieces: number; vol: number; color: string }) {
  return (
    <tr className={color}>
      <td colSpan={COL_COUNT} className="py-1.5 px-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">
            {count} pkg · {pieces} pcs · {formatVol(vol)} m³
          </span>
        </div>
      </td>
    </tr>
  );
}

function PackageRows({ packages }: { packages: PipelinePackage[] }) {
  const sorted = [...packages].sort((a, b) => naturalSort(a.packageNumber ?? "", b.packageNumber ?? ""));
  return (
    <>
      {sorted.map((pkg) => (
        <tr key={pkg.id} className={`border-b border-border/30 last:border-0 ${!pkg.isTracked ? "text-muted-foreground italic" : ""}`}>
          <td className="py-0.5 pr-2">{pkg.packageNumber}{!pkg.isTracked ? " *" : ""}</td>
          <td className="py-0.5 pr-2">{pkg.status ?? ""}</td>
          <td className="py-0.5 pr-2">{pkg.productName ?? ""}</td>
          <td className="py-0.5 pr-2">{pkg.woodSpecies ?? ""}</td>
          <td className="py-0.5 pr-2">{pkg.quality ?? ""}</td>
          <td className="py-0.5 pr-2">{pkg.typeName ?? ""}</td>
          <td className="py-0.5 pr-2">{pkg.processing ?? ""}</td>
          <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.thickness ?? ""}</td>
          <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.width ?? ""}</td>
          <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.length ?? ""}</td>
          <td className="py-0.5 pr-2 text-right tabular-nums">{pkg.pieces && pkg.pieces !== "0" ? pkg.pieces : "-"}</td>
          <td className="py-0.5 text-right tabular-nums">{formatVol(pkg.volumeM3)}</td>
        </tr>
      ))}
    </>
  );
}

function sectionStats(packages: PipelinePackage[]) {
  return {
    count: packages.length,
    pieces: packages.reduce((s, p) => s + (parseInt(p.pieces || "0", 10) || 0), 0),
    vol: packages.reduce((s, p) => s + (p.volumeM3 ?? 0), 0),
  };
}

export interface InputOutputSection {
  label: string;
  packages: PipelinePackage[];
  color: string;
}

export function InputOutputTable({ sections }: { sections: InputOutputSection[] }) {
  const nonEmpty = sections.filter((s) => s.packages.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[11px] text-muted-foreground border-b">
          <th className="text-left py-0.5 pr-2 font-medium">Package</th>
          <th className="text-left py-0.5 pr-2 font-medium">Status</th>
          <th className="text-left py-0.5 pr-2 font-medium">Product</th>
          <th className="text-left py-0.5 pr-2 font-medium">Species</th>
          <th className="text-left py-0.5 pr-2 font-medium">Quality</th>
          <th className="text-left py-0.5 pr-2 font-medium">Type</th>
          <th className="text-left py-0.5 pr-2 font-medium">Processing</th>
          <th className="text-right py-0.5 pr-2 font-medium">Thick</th>
          <th className="text-right py-0.5 pr-2 font-medium">Width</th>
          <th className="text-right py-0.5 pr-2 font-medium">Length</th>
          <th className="text-right py-0.5 pr-2 font-medium">Pcs</th>
          <th className="text-right py-0.5 font-medium">Vol m³</th>
        </tr>
      </thead>
      <tbody>
        {nonEmpty.map((section) => {
          const stats = sectionStats(section.packages);
          return (
            <Fragment key={section.label}>
              <SectionHeader label={section.label} count={stats.count} pieces={stats.pieces} vol={stats.vol} color={section.color} />
              <PackageRows packages={section.packages} />
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function StageRow({ stage, onToggle }: { stage: PipelineStage; onToggle?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isDraft = stage.entryStatus === "draft";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Summary line — always visible */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); onToggle?.(); }}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <span className="font-medium text-sm">{stage.processName}</span>
        {isDraft && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800 font-medium uppercase">In Progress</span>
        )}
        <span className="text-xs text-muted-foreground">{stage.productionDate}</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <span>{stage.inputs.length} in</span>
          <span>→</span>
          <span>{stage.outputs.length} out</span>
          <span className="mx-1">·</span>
          <span>{formatVol(stage.totalInputM3)} → {formatVol(stage.totalOutputM3)} m³</span>
          <span className="mx-1">·</span>
          <span className="font-medium text-foreground">{stage.outcomePercentage.toFixed(1)}%</span>
          {stage.hasOutsidePackages && (
            <span className="italic">+{stage.outsidePackageCount} outside</span>
          )}
        </span>
      </button>

      {/* Detail — inputs and outputs in a single aligned table */}
      {expanded && (
        <div className="p-4 pt-0 border-t">
          <div className="pt-3">
            <InputOutputTable
              sections={[
                { label: "Inputs", packages: stage.inputs, color: "bg-blue-50/50" },
                { label: "Outputs", packages: stage.outputs, color: "bg-green-50/50" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelineView({ pipeline }: PipelineViewProps) {
  const { stages, seedPackages, remainingPackages, finalPackages, shippedPackages } = pipeline;
  const containerRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

  // After each render, track the max height so collapsing doesn't shrink the page
  useEffect(() => {
    if (containerRef.current) {
      const h = containerRef.current.scrollHeight;
      setMinHeight((prev) => (prev === undefined ? undefined : Math.max(prev, h)));
    }
  });

  // When a stage is toggled, snapshot current height as the floor
  const handleStageToggle = useCallback(() => {
    if (containerRef.current) {
      setMinHeight(containerRef.current.scrollHeight);
    }
  }, []);

  // Group stages by depth for visual flow
  const stagesByDepth = useMemo(() => {
    const map = new Map<number, PipelineStage[]>();
    for (const stage of stages) {
      const existing = map.get(stage.depth) ?? [];
      existing.push(stage);
      map.set(stage.depth, existing);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [stages]);

  if (seedPackages.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Add packages to this tracking set to see the production pipeline.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4" style={minHeight ? { minHeight } : undefined}>
      {/* Pipeline stages */}
      <div className="grid gap-2">
        {stagesByDepth.flatMap(([, depthStages]) =>
          depthStages.map((stage) => (
            <StageRow key={stage.entryId} stage={stage} onToggle={handleStageToggle} />
          ))
        )}
      </div>

    </div>
  );
}
