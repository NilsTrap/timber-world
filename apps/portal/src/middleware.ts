import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — adds a Server-Timing header that includes total
 * middleware-edge time so it shows up in the browser DevTools "Network"
 * pane next to each request, and a `[PERF-SRV]` console log line that
 * lands in Vercel function logs.
 *
 * This is diagnostic-only. Remove once perf issues are tracked down.
 */
export function middleware(req: NextRequest) {
  const start = Date.now();
  const url = req.nextUrl;
  const path = url.pathname + (url.search ? url.search : "");

  const res = NextResponse.next();
  const dur = Date.now() - start;

  // Server-Timing surfaces in Chrome DevTools → Network → Timing tab.
  // Each metric is "name;dur=<ms>". Multiple metrics can be combined.
  res.headers.set("Server-Timing", `mw;dur=${dur};desc="edge middleware"`);

  // Vercel function logs (visible via `vercel logs` or the dashboard).
  // We only log path + duration — keep the line short for grep-ability.
  console.log(`[PERF-SRV] mw ${dur}ms ${req.method} ${path}`);

  return res;
}

export const config = {
  // Skip static asset paths so we don't spam logs.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|otf|css|js)$).*)"],
};
