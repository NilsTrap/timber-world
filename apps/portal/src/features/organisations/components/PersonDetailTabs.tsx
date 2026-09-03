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
  Power,
  PowerOff,
  Send,
  RefreshCw,
  Building2,
  Star,
  Loader2,
  KeyRound,
} from "lucide-react";
import {
  getPersonById,
  getPersonMemberships,
  toggleUserActive,
  sendUserCredentials,
  resendUserCredentials,
  removeUserFromOrganisation,
  setMembershipActive,
  type PersonDetail,
  type PersonMembership,
} from "../actions";
import { PersonEditDialog, type EditablePerson } from "./PersonEditDialog";
import { PersonApiKeysSection } from "./PersonApiKeysSection";
import { ManualPasswordDialog } from "./ManualPasswordDialog";
import { canManageManualPassword } from "./manualPasswordEligibility";

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
 * (send/resend/reset), activate/deactivate, and their org
 * memberships (add/remove + per-org access groups). Cross-org, so the page is
 * admin-only; membership mutations additionally re-run the K3 scope wall.
 */
export function PersonDetailTabs({ person: initialPerson }: PersonDetailTabsProps) {
  const [person, setPerson] = useState<PersonDetail>(initialPerson);
  const [memberships, setMemberships] = useState<PersonMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);

  // Dialog / confirm state
  const [editOpen, setEditOpen] = useState(false);
  const [removeOrg, setRemoveOrg] = useState<PersonMembership | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState<string | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [credBusy, setCredBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

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
    // Password setting requires the organisation-scoped secure dialog.
    return null;
  }, [person.isActive, person.status, person.authUserId]);

  const runCredential = async () => {
    if (!credentialAction) return;
    const orgId = primaryOrgId ?? "";
    setCredBusy(true);
    const r = credentialAction === "send"
      ? await sendUserCredentials(person.id, orgId)
      : await resendUserCredentials(person.id, orgId);
    setCredBusy(false);
    if (r.success) {
      toast.success(
        `Invite sent to ${r.data.email}`,
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

  const activateMembership = async (membership: PersonMembership) => {
    setMembershipBusy(membership.orgId);
    const r = await setMembershipActive(person.id, membership.orgId, true);
    setMembershipBusy(null);
    if (r.success) {
      toast.success(`Membership reactivated without restoring old access`);
      loadMemberships();
    } else toast.error(r.error);
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

  const credentialLabel = credentialAction === "send" ? "Send credentials" : "Resend invite";
  const CredentialIcon = credentialAction === "resend" ? RefreshCw : Send;
  const passwordOrgId = memberships.find((membership) => membership.isActive && membership.isPrimary)?.orgId
    ?? memberships.find((membership) => membership.isActive)?.orgId ?? null;
  const canSetPassword = canManageManualPassword(person, !!passwordOrgId);

  return (
    <>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organisations">Company</TabsTrigger>
          <TabsTrigger value="api-keys">API keys</TabsTrigger>
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
                {canSetPassword && (
                  <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
                    <KeyRound className="h-4 w-4 mr-1" /> Set password
                  </Button>
                )}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company
              </CardTitle>
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
                    <div key={m.orgId} className={`flex items-center gap-3 rounded-lg border p-3 ${m.isActive ? "" : "opacity-60"}`}>
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
                          <Badge variant={m.isActive ? "success" : "secondary"} className="text-[10px]">
                            {m.isActive ? "Membership active" : "Membership inactive"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.personas.map((persona) => (
                            <Badge key={persona} variant="outline" className="text-[10px]">{persona}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => m.isActive ? setRemoveOrg(m) : activateMembership(m)}
                        disabled={membershipBusy !== null}
                        title={m.isActive ? "Deactivate membership" : "Reactivate membership"}
                        aria-label={`${m.isActive ? "Deactivate" : "Reactivate"} membership in ${m.orgName}`}
                      >
                        {membershipBusy === m.orgId ? <Loader2 className="h-4 w-4 animate-spin" /> : m.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── API keys (Epic T / T1 · super-admin) ────────────────── */}
        <TabsContent value="api-keys" className="mt-4">
          <PersonApiKeysSection
            personId={person.id}
            orgOptions={memberships.map((m) => ({ id: m.orgId, name: m.orgName }))}
          />
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

      <ManualPasswordDialog
        user={passwordOpen ? person : null}
        organisationId={passwordOrgId}
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onSuccess={async () => { await refreshPerson(); await loadMemberships(); }}
      />

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
            <AlertDialogTitle>Deactivate membership</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate <strong>{person.name}</strong>&apos;s membership in <strong>{removeOrg?.orgName}</strong>? Their
              access there is revoked. A primary or only membership cannot be deactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={isRemoving}>
              {isRemoving ? "Deactivating..." : "Deactivate"}
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
