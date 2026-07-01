import { redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Landing for the Counterparties nav parent: route to the first book the
 * caller may see (mirrors the /admin/settings → first-child redirect). */
export default async function CounterpartiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (isAdmin(session)) redirect("/counterparties/clients");
  const orgId = session.currentOrganizationId || session.organisationId;
  const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
  if (mods.has("counterparties.clients")) redirect("/counterparties/clients");
  if (mods.has("counterparties.suppliers")) redirect("/counterparties/suppliers");
  redirect("/dashboard");
}
