"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import LoginHistorySection from "@/features/audit/components/LoginHistorySection";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@timber/ui";
import {
  User,
  Pencil,
  KeyRound,
  Power,
  PowerOff,
  Send,
  RefreshCw,
  Building2,
  Plus,
  UserMinus,
  Settings2,
  Star,
  Loader2,
} from "lucide-react";
import {
  getPersonById,
  getPersonMemberships,
  toggleUserActive,
  sendUserCredentials,
  resendUserCredentials,
  resetUserPassword,
  removeUserFromOrganisation,
  type PersonDetail,
  type PersonMembership,
} from "../actions";
import type { OrganisationUser } from "../types";
import { PersonEditDialog, type EditablePerson } from "./PersonEditDialog";
import { PersonSetPasswordDialog } from "./PersonSetPasswordDialog";
import { AddPersonToOrgDialog } from "./AddPersonToOrgDialog";
import { UserGroupsDialog } from "./UserGroupsDialog";

interface PersonDetailTabsProps {
  person: PersonDetail;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * K2 + Q4 · Editable person detail.
 *
 * One place to manage a person: profile (name/email/phone), credentials
 * (send/resend/reset + admin set-password), activate/deactivate, and their org
 * memberships (add/remove + per-org access groups). Cross-org, so the page is
 * admin-only; membership mutations additionally re-run the K3 scope wall.
 */
export function PersonDetailTabs({ person: initialPerson }: PersonDetailTabsProps) {
  const [person, setPerson] = useState<PersonDetail>(initialPerson);
  const [memberships, setMemberships] = useState<PersonMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);

  // Dialog / confirm state
  const [editOpen, setEditOpen] = useState(false);
  const [setPwOpen, setSetPwOpen] = useState(false);
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [groupsOrg, setGroupsOrg] = useState<{ id: string; name: string } | null>(null);
  const [removeOrg, setRemoveOrg] = useState<PersonMembership | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [credBusy, setCredBusy] = useState(false);

  const refreshPerson = useCallback(async () => {
    const r = await getPersonById(person.id);
    if (r.success) setPerson(r.data);
  }, [person.id]);

  const loadMemberships = useCallback(async () => {
    setMembershipsLoading(true);
    const r = await getPersonMemberships(person.id);
    if (r.success) setMemberships(r.data);
    else toast.error(r.error);
    setMembershipsLoading(false);
  }, [person.id]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  // The org used for person-level credential/toggle ops: legacy home, else the
  // primary membership, else the first membership.
  const primaryOrgId = useMemo<string | null>(() => {
    if (person.organisationId) return person.organisationId;
    return memberships.find((m) => m.isPrimary)?.orgId ?? memberships[0]?.orgId ?? null;
  }, [person.organisationId, memberships]);

  // Build an OrganisationUser shape for UserGroupsDialog (it uses id + name).
  const orgUserFor = (orgId: string): OrganisationUser => ({
    id: person.id,
    email: person.email,
    name: person.name,
    role: person.role,
    organisationId: orgId,
    authUserId: person.authUserId,
    isActive: person.isActive,
    status: person.status,
    invitedAt: person.invitedAt,
    invitedBy: null,
    invitedByName: null,
    lastLoginAt: person.lastLoginAt,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  });

  const editablePerson: EditablePerson = {
    id: person.id,
    name: person.name,
    email: person.email,
    phone: person.phone,
    primaryOrgId,
  };

  // Credentials: which single action applies to the person's current state.
  const credentialAction = useMemo(() => {
    if (!person.isActive) return null;
    if (person.status === "created" && !person.authUserId) return "send" as const;
    if (person.status === "invited" && person.authUserId) return "resend" as const;
    if (person.status === "active" && person.authUserId) return "reset" as const;
    return null;
  }, [person.isActive, person.status, person.authUserId]);

  const runCredential = async () => {
    if (!credentialAction) return;
    const orgId = primaryOrgId ?? "";
    setCredBusy(true);
    const r =
      credentialAction === "send"
        ? await sendUserCredentials(person.id, orgId)
        : credentialAction === "resend"
          ? await resendUserCredentials(person.id, orgId)
          : await resetUserPassword(person.id, orgId);
    setCredBusy(false);
    if (r.success) {
      toast.success(
        credentialAction === "reset"
          ? `Password reset link sent to ${r.data.email}`
          : `Invite sent to ${r.data.email}`,
      );
      refreshPerson();
    } else {
      toast.error(r.error);
    }
  };

  const confirmToggle = async () => {
    setIsToggling(true);
    const r = await toggleUserActive(person.id, primaryOrgId ?? "", !person.isActive);
    setIsToggling(false);
    if (r.success) {
      toast.success(person.isActive ? "User deactivated" : "User activated");
      setToggleOpen(false);
      refreshPerson();
    } else {
      toast.error(r.error);
    }
  };

  const confirmRemove = async () => {
    if (!removeOrg) return;
    setIsRemoving(true);
    const r = await removeUserFromOrganisation(person.id, removeOrg.orgId);
    setIsRemoving(false);
    if (r.success) {
      toast.success(`Removed from ${removeOrg.orgName}`);
      setRemoveOrg(null);
      loadMemberships();
    } else {
      // Keep the dialog open on a refusal (primary/last org) so the message stays visible.
      toast.error(r.error);
    }
  };

  const statusBadge = (
    <div className="flex items-center gap-2">
      <Badge
        variant={
          !person.isActive
            ? "secondary"
            : person.status === "active"
              ? "success"
              : person.status === "invited"
                ? "warning"
                : "default"
        }
      >
        {!person.isActive ? "Inactive" : person.status === "active" ? "Active" : person.status === "invited" ? "Invited" : "Created"}
      </Badge>
      <Badge variant={person.role === "admin" ? "default" : "secondary"}>
        {person.role === "admin" ? "Super Admin" : "User"}
      </Badge>
    </div>
  );

  const credentialLabel =
    credentialAction === "send" ? "Send credentials" : credentialAction === "resend" ? "Resend invite" : "Reset password";
  const CredentialIcon = credentialAction === "reset" ? RefreshCw : credentialAction === "resend" ? RefreshCw : Send;

  return (
    <>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organisations">Organisations ({memberships.length})</TabsTrigger>
          <TabsTrigger value="login-history">Login history</TabsTrigger>
        </TabsList>

        {/* ── Profile ─────────────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                {credentialAction && (
                  <Button variant="outline" size="sm" onClick={runCredential} disabled={credBusy}>
                    {credBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CredentialIcon className="h-4 w-4 mr-1" />}
                    {credentialLabel}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSetPwOpen(true)}>
                  <KeyRound className="h-4 w-4 mr-1" /> Set password
                </Button>
                <Button variant="outline" size="sm" onClick={() => setToggleOpen(true)}>
                  {person.isActive ? <PowerOff className="h-4 w-4 mr-1" /> : <Power className="h-4 w-4 mr-1" />}
                  {person.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Name" value={person.name} />
                <Field label="Email" value={person.email} />
                <Field label="Phone" value={person.phone || "—"} />
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <div className="mt-1">{statusBadge}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t pt-4">
                <Field label="Last login" value={formatDateTime(person.lastLoginAt)} />
                <Field label="Invited" value={formatDateTime(person.invitedAt)} />
                <Field label="Created" value={formatDateTime(person.createdAt)} />
                <Field label="Updated" value={formatDateTime(person.updatedAt)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Organisations ───────────────────────────────────────── */}
        <TabsContent value="organisations" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organisations
              </CardTitle>
              <Button size="sm" onClick={() => setAddOrgOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add to organisation
              </Button>
            </CardHeader>
            <CardContent>
              {membershipsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : memberships.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  This person belongs to no organisation.
                </p>
              ) : (
                <div className="space-y-2">
                  {memberships.map((m) => (
                    <div key={m.orgId} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/organisations/${m.orgId}`}
                            className="text-sm font-medium text-primary hover:underline truncate"
                          >
                            {m.orgName}
                          </Link>
                          <span className="font-mono text-xs text-muted-foreground">{m.orgCode}</span>
                          {m.isPrimary && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Star className="h-3 w-3" /> Primary
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.groups.length > 0 ? (
                            m.groups.map((g) => (
                              <Badge key={g.groupId} variant="secondary" className="text-[10px]">
                                {g.groupName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No access groups</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setGroupsOrg({ id: m.orgId, name: m.orgName })}
                        title="Manage access groups"
                      >
                        <Settings2 className="h-4 w-4 mr-1" /> Groups
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRemoveOrg(m)}
                        title="Remove from this organisation"
                        aria-label={`Remove from ${m.orgName}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Login history (slot wired by the orchestrator) ──────── */}
        <TabsContent value="login-history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Login history</CardTitle>
            </CardHeader>
            <CardContent>
              <LoginHistorySection userId={person.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PersonEditDialog
        person={editOpen ? editablePerson : null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={refreshPerson}
      />

      <PersonSetPasswordDialog
        personId={person.id}
        personName={person.name}
        hasAuthUser={!!person.authUserId}
        open={setPwOpen}
        onOpenChange={setSetPwOpen}
      />

      <AddPersonToOrgDialog
        personId={person.id}
        personName={person.name}
        open={addOrgOpen}
        onOpenChange={setAddOrgOpen}
        onSuccess={loadMemberships}
      />

      {groupsOrg && (
        <UserGroupsDialog
          user={orgUserFor(groupsOrg.id)}
          organisationId={groupsOrg.id}
          open={!!groupsOrg}
          onOpenChange={(open) => !open && setGroupsOrg(null)}
          onSuccess={loadMemberships}
        />
      )}

      {/* Toggle active confirm */}
      <AlertDialog open={toggleOpen} onOpenChange={(o) => !isToggling && setToggleOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{person.isActive ? "Deactivate user" : "Activate user"}</AlertDialogTitle>
            <AlertDialogDescription>
              {person.isActive ? (
                <>Deactivate <strong>{person.name}</strong>? They will no longer be able to log in.</>
              ) : (
                <>Activate <strong>{person.name}</strong>? They will be able to log in again.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={isToggling}>
              {isToggling ? "Working..." : person.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove-from-org confirm */}
      <AlertDialog open={!!removeOrg} onOpenChange={(o) => !isRemoving && !o && setRemoveOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from organisation</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{person.name}</strong> from <strong>{removeOrg?.orgName}</strong>? Their
              membership and access groups there are revoked. Their primary or only organisation cannot
              be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={isRemoving}>
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-muted-foreground">{children}</label>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <p className="text-sm mt-1 break-words">{value}</p>
    </div>
  );
}
