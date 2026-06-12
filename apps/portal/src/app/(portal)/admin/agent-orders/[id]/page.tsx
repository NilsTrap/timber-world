import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAgentOrder } from "@/features/agent-orders/actions/agentOrders";
import { AgentOrderActions } from "@/features/agent-orders/components/AgentOrderActions";

export const metadata: Metadata = { title: "Agent Order" };
export const dynamic = "force-dynamic";

const gbp = (c: number) => `£${(c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AgentOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("agent-orders.view")) redirect("/dashboard");
  }

  const result = await getAgentOrder(id);
  if (!result.success) notFound();
  const o = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/admin/agent-orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{o.code}</h1>
          <p className="text-muted-foreground capitalize">{o.status}{o.submittedAt ? ` · ${new Date(o.submittedAt).toLocaleString("en-GB")}` : ""}</p>
        </div>
        <AgentOrderActions id={o.id} status={o.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-1 text-sm">
          <h2 className="font-semibold mb-1">Agent</h2>
          <div>{o.agentName}</div>
          <div className="text-muted-foreground">{o.agentEmail}</div>
          {o.agentPhone && <div className="text-muted-foreground">{o.agentPhone}</div>}
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1 text-sm">
          <h2 className="font-semibold mb-1">Customer</h2>
          <div>{o.customerName || "—"}</div>
          {o.customerCompany && <div className="text-muted-foreground">{o.customerCompany}</div>}
          {o.deliveryAddress && <div className="text-muted-foreground whitespace-pre-line">{o.deliveryAddress}</div>}
          {o.notes && <div className="text-muted-foreground mt-2"><span className="font-medium">Notes:</span> {o.notes}</div>}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Product</th>
              <th className="text-left px-4 py-2.5 font-medium">SKU</th>
              <th className="text-left px-4 py-2.5 font-medium">Packaging</th>
              <th className="text-right px-4 py-2.5 font-medium">Qty (pkg)</th>
              <th className="text-right px-4 py-2.5 font-medium">Unit</th>
              <th className="text-right px-4 py-2.5 font-medium">Disc.</th>
              <th className="text-right px-4 py-2.5 font-medium">Line total</th>
              <th className="text-right px-4 py-2.5 font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            {(o.items ?? []).map((it) => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">{it.productName}<div className="text-xs text-muted-foreground">{it.variantLabel}</div></td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{it.sku || "—"}</td>
                <td className="px-4 py-2.5">{it.packagingName || "—"}{it.piecesPerPackage ? ` (${it.piecesPerPackage})` : ""}</td>
                <td className="px-4 py-2.5 text-right">{it.quantityPackages}</td>
                <td className="px-4 py-2.5 text-right">{gbp(it.unitPriceCents)}/{it.unitSymbol}</td>
                <td className="px-4 py-2.5 text-right">{it.discountPct > 0 ? `${it.discountPct}%` : "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">{gbp(it.lineTotalCents)}</td>
                <td className="px-4 py-2.5 text-right text-green-700">{gbp(it.commissionCents)} <span className="text-xs text-muted-foreground">({it.commissionPct.toFixed(1)}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-64 rounded-lg border bg-card p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{gbp(o.subtotalCents)}</span></div>
          {o.discountTotalCents > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>−{gbp(o.discountTotalCents)}</span></div>}
          <div className="flex justify-between font-semibold text-base border-t pt-1.5"><span>Total</span><span>{gbp(o.totalCents)}</span></div>
          <div className="flex justify-between text-green-700 font-medium"><span>Commission</span><span>{gbp(o.commissionTotalCents)}</span></div>
        </div>
      </div>
    </div>
  );
}
