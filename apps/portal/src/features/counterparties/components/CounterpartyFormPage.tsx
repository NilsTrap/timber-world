"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch } from "@timber/ui";
import { uploadOrgLogo } from "@/features/organisations/actions";
import { createCounterparty, updateCounterparty } from "../actions";
import type { CounterpartyBook, CounterpartyInput, CounterpartyProfile } from "../types";
import { CounterpartyDeliveryAddresses } from "./CounterpartyDeliveryAddresses";
import { OrgContactsSection } from "./OrgContactsSection";

type FormState = Required<Omit<CounterpartyInput, "isActive">> & { isActive: boolean };
const value = (v?: string | null) => v ?? "";
const BOOK_LABELS: Record<CounterpartyBook, { title: string; record: string }> = {
  clients: { title: "Customers", record: "customer" },
  suppliers: { title: "Suppliers", record: "supplier" },
  traders: { title: "Traders", record: "trader" },
};

export function CounterpartyFormPage({
  book,
  profile,
}: {
  book: CounterpartyBook;
  profile?: CounterpartyProfile;
}) {
  const router = useRouter();
  const editing = Boolean(profile);
  const labels = BOOK_LABELS[book];
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(profile?.logoUrl ?? "");
  const [form, setForm] = useState<FormState>({
    code: profile?.code ?? "", name: profile?.name ?? "",
    registrationNumber: value(profile?.registrationNumber), vatNumber: value(profile?.vatNumber),
    legalAddress: value(profile?.legalAddress), country: value(profile?.country),
    email: value(profile?.email), phone: value(profile?.phone), website: value(profile?.website),
    bankName: value(profile?.bankName), bankAccountNumber: value(profile?.bankAccountNumber),
    bankSwiftCode: value(profile?.bankSwiftCode), defaultSigneeName: value(profile?.defaultSigneeName),
    defaultSigneeRole: value(profile?.defaultSigneeRole), isActive: profile?.isActive ?? true,
  });
  const set = (key: keyof FormState, next: string | boolean) => setForm((current) => ({ ...current, [key]: next }));
  const listHref = `/counterparties/${book}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing && !/^[A-Z]{3}$/.test(form.code)) return toast.error("Code must be exactly 3 letters (A–Z)");
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const input: CounterpartyInput = { ...form };
    const result = profile
      ? await updateCounterparty(book, profile.id, input)
      : await createCounterparty(book, input);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(profile ? "Company profile updated" : "Company created");
    router.push(`/counterparties/${book}/${result.data.id}`);
    router.refresh();
  };

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    const result = await uploadOrgLogo(profile.id, data, book);
    setUploading(false);
    event.target.value = "";
    if (!result.success) return toast.error(result.error);
    setLogoUrl(result.data.logoUrl);
    toast.success("Logo uploaded");
  };

  const field = (id: keyof FormState, label: string, props?: { type?: string; placeholder?: string }) => (
    <div className="space-y-1.5"><Label htmlFor={`company-${id}`}>{label}</Label><Input id={`company-${id}`} type={props?.type} placeholder={props?.placeholder} value={String(form[id])} onChange={(e) => set(id, e.target.value)} /></div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><p className="text-sm text-muted-foreground">{labels.title}</p><h1 className="text-3xl font-semibold tracking-tight">{editing ? `Edit ${profile?.name}` : `Add ${labels.record}`}</h1></div>
        <div className="flex gap-2"><Button type="button" variant="outline" asChild><Link href={profile ? `${listHref}/${profile.id}` : listHref}>Cancel</Link></Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Create company"}</Button></div>
      </div>

      <Card><CardHeader><CardTitle>Identity</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div className="space-y-1.5"><Label htmlFor="company-code">Code</Label><Input id="company-code" className="uppercase" maxLength={3} disabled={editing} value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} /><p className="text-xs text-muted-foreground">Permanent three-letter code</p></div>
          {field("name", "Legal company name")}
        </div>
        {editing && <div className="flex items-center gap-2"><Switch id="company-active" checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked)} /><Label htmlFor="company-active">Active</Label></div>}
        {editing && <div className="flex items-center gap-4 rounded-lg border p-3">{logoUrl ? <img src={logoUrl} alt="Company logo" className="h-16 w-24 object-contain" /> : <Building2 className="h-12 w-12 text-muted-foreground" />}<div><Label htmlFor="company-logo" className="cursor-pointer"><span className="inline-flex items-center gap-2 text-sm font-medium"><Upload className="h-4 w-4" />{uploading ? "Uploading…" : "Upload logo"}</span></Label><Input id="company-logo" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={(e) => void uploadLogo(e)} /><p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG; maximum 5 MB</p></div></div>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Legal and invoice details</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        {field("registrationNumber", "Registration number")}{field("vatNumber", "VAT number")}
        <div className="sm:col-span-2">{field("legalAddress", "Legal address", { placeholder: "Street, city, postcode" })}</div>
        {field("country", "Country", { placeholder: "LV" })}{field("bankName", "Bank name")}
        {field("bankAccountNumber", "Bank account / IBAN")}{field("bankSwiftCode", "SWIFT / BIC")}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Company contact</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        {field("email", "Email", { type: "email" })}{field("phone", "Phone")}
        <div className="sm:col-span-2">{field("website", "Website")}</div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Default signee</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{field("defaultSigneeName", "Name")}{field("defaultSigneeRole", "Role / title")}</CardContent></Card>

      {profile && <Card><CardContent className="pt-6"><CounterpartyDeliveryAddresses organisationId={profile.id} book={book} /></CardContent></Card>}
      {profile && <Card><CardContent className="pt-6"><OrgContactsSection organisationId={profile.id} book={book} onSigneeUpdated={(name, role) => { set("defaultSigneeName", name); set("defaultSigneeRole", role ?? ""); }} /></CardContent></Card>}
    </form>
  );
}
