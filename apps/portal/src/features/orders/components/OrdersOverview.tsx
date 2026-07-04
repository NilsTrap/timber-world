"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, Link2 } from "lucide-react";
import { Button, Input } from "@timber/ui";
import { toast } from "sonner";
import { getOrders } from "../actions/getOrders";
import { NewDealDialog } from "./NewDealDialog";
import { StageBadge } from "./StageBadge";
import { stageLabel } from "../services/stageColors";
import { partyOrderNumbers } from "../services/partyOrderNumbers";
import { fmtDateLV, initialsOf } from "../format";
import type { Order } from "../types";

/**
 * F1 · Direction of a deal (§2.5/§3.1) — viewer-relative by PARTY COMPARISON, not
 * a chain_role column (there is none). A viewer with a house org sees "Sell" on a
 * deal their org is selling and "Buy" on one their org is buying (buyer == customer
 * under the bilateral invariant). The owner/admin has no single org (userOrgId
 * null) and observes from the house side, falling back to the deal's own kind
 * (`purchase_only` = a buy leg).
 */
function directionOf(o: Order, userOrgId: string | null): "sell" | "buy" {
  if (userOrgId) {
    if (o.sellerOrganisationId === userOrgId) return "sell";
    if (o.customerOrganisationId === userOrgId) return "buy";
  }
  return o.dealKind === "purchase_only" ? "buy" : "sell";
}

/** Direction chips — a different semantic axis from the §12 stage palette, so
 *  kept deliberately neutral (outline chips), not stage colours. */
const DIRECTION_META: Record<"sell" | "buy", { label: string; cls: string }> = {
  sell: { label: "Sell", cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  buy:  { label: "Buy",  cls: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
};

function fmtVol(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toLocaleString("en-GB", { maximumFractionDigits: 3 })} m³`;
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
 * lifecycle stage (§12 palette via StageBadge); a row click opens the deal detail.
 * F1: a Sell/Buy direction badge + filter, and — for the owner/admin only (M1) —
 * the spine code (SP-NNN) on paired rows, a spine filter/grouping affordance, a
 * volume column, and the parties' own order numbers under the Reference. Every
 * spine/pairing hint stays behind `isAdmin` (§6.2 wall): non-admins see none of it
 * (the server also never sends them spineCode/externalRefs).
 */
export function OrdersOverview({ isAdmin = false, userOrgId = null }: { isAdmin?: boolean; userOrgId?: string | null }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [spineFilter, setSpineFilter] = useState("all");

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

  // F1/M1 · pairing: a spine shared by ≥2 rows links a sell leg to its buy leg.
  // Owner/admin ONLY (§6.2) — spineId/spineCode are field-walled to null for
  // everyone else, and we still gate the hints on isAdmin. Counted over ALL rows
  // so it is global.
  const spineCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (isAdmin) for (const o of orders) if (o.spineId) m.set(o.spineId, (m.get(o.spineId) ?? 0) + 1);
    return m;
  }, [orders, isAdmin]);

  // M1 · spine filter/grouping affordance (admin only): the spine codes that
  // actually pair ≥2 legs, so selecting one isolates that chain's legs.
  const pairedSpineCodes = useMemo(() => {
    if (!isAdmin) return [] as string[];
    const codes = new Map<string, string>(); // spineCode → itself, deduped
    for (const o of orders) {
      if (o.spineId && o.spineCode && (spineCounts.get(o.spineId) ?? 0) >= 2) codes.set(o.spineCode, o.spineCode);
    }
    return [...codes.keys()].sort();
  }, [orders, isAdmin, spineCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const pon = isAdmin ? partyOrderNumbers(o.externalRefs) : { customerOrderNo: null, supplierOrderNo: null };
      return (
        (statusFilter === "all" || o.lifecycleStage === statusFilter) &&
        (directionFilter === "all" || directionOf(o, userOrgId) === directionFilter) &&
        (customerFilter === "all" || o.customerOrganisationName === customerFilter) &&
        (manufacturerFilter === "all" || o.sellerOrganisationName === manufacturerFilter) &&
        (spineFilter === "all" || o.spineCode === spineFilter) &&
        (q === "" || [o.dealCode, o.code, o.name, o.customerOrganisationName, o.sellerOrganisationName, o.createdByName, o.projectNumber, o.notes, o.spineCode, pon.customerOrderNo, pon.supplierOrderNo]
          .some((v) => (v ?? "").toString().toLowerCase().includes(q)))
      );
    });
  }, [orders, search, statusFilter, directionFilter, customerFilter, manufacturerFilter, spineFilter, userOrgId, isAdmin]);

  // Admin gets one extra (Volume) column — keep the empty-state colSpan in sync.
  const colCount = isAdmin ? 9 : 8;

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
        <FilterSelect value={statusFilter} onChange={setStatusFilter} label="All statuses" options={stages.map((s) => ({ value: s, label: stageLabel(s) }))} />
        <FilterSelect value={directionFilter} onChange={setDirectionFilter} label="All directions" options={[{ value: "sell", label: "Sell" }, { value: "buy", label: "Buy" }]} />
        <FilterSelect value={customerFilter} onChange={setCustomerFilter} label="All customers" options={customers.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={manufacturerFilter} onChange={setManufacturerFilter} label="All manufacturers" options={manufacturers.map((m) => ({ value: m, label: m }))} />
        {/* M1 · spine grouping — admin only (§6.2). Only paired spines are worth grouping. */}
        {isAdmin && pairedSpineCodes.length > 0 && (
          <FilterSelect value={spineFilter} onChange={setSpineFilter} label="All spines" options={pairedSpineCodes.map((c) => ({ value: c, label: c }))} />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm [&_th]:h-9 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_td]:px-3 [&_td]:py-2">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th>Number</th>
                <th>Reference</th>
                <th>Direction</th>
                <th>Buyer</th>
                <th>Manufacturer</th>
                {isAdmin && <th className="text-right">Volume</th>}
                <th>Created</th>
                <th>Status</th>
                <th className="w-16 text-center">By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const dm = DIRECTION_META[directionOf(o, userOrgId)];
                const paired = isAdmin && !!o.spineId && (spineCounts.get(o.spineId) ?? 0) >= 2;
                const pon = isAdmin ? partyOrderNumbers(o.externalRefs) : { customerOrderNo: null, supplierOrderNo: null };
                return (
                  <tr
                    key={o.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <td className="font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {o.dealCode || o.code || "—"}
                        {paired && (
                          <span
                            className="inline-flex items-center gap-1"
                            title={`Part of a linked sell/buy chain${o.spineCode ? ` · ${o.spineCode}` : ""}`}
                            aria-label={`Part of a linked sell/buy chain${o.spineCode ? ` (spine ${o.spineCode})` : ""}`}
                          >
                            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {o.spineCode && (
                              <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">{o.spineCode}</span>
                            )}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="text-muted-foreground">
                      <div>{o.name && o.name.trim() !== "-" ? o.name : "—"}</div>
                      {/* M1/N3 · the parties' own order numbers (admin only). */}
                      {isAdmin && (pon.customerOrderNo || pon.supplierOrderNo) && (
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground/80">
                          {pon.customerOrderNo && <span>Cust #: <span className="tabular-nums">{pon.customerOrderNo}</span></span>}
                          {pon.supplierOrderNo && <span>Supp #: <span className="tabular-nums">{pon.supplierOrderNo}</span></span>}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${dm.cls}`}>{dm.label}</span>
                    </td>
                    <td className="text-muted-foreground">{o.customerOrganisationName || "—"}</td>
                    <td className="text-muted-foreground">{o.sellerOrganisationName || "—"}</td>
                    {isAdmin && <td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{fmtVol(o.volumeM3)}</td>}
                    <td className="whitespace-nowrap text-muted-foreground">{fmtDateLV(o.createdAt)}</td>
                    <td>
                      <StageBadge stage={o.lifecycleStage} strikeThrough={o.lifecycleStage === "cancelled"} />
                    </td>
                    <td className="text-center">
                      {o.createdByName ? (
                        <span
                          title={o.createdByName}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
                        >
                          {initialsOf(o.createdByName)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-3 py-10 text-center text-muted-foreground">
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
