"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, History } from "lucide-react";
import { getOrderActivityLog, type OrderActivityEntry } from "../actions/getOrderActivityLog";

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Created order",
  updated: "Updated order",
  status_changed: "Changed status",
  products_saved: "Saved products",
  file_uploaded: "Uploaded file",
  file_deleted: "Deleted file",
  thumbnail_changed: "Changed thumbnail",
  sourcing_started: "Sourcing started",
};

interface OrderActivityLogProps {
  orderId: string;
  tab?: string;
}

export function OrderActivityLog({ orderId, tab }: OrderActivityLogProps) {
  const [entries, setEntries] = useState<OrderActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = useCallback(async () => {
    const result = await getOrderActivityLog(orderId, tab);
    if (result.success) {
      setEntries(result.data);
    }
    setLoading(false);
  }, [orderId, tab]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" />
        Activity
      </h3>
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="max-h-[360px] divide-y overflow-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="py-2 first:pt-0">
              {/* Compact + stacked so it never squeezes/wraps badly in the narrow
                  action column: action + time on top, details + who beneath. */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium leading-tight">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                <time className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
              </div>
              {(entry.details || entry.userName) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.details}
                  {entry.details && entry.userName ? " · " : ""}
                  {entry.userName}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
