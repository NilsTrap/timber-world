"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { UserPlus, Loader2 } from "lucide-react";
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  StatusBadge,
} from "@timber/ui";
import { getOrganisationUsers } from "@/features/organisations/actions";
import type { OrganisationUser } from "@/features/organisations/types";

// AddUserDialog (K3 one-pass flow, ~340 LOC) only mounts once the user clicks
// "Add person" — keep it out of the CRM card's initial bundle.
const AddUserDialog = dynamic(
  () => import("@/features/organisations/components/AddUserDialog").then((m) => m.AddUserDialog),
  { ssr: false },
);

function statusBadge(u: OrganisationUser): { label: string; variant: "success" | "warning" | "draft" | "info" } {
  if (!u.isActive) return { label: "Inactive", variant: "draft" };
  if (u.status === "invited") return { label: "Invited", variant: "warning" };
  if (u.status === "active") return { label: "Active", variant: "success" };
  return { label: "Created", variant: "info" };
}

/**
 * Q3 · CRM card Users section for ONE organisation. Sits below the K1 Contacts
 * section in the CounterpartyManager dialog editor. Mirrors OrgContactsSection's
 * shape (self-loading list + add action) but for portal USERS rather than
 * lightweight CRM contacts.
 *
 * The existing-user LIST comes from getOrganisationUsers, which is super-admin
 * only — a scoped salesperson/purchasing caller gets FORBIDDEN and simply sees
 * no list (handled silently). The "Add person" action mounts the same K3
 * `AddUserDialog`, whose scope (admin full picker / sales→forced Client group /
 * purchasing→forced Producer group / trader→admin-only) is enforced ENTIRELY
 * server-side by the Q2 wall — this section adds no new capability, it is just
 * another entry point.
 */
export function CrmOrgUsersSection({
  organisationId,
  onChanged,
}: {
  organisationId: string;
  /** Called after a person is added so the host can refresh the book's Users count. */
  onChanged?: () => void;
}) {
  const [users, setUsers] = useState<OrganisationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [canList, setCanList] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getOrganisationUsers(organisationId, { includeInactive: true });
    if (res.success) {
      setUsers(res.data);
      setCanList(true);
    } else {
      // Non-admin (scoped) callers cannot read the roster — hide it silently
      // rather than toast; the Add person action still works via the wall.
      setUsers([]);
      setCanList(false);
    }
    setLoading(false);
  }, [organisationId]);

  useEffect(() => {
    load();
  }, [load]);

  const onAdded = () => {
    if (canList) load();
    onChanged?.();
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Users</p>
          <p className="text-xs text-muted-foreground">
            {canList
              ? `${users.length} user${users.length === 1 ? "" : "s"} with portal access`
              : "People with portal access"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Add person
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !canList ? (
        <p className="text-sm text-muted-foreground">
          Add a person to give them portal access to this organisation.
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const s = statusBadge(u);
                return (
                  <TableRow key={u.id} className={u.isActive ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <StatusBadge variant={s.variant}>{s.label}</StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AddUserDialog
        organisationId={organisationId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={onAdded}
      />
    </div>
  );
}
