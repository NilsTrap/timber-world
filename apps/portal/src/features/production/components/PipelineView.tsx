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

function packageRowClass(pkg: PipelinePackage, showShipmentStatus = true): string {
  if (!pkg.isTracked) return "text-muted-foreground italic";
  if (!showShipmentStatus) return "";
  if (pkg.isShipped) return "text-blue-600";
  if (pkg.isOnTheWay) return "text-amber-700";
  return "";
}

function packageBadge(pkg: PipelinePackage, showShipmentStatus = true): string {
  if (!pkg.isTracked) return " *";
  if (!showShipmentStatus) return "";
  if (pkg.isShipped) return ` [→ ${pkg.shipmentCode ?? "shipped"}]`;
  if (pkg.isOnTheWay) return ` [→ ${pkg.shipmentCode ?? "on the way"}]`;
  return "";
}

export function PackageList({ packages, label, color, highlightId }: { packages: PipelinePackage[]; label: string; color: string; highlightId?: string | null }) {
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
            <tr key={pkg.id} className={`border-b border-border/30 last:border-0 ${packageRowClass(pkg)} ${highlightId === pkg.id ? "bg-yellow-100 font-medium" : ""}`}>
              <td className="py-0.5 pr-2">{pkg.packageNumber}{packageBadge(pkg)}</td>
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

function PackageRows({ packages, showShipmentStatus = true, highlightId }: { packages: PipelinePackage[]; showShipmentStatus?: boolean; highlightId?: string | null }) {
  const sorted = [...packages].sort((a, b) => naturalSort(a.packageNumber ?? "", b.packageNumber ?? ""));
  return (
    <>
      {sorted.map((pkg) => (
        <tr key={pkg.id} className={`border-b border-border/30 last:border-0 ${packageRowClass(pkg, showShipmentStatus)} ${highlightId === pkg.id ? "bg-yellow-100 font-medium" : ""}`}>
          <td className="py-0.5 pr-2">{pkg.packageNumber}{packageBadge(pkg, showShipmentStatus)}</td>
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
  /** When false, shipped/on-the-way styling is suppressed (for input sections) */
  showShipmentStatus?: boolean;
}

export function InputOutputTable({ sections, highlightId }: { sections: InputOutputSection[]; highlightId?: string | null }) {
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
              <PackageRows packages={section.packages} showShipmentStatus={section.showShipmentStatus !== false} highlightId={highlightId} />
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function parsePieces(p: PipelinePackage): number {
  const n = parseInt(p.pieces || "0", 10);
  return isNaN(n) ? 0 : n;
}

function parseDim(v: string | null): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

interface MissingCalc {
  pieces: number;
  volumeM3: number;
  pct: number;
}

/**
 * Calculate missing pieces/volume per process type.
 *
 * GL (Gluing): Strips are glued into panels. Each panel uses N strips where
 *   N = round(panel_width / strip_width). Remaining strip packages in output
 *   are counted directly. Missing = input strips - (strips used for panels + remaining strips).
 *   Missing volume = missing_pieces × strip_thickness × strip_width × strip_length (in m³).
 *
 * PL (Planing) and default: Input pieces should equal output pieces.
 *   Missing = input pieces - output pieces.
 *   Volume is proportional: (missing / input_pieces) × total_input_volume.
 */
function calculateMissing(stage: PipelineStage): MissingCalc {
  const inputPieces = stage.inputs.reduce((s, p) => s + parsePieces(p), 0);
  if (inputPieces === 0) return { pieces: 0, volumeM3: 0, pct: 0 };

  if (stage.processCode === "GL") {
    return calculateGluingMissing(stage, inputPieces);
  }

  // Default: simple piece comparison
  const outputPieces = stage.outputs.reduce((s, p) => s + parsePieces(p), 0);
  const missing = inputPieces - outputPieces;
  if (missing <= 0) return { pieces: 0, volumeM3: 0, pct: 0 };

  const volumeM3 = (missing / inputPieces) * stage.totalInputM3;
  const pct = stage.totalInputM3 > 0 ? (volumeM3 / stage.totalInputM3) * 100 : 0;
  return { pieces: missing, volumeM3, pct };
}

function calculateGluingMissing(stage: PipelineStage, inputPieces: number): MissingCalc {
  // Get the input strip dimensions (use the most common width as strip width)
  const inputWidths = stage.inputs.map((p) => parseDim(p.width)).filter((w) => w > 0);
  if (inputWidths.length === 0) return { pieces: 0, volumeM3: 0, pct: 0 };

  // Find the most common input width (the strip width)
  const widthCounts = new Map<number, number>();
  for (const w of inputWidths) {
    widthCounts.set(w, (widthCounts.get(w) ?? 0) + 1);
  }
  let stripWidth = 0;
  let maxCount = 0;
  for (const [w, c] of widthCounts) {
    if (c > maxCount) { stripWidth = w; maxCount = c; }
  }
  if (stripWidth === 0) return { pieces: 0, volumeM3: 0, pct: 0 };

  // Get input strip dimensions for volume calculation
  const stripThickness = parseDim(stage.inputs[0]?.thickness ?? null);
  const stripLength = parseDim(stage.inputs[0]?.length ?? null);

  // For each output package, calculate how many strips it accounts for
  let totalAccountedStrips = 0;
  for (const pkg of stage.outputs) {
    const outWidth = parseDim(pkg.width);
    const outPieces = parsePieces(pkg);
    if (outWidth <= 0 || outPieces <= 0) continue;

    if (outWidth > stripWidth * 1.5) {
      // This is a panel — calculate strips per panel
      const stripsPerPanel = Math.round(outWidth / stripWidth);
      totalAccountedStrips += stripsPerPanel * outPieces;
    } else {
      // This is remaining strips — count directly
      totalAccountedStrips += outPieces;
    }
  }

  const missing = inputPieces - totalAccountedStrips;
  if (missing <= 0) return { pieces: 0, volumeM3: 0, pct: 0 };

  // Volume = missing pieces × strip dimensions (mm → m)
  const volumeM3 = missing * (stripThickness / 1000) * (stripWidth / 1000) * (stripLength / 1000);
  const pct = stage.totalInputM3 > 0 ? (volumeM3 / stage.totalInputM3) * 100 : 0;
  return { pieces: missing, volumeM3, pct };
}

export function StageRow({ stage, onToggle, highlightId, hideMissing }: { stage: PipelineStage; onToggle?: () => void; highlightId?: string | null; hideMissing?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isDraft = stage.entryStatus === "draft";

  const inputPieces = stage.inputs.reduce((s, p) => s + parsePieces(p), 0);
  const outputPieces = stage.outputs.reduce((s, p) => s + parsePieces(p), 0);
  const { pieces: missingPieces, volumeM3: missingVolume, pct: missingPct } = hideMissing
    ? { pieces: 0, volumeM3: 0, pct: 0 }
    : calculateMissing(stage);

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
          {missingPieces > 0 && (
            <span className="text-red-600 font-medium">
              missing: −{missingPieces} pcs · −{missingVolume.toFixed(3).replace(".", ",")} m³ · {missingPct.toFixed(1)}%
            </span>
          )}
          <span>{stage.inputs.length} in</span>
          <span>→</span>
          <span>{stage.outputs.length} out</span>
          <span className="mx-1">·</span>
          <span>{inputPieces} → {outputPieces} pcs</span>
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
                { label: "Inputs", packages: stage.inputs, color: "bg-blue-50/50", showShipmentStatus: false },
                { label: "Outputs", packages: stage.outputs, color: "bg-green-50/50" },
              ]}
              highlightId={highlightId}
            />
            {missingPieces > 0 && (
              <div className="mt-2 px-1 py-1.5 flex items-center justify-between text-xs text-red-600 font-medium bg-red-50/50 rounded">
                <span>Missing</span>
                <span className="tabular-nums">
                  −{missingPieces} pcs · −{missingVolume.toFixed(3).replace(".", ",")} m³ · {missingPct.toFixed(1)}%
                </span>
              </div>
            )}
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
