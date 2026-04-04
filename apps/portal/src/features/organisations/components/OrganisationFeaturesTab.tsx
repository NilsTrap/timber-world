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
  getOrganisationFeatures,
  updateOrganisationFeatures,
} from "../actions";
import type { OrganisationFeature } from "../actions";

interface OrganisationFeaturesTabProps {
  organisationId: string;
}

/**
 * OrganisationFeaturesTab — Modules management
 *
 * Shows all modules with a toggle to enable/disable each one.
 */
export function OrganisationFeaturesTab({
  organisationId,
}: OrganisationFeaturesTabProps) {
  const [features, setFeatures] = useState<OrganisationFeature[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [organisationId]);

  const loadData = async () => {
    setIsLoading(true);

    const featuresResult = await getOrganisationFeatures(organisationId);

    if (featuresResult.success) {
      setFeatures(featuresResult.data);
      const enabled = new Set(
        featuresResult.data.filter((f) => f.enabled).map((f) => f.featureCode)
      );
      setEnabledFeatures(enabled);
    } else {
      toast.error(featuresResult.error);
    }

    setIsLoading(false);
  };

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

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateOrganisationFeatures(
      organisationId,
      Array.from(enabledFeatures)
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
        {features.map((feature) => {
          const isEnabled = enabledFeatures.has(feature.featureCode);

          return (
            <div key={feature.featureCode} className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id={`module-${feature.featureCode}`}
                checked={isEnabled}
                onCheckedChange={() => toggleFeature(feature.featureCode)}
                disabled={isSaving}
              />
              <label
                htmlFor={`module-${feature.featureCode}`}
                className="flex-1 font-medium cursor-pointer"
              >
                {feature.category}
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
