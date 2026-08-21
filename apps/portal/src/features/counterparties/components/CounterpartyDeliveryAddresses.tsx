"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Checkbox, Input, Label } from "@timber/ui";
import { deleteDeliveryAddress, getDeliveryAddresses, saveDeliveryAddress } from "@/features/organisations/actions";
import type { DeliveryAddress } from "@/features/organisations/types";
import type { CounterpartyBook } from "../types";

type AddressDraft = Omit<DeliveryAddress, "organisationId">;
const emptyDraft = (): AddressDraft => ({ id: "", label: "", address: "", contactName: "", contactPhone: "", contactHours: "", isDefault: false });

export function CounterpartyDeliveryAddresses({
  organisationId,
  book,
  readOnly = false,
}: {
  organisationId: string;
  book: CounterpartyBook;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AddressDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDeliveryAddresses(organisationId, book);
    if (result.success) setRows(result.data);
    else toast.error(result.error);
    setLoading(false);
  }, [book, organisationId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!draft?.label.trim() || !draft.address.trim()) {
      toast.error("Label and address are required");
      return;
    }
    setSaving(true);
    const result = await saveDeliveryAddress(organisationId, {
      id: draft.id || undefined,
      label: draft.label,
      address: draft.address,
      contactName: draft.contactName,
      contactPhone: draft.contactPhone,
      contactHours: draft.contactHours,
      isDefault: draft.isDefault,
    }, book);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(draft.id ? "Delivery address updated" : "Delivery address added");
    setDraft(null);
    await load();
  };

  const remove = async (row: DeliveryAddress) => {
    if (!window.confirm(`Delete delivery address “${row.label}”?`)) return;
    const result = await deleteDeliveryAddress(organisationId, row.id, book);
    if (!result.success) return toast.error(result.error);
    toast.success("Delivery address deleted");
    await load();
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><p className="font-medium">Delivery addresses</p><p className="text-sm text-muted-foreground">Up to two saved destinations</p></div>
        {!readOnly && !draft && rows.length < 2 && <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft())}><Plus className="h-4 w-4" /> Add address</Button>}
      </div>
      {rows.length === 0 && !draft ? <p className="text-sm text-muted-foreground">No delivery addresses added.</p> : rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div><div className="font-medium">{row.label}{row.isDefault ? <span className="ml-2 text-xs text-muted-foreground">Default</span> : null}</div><p className="text-sm">{row.address}</p><p className="text-xs text-muted-foreground">{[row.contactName, row.contactPhone, row.contactHours].filter(Boolean).join(" · ") || "No delivery contact"}</p></div>
          {!readOnly && <div className="flex gap-1"><Button variant="ghost" size="icon-sm" onClick={() => setDraft({ ...row })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon-sm" onClick={() => void remove(row)}><Trash2 className="h-4 w-4" /></Button></div>}
        </div>
      ))}
      {draft && <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="delivery-label">Label</Label><Input id="delivery-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Main warehouse" /></div><div><Label htmlFor="delivery-contact">Contact name</Label><Input id="delivery-contact" value={draft.contactName ?? ""} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} /></div></div>
        <div><Label htmlFor="delivery-address">Address</Label><Input id="delivery-address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="delivery-phone">Phone</Label><Input id="delivery-phone" value={draft.contactPhone ?? ""} onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })} /></div><div><Label htmlFor="delivery-hours">Hours</Label><Input id="delivery-hours" value={draft.contactHours ?? ""} onChange={(e) => setDraft({ ...draft, contactHours: e.target.value })} /></div></div>
        <div className="flex items-center gap-2"><Checkbox id="delivery-default" checked={draft.isDefault} onCheckedChange={(checked) => setDraft({ ...draft, isDefault: checked === true })} /><Label htmlFor="delivery-default" className="font-normal">Default address</Label></div>
        <div className="flex gap-2"><Button size="sm" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save address"}</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button></div>
      </div>}
    </div>
  );
}
