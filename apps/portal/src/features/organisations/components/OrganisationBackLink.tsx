"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";

const STORAGE_KEY = "organisation-last-entry";

/**
 * Back link that clears the organisation entry memory
 * so the list page doesn't redirect back to the entry.
 */
export function OrganisationBackLink() {
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link
        href="/admin/organisations"
        onClick={() => sessionStorage.removeItem(STORAGE_KEY)}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Back to Organisations</span>
      </Link>
    </Button>
  );
}
