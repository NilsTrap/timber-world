"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  Button, Input, Switch,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  StatusBadge, SectionHeader, EmptyState,
} from "@timber/ui";
import { listCounterparties, createCounterparty, updateCounterparty } from "../actions";
import type { CounterpartyBook, CounterpartyRow } from "../types";

const BOOK_LABELS: Record<CounterpartyBook, { title: string; record: string }> = {
  clients: { title: "Clients", record: "client" },
  suppliers: { title: "Suppliers", record: "supplier" },
};

interface EditorState {
  /** Null when creating a new record. */
  id: string | null;
  code: string;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  legalAddress: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  isActive: boolean;
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  code: "",
  name: "",
  registrationNumber: "",
  vatNumber: "",
  legalAddress: "",
  country: "",
  email: "",
  phone: "",
  website: "",
  isActive: true,
};

/**
 * Counterparty address-book manager (E4, spec §9.3): self-loading list of one
 * book's records (clients or suppliers) with a Dialog editor for add/edit.
 * Codes are 3-letter, uppercase, immutable after creation. Mirrors the
 * GateConfigManager pattern.
 */
export function CounterpartyManager({ book }: { book: CounterpartyBook }) {
  const [rows, setRows] = useState<CounterpartyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const labels = BOOK_LABELS[book];

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listCounterparties(book);
    if (res.success) setRows(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [book]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => setEditor({ ...EMPTY_EDITOR });
  const openEdit = (r: CounterpartyRow) =>
    setEditor({
      id: r.id,
      code: r.code,
      name: r.name,
      registrationNumber: r.registrationNumber ?? "",
      vatNumber: r.vatNumber ?? "",
      legalAddress: r.legalAddress ?? "",
      country: r.country ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      website: r.website ?? "",
      isActive: r.isActive,
    });

  const set = (patch: Partial<EditorState>) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async () => {
    if (!editor) return;
    if (!editor.id && !/^[A-Z]{3}$/.test(editor.code)) {
      toast.error("Code must be exactly 3 letters (A–Z)");
      return;
    }
    if (editor.name.trim() === "") {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const card = {
      name: editor.name,
      registrationNumber: editor.registrationNumber,
      vatNumber: editor.vatNumber,
      legalAddress: editor.legalAddress,
      country: editor.country,
      email: editor.email,
      phone: editor.phone,
      website: editor.website,
    };
    const res = editor.id
      ? await updateCounterparty(book, editor.id, { ...card, isActive: editor.isActive })
      : await createCounterparty(book, { ...card, code: editor.code });
    setSaving(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(editor.id ? `${labels.title} record updated` : `${labels.title} record created`);
    setEditor(null);
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={labels.title}
        subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
        action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Add {labels.record}</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState message={`No ${labels.record} records yet. Click here to add one.`} onClick={openNew} />
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Reg No</TableHead>
                <TableHead>VAT</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.isActive ? "" : "opacity-50"}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.registrationNumber ?? "—"}</TableCell>
                  <TableCell>{r.vatNumber ?? "—"}</TableCell>
                  <TableCell>{r.country ?? "—"}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge variant={r.isActive ? "success" : "draft"}>
                      {r.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editor != null} onOpenChange={(o) => { if (!o) setEditor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.id ? `Edit ${labels.record}` : `Add ${labels.record}`}</DialogTitle>
            <DialogDescription>
              {editor?.id
                ? "Edit the company card. The 3-letter code is permanent."
                : "Create a record with a unique 3-letter code and company card."}
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-code">Code</label>
                  <Input
                    id="cp-code"
                    value={editor.code}
                    onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                    placeholder="ABC"
                    maxLength={3}
                    disabled={editor.id != null}
                    className="uppercase"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-name">Name</label>
                  <Input id="cp-name" value={editor.name} onChange={(e) => set({ name: e.target.value })} placeholder="Company name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-reg">Registration number</label>
                  <Input id="cp-reg" value={editor.registrationNumber} onChange={(e) => set({ registrationNumber: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-vat">VAT number</label>
                  <Input id="cp-vat" value={editor.vatNumber} onChange={(e) => set({ vatNumber: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="cp-address">Legal address</label>
                <Input id="cp-address" value={editor.legalAddress} onChange={(e) => set({ legalAddress: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-country">Country</label>
                  <Input id="cp-country" value={editor.country} onChange={(e) => set({ country: e.target.value })} placeholder="e.g. LV" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-website">Website</label>
                  <Input id="cp-website" value={editor.website} onChange={(e) => set({ website: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-email">Email</label>
                  <Input id="cp-email" type="email" value={editor.email} onChange={(e) => set({ email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="cp-phone">Phone</label>
                  <Input id="cp-phone" value={editor.phone} onChange={(e) => set({ phone: e.target.value })} />
                </div>
              </div>

              {editor.id != null && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={editor.isActive} onCheckedChange={(c) => set({ isActive: c })} id="cp-active" />
                  <label htmlFor="cp-active" className="text-sm">Active</label>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditor(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editor?.id ? "Save changes" : "Create record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
