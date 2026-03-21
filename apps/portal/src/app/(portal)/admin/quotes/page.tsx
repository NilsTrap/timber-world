import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin, orgHasFeature } from "@/lib/auth";
import { QuoteRequestsTable } from "@/features/quotes";

export const metadata: Metadata = {
  title: "Quote Requests",
};

/**
 * Quote Requests Page (Admin Only)
 *
 * View and manage quote requests from the marketing website.
 */
export default async function QuoteRequestsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const hasFeature = await orgHasFeature(orgId, "quotes.view");
    if (!hasFeature) {
      notFound();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Quote Requests</h1>
        <p className="text-muted-foreground">
          View and manage quote requests from the website
        </p>
      </div>

      <QuoteRequestsTable />
    </div>
  );
}
