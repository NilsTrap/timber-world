import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import AuditLogView from "@/features/audit/components/AuditLogView";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

/**
 * Q5.2 · Platform action audit log (Admin only). A read-only trail of identity /
 * access / catalog / settings mutations, tagged human-vs-service so a Vilma/MCP
 * write is distinguishable from a person's action.
 */
export default async function AuditLogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Platform-wide record of who changed what — organisations, users, access
          groups, catalog and settings. Service (Vilma / MCP) actions are tagged
          separately from human actions.
        </p>
      </div>

      <AuditLogView />
    </div>
  );
}
