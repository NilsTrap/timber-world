"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface OrgPrintInfo {
  name: string;
  code: string;
  legalAddress: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  country: string | null;
  logoUrl: string | null;
  deliveryAddresses: {
    id: string;
    label: string;
    address: string;
    contactName: string | null;
    contactPhone: string | null;
    contactHours: string | null;
    isDefault: boolean;
  }[];
}

export interface ShipmentPrintData {
  from: OrgPrintInfo;
  to: OrgPrintInfo;
  /** Free-text delivery-from saved on shipment */
  deliveryFromText: string | null;
  /** Free-text delivery-to saved on shipment */
  deliveryToText: string | null;
}

/**
 * Get organisation details needed for printing CMR and Packing List documents.
 */
export async function getShipmentPrintData(
  shipmentId: string
): Promise<ActionResult<ShipmentPrintData>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Get shipment with org IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("from_organisation_id, to_organisation_id, delivery_from_text, delivery_to_text")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  async function fetchOrgInfo(orgId: string): Promise<OrgPrintInfo | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error } = await (supabase as any)
      .from("organisations")
      .select("name, code, legal_address, vat_number, registration_number, country, logo_url")
      .eq("id", orgId)
      .single();

    if (error || !org) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: addresses } = await (supabase as any)
      .from("organisation_delivery_addresses")
      .select("id, label, address, contact_name, contact_phone, contact_hours, is_default")
      .eq("organisation_id", orgId)
      .order("is_default", { ascending: false });

    return {
      name: org.name,
      code: org.code,
      legalAddress: org.legal_address,
      vatNumber: org.vat_number,
      registrationNumber: org.registration_number,
      country: org.country,
      logoUrl: org.logo_url,
      deliveryAddresses: (addresses ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        label: a.label as string,
        address: a.address as string,
        contactName: a.contact_name as string | null,
        contactPhone: a.contact_phone as string | null,
        contactHours: a.contact_hours as string | null,
        isDefault: a.is_default as boolean,
      })),
    };
  }

  const [fromOrg, toOrg] = await Promise.all([
    fetchOrgInfo(shipment.from_organisation_id),
    fetchOrgInfo(shipment.to_organisation_id),
  ]);

  if (!fromOrg || !toOrg) {
    return { success: false, error: "Organisation not found", code: "ORG_NOT_FOUND" };
  }

  return {
    success: true,
    data: {
      from: fromOrg,
      to: toOrg,
      deliveryFromText: shipment.delivery_from_text ?? null,
      deliveryToText: shipment.delivery_to_text ?? null,
    },
  };
}
