import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { spawn } from "child_process";
import path from "path";

/**
 * POST /api/scraper
 *
 * Runs the mass.ee scraper.
 * Body: { mode: "discover" | "scrape" }
 *
 * - "discover": visits category pages to find all product URLs (~22 page loads)
 * - "scrape": scrapes prices/stock from saved URLs, then pushes to database
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
  const mode: string = body.mode || "scrape";

  // Resolve paths
  const projectRoot = path.resolve(process.cwd(), "../..");
  const scraperDir = path.join(projectRoot, "tools/mass-scraper");
  const scraperScript = path.join(scraperDir, "scraper.ts");
  const pushScript = path.join(scraperDir, "push.ts");
  const resultsFile = path.join(scraperDir, "latest-results.json");

  // Build scraper args
  const scraperArgs = ["tsx", scraperScript, "--output", "json", "--file", resultsFile];
  if (mode === "discover") {
    scraperArgs.push("--discover");
  }

  const scraperEnv = {
    ...process.env,
    NODE_ENV: "production",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  } as NodeJS.ProcessEnv;

  // Stream output back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      send({ type: "status", message: `Starting ${mode === "discover" ? "discovery" : "scraping"}...` });

      const scraper = spawn("npx", scraperArgs, {
        cwd: scraperDir,
        env: scraperEnv,
        shell: true,
      });

      scraper.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("at ") && (
            trimmed.startsWith("Total") ||
            trimmed.startsWith("Found") ||
            trimmed.startsWith("Scraping") ||
            trimmed.startsWith("Discovering") ||
            trimmed.startsWith("Parsing") ||
            trimmed.startsWith("Deactivating") ||
            trimmed.startsWith("Saved") ||
            trimmed.startsWith("Discovery") ||
            trimmed.startsWith("Loaded") ||
            trimmed.startsWith("Species:") ||
            trimmed.startsWith("Qualities:") ||
            trimmed.startsWith("Visiting") ||
            trimmed.startsWith("Progress") ||
            trimmed.startsWith("No saved") ||
            trimmed.startsWith("---") ||
            trimmed.startsWith("===") ||
            trimmed.includes("product") ||
            trimmed.includes("URL") ||
            trimmed.includes("thickness") ||
            trimmed.includes("Processing") ||
            trimmed.includes("excl VAT") ||
            trimmed.includes("Summary") ||
            trimmed.includes("stock") ||
            trimmed.includes("pieces")
          )) {
            send({ type: "log", message: trimmed });
          }
        }
      });

      scraper.stderr?.on("data", (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          send({ type: "log", message: text });
        }
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
          const text = data.toString();
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (trimmed && (
              trimmed.startsWith("Found") ||
              trimmed.startsWith("Successfully") ||
              trimmed.startsWith("Saved") ||
              trimmed.startsWith("Matched") ||
              trimmed.startsWith("Inserting") ||
              trimmed.startsWith("Fetching") ||
              trimmed.includes("product") ||
              trimmed.includes("record")
            )) {
              send({ type: "log", message: trimmed });
            }
          }
        });

        push.stderr?.on("data", (data: Buffer) => {
          const text = data.toString().trim();
          if (text) {
            send({ type: "log", message: text });
          }
        });

        push.on("close", (pushCode) => {
          if (pushCode !== 0) {
            send({ type: "error", message: `Push exited with code ${pushCode}` });
          } else {
            send({ type: "done", message: "Complete! Prices and stock updated." });
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
