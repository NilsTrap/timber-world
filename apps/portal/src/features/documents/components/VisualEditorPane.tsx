"use client";

/**
 * Visual editing pane — a wide Plate editor (2/3) with a live, sample-merged
 * preview (1/3) on the right. The preview compiles doc_json → Handlebars →
 * merges representative DocumentData (server-side) so the user sees real values.
 * On narrow screens the preview is hidden and opens as a slide-out overlay.
 * Page settings + logo live in a compact panel above.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Eye } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@timber/ui";
import { TimberPlateEditor } from "../editor/TimberPlateEditor";
import { previewTemplateJson } from "../actions";
import { PageSettingsPanel } from "./PageSettingsPanel";
import type { DocType } from "@/features/orders/services/dealModel";
import type { PageSettings, SlateValue } from "../types";

export function VisualEditorPane({
  editorKey,
  templateId,
  docType,
  doc,
  pageSettings,
  onDocChange,
  onPageSettingsChange,
}: {
  editorKey: string | number;
  templateId?: string;
  docType: DocType;
  doc: SlateValue;
  pageSettings: PageSettings | null;
  onDocChange: (d: SlateValue) => void;
  onPageSettingsChange: (ps: PageSettings) => void;
}) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const seq = useRef(0);

  const runPreview = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    const res = await previewTemplateJson({ docJson: doc, docType, pageSettings });
    if (s !== seq.current) return;
    if (res.success) {
      setPreviewHtml(res.data.html);
      setPreviewError(null);
    } else {
      setPreviewError(res.error);
    }
    setLoading(false);
  }, [doc, docType, pageSettings]);

  // Debounced live preview on every doc / page-settings change.
  useEffect(() => {
    const t = setTimeout(runPreview, 500);
    return () => clearTimeout(t);
  }, [runPreview]);

  const previewFrame = (className: string) =>
    previewError ? (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <p className="font-semibold">Preview error</p>
        <p className="mt-1 whitespace-pre-wrap font-mono">{previewError}</p>
      </div>
    ) : (
      <iframe title="Live preview" sandbox="" srcDoc={previewHtml} className={className} />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <PageSettingsPanel
            templateId={templateId}
            pageSettings={pageSettings}
            onChange={onPageSettingsChange}
          />
        </div>
        {/* Narrow screens: open the preview as an overlay. */}
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOverlayOpen(true)}>
          <Eye className="h-4 w-4" /> Preview
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Editor — 2/3 */}
        <div className="min-w-0 lg:col-span-2">
          <div className="rounded-md border bg-background shadow-sm">
            <TimberPlateEditor key={editorKey} value={doc} onChange={onDocChange} />
          </div>
        </div>

        {/* Live preview — 1/3, wide screens only */}
        <div className="hidden min-w-0 lg:block">
          <div className="sticky top-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              Live preview · sample deal data
            </div>
            {previewFrame("h-[75vh] w-full rounded-md border bg-white")}
          </div>
        </div>
      </div>

      {/* Narrow-screen preview overlay */}
      <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Preview
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="text-xs font-normal text-muted-foreground">sample deal data</span>
            </DialogTitle>
          </DialogHeader>
          {previewFrame("h-[75vh] w-full rounded-md border bg-white")}
        </DialogContent>
      </Dialog>
    </div>
  );
}
