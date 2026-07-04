"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { getOrders } from "../actions/getOrders";
import { NewDealDialog } from "./NewDealDialog";
import type { Order } from "../types";

/** Per deal-flow stage: label + badge colours (a new/draft order stands out). */
const STAGE_META: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-300" },
  confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-800" },
  produced:  { label: "Produced",  cls: "bg-violet-100 text-violet-800" },
  loaded:    { label: "Loaded",    cls: "bg-orange-100 text-orange-800" },
  delivered: { label: "Delivered", cls: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700 line-through" },
};
function stageMeta(stage: string | null | undefined) {
  return (stage && STAGE_META[stage]) || { label: stage ?? "—", cls: "bg-gray-100 text-gray-700" };
}

function FilterSelect({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="all">{label}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/**
 * Orders = one minimalistic OVERVIEW of the deals. No per-user-group tabs (that's
 * an access-rights concern, handled in Settings, not tabs). Status is the deal-flow
 * lifecycle stage (colour-coded); a row click opens the deal detail.
 */
export function OrdersOverview() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");

  useEffect(() => {
    getOrders().then((res) => {
      if (res.success) setOrders(res.data);
      else toast.error(res.error);
      setLoading(false);
    });
  }, []);

  const customers = useMemo(
    () => [...new Set(orders.map((o) => o.customerOrganisationName).filter(Boolean) as string[])].sort(),
    [orders]);
  const manufacturers = useMemo(
    () => [...new Set(orders.map((o) => o.sellerOrganisationName).filter(Boolean) as string[])].sort(),
    [orders]);
  const stages = useMemo(
    () => [...new Set(orders.map((o) => o.lifecycleStage).filter(Boolean) as string[])],
    [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) =>
      (statusFilter === "all" || o.lifecycleStage === statusFilter) &&
      (customerFilter === "all" || o.customerOrganisationName === customerFilter) &&
      (manufacturerFilter === "all" || o.sellerOrganisationName === manufacturerFilter) &&
      (q === "" || [o.dealCode, o.name, o.customerOrganisationName, o.sellerOrganisationName, o.createdByName, o.projectNumber, o.notes]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q)))
    );
  }, [orders, search, statusFilter, customerFilter, manufacturerFilter]);

  return (
    <div className="space-y-4">
      <NewDealDialog open={newDealOpen} onOpenChange={setNewDealOpen} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">{orders.length} orders</p>
        </div>
        <Button onClick={() => setNewDealOpen(true)}>
          <Plus className="h-4 w-4" /> Add order
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…" className="h-9 pl-8" />
        </div>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} label="All statuses" options={stages.map((s) => ({ value: s, label: stageMeta(s).label }))} />
        <FilterSelect value={customerFilter} onChange={setCustomerFilter} label="All customers" options={customers.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={manufacturerFilter} onChange={setManufacturerFilter} label="All manufacturers" options={manufacturers.map((m) => ({ value: m, label: m }))} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm [&_th]:h-9 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_td]:px-3 [&_td]:py-2">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th>Number</th>
                <th>Buyer</th>
                <th>Manufacturer</th>
                <th>Received</th>
                <th>Status</th>
                <th>Created by</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const m = stageMeta(o.lifecycleStage);
                return (
                  <tr
                    key={o.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <td className="font-medium whitespace-nowrap">{o.dealCode || o.name || "—"}</td>
                    <td className="text-muted-foreground">{o.customerOrganisationName || "—"}</td>
                    <td className="text-muted-foreground">{o.sellerOrganisationName || "—"}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{o.dateReceived}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
                    </td>
                    <td className="text-muted-foreground">{o.createdByName || "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    {orders.length === 0 ? "No orders yet. Create one to start a deal." : "No orders match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
