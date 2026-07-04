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
  ChevronLeft,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Switch,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { AlertTriangle } from "lucide-react";
import type { DocType } from "@/features/orders/services/dealModel";
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/features/orders/services/documents/registry";
import type { ContentFormat, DocumentTemplateSummary, PageSettings, SlateValue } from "../types";
import { compileSlateTemplate } from "../compiler/slate";
import { validateTemplate } from "../compiler/validate";
import { MERGE_FIELD_LABELS } from "../compiler/registry";
import { slateStarterFor } from "../compiler/slate-starters";
import { useCatalogTemplateFields } from "../plate/hooks/use-catalog-template-fields";
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  importDocxTemplate,
  previewTemplate,
} from "../actions";
import { VisualEditorPane } from "./VisualEditorPane";

// Ordered doc types + labels come from the D2 single-source registry (imported
// above) — the templates editor can never mint a type outside it.

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

/** Every valid scalar merge-field token — the S4 validator's known set (registry-derived). */
const KNOWN_SCALAR_TOKENS = Object.keys(MERGE_FIELD_LABELS);

/** Working copy of a template being edited (create when id is absent). */
interface EditingTemplate {
  id?: string;
  docType: DocType;
  name: string;
  html: string;
  isDefault: boolean;
  isActive: boolean;
  contentFormat: ContentFormat;
  docJson: SlateValue | null;
  pageSettings: PageSettings | null;
}

type PreviewView = "code" | "split" | "preview";
type MainTab = "visual" | "advanced";

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
  const [startVisualWarnOpen, setStartVisualWarnOpen] = useState(false); // start a visual version of an html template
  const [dirty, setDirty] = useState(false); // unsaved edits to the open template
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null); // action awaiting discard confirmation

  // Mutate the working copy and mark it dirty (guards against losing unsaved edits).
  const edit = useCallback((patch: Partial<EditingTemplate>) => {
    setDirty(true);
    setEditing((e) => (e ? { ...e, ...patch } : e));
  }, []);

  // Run `action` now, or (if there are unsaved edits) after a discard confirmation.
  const guardNav = useCallback(
    (action: () => void) => {
      if (dirty && editing) setPendingNav(() => action);
      else action();
    },
    [dirty, editing]
  );

  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewSeq = useRef(0);

  // S4 · live token-validation. Catalog fields (for the attr-drift check) come from
  // the shared cached loader; while loading we pass `null` so attr columns are not
  // falsely flagged as deleted. The validator is PURE, so this doubles as both the
  // on-load and on-edit pass — it re-runs whenever the doc or catalog set changes.
  const { fields: catalogFields, loading: catalogLoading } = useCatalogTemplateFields();
  const catalogFieldKeys = useMemo(
    () => (catalogLoading ? null : catalogFields.map((f) => f.fieldKey)),
    [catalogLoading, catalogFields]
  );
  const warnings = useMemo(() => {
    if (!editing?.docJson) return [];
    return validateTemplate({
      docJson: editing.docJson,
      knownScalarTokens: KNOWN_SCALAR_TOKENS,
      catalogFieldKeys,
    }).warnings;
  }, [editing?.docJson, catalogFieldKeys]);

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
    // Everything opens in the visual editor now (no raw-HTML mode). A legacy
    // html template with no doc_json is loaded from its doc type's full Plate
    // template so it opens ready-to-edit (and saving upgrades it to wysiwyg).
    const hasVisual = t.contentFormat === "wysiwyg" && Array.isArray(t.docJson) && t.docJson.length > 0;
    setEditing({
      id: t.id,
      docType: t.docType,
      name: t.name,
      html: t.html,
      isDefault: t.isDefault,
      isActive: t.isActive,
      contentFormat: "wysiwyg",
      docJson: hasVisual ? t.docJson : slateStarterFor(t.docType),
      pageSettings: t.pageSettings,
    });
    setMainTab("visual");
    setEditorNonce((n) => n + 1);
    setDirty(false);
    setPreviewHtml("");
    setPreviewError(null);
  }, []);

  const startCreate = () => {
    const name = addName.trim() || `New ${DOC_TYPE_LABELS[addDocType]} template`;
    // New templates start from the doc type's VISUAL starter (an editable skeleton).
    setEditing({
      docType: addDocType,
      name,
      html: "",
      isDefault: false,
      isActive: true,
      contentFormat: "wysiwyg",
      docJson: slateStarterFor(addDocType),
      pageSettings: null,
    });
    setMainTab("visual");
    setEditorNonce((n) => n + 1);
    setDirty(false);
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
    setDirty(true);
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
    setDirty(true);
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
    const saved = res.data.template;
    toast.success(editing.id ? "Template saved" : "Template created");
    // Save always succeeds; unresolved placeholders are surfaced (never blocking).
    if (res.data.warnings.length > 0) {
      toast.warning(
        `Saved with ${res.data.warnings.length} placeholder warning(s) — some fields won't resolve. See the banner.`
      );
    }
    setEditing({
      id: saved.id,
      docType: saved.docType,
      name: saved.name,
      html: saved.html,
      isDefault: saved.isDefault,
      isActive: saved.isActive,
      contentFormat: saved.contentFormat,
      docJson: saved.docJson,
      pageSettings: saved.pageSettings,
    });
    setDirty(false);
    await load();
  };

  /** Confirmed one-way switch: visual → raw HTML (compile the current doc, drop doc_json). */
  const confirmSwitchToHtml = () => {
    setEditing((e) =>
      e
        ? {
            ...e,
            contentFormat: "html",
            html: e.docJson ? compileSlateTemplate(e.docJson, { pageSettings: e.pageSettings ?? undefined, docType: e.docType }) : e.html,
            docJson: null,
          }
        : e
    );
    setDirty(true);
    setSwitchWarnOpen(false);
    setMainTab("advanced");
    setView("split");
  };

  /** Start a visual version of a raw-HTML template from its doc type's visual starter. */
  const confirmStartVisual = () => {
    if (!editing) return;
    const starterDoc = slateStarterFor(editing.docType);
    setDirty(true);
    setEditing((e) =>
      e ? { ...e, contentFormat: "wysiwyg", docJson: starterDoc, pageSettings: e.pageSettings ?? null } : e
    );
    setEditorNonce((n) => n + 1);
    setStartVisualWarnOpen(false);
    setMainTab("visual");
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
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : editing ? (
        /* ── Editor view: the document list collapses into the picker dropdown ── */
        <div className="space-y-4">
          {/* Picker + document actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => guardNav(() => setEditing(null))}>
              <ChevronLeft className="h-4 w-4" /> All templates
            </Button>
            {editing.id && (
              <Select value={editing.id} onValueChange={(id) => guardNav(() => selectTemplate(id))}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Switch document" />
                </SelectTrigger>
                <SelectContent>
                  {grouped.map((group) =>
                    group.items.length === 0 ? null : (
                      <SelectGroup key={group.docType}>
                        <SelectLabel>{DOC_TYPE_LABELS[group.docType]}</SelectLabel>
                        {group.items.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  )}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => guardNav(() => setAddOpen(true))}>
              <Plus className="h-4 w-4" /> Add
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="tpl-default" checked={editing.isDefault} onCheckedChange={(c) => edit({ isDefault: c })} disabled={saving} />
                <label htmlFor="tpl-default" className="text-sm">Default</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="tpl-active" checked={editing.isActive} onCheckedChange={(c) => edit({ isActive: c })} disabled={saving} />
                <label htmlFor="tpl-active" className="text-sm">Active</label>
              </div>
              {editing.id && (
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(editing)} disabled={saving || deleting}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>

          {/* Name + type */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label htmlFor="tpl-name" className="text-xs text-muted-foreground">Name</label>
              <Input id="tpl-name" value={editing.name} onChange={(e) => edit({ name: e.target.value })} placeholder="Template name" disabled={saving} />
            </div>
            <div className="w-56 space-y-1">
              <label className="text-xs text-muted-foreground">Document type</label>
              {editing.id ? (
                <Input value={DOC_TYPE_LABELS[editing.docType]} disabled readOnly />
              ) : (
                <Select value={editing.docType} onValueChange={(v) => edit({ docType: v as DocType })}>
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
          </div>

          {/* S4 · non-blocking placeholder-validation banner (never gates Save) */}
          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {warnings.length === 1
                  ? "1 placeholder won't resolve"
                  : `${warnings.length} placeholders won't resolve`}
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-xs">
                {warnings.map((w) => (
                  <li key={`${w.kind}:${w.token ?? w.field ?? ""}`}>{w.message}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs opacity-75">
                You can still save — these fields will simply render empty until fixed.
              </p>
            </div>
          )}

          {/* Editor (2/3) + live preview (1/3) */}
          {editing.docJson && (
            <VisualEditorPane
              editorKey={editorNonce}
              templateId={editing.id}
              docType={editing.docType}
              doc={editing.docJson}
              pageSettings={editing.pageSettings}
              onDocChange={(d) => edit({ docJson: d })}
              onPageSettingsChange={(ps) => edit({ pageSettings: ps })}
            />
          )}
        </div>
      ) : loadingTemplate ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* ── List view: pick a document to edit ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Templates</h2>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add template
            </Button>
          </div>
          {summaries.length === 0 ? (
            <EmptyState message="No templates yet. Click here to add one." onClick={() => setAddOpen(true)} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.docType} className="space-y-1 rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {DOC_TYPE_LABELS[group.docType]}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTemplate(t.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
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
      )}

      {/* Add-template dialog (pick a doc type) */}
      <Dialog open={addOpen} onOpenChange={(o) => setAddOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add template</DialogTitle>
            <DialogDescription>
              Pick a document type. It opens a ready-made visual template you can edit and save.
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

      {/* Discard-unsaved-changes confirmation (navigating away with a dirty template) */}
      <AlertDialog open={pendingNav != null} onOpenChange={(o) => { if (!o) setPendingNav(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this template. Leaving now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const go = pendingNav;
                setPendingNav(null);
                setDirty(false);
                go?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
