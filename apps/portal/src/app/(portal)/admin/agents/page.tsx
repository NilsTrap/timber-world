import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAgents } from "@/features/agents/actions/agents";
import { AgentsPageContent } from "@/features/agents/components/AgentsPageContent";

export const metadata: Metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("agents.view")) redirect("/dashboard");
  }

  const result = await getAgents();
  return <AgentsPageContent agents={result.success ? result.data : []} />;
}
