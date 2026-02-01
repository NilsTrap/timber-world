"use client";

import { useRouter } from "next/navigation";
import { Eye, X, Lock, Unlock } from "lucide-react";
import { Button } from "@timber/ui";
import { exitViewAs, toggleViewAsReadOnly } from "../actions/viewAs";

interface ViewAsBannerProps {
  organizationName?: string;
  userName?: string;
  isReadOnly: boolean;
}

/**
 * Banner shown when platform admin is viewing as another org/user
 */
export function ViewAsBanner({
  organizationName,
  userName,
  isReadOnly,
}: ViewAsBannerProps) {
  const router = useRouter();

  const handleExit = async () => {
    await exitViewAs();
    router.refresh();
  };

  const handleToggleReadOnly = async () => {
    await toggleViewAsReadOnly(!isReadOnly);
    router.refresh();
  };

  const viewingText = userName
    ? `${userName} @ ${organizationName || "Unknown Org"}`
    : organizationName || "Unknown Organization";

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as: <strong>{viewingText}</strong>
        </span>
        {isReadOnly && (
          <span className="bg-amber-600 text-amber-100 text-xs px-2 py-0.5 rounded">
            Read-only
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleReadOnly}
          className="h-7 text-amber-950 hover:bg-amber-600"
        >
          {isReadOnly ? (
            <>
              <Unlock className="h-3 w-3 mr-1" />
              Enable Actions
            </>
          ) : (
            <>
              <Lock className="h-3 w-3 mr-1" />
              Read-only
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="h-7 text-amber-950 hover:bg-amber-600"
        >
          <X className="h-3 w-3 mr-1" />
          Exit View As
        </Button>
      </div>
    </div>
  );
}
