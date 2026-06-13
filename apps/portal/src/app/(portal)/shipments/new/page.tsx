import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { NewShipmentClient } from "./NewShipmentClient";

export const metadata: Metadata = {
  title: "New Shipment",
};

export default async function NewShipmentPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  // Two-layer module gate: admins bypass; everyone else needs shipments.view
  // (org-enabled AND user-enabled). Mirrors shipments/page.tsx deny behavior.
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("shipments.view")) {
      notFound();
    }
  }
  return <NewShipmentClient />;
}
