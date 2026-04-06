"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "organisation-last-entry";

/**
 * Saves the current organisation detail URL to sessionStorage
 * so the sidebar link can redirect back here.
 * Renders nothing.
 */
export function OrganisationEntryMemory() {
  const pathname = usePathname();

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, pathname);
  }, [pathname]);

  return null;
}
