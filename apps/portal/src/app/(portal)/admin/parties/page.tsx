import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { PartiesTable } from "@/features/parties";

export const metadata: Metadata = {
  title: "Parties",
};

/**
 * Parties Management Page (Admin Only)
 *
 * Allows admins to manage parties (organizations) for shipments.
 */
export default async function PartiesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    redirect("/dashboard?access_denied=true");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Parties</h1>
        <p className="text-muted-foreground">
          Manage organizations for shipments (e.g., Timber World, producers)
        </p>
      </div>

      <PartiesTable />
    </div>
  );
}
