import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, isSuperAdmin, orgHasModule } from "@/lib/auth";
import { MarketingCmsManager } from "@/features/marketing-cms";

export const metadata: Metadata = {
  title: "CMS",
};

/**
 * CMS Page (Admin Only)
 *
 * Manage website media, reference data, and view analytics.
 */
export default async function CmsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasModule = await orgHasModule(orgId, "marketing.view");
    if (!hasModule) {
      notFound();
    }
  }

  // Super Admin can delete reference options
  const canDelete = isSuperAdmin(session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">CMS www.timber-international.com</h1>
        <p className="text-muted-foreground">
          Manage website media, reference data, and analytics
        </p>
      </div>

      <MarketingCmsManager canDelete={canDelete} />
    </div>
  );
}
