"use client";

import { useEffect, useRef, useState, useCallback, type ChangeEvent } from "react";
import { Loader2, FileText, Download, Plus, Pencil, Trash2, ShieldCheck, Sparkles, CheckCircle2, Circle, BadgeCheck, Upload, FileCheck2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Button, Input,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  SectionHeader, EmptyState, StatusBadge,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@timber/ui";
import type { OrderLineItem, DocType, DealSide, LineUnit } from "../services/dealModel";
import type { LineItemAmountPatch, OrderDealView } from "../services/orderDeals";
import type { OrderDealViewResult } from "../actions/dealActions";
import { DealStageRail, DealAdvanceControl } from "./DealPipeline";
import { OrderActivityLog } from "./OrderActivityLog";
import { DealLineAdder } from "./DealLineAdder";
import { SourcingCard } from "./SourcingCard";
import { NextLegCard } from "./NextLegCard";
import { DuplicateDealButton } from "./DuplicateDealButton";
import { DealPartiesCard } from "./DealPartiesCard";
import { ChainCard } from "./ChainCard";
import { DealActivitiesCard } from "./DealActivitiesCard";
import { DealTermsEditor } from "./DealTermsEditor";
import { DealFilesCard } from "./DealFilesCard";
import { DealReferencesCard } from "./DealReferencesCard";
import { suggestedDocsFor } from "../services/dealActivities";
import { DOC_TYPE_LABELS, expectedDocsForDealKind } from "../services/documents/registry";
import { lineTotalCents } from "../services/documents/assemble";
import {
  getOrderDealView, generateOrderDocument, getOrderDocumentUrl,
  updateDealLineItemAmounts, deleteOrderDocument, setDealMarginApproval,
  firmOrderSpecification,
  uploadSignedOrderDocument, getSignedOrderDocumentUrl, deleteSignedOrderDocument,
} from "../actions/dealActions";
import { removeLineItem } from "../actions/catalogPicker";

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

export function DealPanel({ orderId, onDealChanged }: { orderId: string; onDealChanged?: () => void }) {
  const [deal, setDeal] = useState<OrderDealViewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<DocType>("sales_spec");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<{ id: string; number: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [firmingId, setFirmingId] = useState<string | null>(null);

  const [savingMargin, setSavingMargin] = useState(false);
  // C3: once the deal loads, pre-select the doc type this stage+direction
  // foregrounds (guidance only — the user can still pick any type). A ref keeps it
  // a ONE-time default so a later reload never clobbers the user's choice.
  const didInitDocType = useRef(false);

  const load = useCallback(async () => {
    const res = await getOrderDealView(orderId);
    if (res.success) { setDeal(res.data); setError(null); }
    else setError(res.error);
    setLoading(false);
    // Keep the page header (stage badge, parties, code) in sync after any change.
    onDealChanged?.();
  }, [orderId, onDealChanged]);

  useEffect(() => { load(); }, [load]);

  // C3: pre-select the stage-suggested doc type on first load (guidance default).
  useEffect(() => {
    if (didInitDocType.current || !deal) return;
    didInitDocType.current = true;
    const primary = suggestedDocsFor(deal.lifecycleStage, deal.viewerDirection)[0];
    if (primary) setDocType(primary);
  }, [deal]);

  // Add/remove line actions return the fresh OrderDealView; swap it into local
  // state while preserving the viewer's admin flag (not carried on the view).
  const applyView = useCallback((view: OrderDealView) => {
    setDeal((prev) => ({
      ...view,
      viewerIsAdmin: prev?.viewerIsAdmin ?? false,
      // The server-resolved, owner-gated extras (A3 sibling cost, B3 chain, B4
      // sourcing, B5 capability) are unaffected by editing THIS deal's own lines —
      // preserve them across the optimistic view swap (a full load() refreshes them).
      siblingBuyLegTotalCents: prev?.siblingBuyLegTotalCents ?? null,
      siblingBuyLegCurrency: prev?.siblingBuyLegCurrency ?? null,
      hasSiblingBuyLeg: prev?.hasSiblingBuyLeg ?? false,
      siblingBuyLegPriced: prev?.siblingBuyLegPriced ?? false,
      canEditDealTerms: prev?.canEditDealTerms ?? false,
      canEditParties: prev?.canEditParties ?? false,
      canStartSourcing: prev?.canStartSourcing ?? false,
      sourcing: prev?.sourcing ?? null,
      spineLegs: prev?.spineLegs ?? [],
      spineCode: prev?.spineCode ?? null,
      // C1: direction + facing party depend on the parties, not this deal's own
      // lines, so they are unchanged by an add/remove — preserve across the swap.
      viewerDirection: prev?.viewerDirection ?? "sell",
      facingParty: prev?.facingParty ?? { role: "customer", name: null },
    }));
    setError(null);
  }, []);

  const onToggleMargin = useCallback(async (approved: boolean) => {
    setSavingMargin(true);
    const res = await setDealMarginApproval({ orderId, approved });
    setSavingMargin(false);
    if (!res.success) { toast.error(res.error); return; }
    setDeal((prev) => (prev ? { ...prev, marginApprovedAt: res.data.marginApprovedAt } : prev));
    toast.success(approved ? "Margin approved" : "Margin approval revoked");
  }, [orderId]);

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

  // D1: firm a quotation into the order specification (regenerate in place).
  const onMakeFirm = useCallback(async (documentId: string) => {
    setFirmingId(documentId);
    setError(null);
    const res = await firmOrderSpecification({ orderId, documentId });
    setFirmingId(null);
    if (!res.success) { setError(res.error); return; }
    if (res.data.url) window.open(res.data.url, "_blank", "noopener");
    await load();
  }, [orderId, load]);

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

  // N2 (b) · signed-version upload / replace / download / delete on a generated doc.
  const signedFileInputRef = useRef<HTMLInputElement>(null);
  const signedTargetIdRef = useRef<string | null>(null);
  const [uploadingSignedId, setUploadingSignedId] = useState<string | null>(null);
  const [downloadingSignedId, setDownloadingSignedId] = useState<string | null>(null);
  const [signedToDelete, setSignedToDelete] = useState<{ id: string; number: string } | null>(null);
  const [deletingSigned, setDeletingSigned] = useState(false);

  const onPickSigned = useCallback((documentId: string) => {
    signedTargetIdRef.current = documentId;
    signedFileInputRef.current?.click();
  }, []);

  const onSignedFileChosen = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const documentId = signedTargetIdRef.current;
    e.target.value = ""; // allow re-picking the same file
    if (!file || !documentId) return;
    setUploadingSignedId(documentId);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const res = await uploadSignedOrderDocument({ documentId, orderId, formData });
    setUploadingSignedId(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Signed version uploaded");
    await load();
  }, [orderId, load]);

  const onDownloadSigned = useCallback(async (documentId: string) => {
    setDownloadingSignedId(documentId);
    const res = await getSignedOrderDocumentUrl(documentId);
    setDownloadingSignedId(null);
    if (res.success) window.open(res.data.url, "_blank", "noopener");
    else toast.error(res.error);
  }, []);

  const onConfirmDeleteSigned = useCallback(async () => {
    if (!signedToDelete) return;
    setDeletingSigned(true);
    const res = await deleteSignedOrderDocument({ documentId: signedToDelete.id, orderId });
    setDeletingSigned(false);
    setSignedToDelete(null);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Signed version removed");
    await load();
  }, [signedToDelete, orderId, load]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!deal) {
    return <EmptyState message={error ?? "Could not load the deal for this order."} />;
  }

  const isAdmin = deal.viewerIsAdmin;
  // B5: price inputs show to viewers who may edit deal terms (admin OR a
  // deal_terms-editable group — Salesperson on sell legs, Purchasing on buy legs;
  // side isolation is RLS's job), or when the deal already carries prices. The
  // blank-priced buy leg case relies on canEditDealTerms so Purchasing gets inputs.
  const canEditPrice = deal.canEditDealTerms || deal.lineItems.some((li) => li.unitPriceCents != null);
  const marginApproved = !!deal.marginApprovedAt;
  const hasDealData = !!deal.dealCode || deal.lineItems.length > 0 || deal.documents.length > 0;

  // C3 · stage emphasis (no gating): the doc types this stage+direction foregrounds.
  // Used to mark suggested options in the picker — every type stays generatable.
  const suggestedDocs = suggestedDocsFor(deal.lifecycleStage, deal.viewerDirection);
  const suggestedDocSet = new Set<DocType>(suggestedDocs);
  const allDocTypes = Object.keys(DOC_TYPE_LABELS) as DocType[];
  // Suggested types first (emphasis), the rest after — pure ordering, no filtering.
  const orderedDocTypes = [...suggestedDocs, ...allDocTypes.filter((t) => !suggestedDocSet.has(t))];

  // D3 (§8.2) · the expected document set for this deal's direction (informational
  // only — §8.1: stage never gates existence). exists/missing from what's generated.
  const expectedDocs = expectedDocsForDealKind(deal.dealKind);
  const existingDocTypes = new Set(deal.documents.map((d) => d.docType));
  const canFirm = isAdmin || deal.canEditDealTerms;

  // A1 (§2.1): a deal carries ONLY its own order — one specification table, no
  // buy-side conflation. A3 (§5.3): margin = this deal's own line total (the sell
  // subtotal) − the spine-sibling BUY leg's line total, which the server resolves
  // via spine_id and hands over owner-only (§9.1). The buy figure is NOT derivable
  // from this deal's own lines. The margin card is hidden entirely for non-admins,
  // and on buy legs (a buy leg has no margin of its own — it IS the cost side).
  const isBuyLeg = deal.dealKind === "purchase_only";
  const showMargin = isAdmin && !isBuyLeg;
  const sellTotalCents = deal.lineItems.reduce((s, li) => s + lineTotalCents(li), 0);
  const buyTotalCents = deal.siblingBuyLegTotalCents ?? 0;
  // R7 · a buy leg may be priced in a DIFFERENT currency from the sell deal. Only
  // subtract when they share a currency; otherwise the margin is meaningless — show
  // both legs' totals each labelled with their own currency, no bogus subtraction.
  const buyCurrency = deal.siblingBuyLegCurrency;
  const mixedCurrency = deal.hasSiblingBuyLeg && buyCurrency != null && buyCurrency !== deal.currency;
  const marginCents = sellTotalCents - buyTotalCents;
  const marginPct = sellTotalCents > 0 ? (marginCents / sellTotalCents) * 100 : null;
  // Provisional until a sibling buy leg exists AND carries prices.
  const marginProvisional = !deal.hasSiblingBuyLeg || !deal.siblingBuyLegPriced;

  // Read-only summary (shown to viewers who can't edit terms). Deal kind
  // (buy_sell/purchase_only) and product group are internal discriminators, not
  // commercial terms — deliberately not shown here (the direction is in the page
  // header). Notes is rendered separately below with its own label.
  const summary: Array<{ label: string; value: string | null }> = [
    { label: "Currency", value: deal.currency },
    { label: "Incoterms", value: deal.incoterms ? `${deal.incoterms}${deal.incotermsPlace ? ` ${deal.incotermsPlace}` : ""}` : null },
    { label: "Advance", value: deal.advancePct != null ? `${deal.advancePct}%` : null },
    { label: "Payment terms", value: deal.paymentTerms },
    { label: "Delivery terms", value: deal.deliveryTerms },
    { label: "Delivery deadline", value: deal.deliveryDeadline },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* LEFT — deal content */}
      <div className="flex-1 min-w-0 space-y-6">
      {/* Lifecycle stage rail — the first thing on the page (the deal identity is
          in the page header now; the Order/Deal tabs are retired). */}
      <DealStageRail orderId={orderId} lifecycleStage={deal.lifecycleStage} onChanged={load} />

      {/* H1 · Parties card — a party-less Draft deal has no bilateral code yet;
          setting its parties mints SELLER-BUYER-NNN. Editable only while Draft
          (§3.1: a deal is defined by who sells to whom — after Draft it locks). */}
      {deal.lifecycleStage === "draft" && deal.canEditParties && (deal.customer.id == null || deal.seller.id == null) && (
        <DealPartiesCard
          orderId={orderId}
          customer={{ id: deal.customer.id, name: deal.customer.name }}
          seller={{ id: deal.seller.id, name: deal.seller.name }}
          onChanged={load}
        />
      )}

      {!hasDealData && (
        <EmptyState message="No deal data yet. Deals captured from intake (email / PO / meeting) populate line items here; you can also generate documents below once the deal has line items." />
      )}

      {/* Deal terms — inline editing (deal_terms field-wall gate); read-only
          summary for viewers who can't edit. */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Terms</h3>
        {deal.canEditDealTerms ? (
          <DealTermsEditor
            orderId={orderId}
            values={{
              incoterms: deal.incoterms,
              incotermsPlace: deal.incotermsPlace,
              advancePct: deal.advancePct,
              paymentTerms: deal.paymentTerms,
              deliveryTerms: deal.deliveryTerms,
              deliveryDeadline: deal.deliveryDeadline,
              notes: deal.notes,
              currency: deal.currency,
              sellerSigneeName: deal.sellerSigneeName,
              sellerSigneeRole: deal.sellerSigneeRole,
              buyerSigneeName: deal.buyerSigneeName,
              buyerSigneeRole: deal.buyerSigneeRole,
            }}
            sellerName={deal.seller.name}
            buyerName={deal.buyer.name}
            currencyEditable={deal.lifecycleStage === "draft"}
            onSaved={load}
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              {summary.map((row) => (
                <div key={row.label} className="flex flex-col">
                  <dt className="text-muted-foreground text-xs">{row.label}</dt>
                  <dd className="font-medium">{row.value ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <dt className="text-muted-foreground text-xs">Notes</dt>
              <dd className="text-sm whitespace-pre-wrap">{deal.notes || "—"}</dd>
            </div>
          </>
        )}
      </div>

      {/* N3 · References — the deal's party order numbers (Customer / Supplier
          order no.) + free extras. Its OWN card (not folded into Terms). Same edit
          gate as deal terms. Shown once the deal has data. */}
      {hasDealData && (
        <DealReferencesCard
          orderId={orderId}
          refs={deal.externalRefs}
          canEdit={deal.canEditDealTerms}
          onSaved={load}
        />
      )}

      {/* A1 (§2.1): ONE order-specification table = this deal's own line items.
          No sell/buy split — the buy leg is a separate deal on the same spine.
          Read-only amounts by default; admins can edit amounts (the agent
          sometimes captures a line without a price). Anyone on the Deal tab can
          add/remove lines (the actions enforce orders.view server-side). */}
      <LineItemsTable
        items={deal.lineItems} currency={deal.currency}
        canEdit={deal.canEditDealTerms} canEditPrice={canEditPrice} orderId={orderId} onSaved={load} onApplied={applyView}
      />

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
                  {orderedDocTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-1.5">
                        {suggestedDocSet.has(t) && <Sparkles className="h-3 w-3 text-primary" />}
                        {DOC_TYPE_LABELS[t]}
                      </span>
                    </SelectItem>
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
        {suggestedDocs.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>
              Suggested at this stage:{" "}
              <span className="text-foreground">
                {suggestedDocs.map((t) => DOC_TYPE_LABELS[t]).join(", ")}
              </span>
              {" "}— every document type stays available.
            </span>
          </p>
        )}

        {/* D3 (§8.2) · expected document set for this deal's direction — informational
            (§8.1: the stage never gates which documents exist; missing ≠ blocked). */}
        <div className="rounded-md border bg-muted/30 p-2.5">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {/* §8.2: the document set belongs to the DEAL (its own direction), so no
                viewer-relative sell/buy word here — that avoids contradicting the
                viewer-relative header for a counterparty login. */}
            Expected documents for this deal (guide only — nothing is required):
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {expectedDocs.map((t) => {
              const has = existingDocTypes.has(t);
              return (
                <span key={t} className="flex items-center gap-1 text-xs">
                  {has ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                  <span className={has ? "text-foreground" : "text-muted-foreground"}>{DOC_TYPE_LABELS[t]}</span>
                </span>
              );
            })}
          </div>
        </div>

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
                <TableHead className="text-right">{isAdmin || deal.canEditDealTerms ? "Actions" : "Download"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deal.documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.docNumber}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                      {/* D1: the sales_spec's quotation→firm state. */}
                      {d.docState === "quotation" && <StatusBadge variant="draft">Quotation</StatusBadge>}
                      {d.docState === "firm" && <StatusBadge variant="success">Firm</StatusBadge>}
                      {/* N2 (b): a signed version has been uploaded. */}
                      {d.signedStoragePath && (
                        <StatusBadge variant="success">
                          <span className="flex items-center gap-1"><FileCheck2 className="h-3 w-3" />Signed</span>
                        </StatusBadge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{d.side}</TableCell>
                  <TableCell><StatusBadge variant={d.status === "issued" ? "success" : "draft"}>{d.status}</StatusBadge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* D1: firm a quotation into the order specification (house users). */}
                      {canFirm && d.docType === "sales_spec" && d.docState === "quotation" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onMakeFirm(d.id)}
                          disabled={firmingId === d.id}
                          title="Accepted → make the order specification firm"
                        >
                          {firmingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                          Make firm
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onDownload(d.id)}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                      {/* N2 (b): signed-version controls. Download available to any
                          viewer of the doc; upload/replace/delete gated on deal_terms. */}
                      {d.signedStoragePath ? (
                        <>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => onDownloadSigned(d.id)}
                            disabled={downloadingSignedId === d.id}
                            title="Download the signed version"
                          >
                            {downloadingSignedId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Signed
                          </Button>
                          {deal.canEditDealTerms && (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => onPickSigned(d.id)}
                                disabled={uploadingSignedId === d.id}
                                title="Replace the signed version"
                                aria-label={`Replace signed version of ${d.docNumber}`}
                              >
                                {uploadingSignedId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setSignedToDelete({ id: d.id, number: d.docNumber })}
                                title="Delete the signed version"
                                aria-label={`Delete signed version of ${d.docNumber}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        deal.canEditDealTerms && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => onPickSigned(d.id)}
                            disabled={uploadingSignedId === d.id}
                            title="Upload a signed version of this document"
                          >
                            {uploadingSignedId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload signed
                          </Button>
                        )
                      )}
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

        {/* N2 (b): one hidden picker drives the per-row Upload/Replace-signed actions. */}
        <input
          ref={signedFileInputRef}
          type="file"
          className="hidden"
          onChange={onSignedFileChosen}
        />
      </div>

      {/* N2 (a): free-form external file attachments on the deal (restores the
          legacy Order-tab file section on the deal view). */}
      <div className="rounded-lg border bg-card p-4">
        <DealFilesCard orderId={orderId} />
      </div>
      </div>{/* end LEFT column */}

      {/* RIGHT — actions: advance milestone + sourcing + margin + chain */}
      <div className="lg:w-80 shrink-0 space-y-6">
        {/* Advance-to-next-milestone control (vertical) — the rail stays on the left */}
        <DealAdvanceControl orderId={orderId} lifecycleStage={deal.lifecycleStage} onChanged={load} />

        {/* C2/C3 · §7 activities guidance for this deal's direction + stage.
            Display-only (§1.3): no persistence, no checkboxes — the current stage
            is emphasised, nothing is gated. */}
        <DealActivitiesCard stage={deal.lifecycleStage} direction={deal.viewerDirection} />

        {/* B4 · Sourcing state (Create next leg / Sourced link). Server sends a
            non-null `sourcing` only to viewers with sourcing rights (§9.3). */}
        {deal.sourcing && (
          <SourcingCard
            orderId={orderId}
            sourcing={deal.sourcing}
            sellerOrgId={deal.seller.id}
            sellerName={deal.seller.name}
            onChanged={load}
          />
        )}

        {/* L1 · Create next leg — admin only. Fork a new deal onto this spine
            (copies this deal's spec lines, prices blank). Manual chain assembly. */}
        {isAdmin && (
          <NextLegCard orderId={orderId} originLabel={deal.dealCode ?? deal.code} />
        )}

        {/* R5 · Duplicate this deal into a new Draft origin (fresh spine, prices
            kept). Admin only — mirrors the leg mechanic's gating. */}
        {isAdmin && <DuplicateDealButton orderId={orderId} />}

        {/* Owner margin approval (§5.3). A3: sell subtotal = this deal's own lines;
            buy subtotal = the spine-sibling buy leg's line total (§2.3), resolved
            server-side. Owner/admin ONLY (§9.1) — never shown to ordinary users,
            and not on a buy leg. */}
        {showMargin && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className={marginApproved ? "h-4 w-4 text-green-600" : "h-4 w-4 text-muted-foreground"} />
            <span className="font-medium">Margin</span>
            <StatusBadge variant={marginApproved ? "success" : "pending"}>
              {marginApproved ? "Approved" : "Pending"}
            </StatusBadge>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sell subtotal</dt>
              <dd className="font-medium tabular-nums">{fmtCents(sellTotalCents, deal.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Buy subtotal <span className="text-muted-foreground/70">(sourcing)</span></dt>
              {/* R7 · label the buy total with the BUY leg's own currency (it can
                  differ from the sell deal's), never the sell deal's currency. */}
              <dd className="font-medium tabular-nums">{deal.hasSiblingBuyLeg ? fmtCents(buyTotalCents, buyCurrency ?? deal.currency) : "—"}</dd>
            </div>
            {!mixedCurrency && (
              <div className="flex justify-between border-t pt-1">
                <dt className="font-medium">Margin</dt>
                <dd className={`font-semibold tabular-nums ${marginCents >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {fmtCents(marginCents, deal.currency)}
                  {marginPct != null && <span className="ml-1 text-xs font-normal text-muted-foreground">({marginPct.toFixed(1)}%)</span>}
                </dd>
              </div>
            )}
          </dl>
          {/* R7 · cross-currency: no honest single margin figure — both totals are
              shown above in their own currency; the owner converts manually. */}
          {mixedCurrency ? (
            <p className="text-xs text-amber-600">
              Sell ({deal.currency}) and buy ({buyCurrency}) legs are in different currencies — margin isn&apos;t computed. Compare the two totals above (convert manually).
            </p>
          ) : marginProvisional ? (
            <p className="text-xs text-amber-600">
              {deal.hasSiblingBuyLeg
                ? "The sourced buy leg has no prices yet — margin is provisional."
                : "No sourced buy leg yet — margin is provisional."}
            </p>
          ) : null}
          {marginApproved ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => onToggleMargin(false)} disabled={savingMargin}>
              {savingMargin ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Revoke approval
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={() => onToggleMargin(true)} disabled={savingMargin}>
              {savingMargin ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Approve margin
            </Button>
          )}
        </div>
        )}

        {/* B3 · Chain card — every leg on the spine. Owner/admin only (§6.2); the
            server sends an empty array to everyone else (ChainCard renders nothing). */}
        <ChainCard legs={deal.spineLegs} currentOrderId={orderId} spineCode={deal.spineCode} />

        {/* Activity log — status changes, edits, etc. (self-contained card) */}
        <OrderActivityLog orderId={orderId} />
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

      {/* N2 (b): delete-signed-version confirm */}
      <AlertDialog open={!!signedToDelete} onOpenChange={(o) => { if (!o) setSignedToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the signed version of {signedToDelete?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes only the uploaded signed file. The generated document stays. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSigned}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); onConfirmDeleteSigned(); }}
              disabled={deletingSigned}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSigned ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
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
  items, currency, canEdit, canEditPrice, orderId, onSaved, onApplied,
}: {
  items: OrderLineItem[]; currency: string;
  canEdit: boolean; canEditPrice: boolean; orderId: string;
  onSaved: () => Promise<void> | void; onApplied: (view: OrderDealView) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, AmountDraft>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lineToRemove, setLineToRemove] = useState<OrderLineItem | null>(null);
  const [removing, setRemoving] = useState(false);

  const confirmRemove = async () => {
    if (!lineToRemove?.id) return;
    setRemoving(true);
    const res = await removeLineItem({ orderId, lineItemId: lineToRemove.id });
    setRemoving(false);
    setLineToRemove(null);
    if (!res.success) { toast.error(res.error); return; }
    onApplied(res.data);
    toast.success("Line removed");
  };

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
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-muted-foreground" />Order specification</h3>
        <div className="flex items-center gap-2">
          {canEdit && (
            editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save amounts"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="h-3.5 w-3.5" /> Edit amounts</Button>
            )
          )}
          {!editing && (
            <DealLineAdder orderId={orderId} currency={currency} canEditPrice={canEditPrice} onApplied={onApplied} />
          )}
        </div>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Table dense>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Dimensions (mm)</TableHead>
            <TableHead className="text-right">Pcs</TableHead>
            <TableHead className="text-right">m³</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">
                No line items yet. Add from catalog or a custom line.
              </TableCell>
            </TableRow>
          )}
          {items.map((li) => {
            const d = editing && li.id ? drafts[li.id] : undefined;
            return (
              <TableRow key={li.id ?? li.lineNo}>
                <TableCell className="text-right">{li.lineNo}</TableCell>
                <TableCell>{lineDesc(li)}</TableCell>
                <TableCell>
                  <StatusBadge variant={li.isStandard ? "info" : "draft"}>{li.isStandard ? "Standard" : "Custom"}</StatusBadge>
                </TableCell>
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
                <TableCell className="text-right">
                  {!editing && li.id && (
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setLineToRemove(li)}
                      aria-label={`Remove line ${li.lineNo}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {blankQtyWarn && <p className="text-xs text-amber-600 dark:text-amber-500 text-right">A line has a price but no quantity — its total stays 0 until pieces / m³ are set.</p>}
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">Total volume {totalVol.toFixed(3)} m³ · Subtotal {fmtCents(totalCents, currency)}</p>
      )}

      {/* Remove-line confirm */}
      <AlertDialog open={!!lineToRemove} onOpenChange={(o) => { if (!o) setLineToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this line?</AlertDialogTitle>
            <AlertDialogDescription>
              {lineToRemove ? `Line ${lineToRemove.lineNo} — ${lineDesc(lineToRemove)}` : ""} will be removed from the deal. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmRemove(); }}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
