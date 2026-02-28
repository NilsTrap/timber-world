"use client";

import { useState } from "react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@timber/ui";
import { Plus, X, Tag } from "lucide-react";
import type { CrmKeyword } from "../types";
import { addKeywordToCompany, removeKeywordFromCompany } from "../actions/keywords";

interface CompanyKeywordsProps {
  companyId: string;
  assignedKeywords: CrmKeyword[];
  allKeywords: CrmKeyword[];
}

export function CompanyKeywords({
  companyId,
  assignedKeywords: initialAssigned,
  allKeywords,
}: CompanyKeywordsProps) {
  const [assignedKeywords, setAssignedKeywords] = useState<CrmKeyword[]>(initialAssigned);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const availableKeywords = allKeywords.filter(
    (k) => !assignedKeywords.some((ak) => ak.id === k.id)
  );

  const handleAdd = async (keyword: CrmKeyword) => {
    setIsAdding(true);
    const result = await addKeywordToCompany(companyId, keyword.id);

    if (result.success) {
      setAssignedKeywords((prev) =>
        [...prev, keyword].sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    setIsAdding(false);
  };

  const handleRemove = async (keywordId: string) => {
    setRemovingId(keywordId);
    const result = await removeKeywordFromCompany(companyId, keywordId);

    if (result.success) {
      setAssignedKeywords((prev) => prev.filter((k) => k.id !== keywordId));
    }

    setRemovingId(null);
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Keywords</h2>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={availableKeywords.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add Keyword
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            {availableKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">All keywords assigned</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-auto">
                {availableKeywords.map((keyword) => (
                  <button
                    key={keyword.id}
                    onClick={() => handleAdd(keyword)}
                    disabled={isAdding}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                  >
                    {keyword.name}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {assignedKeywords.length === 0 ? (
        <p className="text-muted-foreground text-sm">No keywords assigned yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignedKeywords.map((keyword) => (
            <Badge
              key={keyword.id}
              variant="secondary"
              className="text-sm py-1.5 px-3 flex items-center gap-2"
            >
              {keyword.name}
              <button
                onClick={() => handleRemove(keyword.id)}
                disabled={removingId === keyword.id}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
