"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ProductionListItem } from "../types";

interface DraftProductionListProps {
  drafts: ProductionListItem[];
}

/**
 * Production List
 *
 * Shows all production entries (draft + validated).
 * Draft entries link to the editable entry page.
 * Validated entries link to the read-only detail view.
 */
export function DraftProductionList({ drafts }: DraftProductionListProps) {
  if (drafts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Production Entries</h2>
      <div className="grid gap-2">
        {drafts.map((entry) => (
          <Link
            key={entry.id}
            href={`/production/${entry.id}`}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors"
          >
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{entry.processName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(entry.productionDate)} &middot; Created{" "}
                {formatDateTime(entry.createdAt)}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                entry.status === "draft"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {entry.status === "draft" ? "Draft" : "Validated"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
