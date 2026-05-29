import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gbp } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const SUPPORT_PHONE = "+44 20 1234 5678"; // placeholder — update with real Timber International number

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Signed-out visitors land on the public catalog instead of the agent dashboard.
  if (!user) redirect("/catalog");

  const { data: agent } = await (supabase as any)
    .from("agent_users")
    .select("id, first_name, last_name, application_status")
    .eq("auth_user_id", user?.id)
    .maybeSingle();

  const { data: orders } = agent
    ? await (supabase as any)
        .from("agent_orders")
        .select("id, code, status, total_cents, commission_total_cents, customer_name, submitted_at")
        .eq("agent_user_id", agent.id)
        .neq("status", "cart")
        .order("submitted_at", { ascending: false })
    : { data: [] };

  const list = orders || [];
  const active = list.filter((o: any) => o.status !== "cancelled");
  const totalSales = active.reduce((s: number, o: any) => s + (o.total_cents || 0), 0);
  const commissionEarned = list.filter((o: any) => o.status === "confirmed").reduce((s: number, o: any) => s + (o.commission_total_cents || 0), 0);
  const commissionPending = list.filter((o: any) => o.status === "submitted").reduce((s: number, o: any) => s + (o.commission_total_cents || 0), 0);
  const recent = list.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Greeting + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {agent?.first_name || "there"}</h1>
          <p className="text-sm text-[var(--charcoal-light)] mt-1">Your agent dashboard</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 bg-green-100 text-green-700 flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
          Verified
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-3 shadow-sm border border-gray-100 text-center">
          <div className="text-2xl font-bold">{active.length}</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--charcoal-light)] font-semibold mt-0.5">Orders</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm border border-gray-100 text-center">
          <div className="text-lg font-bold">{gbp(totalSales)}</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--charcoal-light)] font-semibold mt-0.5">Sales</div>
        </div>
        <div className="rounded-xl p-3 text-white text-center" style={{ background: "var(--forest-green)" }}>
          <div className="text-lg font-bold">{gbp(commissionEarned)}</div>
          <div className="text-[11px] uppercase tracking-wide text-white/70 font-semibold mt-0.5">Commission</div>
        </div>
      </div>
      {commissionPending > 0 && (
        <p className="-mt-3 text-xs text-[var(--charcoal-light)]">+ {gbp(commissionPending)} commission pending on unconfirmed orders.</p>
      )}

      {/* Browse CTA */}
      <Link href="/catalog" className="flex items-center justify-between rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #1B4332, #2D6A4F)" }}>
        <div>
          <div className="font-semibold">Browse the catalog</div>
          <div className="text-xs text-white/70">Find products & place an order</div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="9 18 15 12 9 6"/></svg>
      </Link>

      {/* Recent orders */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--charcoal-light)]">Recent orders</h2>
          {list.length > 0 && <Link href="/orders" className="text-sm font-semibold text-[var(--forest-green)]">View all</Link>}
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl bg-white border border-gray-100 p-6 text-center text-sm text-[var(--charcoal-light)]">No orders yet.</div>
        ) : (
          <div className="space-y-2">
            {recent.map((o: any) => (
              <Link key={o.id} href="/orders" className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm border border-gray-100">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{o.code} <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status] ?? ""}`}>{o.status}</span></div>
                  <div className="text-xs text-[var(--charcoal-light)] truncate">{o.customer_name || "—"}</div>
                </div>
                <div className="text-sm font-semibold">{gbp(o.total_cents)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Support */}
      <div className="rounded-xl bg-white border border-gray-100 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Need help?</h2>
          <p className="text-xs text-[var(--charcoal-light)] mt-0.5">Get in touch with Timber International.</p>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--forest-green)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call
          </a>
          <a href="mailto:hello@timberinternational.example?subject=Agent%20question" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border text-[var(--forest-green)]" style={{ borderColor: "var(--forest-green)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
            Ask
          </a>
        </div>
      </div>
    </div>
  );
}
