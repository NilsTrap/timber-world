"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@timber/ui";
import { formatDate } from "@/lib/utils";
import { createTrackingSet } from "../actions/tracking";
import { deleteTrackingSet } from "../actions/tracking";
import type { TrackingSetListItem } from "../actions/tracking";

interface TrackingTabProps {
  trackingSets: TrackingSetListItem[];
}

export function TrackingTab({ trackingSets }: TrackingTabProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const result = await createTrackingSet(name.trim());
    if (result.success) {
      toast.success("Tracking set created");
      setName("");
      router.push(`/production/tracking/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteTrackingSet(id);
    if (result.success) {
      toast.success("Tracking set deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Create new tracking set */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">New Tracking Set</h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order #1234, Batch March 2026..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={creating}
            />
          </div>
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create
          </Button>
        </form>
      </div>

      {/* Tracking sets list */}
      {trackingSets.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No tracking sets yet. Create one above to start tracking packages through production.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {trackingSets.map((set) => (
            <div
              key={set.id}
              className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/production/tracking/${set.id}`)}
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-medium">{set.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {set.packageCount} package{set.packageCount !== 1 ? "s" : ""} · Created {formatDate(set.createdAt)}
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    disabled={deletingId === set.id}
                  >
                    {deletingId === set.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete tracking set?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &ldquo;{set.name}&rdquo; and remove all tracked packages from it.
                      The packages themselves will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(set.id);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
