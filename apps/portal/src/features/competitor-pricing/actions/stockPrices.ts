"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@timber/database/admin";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface StockPriceRow {
  id: string;
  species: string;
  panel_type: string;
  quality: string;
  thickness: string;
  length_range: string;
  order_price: number;
  stock_price: number;
  sort_order: number;
}

export async function getStockPrices(): Promise<ActionResult<StockPriceRow[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("stock_prices")
    .select("id, species, panel_type, quality, thickness, length_range, order_price, stock_price, sort_order")
    .order("sort_order");

  if (error) {
    console.error("Failed to fetch stock prices:", error);
    return { success: false, error: "Failed to fetch stock prices", code: "FETCH_FAILED" };
  }

  return { success: true, data: data ?? [] };
}

export async function updateStockPrice(
  id: string,
  field: string,
  value: string | number
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("stock_prices" as never)
    .update({ [field]: value, updated_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    console.error("Failed to update stock price:", error);
    return { success: false, error: "Failed to update stock price", code: "UPDATE_FAILED" };
  }

  return { success: true, data: null };
}

export async function reorderStockPrices(
  updates: { id: string; sort_order: number }[]
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = createAdminClient();

  for (const { id, sort_order } of updates) {
    const { error } = await supabase
      .from("stock_prices" as never)
      .update({ sort_order } as never)
      .eq("id", id);
    if (error) {
      console.error("Failed to reorder stock prices:", error);
      return { success: false, error: "Failed to reorder", code: "UPDATE_FAILED" };
    }
  }

  return { success: true, data: null };
}

export async function addStockPriceRow(
  row: Omit<StockPriceRow, "id"> & { sort_order?: number }
): Promise<ActionResult<StockPriceRow>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("stock_prices" as never)
    .insert(row as never)
    .select()
    .single();

  if (error) {
    console.error("Failed to add stock price row:", error);
    return { success: false, error: "Failed to add row", code: "INSERT_FAILED" };
  }

  return { success: true, data: data as unknown as StockPriceRow };
}

export async function deleteStockPriceRow(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("stock_prices" as never)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete stock price row:", error);
    return { success: false, error: "Failed to delete row", code: "DELETE_FAILED" };
  }

  return { success: true, data: null };
}
