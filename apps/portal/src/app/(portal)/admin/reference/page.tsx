import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import { ReferenceDataManager } from "@/features/reference-data";

export const metadata: Metadata = {
  title: "Reference Data",
};

/**
 * Reference Data Management Page (Admin Only)
 *
 * Allows admins to manage dropdown options for inventory attributes.
 */
export default async function ReferenceDataPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Reference Data</h1>
        <p className="text-muted-foreground">
          Manage dropdown options for inventory attributes
        </p>
      </div>

      <ReferenceDataManager canDelete={isSuperAdmin(session)} />
    </div>
  );
}
