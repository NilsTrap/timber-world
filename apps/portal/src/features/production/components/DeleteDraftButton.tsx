"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deleteProductionEntry } from "../actions";

interface DeleteDraftButtonProps {
  entryId: string;
  /** If true, shows different messaging for validated entries (Super Admin only) */
  isValidated?: boolean;
}

/**
 * Client component button that deletes a production entry
 * after user confirmation via AlertDialog.
 *
 * For drafts: available to entry owner
 * For validated: available to Super Admin only
 */
export function DeleteDraftButton({ entryId, isValidated = false }: DeleteDraftButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    setIsPending(true);
    const result = await deleteProductionEntry(entryId);
    if (result.success) {
      toast.success(isValidated ? "Production entry deleted" : "Draft entry deleted");
      router.push("/production?tab=history");
    } else {
      toast.error(result.error);
      setIsPending(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <Trash2 className="h-4 w-4 mr-1" />
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isValidated ? "Delete production entry?" : "Delete draft entry?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isValidated
              ? "This will permanently delete this validated production entry and all its inputs and outputs. This action cannot be undone."
              : "This will permanently delete this draft production entry and all its inputs and outputs. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
