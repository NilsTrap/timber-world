"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Input,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@timber/ui";
import {
  getGroupMembers, setUserGroupMembership, addUserToGroup, listAssignableUsers,
  type GroupMember,
} from "../actions/groups";

interface AssignableUser { id: string; email: string; name: string; role: string }

/**
 * I2 · Manage an access group's members FROM THE GROUP SIDE (the twin of the
 * People tab's per-user "Groups" action — both write the same user_access_groups
 * rows via setUserGroupMembership / addUserToGroup, so the two views always
 * agree). List current members, remove one, and add a user (their org is
 * resolved automatically; multi-org users are assigned from their People row).
 */
export function GroupMembersDialog({
  groupId,
  groupName,
  open,
  onOpenChange,
  onChanged,
}: {
  groupId: string | null;
  groupName: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssignableUser[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    const res = await getGroupMembers(groupId);
    setLoading(false);
    if (res.success) setMembers(res.data);
    else toast.error(res.error);
  }, [groupId]);

  useEffect(() => {
    if (open && groupId) {
      // Reset the add-member search so a previous group's results don't carry
      // over (the dialog is a single persistent instance across groups).
      setQuery("");
      setResults([]);
      setSearching(false);
      load();
    }
  }, [open, groupId, load]);

  const runSearch = useCallback(async () => {
    setSearching(true);
    const res = await listAssignableUsers(query);
    setSearching(false);
    if (res.success) setResults(res.data);
    else toast.error(res.error);
  }, [query]);

  const remove = useCallback(async (m: GroupMember) => {
    if (!groupId) return;
    const key = `${m.userId}:${m.organisationId}`;
    setBusyKey(key);
    const res = await setUserGroupMembership(m.userId, m.organisationId, groupId, false);
    setBusyKey(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Member removed");
    await load();
    onChanged();
  }, [groupId, load, onChanged]);

  const add = useCallback(async (u: AssignableUser) => {
    if (!groupId) return;
    setBusyKey(u.id);
    const res = await addUserToGroup(u.id, groupId);
    setBusyKey(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`${u.name} added`);
    await load();
    onChanged();
  }, [groupId, load, onChanged]);

  const memberIds = new Set(members.map((m) => m.userId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Members — {groupName ?? "group"}</DialogTitle>
          <DialogDescription>Users in this group get its rights in the assigned organisation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current members</p>
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</span>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet. Add one below, or from a user&apos;s Groups action on the People tab.</p>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => {
                  const key = `${m.userId}:${m.organisationId}`;
                  return (
                    <li key={key} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                      <span>{m.userName} <span className="text-muted-foreground">· {m.orgName}</span></span>
                      <Button variant="ghost" size="icon-sm" onClick={() => remove(m)} disabled={busyKey === key} aria-label={`Remove ${m.userName}`}>
                        {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add a member</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="Search users by name or email…" className="h-9 pl-8" />
              </div>
              <Button variant="outline" size="sm" onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            {results.length > 0 && (
              <ul className="mt-1 space-y-1">
                {results.map((u) => {
                  const already = memberIds.has(u.id);
                  return (
                    <li key={u.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span>{u.name} <span className="text-muted-foreground">· {u.email}</span></span>
                      {already ? (
                        <span className="text-xs text-muted-foreground">Member</span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => add(u)} disabled={busyKey === u.id}>
                          {busyKey === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
