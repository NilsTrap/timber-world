"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@timber/ui";
import { createCorrectionEntry } from "../actions";

interface CreateCorrectionButtonProps {
  originalEntryId: string;
}

/**
 * Client component button that creates a correction entry
 * linked to the given original production entry.
 */
export function CreateCorrectionButton({ originalEntryId }: CreateCorrectionButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    const result = await createCorrectionEntry(originalEntryId);
    if (result.success) {
      toast.success("Correction entry created");
      router.push(`/production/${result.data.id}`);
    } else {
      toast.error(result.error);
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Creating..." : "Create Correction"}
    </Button>
  );
}
