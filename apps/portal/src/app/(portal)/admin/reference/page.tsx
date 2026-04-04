import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import { ReferenceDataManager } from "@/features/reference-data";
import { Card, CardContent } from "@timber/ui";

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
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Reference Data</h1>
        <p className="text-muted-foreground">
          Manage dropdown options for inventory attributes
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReferenceDataManager canDelete={isSuperAdmin(session)} />
        </CardContent>
      </Card>
    </div>
  );
}
