"use client";

import { useEffect } from "react";
import { Button } from "@timber/ui";
import { AlertCircle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartiesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Parties Error:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Parties</h1>
        <p className="text-muted-foreground">Something went wrong</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Failed to load parties</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          An error occurred while loading the parties. Please try again.
        </p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
