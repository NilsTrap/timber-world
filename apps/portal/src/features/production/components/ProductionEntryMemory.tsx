"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "production-last-entry";

/**
 * Saves the current production entry URL to sessionStorage
 * so the production list page can redirect back here.
 * Renders nothing.
 */
export function ProductionEntryMemory() {
  const pathname = usePathname();

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, pathname);
  }, [pathname]);

  return null;
}
