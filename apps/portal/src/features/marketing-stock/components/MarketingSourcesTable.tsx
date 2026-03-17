"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import {
  getMarketingSources,
  toggleMarketingSource,
  type MarketingSource,
} from "../actions/getMarketingSources";

export function MarketingSourcesTable() {
  const [sources, setSources] = useState<MarketingSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSources = async () => {
    const result = await getMarketingSources();
    if (result.success) {
      setSources(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleToggle = async (orgId: string, currentEnabled: boolean) => {
    setToggling(orgId);
    const result = await toggleMarketingSource(orgId, !currentEnabled);
    if (result.success) {
      setSources((prev) =>
        prev.map((s) => (s.id === orgId ? { ...s, marketing_enabled: !currentEnabled } : s))
      );
    } else {
      setError(result.error);
    }
    setToggling(null);
  };

  const enabledCount = sources.filter((s) => s.marketing_enabled).length;
  const enabledPackages = sources
    .filter((s) => s.marketing_enabled)
    .reduce((sum, s) => sum + s.package_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium">{enabledCount}</span> organisations enabled |{" "}
        <span className="font-medium">{enabledPackages.toLocaleString()}</span> packages in marketing stock
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Enabled</TableHead>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="text-right w-32">Available Pkgs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell>
                  <button
                    onClick={() => handleToggle(source.id, source.marketing_enabled)}
                    disabled={toggling === source.id}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    style={{
                      backgroundColor: source.marketing_enabled ? "#16a34a" : "#d1d5db",
                    }}
                  >
                    {toggling === source.id ? (
                      <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                    ) : (
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                        style={{
                          transform: source.marketing_enabled
                            ? "translateX(18px)"
                            : "translateX(3px)",
                        }}
                      />
                    )}
                  </button>
                </TableCell>
                <TableCell className="font-mono font-medium">{source.code}</TableCell>
                <TableCell>{source.name}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      source.is_external
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {source.is_external ? "External" : "Internal"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {source.package_count > 0 ? (
                    <span className="font-medium">{source.package_count.toLocaleString()}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
