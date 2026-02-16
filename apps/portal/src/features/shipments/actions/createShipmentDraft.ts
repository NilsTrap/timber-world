"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

interface CreateDraftInput {
  toOrganisationId: string;
  notes?: string;
}

interface DraftShipmentResult {
  id: string;
  shipmentCode: string;
}

/**
 * Create Shipment Draft
 *
 * Creates a new draft shipment from the current user's organization
 * to the specified destination organization.
 *
 * The shipment code is auto-generated: [FROM_CODE]-[TO_CODE]-[NUMBER]
 */
export async function createShipmentDraft(
  input: CreateDraftInput
): Promise<ActionResult<DraftShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const { toOrganisationId, notes } = input;

  // Validate destination org is different from source
  if (toOrganisationId === session.organisationId) {
    return { success: false, error: "Cannot create shipment to your own organization", code: "SAME_ORG" };
  }

  const supabase = await createClient();

  // Get organisation codes for shipment code generation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromOrg, error: fromOrgError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", session.organisationId)
    .single();

  if (fromOrgError || !fromOrg) {
    return { success: false, error: "Source organization not found", code: "ORG_NOT_FOUND" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toOrg, error: toOrgError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", toOrganisationId)
    .single();

  if (toOrgError || !toOrg) {
    return { success: false, error: "Destination organization not found", code: "ORG_NOT_FOUND" };
  }

  // Count existing shipments between these orgs for sequence number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: countError } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("from_organisation_id", session.organisationId)
    .eq("to_organisation_id", toOrganisationId);

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
      from_organisation_id: session.organisationId,
      to_organisation_id: toOrganisationId,
      shipment_date: new Date().toISOString().split("T")[0],
      notes: notes || null,
      status: "draft",
    })
    .select("id, shipment_code")
    .single();

  if (insertError) {
    console.error("Failed to create shipment:", insertError);
    // Handle unique constraint violation (code already exists)
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

/**
 * Get Organizations for Shipment
 *
 * Returns all active organizations except the current user's organization.
 * Used for the destination organization dropdown.
 */
export async function getShipmentDestinations(): Promise<
  ActionResult<Array<{ id: string; code: string; name: string }>>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("organisations")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name");

  // Exclude current user's organization if they have one
  if (session.organisationId) {
    query = query.neq("id", session.organisationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch organizations:", error);
    return { success: false, error: "Failed to fetch organizations", code: "QUERY_FAILED" };
  }

  return { success: true, data: data ?? [] };
}
