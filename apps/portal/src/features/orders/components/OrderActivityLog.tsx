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
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <History className="h-5 w-5" />
        Activity Log
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity...
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No activity recorded yet.</p>
      ) : (
        <div className="rounded-md border divide-y max-h-[400px] overflow-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                {formatDateTime(entry.createdAt)}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                {entry.details && (
                  <span className="text-muted-foreground"> — {entry.details}</span>
                )}
              </div>
              {entry.userName && (
                <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                  {entry.userName}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
