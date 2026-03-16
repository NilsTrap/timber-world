"use server";

import { getSession, isAdmin } from "@/lib/auth";
import * as fs from "fs";
import * as path from "path";
import type { ActionResult } from "../types";

export interface ScraperScript {
  filename: string;
  content: string;
}

export async function getScraperScripts(
  source: string
): Promise<ActionResult<ScraperScript[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const scraperDirs: Record<string, string> = {
    "mass.ee": "tools/mass-scraper",
  };

  const dir = scraperDirs[source];
  if (!dir) {
    return { success: false, error: "Unknown source", code: "NOT_FOUND" };
  }

  const projectRoot = process.cwd();
  const fullDir = path.join(projectRoot, dir);

  const scriptFiles = ["config.ts", "scraper.ts", "push.ts"];
  const scripts: ScraperScript[] = [];

  for (const filename of scriptFiles) {
    const filePath = path.join(fullDir, filename);
    if (fs.existsSync(filePath)) {
      scripts.push({
        filename,
        content: fs.readFileSync(filePath, "utf-8"),
      });
    }
  }

  return { success: true, data: scripts };
}
