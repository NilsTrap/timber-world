import type { ProjectQuoteEntry, ProjectRfqCandidate } from "../actions/projectRfqActions";
import type { ProjectLine } from "../types";

export type PricingRow = { key: string; targetType: "line" | "process"; targetId: string; label: string; quantity: number; unit: string };
export type ProjectQuotationPricingMode = "itemized" | "itemized_total" | "total";

export function quotationPricingRows(lines: ProjectLine[]): PricingRow[] {
  return lines.flatMap((line) => {
    if (!line.id) return [];
    const quantity = Number(line.volumeM3 ?? line.pieces ?? 0);
    const hasMaterialProcess = (line.processRequirements ?? []).some((process) => process.fieldKey === "metal");
    const material = !hasMaterialProcess && quantity > 0 ? [{ key: `line:${line.id}`, targetType: "line" as const, targetId: line.id, label: line.productName ?? `Line ${line.lineNo}`, quantity, unit: line.unit }] : [];
    const processes = (line.processRequirements ?? []).flatMap((process) => {
      const processQuantity = Number(process.value);
      return process.active && processQuantity > 0 ? [{ key: `process:${process.id}`, targetType: "process" as const, targetId: process.id, label: `${line.productName ?? `Line ${line.lineNo}`} · ${process.name}`, quantity: processQuantity, unit: process.unit ?? "unit" }] : [];
    });
    return [...material, ...processes];
  });
}

export function pricesFromQuotation(entries: ProjectRfqCandidate["quoteEntries"]): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [`${entry.targetType}:${entry.targetId}`, (entry.unitPriceCents / 100).toFixed(2)]));
}

export function quotationEntries(lines: ProjectLine[], prices: Record<string, string>): ProjectQuoteEntry[] {
  return quotationPricingRows(lines).flatMap((row) => {
    const rawPrice = prices[row.key]?.trim() ?? "";
    if (!rawPrice) return [];
    const unitPrice = Number(rawPrice);
    return Number.isFinite(unitPrice) && unitPrice >= 0 ? [{ targetType: row.targetType, targetId: row.targetId, label: row.label, quantity: row.quantity, unit: row.unit, unitPriceCents: Math.round(unitPrice * 100) }] : [];
  });
}

export function quotationTotalCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function quotationEntryAmountCents(mode: ProjectQuotationPricingMode, quantity: number, enteredCents: number): number {
  return mode === "itemized_total" ? enteredCents : Math.round(quantity * enteredCents);
}
