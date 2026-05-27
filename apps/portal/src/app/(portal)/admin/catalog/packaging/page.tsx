import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Packaging" };

export default async function PackagingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Packaging</h1>
        <p className="text-muted-foreground">Define how product variants are packaged for sale</p>
      </div>
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p>Packaging configuration is managed within each product&apos;s variant detail.</p>
        <p className="mt-1">Go to a product → variant to define package sizes and pricing.</p>
      </div>
    </div>
  );
}
