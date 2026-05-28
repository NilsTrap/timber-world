import Link from "next/link";
import { getMyOrders } from "@/app/(app)/cart/actions";
import { gbp } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function OrdersPage() {
  const result = await getMyOrders();
  const orders = result.success ? result.data : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 p-8 text-center space-y-3">
          <p className="text-sm text-[var(--charcoal-light)]">No orders yet.</p>
          <Link href="/catalog" className="text-sm font-semibold text-[var(--forest-green)]">Browse the catalog</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl bg-white border border-gray-100 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm">{o.code}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-500"}`}>{o.status}</span>
                </div>
                <span className="text-sm font-semibold">{gbp(o.totalCents)}</span>
              </div>
              <div className="text-xs text-[var(--charcoal-light)]">
                {o.customerName}{o.customerCompany ? ` · ${o.customerCompany}` : ""} · {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                {o.submittedAt ? ` · ${new Date(o.submittedAt).toLocaleDateString("en-GB")}` : ""}
              </div>
              {o.commissionTotalCents > 0 && (
                <div className="text-xs text-[var(--forest-green)] font-medium">Commission {gbp(o.commissionTotalCents)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
