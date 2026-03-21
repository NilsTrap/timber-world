"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const STORAGE_KEY = "production-last-entry";

interface ProductionBackLinkProps {
  href: string;
}

/**
 * Back link that clears the production entry memory
 * so the list page doesn't redirect back to the entry.
 */
export function ProductionBackLink({ href }: ProductionBackLinkProps) {
  return (
    <Link
      href={href}
      onClick={() => sessionStorage.removeItem(STORAGE_KEY)}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Link>
  );
}
