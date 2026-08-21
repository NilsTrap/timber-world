import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCounterpartyProfile } from "@/features/counterparties/actions";
import { CounterpartyProfile } from "@/features/counterparties/components";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getCounterpartyProfile("clients", (await params).id);
  return { title: result.success ? result.data.name : "Company not found" };
}
export default async function CustomerCompanyPage({ params }: Props) {
  if (!(await getSession())) redirect("/login");
  const result = await getCounterpartyProfile("clients", (await params).id);
  if (!result.success) notFound();
  return <CounterpartyProfile book="clients" profile={result.data} />;
}
