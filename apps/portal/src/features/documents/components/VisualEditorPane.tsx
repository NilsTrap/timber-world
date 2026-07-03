"use client";

/**
 * Visual editing pane — the Plate (WYSIWYG) editor at full width. Because the
 * editor already shows the document as it will look, there is no always-on
 * preview split; a "Preview" button opens the sample-merged render on demand in
 * a modal (useful once merge fields fill real deal data). Page settings + logo
 * live in a compact panel above the editor.
 */
import { useCallback, useState } from "react";
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
  /** Stable per loaded template — bumped only on select/create so the editor remounts with fresh content (not on every keystroke). */
  editorKey: string | number;
  templateId?: string;
  docType: DocType;
  doc: SlateValue;
  pageSettings: PageSettings | null;
  onDocChange: (d: SlateValue) => void;
  onPageSettingsChange: (ps: PageSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runPreview = useCallback(async () => {
    setLoading(true);
    setPreviewError(null);
    const res = await previewTemplateJson({ docJson: doc, docType, pageSettings });
    if (res.success) setPreviewHtml(res.data.html);
    else setPreviewError(res.error);
    setLoading(false);
  }, [doc, docType, pageSettings]);

  const openPreview = () => {
    setOpen(true);
    void runPreview();
  };

  return (
    <div className="space-y-3">
      <PageSettingsPanel
        templateId={templateId}
        pageSettings={pageSettings}
        onChange={onPageSettingsChange}
      />

      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={openPreview}>
          <Eye className="h-4 w-4" /> Preview with sample data
        </Button>
      </div>

      {/* Full-width WYSIWYG editor. key → remount with fresh content only when a different template loads. */}
      <div className="rounded-md border bg-background shadow-sm">
        <TimberPlateEditor key={editorKey} value={doc} onChange={onDocChange} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Preview
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="text-xs font-normal text-muted-foreground">(sample deal data)</span>
            </DialogTitle>
          </DialogHeader>
          {previewError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-semibold">Preview error</p>
              <p className="mt-1 whitespace-pre-wrap font-mono">{previewError}</p>
            </div>
          ) : (
            <iframe
              title="Visual preview"
              sandbox=""
              srcDoc={previewHtml}
              className="h-[70vh] w-full rounded-md border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
