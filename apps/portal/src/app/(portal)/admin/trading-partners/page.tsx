import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Trading Partners" };
export default function TradingPartnersLegacyPage() {
  redirect("/admin/organisations");
}
