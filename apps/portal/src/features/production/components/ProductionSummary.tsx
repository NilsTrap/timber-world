"use client";

interface ProductionSummaryProps {
  inputTotalM3: number;
  outputTotalM3: number;
}

function formatVolume(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("lv", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function getOutcomeColor(percent: number | null): string {
  if (percent === null) return "text-muted-foreground";
  if (percent > 80) return "text-green-600";
  if (percent >= 60) return "text-yellow-600";
  return "text-red-600";
}

/**
 * ProductionSummary — Live calculation metrics for production entry.
 *
 * Displays: Input m³, Output m³, Outcome %, Waste %
 * Color-coded outcome: green >80%, yellow 60-80%, red <60%
 */
export function ProductionSummary({
  inputTotalM3,
  outputTotalM3,
}: ProductionSummaryProps) {
  const outcomePercent =
    inputTotalM3 > 0 ? (outputTotalM3 / inputTotalM3) * 100 : null;
  const wastePercent =
    outcomePercent !== null ? 100 - outcomePercent : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Input m³</p>
        <p className="text-xl font-semibold">{formatVolume(inputTotalM3)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Output m³</p>
        <p className="text-xl font-semibold">{formatVolume(outputTotalM3)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Outcome %</p>
        <p className={`text-xl font-semibold ${getOutcomeColor(outcomePercent)}`}>
          {formatPercent(outcomePercent)}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Waste %</p>
        <p className="text-xl font-semibold text-muted-foreground">
          {formatPercent(wastePercent)}
        </p>
      </div>
    </div>
  );
}
