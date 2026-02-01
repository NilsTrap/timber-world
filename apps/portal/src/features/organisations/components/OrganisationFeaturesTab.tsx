"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Button,
  Checkbox,
  Badge,
} from "@timber/ui";
import { getOrganisationFeatures, updateOrganisationFeatures } from "../actions";
import type { OrganisationFeature } from "../actions";

interface OrganisationFeaturesTabProps {
  organisationId: string;
}

/**
 * OrganisationFeaturesTab (Story 10.12)
 *
 * Tab content for managing organization feature configuration.
 * Shows all features grouped by category with checkboxes to enable/disable.
 */
export function OrganisationFeaturesTab({
  organisationId,
}: OrganisationFeaturesTabProps) {
  const [features, setFeatures] = useState<OrganisationFeature[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeatures();
  }, [organisationId]);

  const loadFeatures = async () => {
    setIsLoading(true);
    const result = await getOrganisationFeatures(organisationId);

    if (result.success) {
      setFeatures(result.data);
      // Initialize enabled features
      const enabled = new Set(
        result.data.filter((f) => f.enabled).map((f) => f.featureCode)
      );
      setEnabledFeatures(enabled);
      // Expand all categories by default
      const categories = new Set(result.data.map((f) => f.category));
      setExpandedCategories(categories);
    } else {
      toast.error(result.error);
    }

    setIsLoading(false);
  };

  // Group features by category
  const groupedFeatures = useMemo(() => {
    const groups = new Map<string, OrganisationFeature[]>();
    features.forEach((f) => {
      const existing = groups.get(f.category) || [];
      existing.push(f);
      groups.set(f.category, existing);
    });
    return groups;
  }, [features]);

  const toggleFeature = (featureCode: string) => {
    setEnabledFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureCode)) {
        next.delete(featureCode);
      } else {
        next.add(featureCode);
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

  const toggleAllInCategory = (category: string, enable: boolean) => {
    const categoryFeatures = groupedFeatures.get(category) || [];
    setEnabledFeatures((prev) => {
      const next = new Set(prev);
      categoryFeatures.forEach((f) => {
        if (enable) {
          next.add(f.featureCode);
        } else {
          next.delete(f.featureCode);
        }
      });
      return next;
    });
  };

  const getCategoryStatus = (category: string) => {
    const categoryFeatures = groupedFeatures.get(category) || [];
    const enabledCount = categoryFeatures.filter((f) =>
      enabledFeatures.has(f.featureCode)
    ).length;
    return { enabled: enabledCount, total: categoryFeatures.length };
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateOrganisationFeatures(
      organisationId,
      Array.from(enabledFeatures)
    );

    if (result.success) {
      toast.success("Organization features updated");
      loadFeatures(); // Reload to get fresh state
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  };

  const hasChanges = () => {
    const originalEnabled = new Set(
      features.filter((f) => f.enabled).map((f) => f.featureCode)
    );
    if (originalEnabled.size !== enabledFeatures.size) return true;
    for (const code of enabledFeatures) {
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

  if (features.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No features available to configure</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Enable or disable features for this organization. Disabled features
          will not be available to any users.
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
        {Array.from(groupedFeatures.entries()).map(([category, categoryFeatures]) => {
          const status = getCategoryStatus(category);
          const allEnabled = status.enabled === status.total;
          const noneEnabled = status.enabled === 0;

          return (
            <div key={category} className="border rounded-lg">
              <div className="flex items-center p-3 hover:bg-accent/50 transition-colors">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 flex-1 text-left font-medium"
                >
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {category}
                </button>
                <Badge variant="secondary" className="mr-3 text-xs">
                  {status.enabled}/{status.total}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllInCategory(category, !allEnabled)}
                  disabled={isSaving}
                  className="text-xs"
                >
                  {allEnabled ? "Disable All" : noneEnabled ? "Enable All" : "Enable All"}
                </Button>
              </div>
              {expandedCategories.has(category) && (
                <div className="border-t divide-y">
                  {categoryFeatures.map((feature) => (
                    <div
                      key={feature.featureCode}
                      className="flex items-center gap-3 py-2 px-3 hover:bg-accent/30 transition-colors"
                    >
                      <Checkbox
                        id={`feature-${feature.featureCode}`}
                        checked={enabledFeatures.has(feature.featureCode)}
                        onCheckedChange={() => toggleFeature(feature.featureCode)}
                        disabled={isSaving}
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`feature-${feature.featureCode}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {feature.featureName}
                        </label>
                        {feature.featureDescription && (
                          <p className="text-xs text-muted-foreground">
                            {feature.featureDescription}
                          </p>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground font-mono">
                        {feature.featureCode}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
