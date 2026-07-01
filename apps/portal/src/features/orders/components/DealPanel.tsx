"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, FileText, Download, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Button, Input,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  SectionHeader, EmptyState, StatusBadge,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@timber/ui";
import type { OrderLineItem, DocType, DealSide, LineUnit } from "../services/dealModel";
import type { LineItemAmountPatch } from "../services/orderDeals";
import type { OrderDealViewResult } from "../actions/dealActions";
import { DealPipeline } from "./DealPipeline";
import { lineTotalCents } from "../services/documents/assemble";
import {
  getOrderDealView, generateOrderDocument, getOrderDocumentUrl,
  updateDealLineItemAmounts, deleteOrderDocument,
} from "../actions/dealActions";

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
  const [deal, setDeal] = useState<OrderDealViewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<DocType>("sales_spec");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<{ id: string; number: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const load = useCallback(async () => {
    const res = await getOrderDealView(orderId);
    if (res.success) { setDeal(res.data); setError(null); }
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

  const onConfirmDelete = useCallback(async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    setError(null);
    const res = await deleteOrderDocument({ documentId: docToDelete.id, orderId });
    setDeletingDoc(false);
    setDocToDelete(null);
    if (!res.success) { setError(res.error); return; }
    await load();
  }, [docToDelete, orderId, load]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!deal) {
    return <EmptyState message={error ?? "Could not load the deal for this order."} />;
  }

  const isAdmin = deal.viewerIsAdmin;
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

      {/* Lifecycle pipeline (stages + gates) */}
      <DealPipeline orderId={orderId} lifecycleStage={deal.lifecycleStage} onChanged={load} />

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

      {/* Line items — read-only by default; admins can edit amounts (the agent
          sometimes captures a line without a price). */}
      <LineItemsTable title="Sell-side line items" items={sellItems} currency={deal.currency} isAdmin={isAdmin} orderId={orderId} onSaved={load} />
      {buyItems.length > 0 && <LineItemsTable title="Buy-side line items" items={buyItems} currency={deal.currency} isAdmin={isAdmin} orderId={orderId} onSaved={load} />}

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
                <TableHead className="text-right">{isAdmin ? "Actions" : "Download"}</TableHead>
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
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onDownload(d.id)}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDocToDelete({ id: d.id, number: d.docNumber })}
                          aria-label={`Delete document ${d.docNumber}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete-document confirm (admin) */}
      <AlertDialog open={!!docToDelete} onOpenChange={(o) => { if (!o) setDocToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document {docToDelete?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the generated file and its record. The document number is not reused. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); onConfirmDelete(); }}
              disabled={deletingDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type AmountDraft = { unitPrice: string; pieces: string; volumeM3: string; total: string };

const EMPTY_DRAFT: AmountDraft = { unitPrice: "", pieces: "", volumeM3: "", total: "" };

/** Units whose total is unit price × a quantity (mirror of the service). For
 *  these the Total is computed; for the rest it's an explicit, editable value. */
const DERIVABLE_UNITS = new Set<LineUnit>(["m3", "loose_m3", "piece"]);

function centsToInput(cents: number | null): string {
  return cents == null ? "" : String(cents / 100);
}
/** Strict money/number parse: accepts EU decimal comma, rejects trailing garbage
 *  ("5 eur" → null, unlike parseFloat). Empty → null. */
function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function inputToCents(v: string): number | null {
  const n = parseNum(v);
  return n == null ? null : Math.round(n * 100);
}
function inputToNumber(v: string): number | null {
  return parseNum(v);
}
function piecesOf(d: AmountDraft): string | null {
  return d.pieces.trim() === "" ? null : d.pieces.trim();
}
function draftFor(li: OrderLineItem): AmountDraft {
  return {
    unitPrice: centsToInput(li.unitPriceCents),
    pieces: li.pieces ?? "",
    volumeM3: li.volumeM3 != null ? String(li.volumeM3) : "",
    total: centsToInput(li.lineTotalCents),
  };
}
/** Live total preview that EXACTLY mirrors what the service+PDF will yield:
 *  derivable units recompute price×qty; others use the explicit total field. */
function draftTotalCents(li: OrderLineItem, d: AmountDraft): number {
  if (DERIVABLE_UNITS.has(li.unit)) {
    return lineTotalCents({ lineTotalCents: null, unitPriceCents: inputToCents(d.unitPrice), unit: li.unit, volumeM3: inputToNumber(d.volumeM3), pieces: piecesOf(d) });
  }
  return inputToCents(d.total) ?? 0;
}
/** Did the admin actually change this row's amounts? (skip untouched rows on save) */
function rowChanged(li: OrderLineItem, d: AmountDraft): boolean {
  if (inputToCents(d.unitPrice) !== (li.unitPriceCents ?? null)) return true;
  if (piecesOf(d) !== (li.pieces ?? null)) return true;
  if (inputToNumber(d.volumeM3) !== (li.volumeM3 ?? null)) return true;
  if (!DERIVABLE_UNITS.has(li.unit) && inputToCents(d.total) !== (li.lineTotalCents ?? null)) return true;
  return false;
}

function LineItemsTable({
  title, items, currency, isAdmin, orderId, onSaved,
}: {
  title: string; items: OrderLineItem[]; currency: string;
  isAdmin: boolean; orderId: string; onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, AmountDraft>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startEdit = () => {
    const next: Record<string, AmountDraft> = {};
    for (const li of items) if (li.id) next[li.id] = draftFor(li);
    setDrafts(next);
    setErr(null);
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setErr(null); };
  const setField = (id: string, field: keyof AmountDraft, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_DRAFT), [field]: value } }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    const patches: LineItemAmountPatch[] = [];
    for (const li of items) {
      if (!li.id) continue;
      const d = drafts[li.id];
      if (!d || !rowChanged(li, d)) continue; // skip untouched rows — don't rewrite their totals
      const price = inputToCents(d.unitPrice);
      const vol = inputToNumber(d.volumeM3);
      const total = inputToCents(d.total);
      if ((price != null && price < 0) || (vol != null && vol < 0) || (total != null && total < 0)) {
        setSaving(false);
        setErr("Amounts can't be negative.");
        return;
      }
      const patch: LineItemAmountPatch = { id: li.id, unit: li.unit, unitPriceCents: price, pieces: piecesOf(d), volumeM3: vol };
      if (!DERIVABLE_UNITS.has(li.unit)) patch.lineTotalCents = total; // explicit total for no-quantity units
      patches.push(patch);
    }
    if (patches.length === 0) { setSaving(false); setEditing(false); return; }
    const res = await updateDealLineItemAmounts({ orderId, items: patches });
    setSaving(false);
    if (!res.success) { setErr(res.error); return; }
    setEditing(false);
    await onSaved();
  };

  if (items.length === 0) return null;
  const totalVol = items.reduce((s, li) => s + (li.volumeM3 ?? 0), 0);
  // Same computation as the service/generated document, so row · footer · PDF agree.
  const totalCents = items.reduce((s, li) => {
    const dr = editing && li.id ? drafts[li.id] : undefined;
    return s + (dr ? draftTotalCents(li, dr) : lineTotalCents(li));
  }, 0);
  // Hint: a derivable line priced but missing its quantity totals 0 (the trap the
  // edit UI could otherwise hide — the admin "added a price" yet the total is 0).
  const blankQtyWarn = editing && items.some((li) => {
    const d = li.id ? drafts[li.id] : undefined;
    if (!d || !DERIVABLE_UNITS.has(li.unit)) return false;
    const qtyBlank = li.unit === "piece" ? d.pieces.trim() === "" : d.volumeM3.trim() === "";
    return inputToCents(d.unitPrice) != null && qtyBlank;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-muted-foreground" />{title}</h3>
        {isAdmin && (
          editing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save amounts"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="h-3.5 w-3.5" /> Edit amounts</Button>
          )
        )}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Table dense>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Dimensions (mm)</TableHead>
            <TableHead className="text-right">Pcs</TableHead>
            <TableHead className="text-right">m³</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((li) => {
            const d = editing && li.id ? drafts[li.id] : undefined;
            return (
              <TableRow key={li.id ?? li.lineNo}>
                <TableCell className="text-right">{li.lineNo}</TableCell>
                <TableCell>{lineDesc(li)}</TableCell>
                <TableCell>{lineDims(li)}</TableCell>
                <TableCell className="text-right">
                  {d ? (
                    <Input type="number" inputMode="numeric" min="0" value={d.pieces}
                      onChange={(e) => setField(li.id!, "pieces", e.target.value)}
                      className="h-7 w-20 text-xs text-right ml-auto" />
                  ) : (li.pieces ?? "—")}
                </TableCell>
                <TableCell className="text-right">
                  {d ? (
                    <Input type="number" inputMode="decimal" min="0" step="0.001" value={d.volumeM3}
                      onChange={(e) => setField(li.id!, "volumeM3", e.target.value)}
                      className="h-7 w-24 text-xs text-right ml-auto" />
                  ) : (li.volumeM3 != null ? li.volumeM3.toFixed(3) : "—")}
                </TableCell>
                <TableCell className="text-right">
                  {d ? (
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={d.unitPrice}
                      onChange={(e) => setField(li.id!, "unitPrice", e.target.value)}
                      placeholder={`${currency}/${li.unit}`}
                      className="h-7 w-24 text-xs text-right ml-auto" />
                  ) : fmtCents(li.unitPriceCents, currency)}
                </TableCell>
                <TableCell className="text-right">
                  {d && !DERIVABLE_UNITS.has(li.unit) ? (
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={d.total}
                      onChange={(e) => setField(li.id!, "total", e.target.value)}
                      placeholder={`Total ${currency}`}
                      className="h-7 w-28 text-xs text-right ml-auto" />
                  ) : fmtCents(d ? draftTotalCents(li, d) : lineTotalCents(li), currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {blankQtyWarn && <p className="text-xs text-amber-600 dark:text-amber-500 text-right">A line has a price but no quantity — its total stays 0 until pieces / m³ are set.</p>}
      <p className="text-xs text-muted-foreground text-right">Total volume {totalVol.toFixed(3)} m³ · Subtotal {fmtCents(totalCents, currency)}</p>
    </div>
  );
}
