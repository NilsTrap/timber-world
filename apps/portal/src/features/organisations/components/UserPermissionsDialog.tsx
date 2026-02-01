"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Lock, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  cn,
} from "@timber/ui";
import { getUserPermissions, updateUserPermissions } from "../actions";
import type { UserPermission, OverrideState } from "../actions";
import type { OrganisationUser } from "../types";

interface UserPermissionsDialogProps {
  user: OrganisationUser | null;
  organisationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Permission Row Component
 */
function PermissionRow({
  permission,
  override,
  onOverrideChange,
  disabled,
}: {
  permission: UserPermission;
  override: OverrideState;
  onOverrideChange: (state: OverrideState) => void;
  disabled: boolean;
}) {
  const effectiveAccess = override === "inherit"
    ? permission.fromRoles
    : override === "grant";

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-accent/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{permission.featureName}</span>
          {permission.fromRoles && override === "inherit" && (
            <Badge variant="outline" className="text-xs">
              From Role
            </Badge>
          )}
        </div>
        {permission.featureDescription && (
          <p className="text-xs text-muted-foreground truncate">
            {permission.featureDescription}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 ml-4">
        <button
          type="button"
          onClick={() => onOverrideChange("inherit")}
          disabled={disabled}
          className={cn(
            "px-2 py-1 text-xs rounded-l border transition-colors",
            override === "inherit"
              ? "bg-secondary text-secondary-foreground border-secondary"
              : "bg-background hover:bg-accent border-border"
          )}
        >
          Inherit
        </button>
        <button
          type="button"
          onClick={() => onOverrideChange("grant")}
          disabled={disabled}
          className={cn(
            "px-2 py-1 text-xs border-y transition-colors",
            override === "grant"
              ? "bg-green-600 text-white border-green-600"
              : "bg-background hover:bg-accent border-border"
          )}
        >
          Grant
        </button>
        <button
          type="button"
          onClick={() => onOverrideChange("deny")}
          disabled={disabled}
          className={cn(
            "px-2 py-1 text-xs rounded-r border transition-colors",
            override === "deny"
              ? "bg-destructive text-destructive-foreground border-destructive"
              : "bg-background hover:bg-accent border-border"
          )}
        >
          Deny
        </button>
      </div>
      <div className="ml-3 w-16 text-right">
        <Badge
          variant={effectiveAccess ? "success" : "secondary"}
          className="text-xs"
        >
          {effectiveAccess ? "Allowed" : "Denied"}
        </Badge>
      </div>
    </div>
  );
}

/**
 * UserPermissionsDialog (Story 10.11)
 *
 * Dialog for managing user permission overrides within an organization.
 * Shows all features grouped by category with inherit/grant/deny controls.
 */
export function UserPermissionsDialog({
  user,
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: UserPermissionsDialogProps) {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [overrides, setOverrides] = useState<Map<string, OverrideState>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && user) {
      loadPermissions();
    }
  }, [open, user?.id, organisationId]);

  const loadPermissions = async () => {
    if (!user) return;

    setIsLoading(true);
    const result = await getUserPermissions(user.id, organisationId);

    if (result.success) {
      setPermissions(result.data);
      // Initialize overrides from current state
      const initialOverrides = new Map<string, OverrideState>();
      result.data.forEach((p) => {
        initialOverrides.set(p.featureCode, p.override);
      });
      setOverrides(initialOverrides);
      // Expand all categories by default
      const categories = new Set(result.data.map((p) => p.category));
      setExpandedCategories(categories);
    } else {
      toast.error(result.error);
    }

    setIsLoading(false);
  };

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, UserPermission[]>();
    permissions.forEach((p) => {
      const existing = groups.get(p.category) || [];
      existing.push(p);
      groups.set(p.category, existing);
    });
    return groups;
  }, [permissions]);

  const handleOverrideChange = (featureCode: string, state: OverrideState) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(featureCode, state);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    const overridesArray = Array.from(overrides.entries()).map(
      ([featureCode, state]) => ({ featureCode, state })
    );

    const result = await updateUserPermissions(user.id, organisationId, overridesArray);

    if (result.success) {
      toast.success("User permissions updated");
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  };

  const hasChanges = () => {
    for (const p of permissions) {
      const currentOverride = overrides.get(p.featureCode) || "inherit";
      if (currentOverride !== p.override) return true;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Permission Overrides
          </DialogTitle>
          <DialogDescription>
            Override permissions for <strong>{user?.name}</strong>. Overrides
            take precedence over role-based permissions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No features available
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {Array.from(groupedPermissions.entries()).map(([category, perms]) => (
              <div key={category} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-2 p-3 text-left font-medium hover:bg-accent/50 transition-colors"
                >
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {category}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {perms.length}
                  </Badge>
                </button>
                {expandedCategories.has(category) && (
                  <div className="border-t divide-y">
                    {perms.map((permission) => (
                      <PermissionRow
                        key={permission.featureCode}
                        permission={permission}
                        override={overrides.get(permission.featureCode) || "inherit"}
                        onOverrideChange={(state) =>
                          handleOverrideChange(permission.featureCode, state)
                        }
                        disabled={isSaving}
                      />
                    ))}
                  </div>
                )}
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
