import type { OrderProductRow } from "../types";

export function generateClientId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyOrderProductRow(index: number): OrderProductRow {
  return {
    clientId: generateClientId(),
    dbId: null,
    staircaseCodeId: "",
    productNameId: "",
    woodSpeciesId: "",
    typeId: "",
    qualityId: "",
    thickness: "",
    width: "",
    riser: "",
    length: "",
    pieces: "",
    volumeM3: "",
    workPerPiece: "",
    transportPerPiece: "",
    eurPerM3: "",
    eurPerPiece: "",
    unitPrice: "",
  };
}

/**
 * Calculate transport cost per piece in EUR.
 * Same formula as UK staircase pricing: m³/piece × 300 + 11 EUR flat
 */
export function calculateTransportPerPiece(m3PerPiece: number): number {
  return m3PerPiece * 300 + 11;
}

export function calculateVolume(
  thickness: string,
  width: string,
  length: string,
  riser?: string,
  productName?: string,
): number | null {
  if (!thickness || !width || !length) return null;

  const t = parseFloat(thickness.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const l = parseFloat(length.replace(",", "."));
  const r = riser ? parseFloat(riser.replace(",", ".")) : 0;

  if (isNaN(t) || isNaN(w) || isNaN(l) || isNaN(r)) return null;
  if (t <= 0 || w <= 0 || l <= 0) return null;

  let vol = (t * (w + r) * l) / 1_000_000_000;
  // Winders get 0.8 multiplier (irregular shape uses less material)
  if (productName && productName.toLowerCase() === "winder") vol *= 0.8;
  return vol;
}
