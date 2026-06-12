"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@timber/ui";

const STORAGE_KEY = "production-last-entry";

interface ProductionBackLinkProps {
  href: string;
}

export function ProductionBackLink({ href }: ProductionBackLinkProps) {
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link
        href={href}
        onClick={() => sessionStorage.removeItem(STORAGE_KEY)}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Back</span>
      </Link>
    </Button>
  );
}
