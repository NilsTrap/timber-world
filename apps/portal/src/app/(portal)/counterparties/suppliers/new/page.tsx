import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCounterpartyBookContext } from "@/features/counterparties/actions";
import { CounterpartyFormPage } from "@/features/counterparties/components";

export const metadata: Metadata = { title: "Add supplier company" };
export const dynamic = "force-dynamic";

export default async function NewSupplierCompanyPage() {
  if (!(await getSession())) redirect("/login");
  const access = await getCounterpartyBookContext("suppliers");
  if (!access.success || !access.data.canManage) notFound();
  return <CounterpartyFormPage book="suppliers" />;
}
