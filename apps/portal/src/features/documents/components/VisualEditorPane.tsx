"use client";

/**
 * Visual editing pane — the TipTap editor + a live, sample-merged preview. The
 * preview compiles doc_json → Handlebars → merges representative DocumentData
 * (server-side via previewTemplateJson) so the user always sees real values,
 * never a raw {{token}}. Page settings + logo live in a separate panel (W5).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { TemplateEditor } from "../editor/TemplateEditor";
import { previewTemplateJson } from "../actions";
import type { DocType } from "@/features/orders/services/dealModel";
import type { PageSettings, TipTapDoc } from "../types";

export function VisualEditorPane({
  editorKey,
  docType,
  doc,
  pageSettings,
  onDocChange,
}: {
  /** Stable per loaded template — bumped only on select/create so the editor remounts with fresh content (not on every keystroke). */
  editorKey: string | number;
  docType: DocType;
  doc: TipTapDoc;
  pageSettings: PageSettings | null;
  onDocChange: (d: TipTapDoc) => void;
}) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const runPreview = useCallback(
    async (d: TipTapDoc, ps: PageSettings | null) => {
      const s = ++seq.current;
      setLoading(true);
      const res = await previewTemplateJson({ docJson: d, docType, pageSettings: ps });
      if (s !== seq.current) return; // superseded
      if (res.success) {
        setPreviewHtml(res.data.html);
        setPreviewError(null);
      } else {
        setPreviewError(res.error);
      }
      setLoading(false);
    },
    [docType]
  );

  // Debounced live preview on every doc / page-settings change.
  useEffect(() => {
    const t = setTimeout(() => runPreview(doc, pageSettings), 400);
    return () => clearTimeout(t);
  }, [doc, pageSettings, runPreview]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0">
        {/* key → remount with fresh content only when a different template loads */}
        <TemplateEditor key={editorKey} value={doc} onChange={onDocChange} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Live preview (sample data)
        </div>
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
            className="h-[65vh] w-full rounded-md border bg-white"
          />
        )}
      </div>
    </div>
  );
}
