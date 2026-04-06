"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Settings2, Plus, X, ChevronRight, ChevronDown } from "lucide-react";
import {
  Button,
  Checkbox,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@timber/ui";
import {
  getOrganisationModules,
  updateOrganisationModules,
  getModulePresets,
  createModulePreset,
  deleteModulePreset,
} from "../actions";
import type { OrganisationModule, ModulePreset } from "../actions";

interface OrganisationModulesTabProps {
  organisationId: string;
}

/**
 * OrganisationModulesTab — Modules management with presets
 *
 * Compact view: one line per category. Categories with sub-modules
 * can be expanded to toggle individual sub-modules.
 */
export function OrganisationModulesTab({
  organisationId,
}: OrganisationModulesTabProps) {
  const [modules, setModules] = useState<OrganisationModule[]>([]);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<ModulePreset[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Save as Preset dialog
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  useEffect(() => {
    loadData();
  }, [organisationId]);

  const loadData = async () => {
    setIsLoading(true);

    const [modulesResult, presetsResult] = await Promise.all([
      getOrganisationModules(organisationId),
      getModulePresets(),
    ]);

    if (modulesResult.success) {
      setModules(modulesResult.data);
      const enabled = new Set(
        modulesResult.data.filter((m) => m.enabled).map((m) => m.moduleCode)
      );
      setEnabledModules(enabled);
    } else {
      toast.error(modulesResult.error);
    }

    if (presetsResult.success) {
      setPresets(presetsResult.data);
    }

    setIsLoading(false);
  };

  // Group modules by category
  const groupedModules = useMemo(() => {
    const groups = new Map<string, OrganisationModule[]>();
    modules.forEach((mod) => {
      const existing = groups.get(mod.category) || [];
      existing.push(mod);
      groups.set(mod.category, existing);
    });
    return groups;
  }, [modules]);

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

  const applyPreset = (preset: ModulePreset) => {
    setEnabledModules(new Set(preset.moduleCodes));
    toast.info(`Applied preset "${preset.name}"`);
  };

  const handleDeletePreset = async (preset: ModulePreset) => {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;

    const result = await deleteModulePreset(preset.id);
    if (result.success) {
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      toast.success(`Preset "${preset.name}" deleted`);
    } else {
      toast.error(result.error);
    }
  };

  const handleSavePreset = async () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;

    setIsSavingPreset(true);
    const result = await createModulePreset(trimmed, Array.from(enabledModules));

    if (result.success) {
      setPresets((prev) => [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setIsPresetDialogOpen(false);
      setPresetName("");
      toast.success(`Preset "${trimmed}" created`);
    } else {
      toast.error(result.error);
    }

    setIsSavingPreset(false);
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
      {/* Header */}
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

      {/* Preset buttons */}
      {(presets.length > 0 || true) && (
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
                disabled={isSaving}
              >
                {preset.name}
              </Button>
              <button
                type="button"
                onClick={() => handleDeletePreset(preset)}
                className="ml-1 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title={`Delete preset "${preset.name}"`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPresetDialogOpen(true)}
            disabled={isSaving}
          >
            <Plus className="h-4 w-4 mr-1" />
            Save as Preset
          </Button>
        </div>
      )}

      {/* Module list — one row per category */}
      <div className="space-y-2">
        {Array.from(groupedModules.entries()).map(([category, mods]) => {
          // The .view module is the parent; everything else is a sub-module
          const viewMod = mods.find((m) => m.moduleCode.endsWith(".view"));
          const subMods = mods.filter((m) => !m.moduleCode.endsWith(".view"));
          const hasSubModules = subMods.length > 0;
          const isExpanded = expandedCategories.has(category);

          // Parent is "on" if the .view module is enabled (or the single module for categories without .view)
          const parentCode = viewMod?.moduleCode ?? mods[0]!.moduleCode;
          const parentEnabled = enabledModules.has(parentCode);

          // Sub-module counts (for badge)
          const subEnabledCount = subMods.filter((m) => enabledModules.has(m.moduleCode)).length;
          const allSubEnabled = hasSubModules && subEnabledCount === subMods.length;
          const someSubEnabled = subEnabledCount > 0 && !allSubEnabled;

          return (
            <div key={category}>
              {/* Main category row */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox
                  id={`category-${category}`}
                  checked={
                    parentEnabled && hasSubModules && someSubEnabled
                      ? "indeterminate"
                      : parentEnabled
                  }
                  onCheckedChange={() => {
                    if (parentEnabled && !someSubEnabled) {
                      // Fully on or no subs enabled — turn off parent + all sub-modules
                      setEnabledModules((prev) => {
                        const next = new Set(prev);
                        next.delete(parentCode);
                        subMods.forEach((m) => next.delete(m.moduleCode));
                        return next;
                      });
                    } else if (parentEnabled && someSubEnabled) {
                      // Indeterminate — turn on all remaining sub-modules
                      setEnabledModules((prev) => {
                        const next = new Set(prev);
                        subMods.forEach((m) => next.add(m.moduleCode));
                        return next;
                      });
                    } else {
                      // Off — turn on parent only (user picks sub-modules individually)
                      setEnabledModules((prev) => {
                        const next = new Set(prev);
                        next.add(parentCode);
                        return next;
                      });
                      // Auto-expand so user can pick sub-modules
                      if (hasSubModules) {
                        setExpandedCategories((prev) => {
                          const next = new Set(prev);
                          next.add(category);
                          return next;
                        });
                      }
                    }
                  }}
                  disabled={isSaving}
                />
                <label
                  htmlFor={hasSubModules ? undefined : `category-${category}`}
                  className={`flex-1 font-medium ${hasSubModules ? "cursor-pointer select-none" : "cursor-pointer"}`}
                  onClick={hasSubModules ? () => toggleCategory(category) : undefined}
                >
                  {category}
                </label>
                {hasSubModules && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                )}
                {parentEnabled && allSubEnabled ? (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                ) : parentEnabled && hasSubModules ? (
                  <Badge variant="secondary" className="text-xs">
                    {subEnabledCount}/{subMods.length}
                  </Badge>
                ) : parentEnabled && !hasSubModules ? (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                ) : null}
              </div>

              {/* Expanded sub-modules */}
              {hasSubModules && isExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  {subMods.map((mod) => {
                    const isEnabled = enabledModules.has(mod.moduleCode);
                    return (
                      <div
                        key={mod.moduleCode}
                        className="flex items-center gap-3 p-2 pl-3 border rounded-md bg-muted/30"
                      >
                        <Checkbox
                          id={`module-${mod.moduleCode}`}
                          checked={isEnabled}
                          onCheckedChange={() => {
                            if (isEnabled) {
                              // Just uncheck this sub-module
                              toggleModule(mod.moduleCode);
                            } else {
                              // Enable sub-module + ensure parent is on
                              setEnabledModules((prev) => {
                                const next = new Set(prev);
                                next.add(mod.moduleCode);
                                next.add(parentCode);
                                return next;
                              });
                            }
                          }}
                          disabled={isSaving}
                        />
                        <label
                          htmlFor={`module-${mod.moduleCode}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {mod.moduleName}
                          {mod.moduleDescription && (
                            <span className="text-muted-foreground ml-1">
                              — {mod.moduleDescription}
                            </span>
                          )}
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
              )}
            </div>
          );
        })}
      </div>

      {/* Save as Preset dialog */}
      <Dialog open={isPresetDialogOpen} onOpenChange={setIsPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Preset</DialogTitle>
            <DialogDescription>
              Save the current module selection as a reusable preset.
              {enabledModules.size > 0
                ? ` ${enabledModules.size} module${enabledModules.size === 1 ? "" : "s"} selected.`
                : " No modules selected."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Preset name (e.g., Client, Sales, Production)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && presetName.trim()) {
                  handleSavePreset();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPresetDialogOpen(false);
                setPresetName("");
              }}
              disabled={isSavingPreset}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreset}
              disabled={isSavingPreset || !presetName.trim()}
            >
              {isSavingPreset ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
