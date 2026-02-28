"use client";

import { useState } from "react";
import { Button, Input, Badge } from "@timber/ui";
import { Plus, X, Tag } from "lucide-react";
import type { CrmKeyword } from "../types";
import { createKeyword, deleteKeyword } from "../actions/keywords";

interface KeywordsTabProps {
  keywords: CrmKeyword[];
}

export function KeywordsTab({ keywords: initialKeywords }: KeywordsTabProps) {
  const [keywords, setKeywords] = useState<CrmKeyword[]>(initialKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;

    setIsAdding(true);
    setError(null);

    const result = await createKeyword(newKeyword);

    if (result.success && result.data) {
      setKeywords((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewKeyword("");
    } else {
      setError(result.error || "Failed to add keyword");
    }

    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteKeyword(id);

    if (result.success) {
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } else {
      setError(result.error || "Failed to delete keyword");
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
      {/* Add keyword form */}
      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Add new keyword..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
            disabled={isAdding}
          />
        </div>
        <Button onClick={handleAdd} disabled={isAdding || !newKeyword.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Keywords list */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Keywords ({keywords.length})
        </h3>

        {keywords.length === 0 ? (
          <p className="text-muted-foreground">No keywords yet. Add one above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge
                key={keyword.id}
                variant="secondary"
                className="text-sm py-1.5 px-3 flex items-center gap-2"
              >
                {keyword.name}
                <button
                  onClick={() => handleDelete(keyword.id)}
                  disabled={deletingId === keyword.id}
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
