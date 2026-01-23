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
 * Creates a new shipment with all associated packages.
 * Uses DB helper functions for code generation.
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

  const { fromPartyId, toPartyId, shipmentDate, transportCostEur, packages } = parsed.data;

  const supabase = await createClient();

  // 1. Get next shipment number from sequence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentNumber, error: seqError } = await (supabase as any)
    .rpc("get_next_shipment_number");

  if (seqError) {
    console.error("Failed to get shipment number:", seqError);
    return { success: false, error: `Failed to generate shipment number: ${seqError.message}`, code: "RPC_FAILED" };
  }

  // 2. Generate shipment code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentCode, error: codeError } = await (supabase as any)
    .rpc("generate_shipment_code", {
      p_from_party_id: fromPartyId,
      p_to_party_id: toPartyId,
    });

  if (codeError) {
    console.error("Failed to generate shipment code:", codeError);
    return { success: false, error: `Failed to generate shipment code: ${codeError.message}`, code: "RPC_FAILED" };
  }

  // 3. Insert shipment record
  // NOTE: Supabase JS client does not support multi-statement transactions.
  // If a package insert fails below, the shipment and prior packages persist.
  // A future improvement would be a single PostgreSQL function wrapping all inserts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .insert({
      shipment_code: shipmentCode,
      shipment_number: shipmentNumber,
      from_party_id: fromPartyId,
      to_party_id: toPartyId,
      shipment_date: shipmentDate,
      transport_cost_eur: transportCostEur,
    })
    .select("id")
    .single();

  if (shipmentError) {
    console.error("Failed to create shipment:", shipmentError);
    if (shipmentError.code === "23505") {
      return { success: false, error: "Shipment code already exists", code: "DUPLICATE" };
    }
    return { success: false, error: `Failed to create shipment: ${shipmentError.message}`, code: "INSERT_FAILED" };
  }

  const shipmentId = shipment.id;

  // 4. Insert packages sequentially (each needs a generated package number)
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i]!;

    // Generate package number via DB function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packageNumber, error: pkgNumError } = await (supabase as any)
      .rpc("generate_package_number", { p_shipment_id: shipmentId });

    if (pkgNumError) {
      console.error(`Failed to generate package number for package ${i + 1}:`, pkgNumError);
      return {
        success: false,
        error: `Failed to generate package number for package ${i + 1}: ${pkgNumError.message}`,
        code: "RPC_FAILED",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: pkgError } = await (supabase as any)
      .from("inventory_packages")
      .insert({
        shipment_id: shipmentId,
        package_number: packageNumber,
        package_sequence: i + 1,
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
      });

    if (pkgError) {
      console.error(`Failed to create package ${i + 1}:`, pkgError);
      return {
        success: false,
        error: `Failed to create package ${i + 1}: ${pkgError.message}`,
        code: "INSERT_FAILED",
      };
    }
  }

  return {
    success: true,
    data: {
      shipmentId,
      shipmentCode,
      packageCount: packages.length,
    },
  };
}
