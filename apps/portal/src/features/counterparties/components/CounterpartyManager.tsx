"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
import {
  Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  StatusBadge, SectionHeader, EmptyState,
} from "@timber/ui";
import { listCounterparties } from "../actions";
import type { CounterpartyBook, CounterpartyRow } from "../types";

const BOOK_LABELS: Record<CounterpartyBook, { title: string; record: string }> = {
  clients: { title: "Customers", record: "customer" },
  suppliers: { title: "Suppliers", record: "supplier" },
  traders: { title: "Traders", record: "trader" },
};

export function CounterpartyManager({
  book,
  canManage = false,
  accessMode = "self",
}: {
  book: CounterpartyBook;
  canManage?: boolean;
  accessMode?: "admin" | "manager" | "self";
}) {
  const [rows, setRows] = useState<CounterpartyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const labels = BOOK_LABELS[book];
  const companyHref = (id: string) =>
    accessMode === "admin" ? `/admin/organisations/${id}` : `/counterparties/${book}/${id}`;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listCounterparties(book);
    if (result.success) setRows(result.data);
    else toast.error(result.error);
    setLoading(false);
  }, [book]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={labels.title}
        subtitle={`${rows.length} compan${rows.length === 1 ? "y" : "ies"}`}
        action={canManage ? (
          <Button size="sm" asChild><Link href={`/counterparties/${book}/new`}><Plus className="h-4 w-4" /> Add {labels.record}</Link></Button>
        ) : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState message={canManage ? `No ${labels.record} companies linked yet.` : `No company is available in this book.`} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table dense>
            <TableHeader><TableRow>
              <TableHead className="w-16">Code</TableHead><TableHead>Name</TableHead>
              <TableHead className="w-20"><span className="flex items-center"><Users className="mr-1 h-3.5 w-3.5" />Users</span></TableHead>
              <TableHead>Registration</TableHead><TableHead>VAT</TableHead><TableHead>Country</TableHead>
              <TableHead className="w-20">Status</TableHead><TableHead className="w-12" />
            </TableRow></TableHeader>
            <TableBody>{rows.map((row) => (
              <TableRow key={row.id} className={row.isActive ? "group" : "group opacity-50"}>
                <TableCell className="font-mono font-medium">{row.code}</TableCell>
                <TableCell><Link className="font-medium hover:underline" href={companyHref(row.id)}>{row.name}</Link></TableCell>
                <TableCell className="text-center">{row.userCount ?? 0}</TableCell>
                <TableCell>{row.registrationNumber ?? "—"}</TableCell><TableCell>{row.vatNumber ?? "—"}</TableCell>
                <TableCell>{row.country ?? "—"}</TableCell>
                <TableCell><StatusBadge variant={row.isActive ? "success" : "draft"}>{row.isActive ? "Active" : "Inactive"}</StatusBadge></TableCell>
                <TableCell><Button asChild variant="ghost" size="icon-sm"><Link aria-label={`Open ${row.name}`} href={companyHref(row.id)}><ArrowRight className="h-4 w-4" /></Link></Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
