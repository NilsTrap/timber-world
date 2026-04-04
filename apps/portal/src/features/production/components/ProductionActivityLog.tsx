"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getProductionActivityLog } from "../actions/getProductionActivityLog";
import type { ActivityLogEntry } from "../actions/getProductionActivityLog";

const ACTION_LABELS: Record<string, string> = {
  created: "Entry created",
  correction_created: "Correction entry created",
  input_added: "Input added",
  input_removed: "Input removed",
  input_updated: "Input updated",
  outputs_saved: "Outputs saved",
  work_updated: "Work amounts updated",
  validated: "Validated",
  revalidated: "Re-validated",
  edits_applied: "Edits applied and re-validated",
  edit_cancelled: "Edit cancelled",
  output_validated: "Output sent to inventory",
  output_unvalidated: "Output removed from inventory",
  reverted: "Validation reverted to draft",
};

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatUserEmail(email: string | null): string {
  if (!email) return "System";
  // Show just the part before @
  const atIndex = email.indexOf("@");
  return atIndex > 0 ? email.substring(0, atIndex) : email;
}

interface ProductionActivityLogProps {
  productionEntryId: string;
}

export function ProductionActivityLog({ productionEntryId }: ProductionActivityLogProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getProductionActivityLog(productionEntryId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setEntries(result.data);
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [productionEntryId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading activity log...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-baseline gap-2 text-sm"
        >
          <span className="text-muted-foreground whitespace-nowrap text-xs tabular-nums">
            {formatDateTime(entry.createdAt)}
          </span>
          <span className="font-medium">
            {ACTION_LABELS[entry.action] || entry.action}
          </span>
          <span className="text-muted-foreground">
            by {formatUserEmail(entry.userEmail)}
          </span>
        </div>
      ))}
    </div>
  );
}
