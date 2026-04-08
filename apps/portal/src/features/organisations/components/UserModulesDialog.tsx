"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Settings2, ChevronRight, ChevronDown } from "lucide-react";
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
import { getUserModules, updateUserModules } from "../actions";
import type { UserModule } from "../actions";
import type { OrganisationUser } from "../types";

interface UserModulesDialogProps {
  user: OrganisationUser | null;
  organisationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * UserModulesDialog
 *
 * Dialog for managing which modules a user has access to within an organization.
 * Shows modules grouped by category with checkboxes.
 * Modules not enabled at the org level are shown as disabled.
 */
export function UserModulesDialog({
  user,
  organisationId,
  open,
  onOpenChange,
  onSuccess,
}: UserModulesDialogProps) {
  const [modules, setModules] = useState<UserModule[]>([]);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const loadModules = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    const result = await getUserModules(user.id, organisationId);

    if (result.success && result.data) {
      setModules(result.data);
      const enabled = new Set<string>();
      result.data.forEach((m) => {
        if (m.userEnabled) enabled.add(m.moduleCode);
      });
      setEnabledModules(enabled);
      // Expand all categories by default
      const categories = new Set(result.data.map((m) => m.category));
      setExpandedCategories(categories);
    } else {
      toast.error("Failed to load modules");
    }

    setIsLoading(false);
  }, [user, organisationId]);

  useEffect(() => {
    if (open && user) {
      loadModules();
    }
  }, [open, user?.id, organisationId, loadModules]);

  // Group modules by category
  const grouped = useMemo(() => {
    const groups = new Map<string, UserModule[]>();
    modules.forEach((m) => {
      const existing = groups.get(m.category) || [];
      existing.push(m);
      groups.set(m.category, existing);
    });
    return groups;
  }, [modules]);

  // Separate "parent" modules (e.g. "inventory.view") from sub-modules (e.g. "inventory.create")
  const getCategoryParts = (categoryModules: UserModule[]) => {
    // The ".view" module is the parent; everything else is a sub-module
    const parent = categoryModules.find((m) => m.moduleCode.endsWith(".view"));
    const subs = categoryModules.filter((m) => m !== parent);
    return { parent, subs };
  };

  const toggleModule = (moduleCode: string) => {
    setEnabledModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleCode)) {
        next.delete(moduleCode);
        // If turning off the parent .view module, also turn off all sub-modules
        if (moduleCode.endsWith(".view")) {
          const prefix = moduleCode.split(".")[0] + ".";
          for (const code of prev) {
            if (code.startsWith(prefix)) next.delete(code);
          }
        }
      } else {
        next.add(moduleCode);
        // If turning on a sub-module, also ensure the parent .view is on
        const prefix = moduleCode.split(".")[0];
        const parentView = prefix + ".view";
        if (moduleCode !== parentView) {
          next.add(parentView);
        }
      }
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

  // Select all org-enabled modules for this user
  const handleSelectAll = () => {
    const allOrgEnabled = new Set<string>();
    modules.forEach((m) => {
      if (m.orgEnabled) allOrgEnabled.add(m.moduleCode);
    });
    setEnabledModules(allOrgEnabled);
  };

  // Clear all user modules
  const handleClearAll = () => {
    setEnabledModules(new Set());
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    const result = await updateUserModules(
      user.id,
      organisationId,
      Array.from(enabledModules)
    );

    if (result.success) {
      toast.success("User modules updated");
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error(result.error || "Failed to update modules");
    }

    setIsSaving(false);
  };

  const hasChanges = () => {
    const original = new Set<string>();
    modules.forEach((m) => {
      if (m.userEnabled) original.add(m.moduleCode);
    });
    if (original.size !== enabledModules.size) return true;
    for (const code of enabledModules) {
      if (!original.has(code)) return true;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            User Modules
          </DialogTitle>
          <DialogDescription>
            Configure which modules <strong>{user?.name}</strong> can access.
            Modules not enabled for the organization are shown as disabled.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : modules.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No modules available
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="flex items-center gap-2 px-1">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Clear All
              </Button>
            </div>

            {/* Module list grouped by category */}
            <div className="flex-1 overflow-y-auto space-y-1 py-2">
              {Array.from(grouped.entries()).map(([category, categoryModules]) => {
                const { parent, subs } = getCategoryParts(categoryModules);
                const isExpanded = expandedCategories.has(category);
                const hasSubs = subs.length > 0;

                // Count enabled sub-modules in this category
                const enabledCount = categoryModules.filter(
                  (m) => enabledModules.has(m.moduleCode)
                ).length;

                return (
                  <div key={category} className="border rounded-lg">
                    {/* Category header with parent module checkbox */}
                    <div className="flex items-center gap-2 p-2 hover:bg-accent/30 transition-colors">
                      {hasSubs && (
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="p-0.5"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      {!hasSubs && <div className="w-5" />}

                      {parent ? (
                        <Checkbox
                          id={`user-mod-${parent.moduleCode}`}
                          checked={enabledModules.has(parent.moduleCode)}
                          onCheckedChange={() => toggleModule(parent.moduleCode)}
                          disabled={isSaving || !parent.orgEnabled}
                        />
                      ) : null}

                      <label
                        htmlFor={parent ? `user-mod-${parent.moduleCode}` : undefined}
                        className="flex-1 text-sm font-medium cursor-pointer"
                      >
                        {category}
                      </label>

                      {!parent?.orgEnabled && (
                        <Badge variant="secondary" className="text-[10px]">
                          Org disabled
                        </Badge>
                      )}

                      {hasSubs && (
                        <Badge variant="outline" className="text-xs">
                          {enabledCount}/{categoryModules.length}
                        </Badge>
                      )}
                    </div>

                    {/* Sub-modules */}
                    {isExpanded && hasSubs && (
                      <div className="border-t divide-y">
                        {subs.map((m) => (
                          <div
                            key={m.moduleCode}
                            className="flex items-center gap-2 py-1.5 px-3 pl-10 hover:bg-accent/20 transition-colors"
                          >
                            <Checkbox
                              id={`user-mod-${m.moduleCode}`}
                              checked={enabledModules.has(m.moduleCode)}
                              onCheckedChange={() => toggleModule(m.moduleCode)}
                              disabled={isSaving || !m.orgEnabled}
                            />
                            <label
                              htmlFor={`user-mod-${m.moduleCode}`}
                              className="flex-1 text-sm cursor-pointer"
                            >
                              {m.moduleName}
                            </label>
                            {!m.orgEnabled && (
                              <Badge variant="secondary" className="text-[10px]">
                                Org disabled
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
