"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import {
  Button,
  Checkbox,
  Badge,
} from "@timber/ui";
import {
  getOrganisationModules,
  updateOrganisationModules,
} from "../actions";
import type { OrganisationModule } from "../actions";

interface OrganisationModulesTabProps {
  organisationId: string;
}

/**
 * OrganisationModulesTab — Modules management
 *
 * Shows all modules with a toggle to enable/disable each one.
 */
export function OrganisationModulesTab({
  organisationId,
}: OrganisationModulesTabProps) {
  const [modules, setModules] = useState<OrganisationModule[]>([]);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [organisationId]);

  const loadData = async () => {
    setIsLoading(true);

    const modulesResult = await getOrganisationModules(organisationId);

    if (modulesResult.success) {
      setModules(modulesResult.data);
      const enabled = new Set(
        modulesResult.data.filter((m) => m.enabled).map((m) => m.moduleCode)
      );
      setEnabledModules(enabled);
    } else {
      toast.error(modulesResult.error);
    }

    setIsLoading(false);
  };

  const toggleModule = (moduleCode: string) => {
    setEnabledModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleCode)) {
        next.delete(moduleCode);
      } else {
        next.add(moduleCode);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateOrganisationModules(
      organisationId,
      Array.from(enabledModules)
    );

    if (result.success) {
      toast.success("Modules updated");
      loadData();
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  };

  const hasChanges = () => {
    const originalEnabled = new Set(
      modules.filter((m) => m.enabled).map((m) => m.moduleCode)
    );
    if (originalEnabled.size !== enabledModules.size) return true;
    for (const code of enabledModules) {
      if (!originalEnabled.has(code)) return true;
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No modules available to configure</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Toggle modules on or off to control which pages this organisation sees in the sidebar.
        </p>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges()}
          size="sm"
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
      </div>

      <div className="space-y-2">
        {modules.map((mod) => {
          const isEnabled = enabledModules.has(mod.moduleCode);

          return (
            <div key={mod.moduleCode} className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id={`module-${mod.moduleCode}`}
                checked={isEnabled}
                onCheckedChange={() => toggleModule(mod.moduleCode)}
                disabled={isSaving}
              />
              <label
                htmlFor={`module-${mod.moduleCode}`}
                className="flex-1 font-medium cursor-pointer"
              >
                {mod.category}
              </label>
              {isEnabled && (
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
