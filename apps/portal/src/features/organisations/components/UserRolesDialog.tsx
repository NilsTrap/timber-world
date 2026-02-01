"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Label,
  Badge,
} from "@timber/ui";
import { getUserRoles, updateUserRoles } from "../actions";
import type { UserRoleAssignment } from "../actions";
import type { OrganisationUser } from "../types";

interface UserRolesDialogProps {
  user: OrganisationUser | null;
  organisationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * UserRolesDialog (Story 10.10)
 *
 * Dialog for managing user role assignments within an organization.
 * Shows all available roles with checkboxes to assign/unassign.
 */
export function UserRolesDialog({
  user,
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: UserRolesDialogProps) {
  const [roles, setRoles] = useState<UserRoleAssignment[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadRoles();
    }
  }, [open, user?.id, organisationId]);

  const loadRoles = async () => {
    if (!user) return;

    setIsLoading(true);
    const result = await getUserRoles(user.id, organisationId);

    if (result.success) {
      setRoles(result.data);
      // Initialize selected roles based on current assignments
      const assigned = new Set(
        result.data.filter((r) => r.assigned).map((r) => r.roleId)
      );
      setSelectedRoleIds(assigned);
    } else {
      toast.error(result.error);
    }

    setIsLoading(false);
  };

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    const result = await updateUserRoles(
      user.id,
      organisationId,
      Array.from(selectedRoleIds)
    );

    if (result.success) {
      toast.success("User roles updated");
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  };

  const hasChanges = () => {
    const originalIds = new Set(
      roles.filter((r) => r.assigned).map((r) => r.roleId)
    );
    if (originalIds.size !== selectedRoleIds.size) return true;
    for (const id of selectedRoleIds) {
      if (!originalIds.has(id)) return true;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Roles
          </DialogTitle>
          <DialogDescription>
            Assign roles to <strong>{user?.name}</strong>. Roles determine which
            permissions are inherited.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : roles.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No roles available
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto py-2">
            {roles.map((role) => (
              <div
                key={role.roleId}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={`role-${role.roleId}`}
                  checked={selectedRoleIds.has(role.roleId)}
                  onCheckedChange={() => handleRoleToggle(role.roleId)}
                  disabled={isSaving}
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`role-${role.roleId}`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span className="font-medium">{role.roleName}</span>
                    {role.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                  </Label>
                  {role.roleDescription && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {role.roleDescription}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading || !hasChanges()}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
