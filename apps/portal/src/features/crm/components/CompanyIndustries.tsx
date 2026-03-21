"use client";

import { useState } from "react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@timber/ui";
import { Plus, X, Factory } from "lucide-react";
import type { CrmIndustry } from "../types";
import { addIndustryToCompany, removeIndustryFromCompany } from "../actions/industries";

interface CompanyIndustriesProps {
  companyId: string;
  assignedIndustries: CrmIndustry[];
  allIndustries: CrmIndustry[];
}

export function CompanyIndustries({
  companyId,
  assignedIndustries: initialAssigned,
  allIndustries,
}: CompanyIndustriesProps) {
  const [assignedIndustries, setAssignedIndustries] = useState<CrmIndustry[]>(initialAssigned);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const availableIndustries = allIndustries.filter(
    (i) => !assignedIndustries.some((ai) => ai.id === i.id)
  );

  const handleAdd = async (industry: CrmIndustry) => {
    setIsAdding(true);
    const result = await addIndustryToCompany(companyId, industry.id);

    if (result.success) {
      setAssignedIndustries((prev) =>
        [...prev, industry].sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    setIsAdding(false);
  };

  const handleRemove = async (industryId: string) => {
    setRemovingId(industryId);
    const result = await removeIndustryFromCompany(companyId, industryId);

    if (result.success) {
      setAssignedIndustries((prev) => prev.filter((i) => i.id !== industryId));
    }

    setRemovingId(null);
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Industry</h2>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={availableIndustries.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add Industry
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            {availableIndustries.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">All industries assigned</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-auto">
                {availableIndustries.map((industry) => (
                  <button
                    key={industry.id}
                    onClick={() => handleAdd(industry)}
                    disabled={isAdding}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                  >
                    {industry.name}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {assignedIndustries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No industries assigned yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignedIndustries.map((industry) => (
            <Badge
              key={industry.id}
              variant="secondary"
              className="text-sm py-1.5 px-3 flex items-center gap-2"
            >
              {industry.name}
              <button
                onClick={() => handleRemove(industry.id)}
                disabled={removingId === industry.id}
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
