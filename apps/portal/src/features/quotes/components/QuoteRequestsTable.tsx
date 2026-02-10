"use client";

import { useState, useEffect, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
} from "@timber/ui";
import { getQuoteRequests, updateQuoteRequestStatus, type QuoteRequest } from "../actions/getQuoteRequests";

const statusColors: Record<string, "default" | "success" | "warning" | "secondary"> = {
  new: "warning",
  contacted: "secondary",
  quoted: "secondary",
  completed: "success",
  declined: "default",
};

export function QuoteRequestsTable() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    const result = await getQuoteRequests();
    if (result.success) {
      setRequests(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const result = await updateQuoteRequestStatus(id, newStatus);
    if (result.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">No quote requests yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Specifications</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <Fragment key={request.id}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() =>
                  setExpandedId(expandedId === request.id ? null : request.id)
                }
              >
                <TableCell className="whitespace-nowrap">
                  {formatDate(request.created_at)}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{request.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {request.email}
                  </div>
                  {request.company && (
                    <div className="text-sm text-muted-foreground">
                      {request.company}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {request.product || "—"}
                  {request.species && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {request.species}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {request.thickness || request.width || request.length ? (
                    <span>
                      {request.thickness && `${request.thickness}mm`}
                      {request.width && ` × ${request.width}mm`}
                      {request.length && ` × ${request.length}mm`}
                    </span>
                  ) : (
                    "—"
                  )}
                  {request.pieces && (
                    <div className="text-sm text-muted-foreground">
                      {request.pieces} pcs
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusColors[request.status] || "default"}>
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <select
                    value={request.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleStatusChange(request.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm border rounded px-2 py-1 bg-background"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="quoted">Quoted</option>
                    <option value="completed">Completed</option>
                    <option value="declined">Declined</option>
                  </select>
                </TableCell>
              </TableRow>
              {expandedId === request.id && (
                <TableRow key={`${request.id}-expanded`}>
                  <TableCell colSpan={6} className="bg-muted/30">
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <br />
                          {request.phone || "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <br />
                          {request.type || "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quality:</span>
                          <br />
                          {request.quality || "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Humidity:</span>
                          <br />
                          {request.humidity || "—"}
                        </div>
                      </div>
                      {request.notes && (
                        <div>
                          <span className="text-muted-foreground text-sm">
                            Notes:
                          </span>
                          <p className="mt-1 text-sm whitespace-pre-wrap bg-background p-3 rounded border">
                            {request.notes}
                          </p>
                        </div>
                      )}
                      {request.selected_product_ids &&
                        request.selected_product_ids.length > 0 && (
                          <div>
                            <span className="text-muted-foreground text-sm">
                              Selected Products ({request.selected_product_ids.length}):
                            </span>
                            <p className="mt-1 text-sm font-mono bg-background p-2 rounded border">
                              {request.selected_product_ids.join(", ")}
                            </p>
                          </div>
                        )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`mailto:${request.email}`);
                          }}
                        >
                          Send Email
                        </Button>
                        {request.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`tel:${request.phone}`);
                            }}
                          >
                            Call
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
