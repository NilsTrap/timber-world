"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, History } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@timber/ui";
import { getUserLoginHistory } from "../actions/getUserLoginHistory";
import type { LoginHistoryEntry } from "../types";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
  return `${date} ${time}`;
}

/** Compact "Browser · OS" summary — the raw UA string is far too long for a cell. */
function shortUserAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Other";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
    ? "macOS"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function LoginHistorySection({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getUserLoginHistory(userId);
    if (result.success) {
      setEntries(result.data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" />
        Login History
      </h3>
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">
          No login history yet.
        </p>
      ) : (
        <Table dense>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(e.at)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {e.ip ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {shortUserAgent(e.userAgent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
