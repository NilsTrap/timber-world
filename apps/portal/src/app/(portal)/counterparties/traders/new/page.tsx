import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCounterpartyBookContext } from "@/features/counterparties/actions";
import { CounterpartyFormPage } from "@/features/counterparties/components";

export const metadata: Metadata = { title: "Add trader company" };
export const dynamic = "force-dynamic";

export default async function NewTraderCompanyPage() {
  if (!(await getSession())) redirect("/login");
  const access = await getCounterpartyBookContext("traders");
  if (!access.success || !access.data.canManage) notFound();
  return <CounterpartyFormPage book="traders" />;
}
