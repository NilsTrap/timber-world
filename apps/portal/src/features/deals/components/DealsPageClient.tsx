"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatusBadge,
  EmptyState,
} from "@timber/ui";
import { createDeal } from "../actions";
import type { Currency, Deal, DealStatus } from "../types";
import { CURRENCIES } from "../types";

const STATUS_VARIANT: Record<DealStatus, "draft" | "pending" | "success" | "info" | "warning" | "error"> = {
  draft: "draft",
  quoted: "info",
  confirmed: "pending",
  in_progress: "warning",
  shipped: "info",
  completed: "success",
  cancelled: "error",
};

export function DealsPageClient({ initialDeals }: { initialDeals: Deal[]; isAdmin: boolean }) {
  const router = useRouter();
  const [deals] = useState<Deal[]>(initialDeals);
  const [productGroup, setProductGroup] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createDeal({
        productGroup: productGroup.trim() || null,
        customerNameForCode: customerName.trim() || null,
        currency,
      });
      if (res.success) {
        router.push(`/deals/${res.data.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* New deal */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">New deal</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Product group</label>
            <Input value={productGroup} onChange={(e) => setProductGroup(e.target.value)} placeholder="e.g. malka" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer name</label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Buyer (used for the deal code)" />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Currency</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-4">
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? "Creating…" : "Create deal"}
          </Button>
        </div>
      </div>

      {/* List */}
      {deals.length === 0 ? (
        <EmptyState message="No deals yet. Create one above to get started." />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/deals/${d.id}`)}>
                  <TableCell className="font-medium">
                    <Link href={`/deals/${d.id}`} className="hover:underline">{d.code}</Link>
                  </TableCell>
                  <TableCell>{d.productGroup ?? "—"}</TableCell>
                  <TableCell>{d.customer.name ?? "—"}</TableCell>
                  <TableCell>{d.currency}</TableCell>
                  <TableCell><StatusBadge variant={STATUS_VARIANT[d.status]}>{d.status}</StatusBadge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
