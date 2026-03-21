import { useState, useCallback } from "react";

/**
 * Persist the active tab in sessionStorage so it survives navigation and refresh.
 *
 * Usage:
 *   const [tab, setTab] = usePersistedTab("shipments-tab", "drafts");
 *   <Tabs value={tab} onValueChange={setTab}>
 *
 * @param storageKey  Unique key per page (e.g. "shipments-tab")
 * @param defaultTab  Fallback when nothing is stored and no URL override
 * @param urlDefault  Optional override from URL query param (takes priority on first load)
 */
export function usePersistedTab(
  storageKey: string,
  defaultTab: string,
  urlDefault?: string
): [string, (value: string) => void] {
  const [tab, setTabState] = useState<string>(() => {
    // URL param takes priority on first load
    if (urlDefault) return urlDefault;
    // Then check sessionStorage
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) return stored;
    }
    return defaultTab;
  });

  const setTab = useCallback(
    (value: string) => {
      setTabState(value);
      sessionStorage.setItem(storageKey, value);
    },
    [storageKey]
  );

  return [tab, setTab];
}
