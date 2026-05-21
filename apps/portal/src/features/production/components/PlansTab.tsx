"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Textarea } from "@timber/ui";
import { Plus, ChevronRight, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { createProductionPlan } from "../actions";
import type { ProductionPlanListItem } from "../types-plans";

interface PlansTabProps {
  plans: ProductionPlanListItem[];
}

/**
 * PlansTab
 *
 * "Start new plan" form at the top + list of existing plans as one-line cards
 * below. Clicking a card navigates to /production/plans/[id].
 */
export function PlansTab({ plans: initialPlans }: PlansTabProps) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Plan name is required");
      return;
    }
    setIsCreating(true);
    const result = await createProductionPlan({
      name: trimmedName,
      description: description.trim() || null,
    });
    setIsCreating(false);
    if (result.success) {
      router.push(`/production/plans/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }, [name, description, router]);

  // Keep client state in sync if parent rehydrates
  if (initialPlans !== plans && plans === undefined) {
    setPlans(initialPlans);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Start new plan</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Week 22 priorities"
              disabled={isCreating}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What do you plan to make?"
              className="min-h-[72px] [field-sizing:content]"
              disabled={isCreating}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {isCreating ? "Creating…" : "Create plan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Plans ({initialPlans.length})
        </h3>
        {initialPlans.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            No plans yet. Create your first plan above.
          </div>
        ) : (
          <div className="space-y-1">
            {initialPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => router.push(`/production/plans/${plan.id}`)}
                className="w-full text-left rounded-lg border bg-card p-3 shadow-sm hover:bg-accent/40 transition-colors flex items-center gap-3"
              >
                <Layers className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-medium truncate">{plan.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(plan.createdAt)}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {plan.description}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-right shrink-0 whitespace-nowrap">
                  <div>{plan.packageCount} pkg</div>
                  <div className="tabular-nums">{plan.totalPieces} pcs · {plan.totalVolumeM3.toFixed(3).replace(".", ",")} m³</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
