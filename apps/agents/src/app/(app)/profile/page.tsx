import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { CommissionToggle } from "@/components/CommissionToggle";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: agent } = await (supabase as any)
    .from("agent_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Account</h1>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ background: "var(--forest-green)" }}>
            {agent ? (agent.first_name?.[0] || "") + (agent.last_name?.[0] || "") : user.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div className="font-semibold">
              {agent ? `${agent.first_name} ${agent.last_name}`.trim() || "Agent" : "Agent"}
            </div>
            <div className="text-sm text-[var(--charcoal-light)]">{user.email}</div>
            {agent?.region && <div className="text-xs text-[var(--charcoal-light)] mt-0.5">{agent.region}</div>}
          </div>
        </div>

        {agent && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div>
              <div className="text-xs text-[var(--charcoal-light)] uppercase tracking-wide font-semibold">Phone</div>
              <div className="text-sm mt-0.5">{agent.phone || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--charcoal-light)] uppercase tracking-wide font-semibold">Commission Tier</div>
              <div className="text-sm mt-0.5 capitalize">{agent.commission_tier || "Standard"}</div>
            </div>
          </div>
        )}

        {!agent && (
          <p className="text-sm text-[var(--charcoal-light)]">
            Your agent profile is being set up by the administrator.
          </p>
        )}
      </div>

      {agent && (
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <CommissionToggle initial={!!agent.show_commissions} />
        </div>
      )}

      <LogoutButton />
    </div>
  );
}
