import type { OutputRow } from "../types";

/**
 * Shared helpers for Production Output rows.
 * Used by both ProductionOutputsTable and ProductionOutputsSection.
 */

export function generateClientId(): string {
  return `out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateOutputNumber(index: number, code: string): string {
  // Package numbers are now assigned manually via "Assign Package Numbers" button
  // Return empty string for new rows
  return "";
}

export function isRange(val: string): boolean {
  return val.includes("-") && val.indexOf("-") > 0;
}

export function shouldAutoCalculate(row: OutputRow): boolean {
  if (!row.thickness || !row.width || !row.length || !row.pieces) return false;
  if (isRange(row.thickness) || isRange(row.width) || isRange(row.length)) return false;
  if (row.pieces === "-") return false;
  return true;
}

export function calculateVolume(
  thickness: string,
  width: string,
  length: string,
  pieces: string
): number | null {
  if (!thickness || !width || !length || !pieces) return null;
  if (isRange(thickness) || isRange(width) || isRange(length)) return null;
  if (pieces === "-" || pieces.trim() === "") return null;

  // Normalize comma decimal separators to dots for parsing
  const t = parseFloat(thickness.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const l = parseFloat(length.replace(",", "."));
  const p = parseFloat(pieces.replace(",", "."));

  if (isNaN(t) || isNaN(w) || isNaN(l) || isNaN(p)) return null;
  if (t <= 0 || w <= 0 || l <= 0 || p <= 0) return null;

  return (t * w * l * p) / 1_000_000_000;
}

export function createEmptyOutputRow(index: number, code: string = "OUT"): OutputRow {
  return {
    clientId: generateClientId(),
    dbId: null,
    packageNumber: generateOutputNumber(index, code),
    shipmentCode: "",
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
    notes: "",
  };
}
