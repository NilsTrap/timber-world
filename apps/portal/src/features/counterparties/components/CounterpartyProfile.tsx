"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, Loader2, Pencil, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@timber/ui";
import { removeCounterparty } from "../actions";
import type { CounterpartyBook, CounterpartyProfile as Profile } from "../types";

const shown = (value: string | null | undefined) => value?.trim() || "Not provided";
function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className={value?.trim() ? "font-medium" : "text-muted-foreground"}>{shown(value)}</dd></div>;
}

export function CounterpartyProfile({ book, profile }: { book: CounterpartyBook; profile: Profile }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const base = `/counterparties/${book}`;
  const hardDelete = profile.accessMode === "admin";

  const remove = async () => {
    const warning = hardDelete
      ? `Permanently delete “${profile.name}”? This is blocked when shipments still reference it.`
      : `Remove “${profile.name}” from this company book? The shared organisation record will remain.`;
    if (!window.confirm(warning)) return;
    setRemoving(true);
    const result = await removeCounterparty(book, profile.id);
    setRemoving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(result.data.removed === "deleted" ? "Company deleted" : "Company removed from your book");
    router.push(base);
    router.refresh();
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="flex items-start gap-3"><Button variant="ghost" size="icon-sm" asChild><Link aria-label="Back to companies" href={base}><ArrowLeft className="h-4 w-4" /></Link></Button><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1><Badge variant={profile.isActive ? "success" : "secondary"}>{profile.isActive ? "Active" : "Inactive"}</Badge></div><p className="font-mono text-muted-foreground">{profile.code}</p></div></div>
      {profile.canManage && <div className="flex gap-2"><Button variant="outline" asChild><Link href={`${base}/${profile.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link></Button><Button variant="destructive" disabled={removing} onClick={() => void remove()}>{removing ? <Loader2 className="h-4 w-4 animate-spin" /> : hardDelete ? <Trash2 className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}{hardDelete ? "Delete" : "Remove"}</Button></div>}
    </div>

    <Card><CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
      <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-lg border bg-muted/20">{profile.logoUrl ? <img src={profile.logoUrl} alt={`${profile.name} logo`} className="max-h-20 max-w-32 object-contain" /> : <Building2 className="h-10 w-10 text-muted-foreground" />}</div>
      <dl className="grid flex-1 gap-4 sm:grid-cols-3"><Detail label="Legal company name" value={profile.name} /><Detail label="Company code" value={profile.code} /><Detail label="Profile access" value={profile.accessMode === "self" ? "Own company (read-only)" : profile.accessMode === "manager" ? "Trading partner" : "Platform administrator"} /></dl>
    </CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Legal details</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Detail label="Legal address" value={profile.legalAddress} /></div><Detail label="Registration number" value={profile.registrationNumber} /><Detail label="VAT number" value={profile.vatNumber} /><Detail label="Country" value={profile.country} /></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>Invoice and bank details</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2"><Detail label="Bank" value={profile.bankName} /><Detail label="Account / IBAN" value={profile.bankAccountNumber} /><Detail label="SWIFT / BIC" value={profile.bankSwiftCode} /></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>Company contact</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2"><Detail label="Email" value={profile.email} /><Detail label="Phone" value={profile.phone} /><div className="sm:col-span-2"><Detail label="Website" value={profile.website} /></div></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>Default signee</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2"><Detail label="Name" value={profile.defaultSigneeName} /><Detail label="Role / title" value={profile.defaultSigneeRole} /></dl></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Delivery addresses</CardTitle></CardHeader><CardContent className="space-y-3">{profile.deliveryAddresses.length === 0 ? <p className="text-sm text-muted-foreground">No delivery addresses provided.</p> : profile.deliveryAddresses.map((address) => <div key={address.id} className="rounded-lg border p-3"><div className="font-medium">{address.label}{address.isDefault ? <span className="ml-2 text-xs text-muted-foreground">Default</span> : null}</div><p className="text-sm">{address.address}</p><p className="text-xs text-muted-foreground">{[address.contactName, address.contactPhone, address.contactHours].filter(Boolean).join(" · ") || "No delivery contact provided"}</p></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle>Contacts</CardTitle></CardHeader><CardContent className="space-y-3">{profile.contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts provided.</p> : profile.contacts.map((contact) => <div key={contact.id} className={contact.isActive ? "rounded-lg border p-3" : "rounded-lg border p-3 opacity-50"}><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{contact.name}</span>{contact.isPrimary ? <Badge variant="success">Primary</Badge> : null}</div><p className="text-sm text-muted-foreground">{shown(contact.roleTitle)}</p><p className="text-sm">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details provided"}</p></div>)}</CardContent></Card>
  </div>;
}
