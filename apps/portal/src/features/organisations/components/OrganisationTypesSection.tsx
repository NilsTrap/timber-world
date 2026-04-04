"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Tag,
  Building,
  Building2,
  Factory,
  Truck,
  ShoppingCart,
  ArrowLeftRight,
  Package,
  type LucideIcon,
} from "lucide-react";

// Map icon names from database to Lucide components
const iconMap: Record<string, LucideIcon> = {
  "building-2": Building2,
  "factory": Factory,
  "truck": Truck,
  "shopping-cart": ShoppingCart,
  "arrows-exchange": ArrowLeftRight,
  "package": Package,
};
import {
  Button,
  Checkbox,
  Badge,
  Label,
} from "@timber/ui";
import {
  getOrganisationTypes,
  getOrganisationAssignedTypes,
  updateOrganisationTypes,
} from "../actions/getOrganisationTypes";
import type { OrganizationType } from "../actions/getOrganisationTypes";

interface OrganisationTypesSectionProps {
  organisationId: string;
}

/**
 * OrganisationTypesSection
 *
 * Section for managing organization type assignments (tags).
 * Types categorize the organisation (e.g., Producer, Client).
 * Module configuration is managed in the Modules tab.
 */
export function OrganisationTypesSection({
  organisationId,
}: OrganisationTypesSectionProps) {
  const [types, setTypes] = useState<OrganizationType[]>([]);
  const [assignedTypeIds, setAssignedTypeIds] = useState<Set<string>>(new Set());
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [organisationId]);

  const loadData = async () => {
    setIsLoading(true);

    const [typesResult, assignedResult] = await Promise.all([
      getOrganisationTypes(),
      getOrganisationAssignedTypes(organisationId),
    ]);

    if (typesResult.success) {
      setTypes(typesResult.data);
    } else {
      toast.error(typesResult.error);
    }

    if (assignedResult.success) {
      const assigned = new Set(assignedResult.data);
      setAssignedTypeIds(assigned);
      setOriginalAssignedIds(assigned);
    } else {
      toast.error(assignedResult.error);
    }

    setIsLoading(false);
  };

  const toggleType = (typeId: string) => {
    setAssignedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateOrganisationTypes(
      organisationId,
      Array.from(assignedTypeIds)
    );

    if (result.success) {
      toast.success("Organization types updated");
      setOriginalAssignedIds(new Set(assignedTypeIds));
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  };

  const hasChanges = () => {
    if (originalAssignedIds.size !== assignedTypeIds.size) return true;
    for (const id of assignedTypeIds) {
      if (!originalAssignedIds.has(id)) return true;
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (types.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No organization types available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Organization Types
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Categorize this organisation. Modules are configured in the Modules tab.
          </p>
        </div>
        {hasChanges() && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {types.map((type) => {
          const isAssigned = assignedTypeIds.has(type.id);
          const IconComponent = type.icon ? iconMap[type.icon] : null;
          const Icon = IconComponent || Building;

          return (
            <div
              key={type.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                isAssigned
                  ? "border-primary bg-primary/5"
                  : "bg-card hover:bg-accent/50"
              }`}
              onClick={() => !isSaving && toggleType(type.id)}
            >
              <Checkbox
                id={`type-${type.id}`}
                checked={isAssigned}
                onCheckedChange={() => toggleType(type.id)}
                disabled={isSaving}
              />
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{type.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
