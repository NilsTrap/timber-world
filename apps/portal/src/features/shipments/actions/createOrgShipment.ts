"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createShipmentSchema } from "../schemas";
import type { ActionResult, PackageInput } from "../types";

interface CreateOrgShipmentInput {
  toOrganisationId: string;
  shipmentDate: string;
  transportCostEur: number | null;
  packages: PackageInput[];
}

interface CreateShipmentResult {
  shipmentId: string;
  shipmentCode: string;
  packageCount: number;
}

/**
 * Create Shipment for Organization User
 *
 * Creates a new shipment with packages from the current user's organization.
 * The shipment is created with "draft" status - user must submit it separately.
 * Uses the same atomic PostgreSQL function as admin createShipment.
 */
export async function createOrgShipment(
  input: CreateOrgShipmentInput
): Promise<ActionResult<CreateShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  // Build the full input with the user's organization as "from"
  const fullInput = {
    fromOrganisationId: session.organisationId,
    toOrganisationId: input.toOrganisationId,
    shipmentDate: input.shipmentDate,
    transportCostEur: input.transportCostEur,
    packages: input.packages,
  };

  // Validate input with Zod
  const parsed = createShipmentSchema.safeParse(fullInput);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Validation failed";
    return { success: false, error: message, code: "VALIDATION_FAILED" };
  }

  const { fromOrganisationId, toOrganisationId, shipmentDate, transportCostEur, packages } = parsed.data;

  // Validate destination is different from source
  if (fromOrganisationId === toOrganisationId) {
    return { success: false, error: "Cannot create shipment to your own organization", code: "SAME_ORG" };
  }

  const supabase = await createClient();

  // Verify both organisations have codes (required for shipment code generation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromOrg, error: fromOrgError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", fromOrganisationId)
    .single();

  if (fromOrgError || !fromOrg?.code) {
    console.error("From organisation missing code:", fromOrgError);
    return { success: false, error: "Source organisation is missing a code", code: "ORG_NO_CODE" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toOrg, error: toOrgError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", toOrganisationId)
    .single();

  if (toOrgError || !toOrg?.code) {
    console.error("To organisation missing code:", toOrgError);
    return { success: false, error: "Destination organisation is missing a code", code: "ORG_NO_CODE" };
  }

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
