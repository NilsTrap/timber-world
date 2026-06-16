"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  PageHeader,
  StatusBadge,
  SummaryGrid,
  SummaryCard,
  SectionHeader,
  EmptyState,
} from "@timber/ui";
import { saveDealLineItems, generateDealDocument, getDealDocumentUrl } from "../actions";
import type { Deal, DealLineItem, DealStatus } from "../types";
import { DealLineItemsTable, newLineRow, type LineRow } from "./DealLineItemsTable";

const STATUS_VARIANT: Record<DealStatus, "draft" | "pending" | "success" | "info" | "warning" | "error"> = {
  draft: "draft",
  quoted: "info",
  confirmed: "pending",
  in_progress: "warning",
  shipped: "info",
  completed: "success",
  cancelled: "error",
};

function toRows(items: DealLineItem[]): LineRow[] {
  const sell = items.filter((i) => i.side === "sell");
  if (sell.length === 0) return [newLineRow(0)];
  return sell.map((i, idx) => ({
    clientId: i.id ?? `${idx}`,
    lineNo: i.lineNo ?? idx + 1,
    productName: i.productName ?? "",
    woodSpecies: i.woodSpecies ?? "",
    processing: i.processing ?? "",
    quality: i.quality ?? "",
    thickness: i.thickness ?? "",
    width: i.width ?? "",
    length: i.length ?? "",
    pieces: i.pieces ?? "",
    volumeM3: i.volumeM3 != null ? String(i.volumeM3) : "",
    unitPrice: i.unitPriceCents != null ? (i.unitPriceCents / 100).toFixed(2) : "",
  }));
}

function toItems(rows: LineRow[]): Partial<DealLineItem>[] {
  return rows
    .filter((r) => r.productName.trim() !== "" || r.volumeM3.trim() !== "" || r.pieces.trim() !== "")
    .map((r, idx) => {
      const vol = parseFloat(r.volumeM3);
      const price = parseFloat(r.unitPrice);
      return {
        side: "sell" as const,
        lineNo: idx + 1,
        productName: r.productName.trim() || null,
        woodSpecies: r.woodSpecies.trim() || null,
        processing: r.processing.trim() || null,
        quality: r.quality.trim() || null,
        thickness: r.thickness.trim() || null,
        width: r.width.trim() || null,
        length: r.length.trim() || null,
        pieces: r.pieces.trim() || null,
        volumeM3: Number.isFinite(vol) ? vol : null,
        unit: "m3" as const,
        unitPriceCents: Number.isFinite(price) ? Math.round(price * 100) : null,
      };
    });
}

export function DealDetailClient({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [rows, setRows] = useState<LineRow[]>(() => toRows(deal.lineItems ?? []));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [genPending, startGen] = useTransition();

  const totalVolume = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.volumeM3) || 0), 0),
    [rows]
  );

  function handleSave() {
    setMessage(null);
    setError(null);
    startSave(async () => {
      const res = await saveDealLineItems(deal.id, "sell", toItems(rows));
      if (res.success) {
        setMessage("Line items saved.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleGenerate() {
    setMessage(null);
    setError(null);
    startGen(async () => {
      // Save first so the document reflects the current table.
      const saveRes = await saveDealLineItems(deal.id, "sell", toItems(rows));
      if (!saveRes.success) {
        setError(saveRes.error);
        return;
      }
      const res = await generateDealDocument({ dealId: deal.id, docType: "sales_spec" });
      if (res.success) {
        setMessage(`Generated ${res.data.docNumber}.`);
        if (res.data.url) window.open(res.data.url, "_blank");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  async function handleDownload(documentId: string) {
    setError(null);
    const res = await getDealDocumentUrl(documentId);
    if (res.success) {
      window.open(res.data.url, "_blank");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/deals"
        backLabel="Deals"
        title={deal.code}
        subtitle={deal.customer.name ? `Customer: ${deal.customer.name}` : "No customer set"}
        badge={<StatusBadge variant={STATUS_VARIANT[deal.status]}>{deal.status}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={savePending}>
              {savePending ? "Saving…" : "Save"}
            </Button>
            <Button onClick={handleGenerate} disabled={genPending}>
              {genPending ? "Generating…" : "Generate Sales Specification"}
            </Button>
          </div>
        }
      />

      <SummaryGrid columns={4}>
        <SummaryCard label="Seller" value={deal.seller.name ?? deal.seller.code ?? "—"} />
        <SummaryCard label="Customer" value={deal.customer.name ?? "—"} />
        <SummaryCard label="Product group" value={deal.productGroup ?? "—"} />
        <SummaryCard label="Currency" value={deal.currency} />
        <SummaryCard label="Producer" value={deal.producer.name ?? "—"} />
        <SummaryCard label="Incoterms" value={deal.incoterms ?? "—"} />
        <SummaryCard label="Advance" value={deal.advancePct != null ? `${deal.advancePct}%` : "—"} />
        <SummaryCard label="Total volume" value={`${totalVolume.toFixed(3)} m³`} />
      </SummaryGrid>

      {message && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="space-y-3">
        <SectionHeader title="Line items" subtitle="Sell side — universal, any product." />
        <DealLineItemsTable rows={rows} onRowsChange={setRows} />
      </div>

      <div className="space-y-3">
        <SectionHeader title="Documents" subtitle="Generated documents for this deal." />
        {(deal.documents ?? []).length === 0 ? (
          <EmptyState message="No documents yet. Use “Generate Sales Specification” above." />
        ) : (
          <div className="grid gap-2">
            {(deal.documents ?? []).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
                <div>
                  <span className="font-medium">{doc.docNumber}</span>
                  <span className="ml-2 text-muted-foreground">{doc.docType} · {doc.side} · {new Date(doc.createdAt).toLocaleString()}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDownload(doc.id)}>Download</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
