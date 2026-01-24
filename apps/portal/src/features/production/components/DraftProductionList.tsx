"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { ProductionListItem } from "../types";

interface DraftProductionListProps {
  drafts: ProductionListItem[];
}

/**
 * Draft Production List
 *
 * Shows existing draft production entries that can be continued.
 * Only renders when drafts exist.
 */
export function DraftProductionList({ drafts }: DraftProductionListProps) {
  if (drafts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Draft Entries</h2>
      <div className="grid gap-2">
        {drafts.map((draft) => (
          <Link
            key={draft.id}
            href={`/production/${draft.id}`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors"
          >
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{draft.processName}</p>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                {new Date(draft.productionDate + "T00:00:00").toLocaleDateString()} &middot; Created{" "}
                {new Date(draft.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
              Draft
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
