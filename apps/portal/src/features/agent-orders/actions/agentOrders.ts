"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export interface AgentOrderItem {
  id: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  packagingName: string | null;
  piecesPerPackage: number | null;
  quantityPackages: number;
  unitSymbol: string | null;
  unitPriceCents: number;
  discountPct: number;
  lineSubtotalCents: number;
  lineTotalCents: number;
  commissionPct: number;
  commissionCents: number;
}

export interface AgentOrder {
  id: string;
  code: string;
  status: string;
  agentName: string;
  agentEmail: string;
  agentPhone: string | null;
  customerName: string | null;
  customerCompany: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  subtotalCents: number;
  discountTotalCents: number;
  totalCents: number;
  commissionTotalCents: number;
  itemCount: number;
  submittedAt: string | null;
  createdAt: string;
  items?: AgentOrderItem[];
}

function toOrder(row: any): AgentOrder {
  const a = row.agent_users;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    agentName: a ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : "—",
    agentEmail: a?.email ?? "—",
    agentPhone: a?.phone ?? null,
    customerName: row.customer_name,
    customerCompany: row.customer_company,
    deliveryAddress: row.delivery_address,
    notes: row.notes,
    subtotalCents: row.subtotal_cents,
    discountTotalCents: row.discount_total_cents,
    totalCents: row.total_cents,
    commissionTotalCents: row.commission_total_cents,
    itemCount: row.agent_order_items?.[0]?.count ?? (Array.isArray(row.agent_order_items) ? row.agent_order_items.length : 0),
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  };
}

function toItem(row: any): AgentOrderItem {
  return {
    id: row.id,
    productName: row.product_name,
    variantLabel: row.variant_label,
    sku: row.sku,
    packagingName: row.packaging_name,
    piecesPerPackage: row.pieces_per_package,
    quantityPackages: row.quantity_packages,
    unitSymbol: row.unit_symbol,
    unitPriceCents: row.unit_price_cents,
    discountPct: Number(row.discount_pct),
    lineSubtotalCents: row.line_subtotal_cents,
    lineTotalCents: row.line_total_cents,
    commissionPct: Number(row.commission_pct),
    commissionCents: row.commission_cents,
  };
}

export async function getAgentOrders(statusFilter?: string): Promise<ActionResult<AgentOrder[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  let query = (supabase as any)
    .from("agent_orders")
    .select("*, agent_users(first_name, last_name, email, phone), agent_order_items(count)")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
  else query = query.neq("status", "cart"); // default: hide carts unless explicitly requested

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toOrder) };
}

export async function getAgentOrder(id: string): Promise<ActionResult<AgentOrder>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("agent_orders")
    .select("*, agent_users(first_name, last_name, email, phone), agent_order_items(*)")
    .eq("id", id)
    .single();
  if (error) return { success: false, error: error.message };

  const order = toOrder(data);
  const items = (data.agent_order_items || []).map(toItem);
  order.items = items;
  order.itemCount = items.length;
  return { success: true, data: order };
}

async function setStatus(id: string, status: "confirmed" | "cancelled"): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("agent_orders").update({ status }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/agent-orders");
  revalidatePath(`/admin/agent-orders/${id}`);
  return { success: true, data: null };
}

export async function confirmAgentOrder(id: string) { return setStatus(id, "confirmed"); }
export async function cancelAgentOrder(id: string) { return setStatus(id, "cancelled"); }
