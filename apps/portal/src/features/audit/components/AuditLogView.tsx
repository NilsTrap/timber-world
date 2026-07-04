"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ShieldCheck, Bot, User } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Badge,
} from "@timber/ui";
import { getAuditLog, getAuditResourceTypes } from "../actions/getAuditLog";
import type { AuditLogEntry, AuditActorType } from "../types";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}.${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

/** Human vs service badge — distinguishes Vilma/MCP writes from real people. */
function ActorBadge({ type }: { type: AuditActorType }) {
  if (type === "service") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Bot className="h-3 w-3" /> Service
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <User className="h-3 w-3" /> Human
    </Badge>
  );
}

function short(id: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [actorType, setActorType] = useState<"" | AuditActorType>("");
  const [resourceType, setResourceType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAuditLog({
      actorType: actorType || undefined,
      resourceType: resourceType || undefined,
      search: search || undefined,
    });
    if (result.success) setEntries(result.data);
    setLoading(false);
  }, [actorType, resourceType, search]);

  // Resource-type dropdown options (once).
  useEffect(() => {
    getAuditResourceTypes().then((r) => {
      if (r.success) setResourceTypes(r.data);
    });
  }, []);

  // Debounced reload on filter change.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={actorType}
          onChange={(e) => setActorType(e.target.value as "" | AuditActorType)}
        >
          <option value="">All actors</option>
          <option value="human">Human</option>
          <option value="service">Service</option>
        </select>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
        >
          <option value="">All resources</option>
          {resourceTypes.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
        <Input
          className="h-8 w-56 text-xs"
          placeholder="Search action / actor / id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? "" : `${entries.length} event${entries.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> No audit events match these filters yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const meta =
                  e.metadata && Object.keys(e.metadata).length > 0
                    ? JSON.stringify(e.metadata)
                    : "";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(e.at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <ActorBadge type={e.actorType} />
                        <span title={e.actorUserId ?? undefined}>
                          {e.actorLabel ?? "—"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap font-mono"
                      title={meta || undefined}
                    >
                      {e.action}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span title={e.resourceId ?? undefined}>
                        {e.resourceType}
                        {e.resourceId ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {short(e.resourceId)}
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-muted-foreground"
                      title={e.organisationId ?? undefined}
                    >
                      {short(e.organisationId)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {e.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
