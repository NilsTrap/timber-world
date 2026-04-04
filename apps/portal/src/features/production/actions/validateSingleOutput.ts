"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isOrgUser, isSuperAdmin, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";
import { logProductionActivity } from "./logProductionActivity";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a single production output package.
 *
 * Creates an inventory_package from the output row and links it
 * via inventory_package_id on portal_production_outputs.
 *
 * The output must have all required fields filled (same rules as full validation).
 * No input deductions happen — those only occur at full entry validation.
 */
export async function validateSingleOutput(
  productionEntryId: string,
  outputId: string
): Promise<ActionResult<{ inventoryPackageId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isOrgUser(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }
  if (!outputId || !UUID_REGEX.test(outputId)) {
    return { success: false, error: "Invalid output ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, organisation_id, created_by")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  if (entry.status !== "draft") {
    return { success: false, error: "Can only validate individual outputs from draft entries", code: "VALIDATION_FAILED" };
  }

  // Permission: own org or admin
  if (!isAdmin) {
    const isOwnEntry = entry.created_by === session.id;
    const isOrgEntry = isOrganisationUser(session) && entry.organisation_id === session.organisationId;
    if (!isOwnEntry && !isOrgEntry) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
  }

  // Fetch the output row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: output, error: outputError } = await (supabase as any)
    .from("portal_production_outputs")
    .select("*")
    .eq("id", outputId)
    .eq("production_entry_id", productionEntryId)
    .single();

  if (outputError || !output) {
    return { success: false, error: "Output row not found", code: "NOT_FOUND" };
  }

  // Check if already validated
  if (output.inventory_package_id) {
    return { success: false, error: "This output is already validated", code: "VALIDATION_FAILED" };
  }

  // Validate required fields (same rules as full validation)
  const requiredRefs = [
    { field: "product_name_id", label: "Product" },
    { field: "wood_species_id", label: "Species" },
    { field: "humidity_id", label: "Humidity" },
    { field: "type_id", label: "Type" },
    { field: "processing_id", label: "Processing" },
    { field: "fsc_id", label: "FSC" },
    { field: "quality_id", label: "Quality" },
  ];

  for (const { field, label } of requiredRefs) {
    if (!output[field]) {
      return { success: false, error: `Missing required field: ${label}`, code: "VALIDATION_FAILED" };
    }
  }

  // Dimensions
  if (!output.thickness) {
    return { success: false, error: "Missing required field: Thickness", code: "VALIDATION_FAILED" };
  }
  if (!output.width) {
    return { success: false, error: "Missing required field: Width", code: "VALIDATION_FAILED" };
  }
  if (!output.length) {
    return { success: false, error: "Missing required field: Length", code: "VALIDATION_FAILED" };
  }

  // Volume > 0
  const volume = Number(output.volume_m3);
  if (!volume || volume <= 0) {
    return { success: false, error: "Volume must be greater than 0", code: "VALIDATION_FAILED" };
  }

  // Package number assigned
  if (!output.package_number || !output.package_number.trim()) {
    return { success: false, error: "Package number must be assigned", code: "VALIDATION_FAILED" };
  }

  // Check package number uniqueness in inventory (same org)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingPkg } = await (supabase as any)
    .from("inventory_packages")
    .select("id")
    .eq("organisation_id", entry.organisation_id)
    .eq("package_number", output.package_number)
    .limit(1);

  if (existingPkg && existingPkg.length > 0) {
    return {
      success: false,
      error: `Package number ${output.package_number} already exists in inventory`,
      code: "VALIDATION_FAILED",
    };
  }

  // Create inventory package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inventoryPkg, error: insertError } = await (supabase as any)
    .from("inventory_packages")
    .insert({
      organisation_id: entry.organisation_id,
      production_entry_id: productionEntryId,
      shipment_id: null,
      package_number: output.package_number,
      package_sequence: output.sort_order != null ? output.sort_order + 1 : 1,
      product_name_id: output.product_name_id,
      wood_species_id: output.wood_species_id,
      humidity_id: output.humidity_id,
      type_id: output.type_id,
      processing_id: output.processing_id,
      fsc_id: output.fsc_id,
      quality_id: output.quality_id,
      thickness: output.thickness,
      width: output.width,
      length: output.length,
      pieces: output.pieces,
      volume_m3: output.volume_m3,
      volume_is_calculated: false,
      status: "produced",
      notes: output.notes || null,
    })
    .select("id")
    .single();

  if (insertError || !inventoryPkg) {
    console.error("[validateSingleOutput] Failed to create inventory package:", insertError);
    return {
      success: false,
      error: `Failed to create inventory package: ${insertError?.message || "Unknown error"}`,
      code: "INSERT_FAILED",
    };
  }

  // Link the output row to the inventory package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: linkError } = await (supabase as any)
    .from("portal_production_outputs")
    .update({ inventory_package_id: inventoryPkg.id })
    .eq("id", outputId);

  if (linkError) {
    // Rollback: delete the inventory package
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("inventory_packages").delete().eq("id", inventoryPkg.id);
    return {
      success: false,
      error: `Failed to link output to inventory: ${linkError.message}`,
      code: "UPDATE_FAILED",
    };
  }

  await logProductionActivity(supabase, productionEntryId, "output_validated", session.id, session.email, { outputId, inventoryPackageId: inventoryPkg.id });

  revalidatePath("/production");
  revalidatePath("/inventory");

  return { success: true, data: { inventoryPackageId: inventoryPkg.id } };
}
