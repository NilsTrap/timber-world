import type { ProductionInput, WorkFormula } from "../types";

/**
 * Calculate planned work amount based on formula and inputs/outputs.
 *
 * Formulas:
 * - length_x_pieces: Sum of (length × pieces) for all inputs - result in meters
 * - area: Sum of (length × width × pieces) for all inputs - result in m²
 * - volume: Sum of volume_m3 for all inputs - result in m³
 * - pieces: Sum of pieces for all inputs - result in pkg
 * - hours: Manual entry only, returns null
 * - output_packages: Count of output packages - result in pkg
 * - null: No auto-calculation, returns null
 */
export function calculatePlannedWork(
  formula: WorkFormula,
  inputs: ProductionInput[],
  outputCount?: number
): number | null {
  if (!formula || formula === "hours") {
    return null;
  }

  // output_packages formula uses output count, not inputs
  if (formula === "output_packages") {
    return outputCount && outputCount > 0 ? outputCount : null;
  }

  if (inputs.length === 0) {
    return null;
  }

  switch (formula) {
    case "length_x_pieces": {
      // Sum of (length × pieces) for all inputs
      // Length is in mm, convert to meters
      let total = 0;
      for (const input of inputs) {
        const length = parseFloat(input.length || "0");
        const pieces = input.piecesUsed ?? 0;
        if (length > 0 && pieces > 0) {
          // Length is stored in mm, convert to meters
          total += (length / 1000) * pieces;
        }
      }
      return total > 0 ? Math.round(total * 100) / 100 : null;
    }

    case "area": {
      // Sum of (length × width × pieces) for all inputs
      // Length and width are in mm, convert to m²
      let total = 0;
      for (const input of inputs) {
        const length = parseFloat(input.length || "0");
        const width = parseFloat(input.width || "0");
        const pieces = input.piecesUsed ?? 0;
        if (length > 0 && width > 0 && pieces > 0) {
          // Convert mm² to m²: divide by 1,000,000
          total += (length * width * pieces) / 1_000_000;
        }
      }
      return total > 0 ? Math.round(total * 100) / 100 : null;
    }

    case "volume": {
      // Sum of volume_m3 for all inputs
      let total = 0;
      for (const input of inputs) {
        total += input.volumeM3 || 0;
      }
      return total > 0 ? Math.round(total * 1000) / 1000 : null;
    }

    case "pieces": {
      // Sum of pieces for all inputs
      let total = 0;
      for (const input of inputs) {
        total += input.piecesUsed ?? 0;
      }
      return total > 0 ? total : null;
    }

    default:
      return null;
  }
}

/**
 * Get a human-readable description of the formula
 */
export function getFormulaDescription(formula: WorkFormula): string {
  switch (formula) {
    case "length_x_pieces":
      return "Length × Pieces (meters)";
    case "area":
      return "Length × Width × Pieces (m²)";
    case "volume":
      return "Total Volume (m³)";
    case "pieces":
      return "Total Pieces";
    case "hours":
      return "Manual Entry (hours)";
    case "output_packages":
      return "Output Packages (count)";
    default:
      return "No formula";
  }
}
