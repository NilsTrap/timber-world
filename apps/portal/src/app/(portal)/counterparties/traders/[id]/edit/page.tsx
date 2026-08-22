import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCounterpartyProfile } from "@/features/counterparties/actions";
import { CounterpartyFormPage } from "@/features/counterparties/components";

export const metadata: Metadata = { title: "Edit trader company" };
export const dynamic = "force-dynamic";

export default async function EditTraderCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) redirect("/login");
  const result = await getCounterpartyProfile("traders", (await params).id);
  if (!result.success || !result.data.canManage) notFound();
  return <CounterpartyFormPage book="traders" profile={result.data} />;
}
