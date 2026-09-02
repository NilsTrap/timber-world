"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  Power,
  PowerOff,
  Plus,
  Loader2,
  Send,
  RefreshCw,
  KeyRound,
  UserMinus,
  Star,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@timber/ui";
import {
  getOrganisationUsers,
  toggleUserActive,
  sendUserCredentials,
  resendUserCredentials,
  resetUserPassword,
  removeUserFromOrganisation,
  setMembershipActive,
  setPrimaryMembership,
} from "../actions";
import dynamic from "next/dynamic";
import type { OrganisationUser } from "../types";
import { generateTemporaryPassword } from "@/lib/utils/generatePassword";

// AddUserDialog only mounts when the admin clicks the corresponding action.
const AddUserDialog = dynamic(
  () => import("./AddUserDialog").then((mod) => mod.AddUserDialog),
  { ssr: false },
);
import { EditUserDialog } from "./EditUserDialog";

type SortColumn = "name" | "email" | "status" | "lastLoginAt";
type SortDirection = "asc" | "desc";

interface OrganisationUsersTableProps {
  organisationId: string;
}

/**
 * Format date for display (European format)
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get display status for a user
 * Status flow: Created → Invited → Active
 */
function getDisplayStatus(user: OrganisationUser): {
  label: string;
  variant: "default" | "secondary" | "success" | "warning" | "destructive";
} {
  if (!user.isActive) {
    return { label: "Inactive account", variant: "secondary" };
  }
  if (user.membershipActive === false) return { label: "Inactive membership", variant: "secondary" };
  if (user.status === "created") {
    return { label: "Created", variant: "default" };
  }
  if (user.status === "invited") {
    return { label: "Invited", variant: "warning" };
  }
  return { label: "Active", variant: "success" };
}

/**
 * Sort Indicator Component
 */
function SortIndicator({
  column,
  sortColumn,
  sortDirection,
}: {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) {
    return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
  }
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  );
}

/**
 * Organisation Users Table
 *
 * Displays all users in an organisation with CRUD actions.
 */
export function OrganisationUsersTable({ organisationId }: OrganisationUsersTableProps) {
  const [users, setUsers] = useState<OrganisationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OrganisationUser | null>(null);

  // Sorting state - default to alphabetical by name
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Deactivate/Activate confirmation state
  const [toggleUser, setToggleUser] = useState<OrganisationUser | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Delete confirmation state

  // Remove-from-organisation confirmation state (K3)
  const [removeUser, setRemoveUser] = useState<OrganisationUser | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Send/Resend credentials state
  const [sendingCredentialsFor, setSendingCredentialsFor] = useState<string | null>(null);
  const [resendingCredentialsFor, setResendingCredentialsFor] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<OrganisationUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const resetSubmittingRef = useRef(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    const result = await getOrganisationUsers(organisationId, { includeInactive: true });
    if (result.success) {
      setUsers(result.data);
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  }, [organisationId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Sort users based on current sort state
  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "email":
          comparison = a.email.localeCompare(b.email);
          break;
        case "status": {
          // Sort by combined status: Active > Invited > Created > Inactive
          const statusA = getDisplayStatus(a);
          const statusB = getDisplayStatus(b);
          const order = { Active: 0, Invited: 1, Created: 2, Inactive: 3 };
          comparison = (order[statusA.label as keyof typeof order] ?? 4) - (order[statusB.label as keyof typeof order] ?? 4);
          break;
        }
        case "lastLoginAt": {
          // NULL dates go to the end
          const dateA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
          const dateB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [users, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Handle toggle active status
  const handleToggleActive = (user: OrganisationUser) => {
    setToggleUser(user);
  };

  // Confirm toggle active
  const confirmToggleActive = async () => {
    if (!toggleUser) return;

    setIsToggling(true);
    const newActive = !toggleUser.isActive;
    const result = await toggleUserActive(toggleUser.id, organisationId, newActive);

    if (result.success) {
      toast.success(newActive ? "User activated" : "User deactivated");
      loadUsers();
    } else {
      toast.error(result.error);
    }

    setIsToggling(false);
    setToggleUser(null);
  };

  const handleEdit = (user: OrganisationUser) => {
    setEditingUser(user);
  };

  // Handle send credentials (first time - no auth_user_id yet)
  const handleSendCredentials = async (user: OrganisationUser) => {
    setSendingCredentialsFor(user.id);

    const result = await sendUserCredentials(user.id, organisationId);

    if (result.success) {
      toast.success(`Invite sent to ${result.data.email}. They will receive an email to set their password.`);
      loadUsers();
    } else {
      toast.error(result.error);
    }

    setSendingCredentialsFor(null);
  };

  // Handle resend credentials (invited users who already have auth_user_id)
  const handleResendCredentials = async (user: OrganisationUser) => {
    setResendingCredentialsFor(user.id);

    const result = await resendUserCredentials(user.id, organisationId);

    if (result.success) {
      toast.success(`New invite sent to ${result.data.email}`);
      loadUsers();
    } else {
      toast.error(result.error);
    }

    setResendingCredentialsFor(null);
  };

  // Handle reset password (active users)
  const clearResetDialog = () => {
    setResetUser(null);
    setResetPassword("");
    setResetConfirmation("");
    setResetError(null);
    setShowResetPassword(false);
  };

  const handleResetPassword = async () => {
    if (!resetUser || resetSubmittingRef.current) return;
    if (resetPassword.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }
    if (resetPassword !== resetConfirmation) {
      setResetError("Passwords do not match");
      return;
    }

    resetSubmittingRef.current = true;
    setIsResettingPassword(true);
    try {
      setResetError(null);
      const result = await resetUserPassword(resetUser.id, organisationId, {
        password: resetPassword,
        confirmation: resetConfirmation,
      });
      if (result.success) {
        toast.success("Password updated");
        clearResetDialog();
        loadUsers();
      } else {
        setResetError(result.error);
      }
    } catch {
      setResetError("Password could not be updated; try again");
    } finally {
      resetSubmittingRef.current = false;
      setIsResettingPassword(false);
    }
  };

  const copyResetPassword = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(resetPassword);
      toast.success("Password copied");
    } catch {
      toast.error("Password could not be copied");
    }
  };

  // Confirm remove-from-organisation (deactivates the membership; refuses the
  // user's last/primary org — the server is the wall).
  const confirmRemoveUser = async () => {
    if (!removeUser) return;

    setIsRemoving(true);
    const result = await removeUserFromOrganisation(removeUser.id, organisationId);

    if (result.success) {
      toast.success(`"${removeUser.name}" removed from this organisation`);
      setRemoveUser(null);
      loadUsers();
    } else {
      // Keep the dialog open on a refusal (e.g. primary/last org) so the message
      // stays visible and the admin can act on it.
      toast.error(result.error);
    }

    setIsRemoving(false);
  };

  const reactivateMembership = async (user: OrganisationUser) => {
    setIsRemoving(true);
    const result = await setMembershipActive(user.id, organisationId, true);
    setIsRemoving(false);
    if (result.success) {
      toast.success(`"${user.name}" reactivated without restoring old access`);
      loadUsers();
    } else toast.error(result.error);
  };

  const makePrimaryMembership = async (user: OrganisationUser) => {
    const result = await setPrimaryMembership(user.id, organisationId);
    if (result.success) {
      toast.success(`${organisationId === user.organisationId ? "This organisation" : "Organisation"} is now primary for ${user.name}`);
      loadUsers();
    } else toast.error(result.error);
  };

  const handleSuccess = () => {
    loadUsers();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add person
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No users in this organisation yet</p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add first person
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by name"
                  >
                    Name
                    <SortIndicator column="name" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("email")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by email"
                  >
                    Email
                    <SortIndicator column="email" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by status"
                  >
                    Status
                    <SortIndicator column="status" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-40">
                  <button
                    onClick={() => handleSort("lastLoginAt")}
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    aria-label="Sort by last login"
                  >
                    Last Login
                    <SortIndicator column="lastLoginAt" sortColumn={sortColumn} sortDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => {
                const displayStatus = getDisplayStatus(user);
                return (
                  <TableRow
                    key={user.id}
                    className={!user.isActive || user.membershipActive === false ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={displayStatus.variant}>
                        {displayStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.membershipActive !== false && !user.isPrimaryMembership && (
                          <Button variant="ghost" size="icon-sm" onClick={() => makePrimaryMembership(user)} aria-label={`Make this organisation primary for ${user.name}`} title="Make primary">
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Send Credentials button - for created users (no auth_user_id yet) */}
                        {user.status === "created" && !user.authUserId && user.isActive && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleSendCredentials(user)}
                            disabled={sendingCredentialsFor === user.id}
                            aria-label={`Send credentials to ${user.name}`}
                            title="Send login credentials"
                          >
                            {sendingCredentialsFor === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {/* Resend Credentials button - for invited users WITH auth_user_id */}
                        {user.status === "invited" && user.authUserId && user.isActive && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleResendCredentials(user)}
                            disabled={resendingCredentialsFor === user.id}
                            aria-label={`Resend credentials to ${user.name}`}
                            title="Resend login credentials"
                          >
                            {resendingCredentialsFor === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {/* Reset Password button - for active users */}
                        {user.status === "active" && user.authUserId && user.isActive && user.membershipActive !== false && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setResetUser(user)}
                            aria-label={`Reset password for ${user.name}`}
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(user)}
                          aria-label={`Edit ${user.name}`}
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggleActive(user)}
                          aria-label={
                            user.isActive
                              ? `Deactivate ${user.name}`
                              : `Activate ${user.name}`
                          }
                          title={user.isActive ? "Deactivate user" : "Activate user"}
                        >
                          {user.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => user.membershipActive === false ? reactivateMembership(user) : setRemoveUser(user)}
                          aria-label={`${user.membershipActive === false ? "Reactivate" : "Deactivate"} ${user.name}'s membership`}
                          title={user.membershipActive === false ? "Reactivate membership" : "Deactivate membership"}
                        >
                          {user.membershipActive === false ? <Power className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
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

      {/* Add User Dialog */}
      <AddUserDialog
        organisationId={organisationId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={handleSuccess}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editingUser}
        organisationId={organisationId}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSuccess={handleSuccess}
      />

      <Dialog
        open={!!resetUser}
        onOpenChange={(open) => {
          if (!open && !isResettingPassword) clearResetDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.name}. It will not be sent by email.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleResetPassword(); }}>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={resetPassword}
                  aria-describedby={resetError ? "reset-password-error" : undefined}
                  aria-invalid={!!resetError}
                  onChange={(event) => { setResetPassword(event.target.value); setResetError(null); }}
                  disabled={isResettingPassword}
                />
                <Button type="button" variant="outline" size="icon" disabled={isResettingPassword} onClick={() => setShowResetPassword((shown) => !shown)} aria-label={showResetPassword ? "Hide password" : "Show password"}>
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!resetPassword || isResettingPassword}
                  aria-label="Copy password"
                  onClick={() => void copyResetPassword()}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password-confirmation">Confirm password</Label>
              <Input
                id="reset-password-confirmation"
                type={showResetPassword ? "text" : "password"}
                autoComplete="new-password"
                value={resetConfirmation}
                aria-describedby={resetError ? "reset-password-error" : undefined}
                aria-invalid={!!resetError}
                onChange={(event) => { setResetConfirmation(event.target.value); setResetError(null); }}
                disabled={isResettingPassword}
              />
            </div>
            {resetError && <p id="reset-password-error" role="alert" className="text-sm text-destructive">{resetError}</p>}
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const generated = generateTemporaryPassword(12);
                  setResetPassword(generated);
                  setResetConfirmation(generated);
                  setResetError(null);
                  setShowResetPassword(true);
                }}
                disabled={isResettingPassword}
              >
                Generate
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={clearResetDialog} disabled={isResettingPassword}>Cancel</Button>
                <Button type="submit" disabled={isResettingPassword}>
                  {isResettingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Set password
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toggle Active Confirmation Dialog */}
      <AlertDialog
        open={!!toggleUser}
        onOpenChange={(open) => {
          if (!open && !isToggling) {
            setToggleUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleUser?.isActive ? "Deactivate User" : "Activate User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUser?.isActive ? (
                <>
                  Are you sure you want to deactivate <strong>{toggleUser?.name}</strong>?
                  <br />
                  <br />
                  They will no longer be able to log in to the portal.
                </>
              ) : (
                <>
                  Are you sure you want to activate <strong>{toggleUser?.name}</strong>?
                  <br />
                  <br />
                  They will be able to log in to the portal again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleActive} disabled={isToggling}>
              {isToggling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {toggleUser?.isActive ? "Deactivating..." : "Activating..."}
                </>
              ) : (
                toggleUser?.isActive ? "Deactivate" : "Activate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove From Organisation Confirmation Dialog (K3) */}
      <AlertDialog
        open={!!removeUser}
        onOpenChange={(open) => {
          if (!open && !isRemoving) {
            setRemoveUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from organisation</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeUser?.name}</strong> from this organisation?
              <br />
              <br />
              Their membership and access groups here are revoked. Their account and any other
              organisations are unaffected. The user&apos;s primary or only organisation cannot be
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveUser} disabled={isRemoving}>
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
