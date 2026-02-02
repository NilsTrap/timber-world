"use server";

/**
 * Recalculate Entry Metrics
 *
 * Recalculates and updates the production entry's totals and percentages:
 * - total_input_m3: sum of all input volumes
 * - total_output_m3: sum of all output volumes
 * - outcome_percentage: (output / input) * 100
 * - waste_percentage: 100 - outcome_percentage
 *
 * Used after admin edits to validated entries.
 */
export async function recalculateEntryMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productionEntryId: string
): Promise<void> {
  // Fetch all inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputs } = await (supabase as any)
    .from("portal_production_inputs")
    .select("volume_m3")
    .eq("production_entry_id", productionEntryId);

  // Fetch all outputs
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

  // Update the production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("portal_production_entries")
    .update({
      total_input_m3: totalInputM3,
      total_output_m3: totalOutputM3,
      outcome_percentage: outcomePercentage,
      waste_percentage: wastePercentage,
    })
    .eq("id", productionEntryId);
}
