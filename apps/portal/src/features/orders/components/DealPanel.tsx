"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, Download, Plus } from "lucide-react";
import {
  Button,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  SectionHeader, EmptyState, StatusBadge,
} from "@timber/ui";
import type { OrderDealView } from "../services/orderDeals";
import type { OrderLineItem, DocType, DealSide } from "../services/dealModel";
import { lineTotalCents } from "../services/documents/assemble";
import { getOrderDealView, generateOrderDocument, getOrderDocumentUrl } from "../actions/dealActions";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  sales_spec: "Sales specification",
  purchase_spec: "Purchase specification",
  contract: "Contract",
  proforma_invoice: "Proforma / advance invoice",
  invoice: "Invoice",
  packing_list: "Packing list",
  cmr: "CMR",
};

function fmtCents(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  const v = (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} ${currency}`;
}
function lineDesc(li: OrderLineItem): string {
  return [li.productName, li.woodSpecies, li.processing, li.quality, li.gradeNote].filter(Boolean).join(", ") || "—";
}
function lineDims(li: OrderLineItem): string {
  return [li.thickness, li.width, li.length].filter(Boolean).join(" × ") || "—";
}

export function DealPanel({ orderId }: { orderId: string }) {
  const [deal, setDeal] = useState<OrderDealView | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<DocType>("sales_spec");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getOrderDealView(orderId);
    if (res.success) setDeal(res.data);
    else setError(res.error);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const onGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    const side: DealSide = docType === "purchase_spec" ? "buy" : "sell";
    const res = await generateOrderDocument({ orderId, docType, side });
    setGenerating(false);
    if (!res.success) { setError(res.error); return; }
    if (res.data.url) window.open(res.data.url, "_blank", "noopener");
    await load();
  }, [orderId, docType, load]);

  const onDownload = useCallback(async (documentId: string) => {
    const res = await getOrderDocumentUrl(documentId);
    if (res.success) window.open(res.data.url, "_blank", "noopener");
    else setError(res.error);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!deal) {
    return <EmptyState message={error ?? "Could not load the deal for this order."} />;
  }

  const sellItems = deal.lineItems.filter((li) => li.side === "sell");
  const buyItems = deal.lineItems.filter((li) => li.side === "buy");
  const hasDealData = !!deal.dealCode || deal.lineItems.length > 0 || deal.documents.length > 0;

  const summary: Array<{ label: string; value: string | null }> = [
    { label: "Deal code", value: deal.dealCode },
    { label: "Kind", value: deal.dealKind },
    { label: "Product group", value: deal.productGroup },
    { label: "Currency", value: deal.currency },
    { label: "Incoterms", value: deal.incoterms ? `${deal.incoterms}${deal.incotermsPlace ? ` ${deal.incotermsPlace}` : ""}` : null },
    { label: "Advance", value: deal.advancePct != null ? `${deal.advancePct}%` : null },
    { label: "Payment terms", value: deal.paymentTerms },
    { label: "Delivery terms", value: deal.deliveryTerms },
    { label: "Delivery deadline", value: deal.deliveryDeadline },
  ];

  return (
    <div className="space-y-6">
      {!hasDealData && (
        <EmptyState message="No deal data yet. Deals captured from intake (email / PO / meeting) populate line items here; you can also generate documents below once the deal has line items." />
      )}

      {/* Deal summary */}
      <div className="rounded-lg border bg-card p-4">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {summary.map((row) => (
            <div key={row.label} className="flex flex-col">
              <dt className="text-muted-foreground text-xs">{row.label}</dt>
              <dd className="font-medium">{row.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {deal.notes && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{deal.notes}</p>}
      </div>

      {/* Line items (read-only — captured via intake/MCP today) */}
      <LineItemsTable title="Sell-side line items" items={sellItems} currency={deal.currency} />
      {buyItems.length > 0 && <LineItemsTable title="Buy-side line items" items={buyItems} currency={deal.currency} />}

      {/* Documents */}
      <div className="space-y-3">
        <SectionHeader
          title="Documents"
          subtitle={`${deal.documents.length} generated`}
          action={
            <div className="flex items-center gap-2">
              <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                    <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={onGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate
              </Button>
            </div>
          }
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {deal.documents.length === 0 ? (
          <EmptyState message="No documents generated yet. Pick a type and press Generate." />
        ) : (
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deal.documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.docNumber}</TableCell>
                  <TableCell>{DOC_TYPE_LABELS[d.docType] ?? d.docType}</TableCell>
                  <TableCell>{d.side}</TableCell>
                  <TableCell><StatusBadge variant={d.status === "issued" ? "success" : "draft"}>{d.status}</StatusBadge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onDownload(d.id)}>
                      <Download className="h-4 w-4" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function LineItemsTable({ title, items, currency }: { title: string; items: OrderLineItem[]; currency: string }) {
  if (items.length === 0) return null;
  const totalVol = items.reduce((s, li) => s + (li.volumeM3 ?? 0), 0);
  // Same computation as the service/generated document, so row · footer · PDF agree.
  const totalCents = items.reduce((s, li) => s + lineTotalCents(li), 0);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-muted-foreground" />{title}</h3>
      <Table dense>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Dimensions (mm)</TableHead>
            <TableHead className="text-right">Pcs</TableHead>
            <TableHead className="text-right">m³</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((li) => (
            <TableRow key={li.id ?? li.lineNo}>
              <TableCell className="text-right">{li.lineNo}</TableCell>
              <TableCell>{lineDesc(li)}</TableCell>
              <TableCell>{lineDims(li)}</TableCell>
              <TableCell className="text-right">{li.pieces ?? "—"}</TableCell>
              <TableCell className="text-right">{li.volumeM3 != null ? li.volumeM3.toFixed(3) : "—"}</TableCell>
              <TableCell className="text-right">{fmtCents(li.unitPriceCents, currency)}</TableCell>
              <TableCell className="text-right">{fmtCents(lineTotalCents(li), currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground text-right">Total volume {totalVol.toFixed(3)} m³ · Subtotal {fmtCents(totalCents, currency)}</p>
    </div>
  );
}
