"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@timber/ui";
import { deleteProductionEntry } from "../actions";

interface PackageUsageInfo {
  packageId: string;
  packageNumber: string;
  usedInProcessName: string;
  usedInProductionDate: string;
  usedInEntryId: string;
}

interface ValidatedEntryActionsProps {
  entryId: string;
  /** Pre-fetched list of packages that are used elsewhere (for tooltip) */
  usedPackages?: PackageUsageInfo[];
}

/**
 * Actions for validated production entries:
 * - Edit button: enters edit mode (packages used elsewhere become read-only)
 * - Delete button: deletes entry and restores inventory (disabled if packages are used)
 *
 * Shows tooltips explaining why actions might be disabled.
 */
export function ValidatedEntryActions({
  entryId,
  usedPackages = [],
}: ValidatedEntryActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteProductionEntry(entryId);
    if (result.success) {
      toast.success("Production entry deleted and inventory restored");
      router.push("/production?tab=history");
    } else {
      toast.error(result.error);
      setIsDeleting(false);
    }
  };

  const handleEditClick = () => {
    router.push(`/production/${entryId}?edit=true`);
  };

  const canDelete = usedPackages.length === 0;

  // Build tooltip message for blocked delete
  const deleteTooltip = canDelete
    ? "Delete this entry and restore input packages to inventory"
    : `Cannot delete: ${usedPackages.length} package(s) are used in other processes:\n${usedPackages
        .slice(0, 5)
        .map((p) => `${p.packageNumber} - ${p.usedInProcessName}`)
        .join("\n")}${usedPackages.length > 5 ? `\n...and ${usedPackages.length - 5} more` : ""}`;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Edit Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleEditClick}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>

        {/* Delete Button with AlertDialog */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <AlertDialogTrigger asChild disabled={!canDelete}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeleting || !canDelete}
                    className={!canDelete ? "opacity-50 cursor-not-allowed" : "hover:border-destructive hover:text-destructive"}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </AlertDialogTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className={!canDelete ? "max-w-xs whitespace-pre-line bg-destructive text-destructive-foreground" : ""}
            >
              {deleteTooltip}
            </TooltipContent>
          </Tooltip>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                Delete validated production entry?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="font-medium text-destructive">
                    This action will permanently delete this production entry and reverse all inventory changes:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Input packages will be restored to their original state</li>
                    <li>Output packages will be removed from inventory</li>
                    <li>All production data will be deleted</li>
                  </ul>
                  <p className="font-bold text-destructive">
                    This action cannot be undone!
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Entry"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
