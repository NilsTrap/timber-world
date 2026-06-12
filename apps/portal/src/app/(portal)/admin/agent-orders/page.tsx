import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getAgentOrders } from "@/features/agent-orders/actions/agentOrders";

export const metadata: Metadata = { title: "Agent Orders" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "cart", label: "Carts" },
];

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  cart: "bg-amber-100 text-amber-700",
};

const gbp = (c: number) => `£${(c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AgentOrdersPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  const { status } = await searchParams;
  const active = status ?? "submitted";
  const result = await getAgentOrders(active);
  const orders = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Agent Orders</h1>
        <p className="text-muted-foreground">Orders placed by agents through the Timber Agents app</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/agent-orders?status=${f.value}`}
            className={`text-sm px-3 py-1.5 rounded-full border ${active === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Order</th>
              <th className="text-left px-4 py-2.5 font-medium">Agent</th>
              <th className="text-left px-4 py-2.5 font-medium">Customer</th>
              <th className="text-right px-4 py-2.5 font-medium">Items</th>
              <th className="text-right px-4 py-2.5 font-medium">Total</th>
              <th className="text-right px-4 py-2.5 font-medium">Commission</th>
              <th className="text-center px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/agent-orders/${o.id}`} className="font-medium text-primary hover:underline">{o.code}</Link>
                </td>
                <td className="px-4 py-2.5">{o.agentName}<div className="text-xs text-muted-foreground">{o.agentEmail}</div></td>
                <td className="px-4 py-2.5">{o.customerName || "—"}{o.customerCompany ? <div className="text-xs text-muted-foreground">{o.customerCompany}</div> : null}</td>
                <td className="px-4 py-2.5 text-right">{o.itemCount}</td>
                <td className="px-4 py-2.5 text-right font-medium">{gbp(o.totalCents)}</td>
                <td className="px-4 py-2.5 text-right text-green-700">{gbp(o.commissionTotalCents)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[o.status] ?? "bg-gray-100"}`}>{o.status}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{(o.submittedAt || o.createdAt) ? new Date(o.submittedAt || o.createdAt).toLocaleDateString("en-GB") : "—"}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No orders in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
