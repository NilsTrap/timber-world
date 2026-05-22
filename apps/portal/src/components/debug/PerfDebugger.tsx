"use client";

/**
 * Perf Debugger — temporary diagnostic component.
 *
 * Mounts once per page load. Captures:
 *   - Navigation timing (TTFB, DCL, Load)
 *   - Core Web Vitals (FCP, LCP, CLS, INP via PerformanceObserver)
 *   - Resource timing breakdown (counts + bytes by type, slowest 8)
 *   - Long tasks (>50ms blocking the main thread)
 *   - Server-action invocations seen on the wire (URLs containing _rsc or
 *     ?_rsc, plus any fetch() to /api/* or /*?action)
 *
 * All output goes to console.log with a clear "PERF:" prefix so users can
 * filter and copy back to us.
 *
 * To disable: remove the import + mount in apps/portal/src/app/(portal)/layout.tsx.
 */

import { useEffect } from "react";

type Metric = { name: string; value: number; entryType?: string };

function fmtMs(ms: number): string {
  return `${Math.round(ms)}ms`;
}

function fmtKb(bytes: number): string {
  return bytes < 1024 ? `${bytes}b` : `${(bytes / 1024).toFixed(1)}kb`;
}

export function PerfDebugger() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tag = "[PERF]";
    const mountedAt = performance.now();
    let lcpValue = 0;
    let lcpEl: Element | null = null;
    let clsValue = 0;
    let longTaskCount = 0;
    let longTaskTotal = 0;

    // ─── Web Vitals via PerformanceObserver ───────────────────────────
    const observers: PerformanceObserver[] = [];

    try {
      const lcpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { element?: Element; startTime: number };
          lcpValue = e.startTime;
          if (e.element) lcpEl = e.element;
        }
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
      observers.push(lcpObs);
    } catch {/* not supported */}

    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!e.hadRecentInput && typeof e.value === "number") clsValue += e.value;
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
      observers.push(clsObs);
    } catch {/* not supported */}

    try {
      const ltObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCount++;
          longTaskTotal += entry.duration;
          if (entry.duration > 200) {
            console.log(`${tag} LONG-TASK ${fmtMs(entry.duration)} at startTime=${fmtMs(entry.startTime)}`);
          }
        }
      });
      ltObs.observe({ type: "longtask", buffered: true });
      observers.push(ltObs);
    } catch {/* not supported */}

    try {
      const inpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { interactionId?: number; duration: number };
          if (e.interactionId && e.duration > 100) {
            console.log(`${tag} SLOW-INTERACTION ${fmtMs(e.duration)} ${entry.entryType}/${entry.name}`);
          }
        }
      });
      inpObs.observe({ type: "event", buffered: true, durationThreshold: 100 } as PerformanceObserverInit);
      observers.push(inpObs);
    } catch {/* not supported */}

    // ─── Final report 2.5s after mount (LCP usually settled by then) ───
    const reportAt = window.setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

      const navMetrics: Metric[] = nav
        ? [
            { name: "ttfb", value: nav.responseStart - nav.requestStart },
            { name: "domContentLoaded", value: nav.domContentLoadedEventEnd - nav.fetchStart },
            { name: "load", value: nav.loadEventEnd - nav.fetchStart },
            { name: "fcp", value: fcp },
            { name: "lcp", value: lcpValue },
            { name: "cls", value: clsValue * 1000 }, // scale for readability
          ]
        : [];

      // Resource breakdown by type
      const byType: Record<string, { count: number; bytes: number; ms: number }> = {};
      for (const r of resources) {
        const t = r.initiatorType || "other";
        if (!byType[t]) byType[t] = { count: 0, bytes: 0, ms: 0 };
        byType[t].count++;
        byType[t].bytes += r.transferSize || 0;
        byType[t].ms += r.duration;
      }

      const slowest = [...resources]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8)
        .map((r) => ({
          url: r.name.replace(window.location.origin, "").slice(0, 80),
          dur: fmtMs(r.duration),
          size: fmtKb(r.transferSize || 0),
          type: r.initiatorType,
        }));

      const serverActions = resources
        .filter((r) => r.name.includes("_rsc") || r.name.includes("/api/"))
        .map((r) => ({ url: r.name.replace(window.location.origin, "").slice(0, 100), dur: fmtMs(r.duration), size: fmtKb(r.transferSize || 0) }));

      const lcpInfo = lcpEl
        ? `<${lcpEl.tagName.toLowerCase()}${lcpEl.id ? ` #${lcpEl.id}` : ""}${lcpEl.className ? ` .${String(lcpEl.className).split(" ").slice(0, 2).join(".")}` : ""}>`
        : "(none)";

      console.groupCollapsed(`${tag} ${window.location.pathname} — paste this back if it feels slow`);
      console.log(`Path:        ${window.location.pathname}`);
      console.log(`User agent:  ${navigator.userAgent.slice(0, 80)}`);
      console.log("");
      console.log("Vitals:");
      for (const m of navMetrics) {
        console.log(`  ${m.name.padEnd(18)} ${fmtMs(m.value)}`);
      }
      console.log(`  longTasks         ${longTaskCount} totalling ${fmtMs(longTaskTotal)}`);
      console.log(`  lcpElement        ${lcpInfo}`);
      console.log("");
      console.log("Resources by type:");
      for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes)) {
        console.log(`  ${t.padEnd(10)} ${String(v.count).padStart(3)}× ${fmtKb(v.bytes).padStart(8)} ${fmtMs(v.ms).padStart(7)}`);
      }
      console.log("");
      console.log("Slowest 8 resources:");
      for (const s of slowest) {
        console.log(`  ${s.dur.padStart(7)} ${s.size.padStart(8)} ${s.type.padEnd(10)} ${s.url}`);
      }
      if (serverActions.length > 0) {
        console.log("");
        console.log("Server-action / RSC fetches:");
        for (const s of serverActions) {
          console.log(`  ${s.dur.padStart(7)} ${s.size.padStart(8)} ${s.url}`);
        }
      }
      console.log("");
      console.log(`Mounted at: ${fmtMs(mountedAt)} after fetchStart`);
      console.groupEnd();
    }, 2500);

    return () => {
      window.clearTimeout(reportAt);
      for (const o of observers) o.disconnect();
    };
  }, []);

  return null;
}
