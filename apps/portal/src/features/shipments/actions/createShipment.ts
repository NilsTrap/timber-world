"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { createShipmentSchema } from "../schemas";
import type { ActionResult, CreateShipmentInput } from "../types";

interface CreateShipmentResult {
  shipmentId: string;
  shipmentCode: string;
  packageCount: number;
}

/**
 * Create Shipment
 *
 * Creates a new shipment with all associated packages atomically
 * via a single PostgreSQL function call (transactional).
 * Admin only.
 */
export async function createShipment(
  input: CreateShipmentInput
): Promise<ActionResult<CreateShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Validate input with Zod
  const parsed = createShipmentSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Validation failed";
    return { success: false, error: message, code: "VALIDATION_FAILED" };
  }

  const { fromOrganisationId, toOrganisationId, shipmentDate, transportCostEur, packages } = parsed.data;

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

  // Call atomic DB function (single transaction)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("create_shipment_with_packages", {
      p_from_organisation_id: fromOrganisationId,
      p_to_organisation_id: toOrganisationId,
      p_shipment_date: shipmentDate,
      p_transport_cost_eur: transportCostEur,
      p_packages: packagesJsonb,
    });

  if (error) {
    console.error("Failed to create shipment:", error);
    if (error.code === "23505") {
      return { success: false, error: "Shipment code already exists", code: "DUPLICATE" };
    }
    return { success: false, error: `Failed to create shipment: ${error.message}`, code: "RPC_FAILED" };
  }

  return {
    success: true,
    data: {
      shipmentId: data.shipment_id,
      shipmentCode: data.shipment_code,
      packageCount: data.package_count,
    },
  };
}
