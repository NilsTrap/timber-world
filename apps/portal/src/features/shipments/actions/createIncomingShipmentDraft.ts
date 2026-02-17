"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

interface CreateIncomingDraftInput {
  fromOrganisationId: string;
  notes?: string;
}

interface DraftShipmentResult {
  id: string;
  shipmentCode: string;
}

/**
 * Create Incoming Shipment Draft
 *
 * Creates a new draft shipment from an external organization
 * to the current user's organization.
 *
 * The source organization must be:
 * 1. A trading partner of the user's organization
 * 2. Marked as external (is_external = true)
 *
 * The shipment code is auto-generated: [FROM_CODE]-[TO_CODE]-[NUMBER]
 */
export async function createIncomingShipmentDraft(
  input: CreateIncomingDraftInput
): Promise<ActionResult<DraftShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const { fromOrganisationId, notes } = input;

  // Validate source org is different from destination
  if (fromOrganisationId === session.organisationId) {
    return { success: false, error: "Cannot create shipment from your own organization", code: "SAME_ORG" };
  }

  const supabase = await createClient();

  // Verify the source org is external and a trading partner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromOrg, error: fromOrgError } = await (supabase as any)
    .from("organisations")
    .select("id, code, is_external, is_active")
    .eq("id", fromOrganisationId)
    .single();

  if (fromOrgError || !fromOrg) {
    return { success: false, error: "Source organization not found", code: "ORG_NOT_FOUND" };
  }

  if (!fromOrg.is_external) {
    return { success: false, error: "Incoming shipments can only be from external organizations", code: "NOT_EXTERNAL" };
  }

  if (!fromOrg.is_active) {
    return { success: false, error: "Source organization is not active", code: "ORG_INACTIVE" };
  }

  // Verify trading partner relationship
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partnerCheck, error: partnerError } = await (supabase as any)
    .from("organisation_trading_partners")
    .select("id")
    .eq("organisation_id", session.organisationId)
    .eq("partner_organisation_id", fromOrganisationId)
    .single();

  if (partnerError || !partnerCheck) {
    return { success: false, error: "Source organization is not a trading partner", code: "NOT_PARTNER" };
  }

  // Get destination org code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toOrg, error: toOrgError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", session.organisationId)
    .single();

  if (toOrgError || !toOrg) {
    return { success: false, error: "Destination organization not found", code: "ORG_NOT_FOUND" };
  }

  // Count existing shipments between these orgs for sequence number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: countError } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("from_organisation_id", fromOrganisationId)
    .eq("to_organisation_id", session.organisationId);

  if (countError) {
    console.error("Failed to count shipments:", countError);
    return { success: false, error: "Failed to generate shipment code", code: "COUNT_FAILED" };
  }

  // Generate shipment code: FROM-TO-001
  const sequenceNumber = String((count ?? 0) + 1).padStart(3, "0");
  const shipmentCode = `${fromOrg.code}-${toOrg.code}-${sequenceNumber}`;

  // Get next shipment number from sequence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seqData, error: seqError } = await (supabase as any)
    .rpc("get_next_shipment_number");

  if (seqError) {
    console.error("Failed to get shipment number:", seqError);
    return { success: false, error: "Failed to generate shipment number", code: "SEQ_FAILED" };
  }

  const shipmentNumber = seqData;

  // Create draft shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: insertError } = await (supabase as any)
    .from("shipments")
    .insert({
      shipment_code: shipmentCode,
      shipment_number: shipmentNumber,
      from_organisation_id: fromOrganisationId,
      to_organisation_id: session.organisationId,
      shipment_date: new Date().toISOString().split("T")[0],
      notes: notes || null,
      status: "draft",
    })
    .select("id, shipment_code")
    .single();

  if (insertError) {
    console.error("Failed to create shipment:", insertError);
    if (insertError.code === "23505") {
      return { success: false, error: "Shipment code already exists", code: "DUPLICATE_CODE" };
    }
    return { success: false, error: "Failed to create shipment", code: "INSERT_FAILED" };
  }

  revalidatePath("/shipments");

  return {
    success: true,
    data: {
      id: shipment.id,
      shipmentCode: shipment.shipment_code,
    },
  };
}
