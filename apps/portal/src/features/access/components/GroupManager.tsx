"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Switch,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  StatusBadge,
  SectionHeader,
  EmptyState,
  Card,
  CardContent,
} from "@timber/ui";
import type { AccessGroupSummary } from "../types";
import {
  listAccessGroups,
  createAccessGroup,
  updateAccessGroup,
  deleteAccessGroup,
  getPlatformSetting,
  setPlatformSetting,
} from "../actions";
import { GroupRightsEditor } from "./GroupRightsEditor";

interface NameEditorState {
  /** null = create, else the group being renamed. */
  groupId: string | null;
  name: string;
  description: string;
}

/**
 * GroupManager (E4) — the access-group admin list: create / rename /
 * delete groups and open the per-group rights editor. Groups are global
 * (platform-wide); members get the union of their groups' rights per org.
 */
export function GroupManager() {
  const [groups, setGroups] = useState<AccessGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameEditor, setNameEditor] = useState<NameEditorState | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [rightsGroup, setRightsGroup] = useState<AccessGroupSummary | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<AccessGroupSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listAccessGroups();
    if (res.success) setGroups(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => setNameEditor({ groupId: null, name: "", description: "" });
  const openRename = (g: AccessGroupSummary) =>
    setNameEditor({ groupId: g.id, name: g.name, description: g.description ?? "" });

  const saveName = async () => {
    if (!nameEditor) return;
    const name = nameEditor.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSavingName(true);
    const res = nameEditor.groupId
      ? await updateAccessGroup(nameEditor.groupId, {
          name,
          description: nameEditor.description.trim() || null,
        })
      : await createAccessGroup({ name, description: nameEditor.description.trim() || null });
    setSavingName(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(nameEditor.groupId ? "Group updated" : "Group created");
    setNameEditor(null);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteGroup) return;
    setDeleting(true);
    const res = await deleteAccessGroup(deleteGroup.id);
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Group "${deleteGroup.name}" deleted`);
    setDeleteGroup(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Groups"
        subtitle={`${groups.length} groups — a user's rights are the union of their assigned groups.`}
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Group
          </Button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState message="No access groups yet. Click here to add one." onClick={openCreate} />
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="w-24">System</TableHead>
                <TableHead className="w-24">Members</TableHead>
                <TableHead className="w-64 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <div>
                      {g.name}
                      {g.description && (
                        <p className="text-xs text-muted-foreground font-normal">{g.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{g.key}</TableCell>
                  <TableCell>
                    {g.isSystem ? (
                      <StatusBadge variant="info">System</StatusBadge>
                    ) : (
                      <StatusBadge variant="draft">Custom</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>{g.memberCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setRightsGroup(g)}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Edit rights
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openRename(g)}>
                        <Pencil className="h-3.5 w-3.5" /> Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteGroup(g)}
                        disabled={g.isSystem}
                        title={g.isSystem ? "System groups cannot be deleted" : "Delete group"}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        System groups ship with seeded default rights. Rights edits apply immediately to every
        member — no deploy needed.
      </p>

      {/* Create / rename dialog */}
      <Dialog open={nameEditor != null} onOpenChange={(o) => { if (!o && !savingName) setNameEditor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{nameEditor?.groupId ? "Rename group" : "Add group"}</DialogTitle>
            <DialogDescription>
              {nameEditor?.groupId
                ? "Change the group's display name and description."
                : "Create a new access group, then edit its rights."}
            </DialogDescription>
          </DialogHeader>
          {nameEditor && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="group-name" className="text-xs text-muted-foreground">
                  Name
                </label>
                <Input
                  id="group-name"
                  value={nameEditor.name}
                  onChange={(e) => setNameEditor({ ...nameEditor, name: e.target.value })}
                  placeholder="e.g. Salesperson"
                  disabled={savingName}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="group-description" className="text-xs text-muted-foreground">
                  Description (optional)
                </label>
                <Textarea
                  id="group-description"
                  value={nameEditor.description}
                  onChange={(e) => setNameEditor({ ...nameEditor, description: e.target.value })}
                  placeholder="What this group is for"
                  rows={2}
                  disabled={savingName}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNameEditor(null)} disabled={savingName}>
              Cancel
            </Button>
            <Button onClick={saveName} disabled={savingName}>
              {savingName ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : nameEditor?.groupId ? (
                "Save"
              ) : (
                "Create group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rights editor dialog */}
      <GroupRightsEditor
        groupId={rightsGroup?.id ?? null}
        groupName={rightsGroup?.name ?? ""}
        isSystem={rightsGroup?.isSystem ?? false}
        open={rightsGroup != null}
        onOpenChange={(o) => { if (!o) setRightsGroup(null); }}
        onSaved={load}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteGroup != null}
        onOpenChange={(o) => { if (!o && !deleting) setDeleteGroup(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteGroup?.name}</strong>?
              {deleteGroup != null && deleteGroup.memberCount > 0 && (
                <>
                  <br />
                  <br />
                  {deleteGroup.memberCount} user assignment
                  {deleteGroup.memberCount === 1 ? "" : "s"} will be removed — those users lose this
                  group&apos;s rights immediately.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * AddressBooksCard (E4) — the spec §9.3 platform toggle: whether the
 * Purchasing book may select/see client records. Bound to the
 * purchasing_may_reuse_clients platform setting.
 */
export function AddressBooksCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getPlatformSetting("purchasing_may_reuse_clients");
      if (cancelled) return;
      if (res.success) setEnabled(res.data.value === true);
      else toast.error(res.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (checked: boolean) => {
    setSaving(true);
    setEnabled(checked);
    const res = await setPlatformSetting("purchasing_may_reuse_clients", checked);
    setSaving(false);
    if (!res.success) {
      setEnabled(!checked);
      toast.error(res.error);
      return;
    }
    toast.success("Setting saved");
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <SectionHeader
          title="Address books"
          subtitle="Platform-wide counterparty record settings."
        />
        <div className="flex items-center gap-3">
          <Switch
            id="purchasing-may-reuse-clients"
            checked={enabled}
            onCheckedChange={toggle}
            disabled={loading || saving}
          />
          <label htmlFor="purchasing-may-reuse-clients" className="text-sm">
            Purchasing may reuse client records
          </label>
          {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );
}
