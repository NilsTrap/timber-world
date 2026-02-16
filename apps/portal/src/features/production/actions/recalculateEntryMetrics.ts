"use server";

import type { WorkFormula } from "../types";

/**
 * Recalculate Entry Metrics
 *
 * Recalculates and updates the production entry's totals and percentages:
 * - total_input_m3: sum of all input volumes
 * - total_output_m3: sum of all output volumes
 * - outcome_percentage: (output / input) * 100
 * - waste_percentage: 100 - outcome_percentage
 * - planned_work: auto-calculated based on process formula
 *
 * Used after inputs/outputs are modified (drafts and admin edits).
 */
export async function recalculateEntryMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productionEntryId: string
): Promise<void> {
  // Fetch entry with process formula
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, process_id, ref_processes(work_formula)")
    .eq("id", productionEntryId)
    .single();

  // Fetch all inputs with package dimensions for formula calculation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputs } = await (supabase as any)
    .from("portal_production_inputs")
    .select(`
      volume_m3,
      pieces_used,
      inventory_packages(length, width)
    `)
    .eq("production_entry_id", productionEntryId);

  // Fetch all outputs (count for output_packages formula)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputs } = await (supabase as any)
    .from("portal_production_outputs")
    .select("volume_m3")
    .eq("production_entry_id", productionEntryId);

  const totalInputM3 = (inputs || []).reduce(
    (sum: number, i: { volume_m3: number }) => sum + Number(i.volume_m3),
    0
  );
  const totalOutputM3 = (outputs || []).reduce(
    (sum: number, o: { volume_m3: number }) => sum + Number(o.volume_m3),
    0
  );
  const outcomePercentage = totalInputM3 > 0 ? (totalOutputM3 / totalInputM3) * 100 : 0;
  const wastePercentage = 100 - outcomePercentage;

  // Calculate planned_work based on process formula
  const formula = entry?.ref_processes?.work_formula as WorkFormula | null;
  const plannedWork = calculatePlannedWork(formula, inputs || [], (outputs || []).length);

  // Update the production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("portal_production_entries")
    .update({
      total_input_m3: totalInputM3,
      total_output_m3: totalOutputM3,
      outcome_percentage: outcomePercentage,
      waste_percentage: wastePercentage,
      planned_work: plannedWork,
    })
    .eq("id", productionEntryId);
}

/**
 * Calculate planned work based on formula and inputs
 */
function calculatePlannedWork(
  formula: WorkFormula | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: any[],
  outputCount: number
): number | null {
  if (!formula || formula === "hours") return null;

  if (formula === "output_packages") {
    return outputCount > 0 ? outputCount : null;
  }

  if (inputs.length === 0) return null;

  let total = 0;
  for (const input of inputs) {
    const pieces = input.pieces_used ? Number(input.pieces_used) : 0;
    const length = input.inventory_packages?.length ? Number(input.inventory_packages.length) : 0;
    const width = input.inventory_packages?.width ? Number(input.inventory_packages.width) : 0;
    const volume = Number(input.volume_m3);

    switch (formula) {
      case "length_x_pieces":
        // Length (m) × Pieces
        total += (length / 1000) * pieces;
        break;
      case "area":
        // Length (m) × Width (m) × Pieces
        total += (length / 1000) * (width / 1000) * pieces;
        break;
      case "volume":
        // Sum of input volumes
        total += volume;
        break;
      case "pieces":
        // Sum of pieces
        total += pieces;
        break;
    }
  }

  return total > 0 ? total : null;
}
