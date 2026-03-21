"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When a production entry is not found (e.g. deleted), clear the stored
 * sidebar shortcut so the user isn't stuck in a redirect loop.
 */
export default function ProductionEntryNotFound() {
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem("production-last-entry");
    router.replace("/production");
  }, [router]);

  return null;
}
