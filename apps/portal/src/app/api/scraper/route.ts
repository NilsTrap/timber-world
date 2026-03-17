import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { spawn } from "child_process";
import path from "path";

/**
 * Source → scraper directory mapping
 */
const SCRAPER_DIRS: Record<string, string> = {
  "mass.ee": "tools/mass-scraper",
  "slhardwoods.co.uk": "tools/sl-hardwoods-scraper",
  "uktimber.co.uk": "tools/uk-timber-scraper",
  "timbersource.co.uk": "tools/timbersource-scraper",
  "fiximer.co.uk": "tools/fiximer-scraper",
};

/**
 * POST /api/scraper
 *
 * Runs a competitor scraper.
 * Body: { source: string, mode: "discover" | "scrape", filter?: object }
 *
 * - "discover": finds product URLs and saves them to database
 * - "scrape": scrapes prices from saved URLs, then pushes to database
 *
 * Returns a streaming response with scraper output.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const body = await request.json();
  const source: string = body.source || "mass.ee";
  const mode: string = body.mode || "scrape";
  const filter = body.filter || {};

  console.log("[scraper route] source:", source, "mode:", mode, "filter:", JSON.stringify(filter));

  // Resolve paths based on source
  const scraperDirName = SCRAPER_DIRS[source];
  if (!scraperDirName) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
  }

  const projectRoot = path.resolve(process.cwd(), "../..");
  const scraperDir = path.join(projectRoot, scraperDirName);
  const scraperScript = path.join(scraperDir, "scraper.ts");
  const pushScript = path.join(scraperDir, "push.ts");
  const resultsFile = path.join(scraperDir, "latest-results.json");

  // Build scraper args
  const scraperArgs = ["tsx", scraperScript, "--output", "json", "--file", resultsFile];
  if (mode === "discover") {
    scraperArgs.push("--discover");
  }

  // Pass filter via env var to avoid shell escaping issues
  const hasFilter = mode === "scrape" && Object.keys(filter).length > 0;

  const scraperEnv = {
    ...process.env,
    NODE_ENV: "production",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    ...(hasFilter ? { SCRAPER_FILTER: JSON.stringify(filter) } : {}),
  } as NodeJS.ProcessEnv;

  // Broad log filter — pass through any meaningful output line
  const isLogLine = (line: string): boolean => {
    if (!line || line.startsWith("at ")) return false;
    return (
      line.startsWith("[") ||
      line.startsWith("Total") ||
      line.startsWith("Found") ||
      line.startsWith("Scraping") ||
      line.startsWith("Discovering") ||
      line.startsWith("Parsing") ||
      line.startsWith("Deactivating") ||
      line.startsWith("Saved") ||
      line.startsWith("Discovery") ||
      line.startsWith("Loaded") ||
      line.startsWith("Species:") ||
      line.startsWith("Qualities:") ||
      line.startsWith("Visiting") ||
      line.startsWith("Progress") ||
      line.startsWith("No saved") ||
      line.startsWith("Reading") ||
      line.startsWith("MISSING") ||
      line.startsWith("---") ||
      line.startsWith("===") ||
      line.includes("product") ||
      line.includes("URL") ||
      line.includes("thickness") ||
      line.includes("Processing") ||
      line.includes("excl VAT") ||
      line.includes("Summary") ||
      line.includes("stock") ||
      line.includes("pieces") ||
      line.includes("upsert") ||
      line.includes("Upsert") ||
      line.includes("error") ||
      line.includes("Error")
    );
  };

  // Stream output back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      send({ type: "status", message: `Starting ${mode === "discover" ? "discovery" : "scraping"} for ${source}...` });

      const scraper = spawn("npx", scraperArgs, {
        cwd: scraperDir,
        env: scraperEnv,
        shell: true,
      });

      scraper.stdout?.on("data", (data: Buffer) => {
        for (const line of data.toString().split("\n")) {
          const trimmed = line.trim();
          if (isLogLine(trimmed)) {
            send({ type: "log", message: trimmed });
          }
        }
      });

      scraper.stderr?.on("data", (data: Buffer) => {
        const text = data.toString().trim();
        if (text) send({ type: "log", message: text });
      });

      scraper.on("close", (code) => {
        if (code !== 0) {
          send({ type: "error", message: `Scraper exited with code ${code}` });
          controller.close();
          return;
        }

        // Discovery mode — no push needed
        if (mode === "discover") {
          send({ type: "done", message: "Discovery complete! URLs saved to database." });
          controller.close();
          return;
        }

        // Scrape mode — push results to database
        send({ type: "status", message: "Scraping complete. Pushing results to database..." });

        const push = spawn("npx", ["tsx", pushScript, resultsFile], {
          cwd: scraperDir,
          env: scraperEnv,
          shell: true,
        });

        push.stdout?.on("data", (data: Buffer) => {
          for (const line of data.toString().split("\n")) {
            const trimmed = line.trim();
            if (isLogLine(trimmed)) {
              send({ type: "log", message: trimmed });
            }
          }
        });

        push.stderr?.on("data", (data: Buffer) => {
          const text = data.toString().trim();
          if (text) send({ type: "log", message: text });
        });

        push.on("close", (pushCode) => {
          if (pushCode !== 0) {
            send({ type: "error", message: `Push exited with code ${pushCode}` });
          } else {
            send({ type: "done", message: "Complete! Prices updated." });
          }
          controller.close();
        });
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
