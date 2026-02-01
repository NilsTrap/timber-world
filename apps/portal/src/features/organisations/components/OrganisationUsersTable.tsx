"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Trash2,
  Shield,
  Lock,
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
} from "@timber/ui";
import {
  getOrganisationUsers,
  toggleUserActive,
  sendUserCredentials,
  resendUserCredentials,
  resetUserPassword,
  deleteOrganisationUser,
} from "../actions";
import type { OrganisationUser } from "../types";
import { AddUserDialog } from "./AddUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { UserRolesDialog } from "./UserRolesDialog";
import { UserPermissionsDialog } from "./UserPermissionsDialog";

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
    return { label: "Inactive", variant: "secondary" };
  }
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
  const [deleteUser, setDeleteUser] = useState<OrganisationUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Send/Resend credentials state
  const [sendingCredentialsFor, setSendingCredentialsFor] = useState<string | null>(null);
  const [resendingCredentialsFor, setResendingCredentialsFor] = useState<string | null>(null);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<string | null>(null);

  // Roles and permissions dialog state
  const [rolesUser, setRolesUser] = useState<OrganisationUser | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<OrganisationUser | null>(null);

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
  const handleResetPassword = async (user: OrganisationUser) => {
    setResettingPasswordFor(user.id);

    const result = await resetUserPassword(user.id, organisationId);

    if (result.success) {
      toast.success(`Password reset link sent to ${result.data.email}`);
      loadUsers();
    } else {
      toast.error(result.error);
    }

    setResettingPasswordFor(null);
  };

  // Handle delete user
  const handleDeleteUser = (user: OrganisationUser) => {
    setDeleteUser(user);
  };

  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!deleteUser) return;

    setIsDeleting(true);
    const result = await deleteOrganisationUser(deleteUser.id, organisationId);

    if (result.success) {
      toast.success(`User "${deleteUser.name}" deleted`);
      loadUsers();
    } else {
      toast.error(result.error);
    }

    setIsDeleting(false);
    setDeleteUser(null);
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
          Add User
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No users in this organisation yet</p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First User
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
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
                    className={!user.isActive ? "opacity-50" : ""}
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
                        {/* Roles button - manage user role assignments */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRolesUser(user)}
                          aria-label={`Manage roles for ${user.name}`}
                          title="Manage roles"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        {/* Permissions button - manage permission overrides */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPermissionsUser(user)}
                          aria-label={`Manage permissions for ${user.name}`}
                          title="Permission overrides"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
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
                        {user.status === "active" && user.authUserId && user.isActive && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleResetPassword(user)}
                            disabled={resettingPasswordFor === user.id}
                            aria-label={`Reset password for ${user.name}`}
                            title="Reset password"
                          >
                            {resettingPasswordFor === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
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
                          onClick={() => handleDeleteUser(user)}
                          aria-label={`Delete ${user.name}`}
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteUser?.name}</strong>?
              <br />
              <br />
              This action cannot be undone. The user will lose all access and their account will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Roles Dialog */}
      <UserRolesDialog
        user={rolesUser}
        organisationId={organisationId}
        open={!!rolesUser}
        onOpenChange={(open) => !open && setRolesUser(null)}
        onSuccess={handleSuccess}
      />

      {/* User Permissions Dialog */}
      <UserPermissionsDialog
        user={permissionsUser}
        organisationId={organisationId}
        open={!!permissionsUser}
        onOpenChange={(open) => !open && setPermissionsUser(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
