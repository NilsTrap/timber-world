"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When a shipment is not found (e.g. deleted), clear the stored
 * sidebar shortcut so the user isn't stuck in a redirect loop.
 */
export default function ShipmentNotFound() {
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem("shipment-last-entry");
    router.replace("/shipments");
  }, [router]);

  return null;
}
