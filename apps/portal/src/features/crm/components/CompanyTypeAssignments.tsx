"use client";

import { useState } from "react";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@timber/ui";
import { Plus, X, Briefcase } from "lucide-react";
import type { CrmCompanyType } from "../types";
import { addTypeToCompany, removeTypeFromCompany } from "../actions/companyTypes";

interface CompanyTypeAssignmentsProps {
  companyId: string;
  assignedTypes: CrmCompanyType[];
  allTypes: CrmCompanyType[];
}

export function CompanyTypeAssignments({
  companyId,
  assignedTypes: initialAssigned,
  allTypes,
}: CompanyTypeAssignmentsProps) {
  const [assignedTypes, setAssignedTypes] = useState<CrmCompanyType[]>(initialAssigned);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const availableTypes = allTypes.filter(
    (t) => !assignedTypes.some((at) => at.id === t.id)
  );

  const handleAdd = async (type: CrmCompanyType) => {
    setIsAdding(true);
    const result = await addTypeToCompany(companyId, type.id);

    if (result.success) {
      setAssignedTypes((prev) =>
        [...prev, type].sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    setIsAdding(false);
  };

  const handleRemove = async (typeId: string) => {
    setRemovingId(typeId);
    const result = await removeTypeFromCompany(companyId, typeId);

    if (result.success) {
      setAssignedTypes((prev) => prev.filter((t) => t.id !== typeId));
    }

    setRemovingId(null);
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Company Type</h2>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={availableTypes.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add Type
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            {availableTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">All types assigned</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-auto">
                {availableTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleAdd(type)}
                    disabled={isAdding}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {assignedTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No types assigned yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignedTypes.map((type) => (
            <Badge
              key={type.id}
              variant="secondary"
              className="text-sm py-1.5 px-3 flex items-center gap-2"
            >
              {type.name}
              <button
                onClick={() => handleRemove(type.id)}
                disabled={removingId === type.id}
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
