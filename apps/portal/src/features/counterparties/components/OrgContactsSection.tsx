"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Star, PenLine } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Checkbox,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  StatusBadge,
} from "@timber/ui";
import {
  listOrgContacts,
  createOrgContact,
  updateOrgContact,
  deleteOrgContact,
  setPrimaryContact,
  useContactAsSignee,
} from "../actions";
import type { OrgContactRow } from "../contactTypes";
import type { CounterpartyBook } from "../types";

interface FormState {
  /** Null when adding a new contact. */
  id: string | null;
  name: string;
  roleTitle: string;
  email: string;
  phone: string;
  notes: string;
  isPrimary: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  roleTitle: "",
  email: "",
  phone: "",
  notes: "",
  isPrimary: false,
  isActive: true,
};

/**
 * K1 · CRM contacts for one organisation. Self-loading list with an inline
 * add/edit form (kept inline rather than a nested modal so it composes inside
 * the CRM card dialog). Reused read-only on the admin org-detail page.
 *
 * `onSigneeUpdated` lets the host (the CRM card) keep its open signee fields in
 * sync when "Use as signee" writes organisations.default_signee_*.
 */
export function OrgContactsSection({
  organisationId,
  readOnly = false,
  book,
  onSigneeUpdated,
}: {
  organisationId: string;
  readOnly?: boolean;
  book?: CounterpartyBook;
  onSigneeUpdated?: (name: string, role: string | null) => void;
}) {
  const [rows, setRows] = useState<OrgContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listOrgContacts(organisationId, { book });
    if (res.success) setRows(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [book, organisationId]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => setForm({ ...EMPTY_FORM });
  const openEdit = (c: OrgContactRow) =>
    setForm({
      id: c.id,
      name: c.name,
      roleTitle: c.roleTitle ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
      isPrimary: c.isPrimary,
      isActive: c.isActive,
    });
  const set = (patch: Partial<FormState>) => setForm((p) => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!form) return;
    if (form.name.trim() === "") {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const card = {
      name: form.name,
      roleTitle: form.roleTitle,
      email: form.email,
      phone: form.phone,
      notes: form.notes,
    };
    const res = form.id
      ? await updateOrgContact(form.id, { ...card, isActive: form.isActive }, book)
      : await createOrgContact(organisationId, { ...card, isPrimary: form.isPrimary }, book);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "Contact updated" : "Contact added");
    setForm(null);
    await load();
  };

  const makePrimary = async (c: OrgContactRow) => {
    setBusyId(c.id);
    const res = await setPrimaryContact(c.id, book);
    setBusyId(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`${c.name} is now the primary contact`);
    await load();
  };

  const asSignee = async (c: OrgContactRow) => {
    setBusyId(c.id);
    const res = await useContactAsSignee(organisationId, c.id, book);
    setBusyId(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`${c.name} set as default signee`);
    onSigneeUpdated?.(res.data.signeeName, res.data.signeeRole);
  };

  const remove = async (c: OrgContactRow) => {
    if (!window.confirm(`Delete contact "${c.name}"? This cannot be undone.`)) return;
    setBusyId(c.id);
    const res = await deleteOrgContact(c.id, book);
    setBusyId(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact deleted");
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Read-only variant (admin org detail) ─────────────────────────────────
  if (readOnly) {
    if (rows.length === 0) {
      return <p className="text-sm text-muted-foreground">No contacts added yet.</p>;
    }
    return (
      <div className="rounded-lg border">
        <Table dense>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-20">Primary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className={c.isActive ? "" : "opacity-50"}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.roleTitle ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>
                  {c.isPrimary ? <StatusBadge variant="success">Primary</StatusBadge> : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // ── Editable variant (CRM card) ──────────────────────────────────────────
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Contacts</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} contact{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        {!form && (
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add contact
          </Button>
        )}
      </div>

      {/* Inline add/edit form */}
      {form && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="oc-name">Name</label>
              <Input id="oc-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="oc-role">Role / title</label>
              <Input id="oc-role" value={form.roleTitle} onChange={(e) => set({ roleTitle: e.target.value })} placeholder="e.g. Purchasing manager" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="oc-email">Email</label>
              <Input id="oc-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="oc-phone">Phone</label>
              <Input id="oc-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="oc-notes">Notes</label>
            <Textarea id="oc-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
          </div>
          {form.id == null ? (
            <div className="flex items-center gap-2">
              <Checkbox id="oc-primary" checked={form.isPrimary} onCheckedChange={(c) => set({ isPrimary: c === true })} />
              <Label htmlFor="oc-primary" className="text-sm font-normal">Set as primary contact</Label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Checkbox id="oc-active" checked={form.isActive} onCheckedChange={(c) => set({ isActive: c === true })} />
              <Label htmlFor="oc-active" className="text-sm font-normal">Active</Label>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? "Save contact" : "Add contact"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Contacts table */}
      {rows.length === 0 ? (
        !form && <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-16">Primary</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className={c.isActive ? "" : "opacity-50"}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.roleTitle ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {c.isPrimary ? <StatusBadge variant="success">Primary</StatusBadge> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {!c.isPrimary && (
                        <Button variant="ghost" size="icon-sm" title="Make primary" disabled={busyId === c.id} onClick={() => makePrimary(c)}>
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" title="Use as signee" disabled={busyId === c.id} onClick={() => asSignee(c)}>
                        <PenLine className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Delete" disabled={busyId === c.id} onClick={() => remove(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
