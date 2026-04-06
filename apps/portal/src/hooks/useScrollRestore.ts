import { useCallback, useEffect, useRef } from "react";

/**
 * Save and restore scroll position of a scrollable container.
 *
 * Uses a callback ref so scroll is restored the moment the element mounts.
 * Retries horizontal restore until the content is wide enough to scroll to.
 * Suppresses saving during the restore phase to avoid overwriting the target.
 *
 * @param storageKey  Unique key per page/tab (e.g. "orders-sales-scroll")
 * @returns callback ref to attach to the scrollable container element
 */
export function useScrollRestore(storageKey: string) {
  const elRef = useRef<HTMLElement | null>(null);
  const restoredRef = useRef(false);
  const restoringRef = useRef(false);

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      elRef.current = el;

      if (el && !restoredRef.current) {
        restoredRef.current = true;
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          try {
            const { top, left } = JSON.parse(saved);
            restoringRef.current = true;

            let attempts = 0;
            const tryRestore = () => {
              el.scrollTop = top;
              el.scrollLeft = left;

              if (left > 0 && el.scrollLeft < left - 1 && attempts < 30) {
                attempts++;
                requestAnimationFrame(tryRestore);
              } else {
                // Done restoring — allow saving again after one more frame
                requestAnimationFrame(() => {
                  restoringRef.current = false;
                });
              }
            };

            requestAnimationFrame(tryRestore);
          } catch {
            restoringRef.current = false;
          }
        }
      }
    },
    [storageKey]
  );

  // Save position on scroll (throttled), but not during restore
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (restoringRef.current) return;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          if (!restoringRef.current) {
            sessionStorage.setItem(
              storageKey,
              JSON.stringify({ top: el.scrollTop, left: el.scrollLeft })
            );
          }
          ticking = false;
        });
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  return setRef;
}
