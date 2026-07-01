"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Badge,
} from "@timber/ui";
import { getUserAccessGroups, updateUserAccessGroups } from "@/features/access/actions";
import type { UserGroupAssignment } from "@/features/access/types";
import type { OrganisationUser } from "../types";

interface UserGroupsDialogProps {
  user: OrganisationUser | null;
  organisationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * UserGroupsDialog (E4)
 *
 * Dialog for assigning access groups to a user within an organisation.
 * Replaces the per-user module toggles (UserModulesDialog): a user's
 * effective rights are the union of their assigned groups' rights,
 * capped by the organisation's module ceiling.
 */
export function UserGroupsDialog({
  user,
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: UserGroupsDialogProps) {
  const [groups, setGroups] = useState<UserGroupAssignment[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    // Clear the previous user's assignments BEFORE fetching, so a failed load
    // can never leave user A's checkboxes renderable (and savable) under user B.
    setGroups([]);
    setSelected(new Set());
    const result = await getUserAccessGroups(user.id, organisationId);

    if (result.success) {
      setGroups(result.data);
      setSelected(new Set(result.data.filter((g) => g.assigned).map((g) => g.groupId)));
    } else {
      toast.error(result.error || "Failed to load groups");
    }

    setIsLoading(false);
  }, [user, organisationId]);

  useEffect(() => {
    if (open && user) {
      loadGroups();
    }
  }, [open, user?.id, organisationId, loadGroups]);

  const toggleGroup = (groupId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const hasChanges = () => {
    const original = new Set(groups.filter((g) => g.assigned).map((g) => g.groupId));
    if (original.size !== selected.size) return true;
    for (const id of selected) {
      if (!original.has(id)) return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    const result = await updateUserAccessGroups(user.id, organisationId, Array.from(selected));

    if (result.success) {
      toast.success("User groups updated");
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error(result.error || "Failed to update groups");
    }

    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Groups
          </DialogTitle>
          <DialogDescription>
            Assign access groups to <strong>{user?.name}</strong> in this organisation. Their
            rights are the union of the selected groups.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No groups available</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 py-2">
            {groups.map((g) => (
              <div
                key={g.groupId}
                className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent/30 transition-colors"
              >
                <Checkbox
                  id={`user-group-${g.groupId}`}
                  checked={selected.has(g.groupId)}
                  onCheckedChange={() => toggleGroup(g.groupId)}
                  disabled={isSaving}
                />
                <label
                  htmlFor={`user-group-${g.groupId}`}
                  className="flex-1 text-sm font-medium cursor-pointer"
                >
                  {g.groupName}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{g.groupKey}</span>
                </label>
                {g.isSystem && (
                  <Badge variant="secondary" className="text-[10px]">
                    System
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !hasChanges()}>
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
