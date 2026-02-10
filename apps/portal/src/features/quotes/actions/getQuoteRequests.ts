"use server";

import { createClient } from "@timber/database/server";

export interface QuoteRequest {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  product: string | null;
  species: string | null;
  type: string | null;
  quality: string | null;
  humidity: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  notes: string | null;
  selected_product_ids: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getQuoteRequests(): Promise<ActionResult<QuoteRequest[]>> {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("quote_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch quote requests:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as QuoteRequest[] };
  } catch (err) {
    console.error("Unexpected error fetching quote requests:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateQuoteRequestStatus(
  id: string,
  status: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("quote_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Failed to update quote request status:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: undefined };
  } catch (err) {
    console.error("Unexpected error updating quote request:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
