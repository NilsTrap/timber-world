"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@timber/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { deleteProductionEntry } from "../actions";
import type { ProductionListItem } from "../types";

interface DraftProductionListProps {
  drafts: ProductionListItem[];
}

/**
 * Production List
 *
 * Shows all production entries (draft + validated).
 * Draft entries link to the editable entry page.
 * Includes inline delete for draft entries.
 */
export function DraftProductionList({ drafts }: DraftProductionListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (drafts.length === 0) return null;

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId);
    const result = await deleteProductionEntry(entryId);
    if (result.success) {
      toast.success("Draft entry deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Production Entries</h2>
      <div className="grid gap-2">
        {drafts.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm"
          >
            <Link
              href={`/production/${entry.id}`}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-70 transition-opacity"
            >
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{entry.processName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.productionDate)} &middot; Created{" "}
                  {formatDateTime(entry.createdAt)}
                  {entry.createdByName && ` by ${entry.createdByName}`}
                </p>
              </div>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-yellow-100 text-yellow-800">
              Draft
            </span>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={deletingId === entry.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete draft entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &ldquo;{entry.processName}&rdquo; and all its
                      inputs and outputs. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deletingId === entry.id ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        ))}
      </div>
    </div>
  );
}
