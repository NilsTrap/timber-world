"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";

/**
 * Back link to the organisations list. (Q1: the sidebar "last entry" deep-jump
 * for /admin/organisations was removed, so there is no entry-memory key left to
 * clear here — this is now a plain back link.)
 */
export function OrganisationBackLink() {
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/admin/organisations">
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Back to companies</span>
      </Link>
    </Button>
  );
}
