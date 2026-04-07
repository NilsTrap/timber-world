"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { DeliveryAddress, ActionResult } from "../types";

/**
 * Get Delivery Addresses
 *
 * Fetches all delivery addresses for an organisation.
 * Admin only endpoint.
 */
export async function getDeliveryAddresses(
  organisationId: string
): Promise<ActionResult<DeliveryAddress[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisation_delivery_addresses")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });

  if (error) {
    console.error("Failed to fetch delivery addresses:", error);
    return { success: false, error: "Failed to fetch delivery addresses" };
  }

  const addresses: DeliveryAddress[] = (data || []).map(mapRow);

  return { success: true, data: addresses };
}

/**
 * Save Delivery Address
 *
 * Creates or updates a delivery address. Max 2 per organisation.
 * If isDefault is true, unsets default on other addresses.
 */
export async function saveDeliveryAddress(
  organisationId: string,
  address: {
    id?: string;
    label: string;
    address: string;
    contactName?: string | null;
    contactPhone?: string | null;
    contactHours?: string | null;
    isDefault: boolean;
  }
): Promise<ActionResult<DeliveryAddress>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID" };
  }

  if (!address.label.trim()) {
    return { success: false, error: "Label is required" };
  }
  if (!address.address.trim()) {
    return { success: false, error: "Address is required" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Check max 2 addresses (only for new addresses)
  if (!address.id) {
    const { count } = await client
      .from("organisation_delivery_addresses")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId);

    if ((count ?? 0) >= 2) {
      return { success: false, error: "Maximum 2 delivery addresses per organisation" };
    }
  }

  // If setting as default, unset others first
  if (address.isDefault) {
    await client
      .from("organisation_delivery_addresses")
      .update({ is_default: false })
      .eq("organisation_id", organisationId);
  }

  const payload = {
    organisation_id: organisationId,
    label: address.label.trim(),
    address: address.address.trim(),
    contact_name: address.contactName?.trim() || null,
    contact_phone: address.contactPhone?.trim() || null,
    contact_hours: address.contactHours?.trim() || null,
    is_default: address.isDefault,
  };

  let result;
  if (address.id) {
    // Update existing
    if (!isValidUUID(address.id)) {
      return { success: false, error: "Invalid address ID" };
    }
    result = await client
      .from("organisation_delivery_addresses")
      .update(payload)
      .eq("id", address.id)
      .eq("organisation_id", organisationId)
      .select("*")
      .single();
  } else {
    // Insert new
    result = await client
      .from("organisation_delivery_addresses")
      .insert(payload)
      .select("*")
      .single();
  }

  if (result.error) {
    console.error("Failed to save delivery address:", result.error);
    return { success: false, error: "Failed to save delivery address" };
  }

  return { success: true, data: mapRow(result.data) };
}

/**
 * Delete Delivery Address
 */
export async function deleteDeliveryAddress(
  organisationId: string,
  addressId: string
): Promise<ActionResult<{ deleted: true }>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  if (!isValidUUID(organisationId) || !isValidUUID(addressId)) {
    return { success: false, error: "Invalid ID" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("organisation_delivery_addresses")
    .delete()
    .eq("id", addressId)
    .eq("organisation_id", organisationId);

  if (error) {
    console.error("Failed to delete delivery address:", error);
    return { success: false, error: "Failed to delete delivery address" };
  }

  return { success: true, data: { deleted: true } };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): DeliveryAddress {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    label: row.label,
    address: row.address,
    contactName: row.contact_name ?? null,
    contactPhone: row.contact_phone ?? null,
    contactHours: row.contact_hours ?? null,
    isDefault: row.is_default,
  };
}
