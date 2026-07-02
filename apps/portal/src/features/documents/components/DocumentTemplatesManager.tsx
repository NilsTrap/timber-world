"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Upload,
  RefreshCw,
  Trash2,
  Save,
  Code2,
  Eye,
  Columns2,
  FileText,
  PenLine,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  StatusBadge,
  EmptyState,
  cn,
} from "@timber/ui";
import type { DocType } from "@/features/orders/services/dealModel";
import type { ContentFormat, DocumentTemplateSummary, PageSettings, TipTapDoc } from "../types";
import { compileTemplate } from "../compiler";
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  importDocxTemplate,
  previewTemplate,
} from "../actions";
import { VisualEditorPane } from "./VisualEditorPane";

/** Ordered doc types + human labels for grouping the list and the type picker. */
const DOC_TYPES: DocType[] = [
  "sales_spec",
  "purchase_spec",
  "contract",
  "proforma_invoice",
  "invoice",
  "packing_list",
  "cmr",
];

const DOC_TYPE_LABELS: Record<DocType, string> = {
  sales_spec: "Sales Specification",
  purchase_spec: "Purchase Specification",
  contract: "Sales Contract",
  proforma_invoice: "Proforma / Advance Invoice",
  invoice: "Invoice",
  packing_list: "Packing List",
  cmr: "CMR",
};

/**
 * Curated merge-variable palette — the common DocumentData bindings + the four
 * Handlebars helpers. Clicking a chip inserts its token at the editor cursor.
 */
interface PaletteGroup {
  heading: string;
  items: { label: string; token: string }[];
}

const PALETTE: PaletteGroup[] = [
  {
    heading: "Document",
    items: [
      { label: "Title", token: "{{docTitle}}" },
      { label: "Number", token: "{{docNumber}}" },
      { label: "Date", token: "{{fmtDate docDate}}" },
      { label: "Deal code", token: "{{dealCode}}" },
      { label: "Currency", token: "{{currency}}" },
      { label: "Notes", token: "{{notes}}" },
    ],
  },
  {
    heading: "Seller",
    items: [
      { label: "Name", token: "{{seller.name}}" },
      { label: "Reg no", token: "{{seller.regNo}}" },
      { label: "VAT no", token: "{{seller.vatNo}}" },
      { label: "Address", token: "{{seller.address}}" },
      { label: "Country", token: "{{seller.country}}" },
      { label: "Email", token: "{{seller.email}}" },
      { label: "Phone", token: "{{seller.phone}}" },
      { label: "Bank", token: "{{seller.bankName}}" },
      { label: "Account", token: "{{seller.bankAccount}}" },
      { label: "SWIFT", token: "{{seller.bankSwift}}" },
    ],
  },
  {
    heading: "Buyer",
    items: [
      { label: "Name", token: "{{buyer.name}}" },
      { label: "Reg no", token: "{{buyer.regNo}}" },
      { label: "VAT no", token: "{{buyer.vatNo}}" },
      { label: "Address", token: "{{buyer.address}}" },
      { label: "Country", token: "{{buyer.country}}" },
      { label: "Email", token: "{{buyer.email}}" },
      { label: "Phone", token: "{{buyer.phone}}" },
    ],
  },
  {
    heading: "Terms",
    items: [
      { label: "Incoterms", token: "{{incoterms}}" },
      { label: "Payment terms", token: "{{paymentTerms}}" },
      { label: "Delivery terms", token: "{{deliveryTerms}}" },
      { label: "Delivery deadline", token: "{{deliveryDeadline}}" },
      { label: "Advance %", token: "{{pct advancePct}}" },
    ],
  },
  {
    heading: "Line items (loop)",
    items: [
      { label: "Each start", token: "{{#each lineItems}}\n" },
      { label: "Each end", token: "\n{{/each}}" },
      { label: "Line no", token: "{{lineNo}}" },
      { label: "Description", token: "{{description}}" },
      { label: "Dimensions", token: "{{dimensions}}" },
      { label: "Pieces", token: "{{pieces}}" },
      { label: "Volume m³", token: "{{fmtM3 volumeM3}}" },
      { label: "Unit", token: "{{unit}}" },
      { label: "Unit price", token: "{{money unitPriceCents}}" },
      { label: "Line total", token: "{{money lineTotalCents}}" },
    ],
  },
  {
    heading: "External refs (loop)",
    items: [
      { label: "Each start", token: "{{#each externalRefs}}\n" },
      { label: "Each end", token: "\n{{/each}}" },
      { label: "Label", token: "{{label}}" },
      { label: "Value", token: "{{value}}" },
    ],
  },
  {
    heading: "Totals",
    items: [
      { label: "Total volume m³", token: "{{fmtM3 totals.totalVolumeM3}}" },
      { label: "Subtotal", token: "{{money totals.subtotalCents}}" },
      { label: "VAT rate", token: "{{pct totals.vatRate}}" },
      { label: "VAT amount", token: "{{money totals.vatCents}}" },
      { label: "Total", token: "{{money totals.totalCents}}" },
      { label: "Amount in words", token: "{{totals.amountInWords}}" },
    ],
  },
  {
    heading: "Helpers",
    items: [
      { label: "money cents", token: "{{money cents}}" },
      { label: "fmtM3 n", token: "{{fmtM3 n}}" },
      { label: "fmtDate iso", token: "{{fmtDate iso}}" },
      { label: "pct n", token: "{{pct n}}" },
    ],
  },
];

/** Working copy of a template being edited (create when id is absent). */
interface EditingTemplate {
  id?: string;
  docType: DocType;
  name: string;
  html: string;
  isDefault: boolean;
  isActive: boolean;
  contentFormat: ContentFormat;
  docJson: TipTapDoc | null;
  pageSettings: PageSettings | null;
}

type PreviewView = "code" | "split" | "preview";
type MainTab = "visual" | "advanced";

/** Minimal starter for a brand-new visual template (never a blank canvas). */
const NEW_WYSIWYG_DOC: TipTapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "mergeField", attrs: { token: "docTitle", label: "Title" } }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "No. " },
        { type: "mergeField", attrs: { token: "docNumber", label: "Number" } },
        { type: "text", text: " · " },
        { type: "mergeField", attrs: { token: "fmtDate docDate", label: "Date" } },
      ],
    },
    { type: "paragraph" },
  ],
};

/**
 * DocumentTemplatesManager (E6) — the lightweight HTML-code + live-preview
 * editor for the global document templates. Left: templates grouped by doc
 * type. Right: a monospace HTML editor with a merge-variable palette, a
 * sandboxed live preview (previewTemplate merges against a sample deal), and
 * .docx import. No WYSIWYG — plain textarea code view only.
 */
export function DocumentTemplatesManager() {
  const [summaries, setSummaries] = useState<DocumentTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EditingTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDocType, setAddDocType] = useState<DocType>("sales_spec");
  const [addName, setAddName] = useState("");

  const [view, setView] = useState<PreviewView>("split");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [mainTab, setMainTab] = useState<MainTab>("visual");
  const [editorNonce, setEditorNonce] = useState(0); // bump → remount the visual editor with fresh content
  const [switchWarnOpen, setSwitchWarnOpen] = useState(false); // one-way visual→html switch confirm

  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewSeq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listTemplates();
    if (res.success) setSummaries(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(
    () =>
      DOC_TYPES.map((docType) => ({
        docType,
        items: summaries.filter((s) => s.docType === docType),
      })),
    [summaries]
  );

  const runPreview = useCallback(async (html: string, docType: DocType) => {
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    const res = await previewTemplate({ html, docType });
    if (seq !== previewSeq.current) return; // a newer request superseded this one
    if (res.success) {
      setPreviewHtml(res.data.html);
      setPreviewError(null);
    } else {
      setPreviewError(res.error);
    }
    setPreviewLoading(false);
  }, []);

  // Debounced live preview for the ADVANCED (raw HTML) tab whenever the html/type
  // changes and the preview pane is visible. The Visual tab has its own preview.
  useEffect(() => {
    if (!editing || mainTab !== "advanced" || view === "code") return;
    const html = editing.html;
    const docType = editing.docType;
    const t = setTimeout(() => {
      runPreview(html, docType);
    }, 400);
    return () => clearTimeout(t);
  }, [editing?.html, editing?.docType, view, mainTab, editing, runPreview]);

  const selectTemplate = useCallback(async (id: string) => {
    setLoadingTemplate(true);
    // Clear any currently-open template BEFORE loading the new one, so a failed
    // load can't leave the previous template in the editor under the new
    // selection (which a Save would then write to the wrong row).
    setEditing(null);
    const res = await getTemplate(id);
    setLoadingTemplate(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const t = res.data;
    setEditing({
      id: t.id,
      docType: t.docType,
      name: t.name,
      html: t.html,
      isDefault: t.isDefault,
      isActive: t.isActive,
      contentFormat: t.contentFormat,
      docJson: t.docJson,
      pageSettings: t.pageSettings,
    });
    // Open in the surface that matches the template's format.
    setMainTab(t.contentFormat === "wysiwyg" ? "visual" : "advanced");
    setEditorNonce((n) => n + 1);
    setPreviewHtml("");
    setPreviewError(null);
  }, []);

  const startCreate = () => {
    const name = addName.trim() || `New ${DOC_TYPE_LABELS[addDocType]} template`;
    // New templates default to the VISUAL editor.
    setEditing({
      docType: addDocType,
      name,
      html: "",
      isDefault: false,
      isActive: true,
      contentFormat: "wysiwyg",
      docJson: NEW_WYSIWYG_DOC,
      pageSettings: null,
    });
    setMainTab("visual");
    setEditorNonce((n) => n + 1);
    setPreviewHtml("");
    setPreviewError(null);
    setAddOpen(false);
    setAddName("");
  };

  const insertToken = (token: string) => {
    const ta = htmlRef.current;
    if (!editing) return;
    const start = ta?.selectionStart ?? editing.html.length;
    const end = ta?.selectionEnd ?? editing.html.length;
    const next = editing.html.slice(0, start) + token + editing.html.slice(end);
    setEditing({ ...editing, html: next });
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !editing) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await importDocxTemplate(fd);
    setImporting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setEditing({ ...editing, html: res.data.html });
    if (res.data.messages.length > 0) {
      toast.warning(`Imported with ${res.data.messages.length} conversion warning(s). Review before saving.`);
    } else {
      toast.success("Imported .docx — review and save.");
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editing.contentFormat === "html" && !editing.html.trim()) {
      toast.error("Template HTML is required");
      return;
    }
    if (editing.contentFormat === "wysiwyg" && !editing.docJson) {
      toast.error("Visual document is required");
      return;
    }
    setSaving(true);
    const res = await saveTemplate({
      id: editing.id,
      docType: editing.docType,
      name: editing.name.trim(),
      html: editing.html,
      isDefault: editing.isDefault,
      isActive: editing.isActive,
      contentFormat: editing.contentFormat,
      docJson: editing.docJson,
      pageSettings: editing.pageSettings,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(editing.id ? "Template saved" : "Template created");
    setEditing({
      id: res.data.id,
      docType: res.data.docType,
      name: res.data.name,
      html: res.data.html,
      isDefault: res.data.isDefault,
      isActive: res.data.isActive,
      contentFormat: res.data.contentFormat,
      docJson: res.data.docJson,
      pageSettings: res.data.pageSettings,
    });
    await load();
  };

  /** Confirmed one-way switch: visual → raw HTML (compile the current doc, drop doc_json). */
  const confirmSwitchToHtml = () => {
    setEditing((e) =>
      e
        ? {
            ...e,
            contentFormat: "html",
            html: e.docJson ? compileTemplate(e.docJson, { pageSettings: e.pageSettings ?? undefined, docType: e.docType }) : e.html,
            docJson: null,
          }
        : e
    );
    setSwitchWarnOpen(false);
    setMainTab("advanced");
    setView("split");
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    const res = await deleteTemplate(deleteTarget.id);
    setDeleting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Template "${deleteTarget.name}" deleted`);
    if (editing?.id === deleteTarget.id) setEditing(null);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      {/* ── Left: template list grouped by doc type ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Templates</h2>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add template
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : summaries.length === 0 ? (
          <EmptyState message="No templates yet. Click here to add one." onClick={() => setAddOpen(true)} />
        ) : (
          <div className="space-y-4">
            {grouped.map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.docType} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {DOC_TYPE_LABELS[group.docType]}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTemplate(t.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                          editing?.id === t.id ? "border-primary bg-muted" : "border-transparent"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {t.isDefault && <StatusBadge variant="success">Default</StatusBadge>}
                          {!t.isActive && <StatusBadge variant="draft">Inactive</StatusBadge>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Right: editor ───────────────────────────────────────────────── */}
      <div className="min-w-0">
        {loadingTemplate ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !editing ? (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Select a template on the left, or add a new one to start editing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meta row */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[220px] flex-1 space-y-1">
                <label htmlFor="tpl-name" className="text-xs text-muted-foreground">
                  Name
                </label>
                <Input
                  id="tpl-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Template name"
                  disabled={saving}
                />
              </div>
              <div className="w-56 space-y-1">
                <label className="text-xs text-muted-foreground">Document type</label>
                {editing.id ? (
                  <Input value={DOC_TYPE_LABELS[editing.docType]} disabled readOnly />
                ) : (
                  <Select
                    value={editing.docType}
                    onValueChange={(v) => setEditing({ ...editing, docType: v as DocType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {DOC_TYPE_LABELS[dt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-default"
                  checked={editing.isDefault}
                  onCheckedChange={(c) => setEditing({ ...editing, isDefault: c })}
                  disabled={saving}
                />
                <label htmlFor="tpl-default" className="text-sm">
                  Default
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-active"
                  checked={editing.isActive}
                  onCheckedChange={(c) => setEditing({ ...editing, isActive: c })}
                  disabled={saving}
                />
                <label htmlFor="tpl-active" className="text-sm">
                  Active
                </label>
              </div>
            </div>

            {/* Action bar: Visual | Advanced(HTML) tabs + shared Save/Delete */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border p-0.5">
                <Button
                  variant={mainTab === "visual" ? "secondary" : "ghost"}
                  size="sm"
                  disabled={editing.contentFormat === "html"}
                  title={
                    editing.contentFormat === "html"
                      ? "This template is raw HTML — visual editing isn't available"
                      : undefined
                  }
                  onClick={() => {
                    if (editing.contentFormat !== "html") setMainTab("visual");
                  }}
                >
                  <PenLine className="h-4 w-4" /> Visual
                </Button>
                <Button
                  variant={mainTab === "advanced" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    // Opening Advanced on a visual template is a one-way switch to raw HTML.
                    if (editing.contentFormat === "wysiwyg") setSwitchWarnOpen(true);
                    else setMainTab("advanced");
                  }}
                >
                  <Code2 className="h-4 w-4" /> Advanced (HTML)
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editing.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(editing)}
                    disabled={saving || deleting}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>

            {/* ── Visual tab ─────────────────────────────────────────────── */}
            {mainTab === "visual" && editing.docJson && (
              <VisualEditorPane
                editorKey={editorNonce}
                templateId={editing.id}
                docType={editing.docType}
                doc={editing.docJson}
                pageSettings={editing.pageSettings}
                onDocChange={(d) => setEditing((e) => (e ? { ...e, docJson: d } : e))}
                onPageSettingsChange={(ps) => setEditing((e) => (e ? { ...e, pageSettings: ps } : e))}
              />
            )}

            {/* ── Advanced (HTML) tab ────────────────────────────────────── */}
            {mainTab === "advanced" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* View toggle */}
                  <div className="inline-flex rounded-md border p-0.5">
                    <Button variant={view === "code" ? "secondary" : "ghost"} size="sm" onClick={() => setView("code")}>
                      <Code2 className="h-4 w-4" /> Code
                    </Button>
                    <Button variant={view === "split" ? "secondary" : "ghost"} size="sm" onClick={() => setView("split")}>
                      <Columns2 className="h-4 w-4" /> Split
                    </Button>
                    <Button variant={view === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setView("preview")}>
                      <Eye className="h-4 w-4" /> Preview
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runPreview(editing.html, editing.docType)}
                      disabled={previewLoading || view === "code"}
                    >
                      {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Refresh preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportClick} disabled={importing}>
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Import .docx
                    </Button>
                    <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={handleImportFile} />
                  </div>
                </div>

                <div className={cn("grid gap-4", view === "split" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1")}>
                  {/* Code view + palette */}
                  {view !== "preview" && (
                    <div className="space-y-3">
                      <Textarea
                        ref={htmlRef}
                        value={editing.html}
                        onChange={(e) => setEditing({ ...editing, html: e.target.value })}
                        spellCheck={false}
                        className="h-[65vh] resize-none font-mono text-xs leading-relaxed"
                        placeholder="Template HTML (Handlebars) — e.g. <h1>{{docTitle}}</h1>"
                      />
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="text-xs font-semibold">Insert variable</p>
                        <div className="space-y-2">
                          {PALETTE.map((g) => (
                            <div key={g.heading}>
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                {g.heading}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {g.items.map((it) => (
                                  <button
                                    key={g.heading + it.label}
                                    type="button"
                                    onClick={() => insertToken(it.token)}
                                    title={it.token}
                                    className="rounded border bg-muted/40 px-2 py-0.5 font-mono text-[11px] hover:bg-muted"
                                  >
                                    {it.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live preview (sandboxed iframe — no allow-scripts) */}
                  {view !== "code" && (
                    <div className="space-y-2">
                      {previewError ? (
                        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                          <p className="font-semibold">Template error</p>
                          <p className="mt-1 whitespace-pre-wrap font-mono">{previewError}</p>
                        </div>
                      ) : (
                        <iframe
                          title="Template preview"
                          sandbox=""
                          srcDoc={previewHtml}
                          className="h-[65vh] w-full rounded-md border bg-white"
                        />
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Preview merges the template against a sample deal. Scripts are disabled.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add-template dialog (pick a doc type) */}
      <Dialog open={addOpen} onOpenChange={(o) => setAddOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add template</DialogTitle>
            <DialogDescription>
              Pick a document type. You can edit the HTML and save afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Document type</label>
              <Select value={addDocType} onValueChange={(v) => setAddDocType(v as DocType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {DOC_TYPE_LABELS[dt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="add-name" className="text-xs text-muted-foreground">
                Name (optional)
              </label>
              <Input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder={`New ${DOC_TYPE_LABELS[addDocType]} template`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* One-way visual → raw HTML switch confirmation */}
      <AlertDialog open={switchWarnOpen} onOpenChange={(o) => setSwitchWarnOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Advanced (HTML)?</AlertDialogTitle>
            <AlertDialogDescription>
              This converts the template to raw HTML and disconnects the visual editor. The current
              layout is kept as HTML, but you won&apos;t be able to edit it visually again unless you
              rebuild it. This takes effect when you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchToHtml}>Switch to HTML</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
