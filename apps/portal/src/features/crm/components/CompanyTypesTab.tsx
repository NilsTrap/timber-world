"use client";

import { useState } from "react";
import { Button, Input, Badge } from "@timber/ui";
import { Plus, X, Briefcase } from "lucide-react";
import type { CrmCompanyType } from "../types";
import { createCompanyType, deleteCompanyType } from "../actions/companyTypes";

interface CompanyTypesTabProps {
  companyTypes: CrmCompanyType[];
}

export function CompanyTypesTab({ companyTypes: initialTypes }: CompanyTypesTabProps) {
  const [companyTypes, setCompanyTypes] = useState<CrmCompanyType[]>(initialTypes);
  const [newType, setNewType] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newType.trim()) return;

    setIsAdding(true);
    setError(null);

    const result = await createCompanyType(newType);

    if (result.success && result.data) {
      setCompanyTypes((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewType("");
    } else {
      setError(result.error || "Failed to add company type");
    }

    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteCompanyType(id);

    if (result.success) {
      setCompanyTypes((prev) => prev.filter((t) => t.id !== id));
    } else {
      setError(result.error || "Failed to delete company type");
    }

    setDeletingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-6">
      {/* Add type form */}
      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Add new company type..."
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
            disabled={isAdding}
          />
        </div>
        <Button onClick={handleAdd} disabled={isAdding || !newType.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Types list */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Company Types ({companyTypes.length})
        </h3>

        {companyTypes.length === 0 ? (
          <p className="text-muted-foreground">No company types yet. Add one above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {companyTypes.map((type) => (
              <Badge
                key={type.id}
                variant="secondary"
                className="text-sm py-1.5 px-3 flex items-center gap-2"
              >
                {type.name}
                <button
                  onClick={() => handleDelete(type.id)}
                  disabled={deletingId === type.id}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
