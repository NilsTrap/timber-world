"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Input,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@timber/ui";
import { Loader2, Pencil, Power, PowerOff, Send, RefreshCw, KeyRound, Star, Search } from "lucide-react";
import { getPeopleDirectory, type DirectoryPerson } from "../actions/getPeopleDirectory";
import {
  toggleUserActive,
  sendUserCredentials,
  resendUserCredentials,
  resetUserPassword,
} from "../actions";
import { PersonEditDialog, type EditablePerson } from "./PersonEditDialog";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusInfo(p: DirectoryPerson): { label: string; variant: "secondary" | "success" | "warning" | "default" } {
  if (!p.isActive) return { label: "Inactive", variant: "secondary" };
  if (p.status === "active") return { label: "Active", variant: "success" };
  if (p.status === "invited") return { label: "Invited", variant: "warning" };
  return { label: "Created", variant: "default" };
}

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * K2 · Person-centric People directory.
 *
 * Every portal user appears ONCE with all their organisations (primary flagged)
 * and their access groups. Search (name/email/phone) + filters (organisation,
 * access group, status). Row actions edit the profile, send/resend/reset
 * credentials, and activate/deactivate — person-level ops using the person's
 * primary org where an org is needed. Admin-only (getPeopleDirectory guards
 * isSuperAdmin); a scoped viewer never reaches this component.
 */
export function PeopleTable() {
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [editPerson, setEditPerson] = useState<EditablePerson | null>(null);
  const [togglePerson, setTogglePerson] = useState<DirectoryPerson | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [credBusyId, setCredBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await getPeopleDirectory();
    if (r.success) setPeople(r.data);
    else setError(r.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Filter option lists derived from the loaded data.
  const orgOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) for (const o of p.orgs) m.set(o.id, `${o.name} (${o.code})`);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [people]);

  const groupOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) for (const g of p.groups) m.set(g.groupId, g.groupName);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q)))
        return false;
      if (orgFilter && !p.orgs.some((o) => o.id === orgFilter)) return false;
      if (groupFilter && !p.groups.some((g) => g.groupId === groupFilter)) return false;
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;
      return true;
    });
  }, [people, search, orgFilter, groupFilter, statusFilter]);

  const credentialAction = (p: DirectoryPerson): "send" | "resend" | "reset" | null => {
    if (!p.isActive) return null;
    if (p.status === "created" && !p.authUserId) return "send";
    if (p.status === "invited" && p.authUserId) return "resend";
    if (p.status === "active" && p.authUserId) return "reset";
    return null;
  };

  const runCredential = async (p: DirectoryPerson) => {
    const action = credentialAction(p);
    if (!action) return;
    const orgId = p.primaryOrgId ?? "";
    setCredBusyId(p.id);
    const r =
      action === "send"
        ? await sendUserCredentials(p.id, orgId)
        : action === "resend"
          ? await resendUserCredentials(p.id, orgId)
          : await resetUserPassword(p.id, orgId);
    setCredBusyId(null);
    if (r.success) {
      toast.success(action === "reset" ? `Reset link sent to ${r.data.email}` : `Invite sent to ${r.data.email}`);
      load();
    } else {
      toast.error(r.error);
    }
  };

  const confirmToggle = async () => {
    if (!togglePerson) return;
    setIsToggling(true);
    const r = await toggleUserActive(togglePerson.id, togglePerson.primaryOrgId ?? "", !togglePerson.isActive);
    setIsToggling(false);
    if (r.success) {
      toast.success(togglePerson.isActive ? "User deactivated" : "User activated");
      setTogglePerson(null);
      load();
    } else {
      toast.error(r.error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Search name, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={selectClass} value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
          <option value="">All organisations</option>
          {orgOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">All access groups</option>
          {groupOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} / {people.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border bg-muted/50 p-8 text-center text-muted-foreground">No people match.</div>
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organisations</TableHead>
                <TableHead>Access groups</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const s = statusInfo(p);
                const action = credentialAction(p);
                // Distinct group names across all orgs (compact display).
                const groupNames = Array.from(new Set(p.groups.map((g) => g.groupName)));
                return (
                  <TableRow key={p.id} className={!p.isActive ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/people/${p.id}`} className="text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-muted-foreground">{p.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.orgs.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {p.orgs.slice(0, 3).map((o) => (
                            <Badge key={o.id} variant={o.isPrimary ? "default" : "secondary"} className="gap-1 text-[10px]">
                              {o.isPrimary && <Star className="h-2.5 w-2.5" />}
                              {o.code}
                            </Badge>
                          ))}
                          {p.orgs.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{p.orgs.length - 3}</Badge>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {groupNames.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {groupNames.slice(0, 2).map((n) => (
                            <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                          ))}
                          {groupNames.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">+{groupNames.length - 2}</Badge>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(p.lastLoginAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setEditPerson({
                              id: p.id,
                              name: p.name,
                              email: p.email,
                              phone: p.phone,
                              primaryOrgId: p.primaryOrgId,
                            })
                          }
                          title="Edit profile"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {action && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => runCredential(p)}
                            disabled={credBusyId === p.id}
                            title={action === "send" ? "Send credentials" : action === "resend" ? "Resend invite" : "Reset password"}
                            aria-label={`Credentials for ${p.name}`}
                          >
                            {credBusyId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : action === "reset" ? (
                              <KeyRound className="h-4 w-4" />
                            ) : action === "resend" ? (
                              <RefreshCw className="h-4 w-4" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setTogglePerson(p)}
                          title={p.isActive ? "Deactivate" : "Activate"}
                          aria-label={p.isActive ? `Deactivate ${p.name}` : `Activate ${p.name}`}
                        >
                          {p.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PersonEditDialog
        person={editPerson}
        open={!!editPerson}
        onOpenChange={(o) => !o && setEditPerson(null)}
        onSuccess={load}
      />

      <AlertDialog open={!!togglePerson} onOpenChange={(o) => !isToggling && !o && setTogglePerson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{togglePerson?.isActive ? "Deactivate user" : "Activate user"}</AlertDialogTitle>
            <AlertDialogDescription>
              {togglePerson?.isActive ? (
                <>Deactivate <strong>{togglePerson?.name}</strong>? They will no longer be able to log in.</>
              ) : (
                <>Activate <strong>{togglePerson?.name}</strong>? They will be able to log in again.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={isToggling}>
              {isToggling ? "Working..." : togglePerson?.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
