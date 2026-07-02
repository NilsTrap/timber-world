import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { DocumentTemplatesManager } from "@/features/documents/components";
import { Card, CardContent } from "@timber/ui";

export const metadata: Metadata = { title: "Document Templates" };
export const dynamic = "force-dynamic";

/**
 * Document Templates configuration (Admin only, E6) — manage the global
 * Handlebars document templates (per doc type) that generated PDFs are merged
 * from. A code-view HTML editor with a live sandboxed preview and .docx import;
 * templates are platform-admin managed and edited in-app, never in code.
 */
export default async function DocumentTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Document Templates</h1>
        <p className="text-muted-foreground">
          Edit the global HTML templates used to generate deal documents. Bind merge variables,
          preview against a sample deal, and set the default per document type.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DocumentTemplatesManager />
        </CardContent>
      </Card>
    </div>
  );
}
