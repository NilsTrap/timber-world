"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { packageInputSchema } from "../schemas";
import type { ActionResult, UpdateShipmentInput } from "../types";
import { z } from "zod";

interface UpdateShipmentResult {
  shipmentId: string;
  packageCount: number;
}

const updateShipmentSchema = z.object({
  shipmentId: z.string().uuid("Invalid shipment ID"),
  transportCostEur: z.number().nonnegative().nullable(),
  packages: z
    .array(packageInputSchema)
    .min(1, "At least one package is required"),
});

/**
 * Update Shipment Packages
 *
 * Updates an existing shipment's transport cost and replaces all packages
 * atomically via a single PostgreSQL function call.
 * Admin only.
 */
export async function updateShipmentPackages(
  input: UpdateShipmentInput
): Promise<ActionResult<UpdateShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const parsed = updateShipmentSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Validation failed";
    return { success: false, error: message, code: "VALIDATION_FAILED" };
  }

  const { shipmentId, transportCostEur, packages } = parsed.data;

  const supabase = await createClient();

  // Transform packages to snake_case JSONB for the DB function
  const packagesJsonb = packages.map((pkg) => ({
    product_name_id: pkg.productNameId || null,
    wood_species_id: pkg.woodSpeciesId || null,
    humidity_id: pkg.humidityId || null,
    type_id: pkg.typeId || null,
    processing_id: pkg.processingId || null,
    fsc_id: pkg.fscId || null,
    quality_id: pkg.qualityId || null,
    thickness: pkg.thickness || null,
    width: pkg.width || null,
    length: pkg.length || null,
    pieces: pkg.pieces || null,
    volume_m3: pkg.volumeM3,
    volume_is_calculated: pkg.volumeIsCalculated,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("update_shipment_packages", {
      p_shipment_id: shipmentId,
      p_transport_cost_eur: transportCostEur,
      p_packages: packagesJsonb,
    });

  if (error) {
    console.error("Failed to update shipment:", error);
    return { success: false, error: `Failed to update shipment: ${error.message}`, code: "RPC_FAILED" };
  }

  revalidatePath("/admin/inventory");

  return {
    success: true,
    data: {
      shipmentId: data.shipment_id,
      packageCount: data.package_count,
    },
  };
}
