"use client";

import { useEffect, useState } from "react";

/**
 * Client-side permissions hook (Story 10.8)
 *
 * Fetches effective permissions from server and provides
 * hasPermission() check for client components.
 */

interface UsePermissionsResult {
  permissions: string[];
  hasPermission: (featureCode: string) => boolean;
  isLoading: boolean;
  isPlatformAdmin: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const response = await fetch("/api/auth/permissions");
        if (response.ok) {
          const data = await response.json();
          setPermissions(data.permissions || []);
          setIsPlatformAdmin(data.isPlatformAdmin || false);
        }
      } catch (error) {
        console.error("Failed to fetch permissions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, []);

  const hasPermission = (featureCode: string): boolean => {
    if (isPlatformAdmin) return true;
    return permissions.includes(featureCode);
  };

  return {
    permissions,
    hasPermission,
    isLoading,
    isPlatformAdmin,
  };
}
