"use client";

import { useState } from "react";
import { Button, Input, Badge } from "@timber/ui";
import { Plus, X, Factory } from "lucide-react";
import type { CrmIndustry } from "../types";
import { createIndustry, deleteIndustry } from "../actions/industries";

interface IndustriesTabProps {
  industries: CrmIndustry[];
}

export function IndustriesTab({ industries: initialIndustries }: IndustriesTabProps) {
  const [industries, setIndustries] = useState<CrmIndustry[]>(initialIndustries);
  const [newIndustry, setNewIndustry] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newIndustry.trim()) return;

    setIsAdding(true);
    setError(null);

    const result = await createIndustry(newIndustry);

    if (result.success && result.data) {
      setIndustries((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewIndustry("");
    } else {
      setError(result.error || "Failed to add industry");
    }

    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteIndustry(id);

    if (result.success) {
      setIndustries((prev) => prev.filter((i) => i.id !== id));
    } else {
      setError(result.error || "Failed to delete industry");
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
      {/* Add industry form */}
      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Factory className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Add new industry..."
            value={newIndustry}
            onChange={(e) => setNewIndustry(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
            disabled={isAdding}
          />
        </div>
        <Button onClick={handleAdd} disabled={isAdding || !newIndustry.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Industries list */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Industries ({industries.length})
        </h3>

        {industries.length === 0 ? (
          <p className="text-muted-foreground">No industries yet. Add one above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {industries.map((industry) => (
              <Badge
                key={industry.id}
                variant="secondary"
                className="text-sm py-1.5 px-3 flex items-center gap-2"
              >
                {industry.name}
                <button
                  onClick={() => handleDelete(industry.id)}
                  disabled={deletingId === industry.id}
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
