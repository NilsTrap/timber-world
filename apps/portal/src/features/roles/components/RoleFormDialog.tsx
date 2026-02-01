"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
} from "@timber/ui";
import { saveRole, type Role, type FeaturesByCategory } from "../actions";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  featuresByCategory: FeaturesByCategory;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  featuresByCategory,
}: RoleFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!role;
  const isSystem = role?.isSystem ?? false;

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setSelectedPermissions(role.permissions);
    } else {
      setName("");
      setDescription("");
      setSelectedPermissions([]);
    }
    setError(null);
  }, [role, open]);

  const handlePermissionToggle = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code)
        ? prev.filter((p) => p !== code)
        : [...prev, code]
    );
  };

  const handleSelectAllInCategory = (category: string, checked: boolean) => {
    const categoryFeatures = featuresByCategory[category] || [];
    const categoryCodes = categoryFeatures.map((f) => f.code);

    if (checked) {
      setSelectedPermissions((prev) => [
        ...prev.filter((p) => !categoryCodes.includes(p)),
        ...categoryCodes,
      ]);
    } else {
      setSelectedPermissions((prev) =>
        prev.filter((p) => !categoryCodes.includes(p))
      );
    }
  };

  const isCategoryFullySelected = (category: string) => {
    const categoryFeatures = featuresByCategory[category] || [];
    return categoryFeatures.every((f) => selectedPermissions.includes(f.code));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await saveRole({
      id: role?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: selectedPermissions,
    });

    setIsSaving(false);

    if (result.success) {
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to save role");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Role: ${role.name}` : "Create Role"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystem}
                placeholder="e.g., Warehouse Manager"
              />
              {isSystem && (
                <p className="text-xs text-muted-foreground">
                  System role names cannot be changed
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this role"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label>Permissions</Label>
            <div className="border rounded-md p-4 space-y-6 max-h-96 overflow-y-auto">
              {Object.entries(featuresByCategory).map(([category, features]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Checkbox
                      id={`cat-${category}`}
                      checked={isCategoryFullySelected(category)}
                      onCheckedChange={(checked) =>
                        handleSelectAllInCategory(category, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`cat-${category}`}
                      className="font-semibold cursor-pointer"
                    >
                      {category}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    {features.map((feature) => (
                      <div key={feature.code} className="flex items-center gap-2">
                        <Checkbox
                          id={feature.code}
                          checked={selectedPermissions.includes(feature.code)}
                          onCheckedChange={() =>
                            handlePermissionToggle(feature.code)
                          }
                        />
                        <Label
                          htmlFor={feature.code}
                          className="text-sm cursor-pointer"
                          title={feature.description || undefined}
                        >
                          {feature.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedPermissions.length} permission(s)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
