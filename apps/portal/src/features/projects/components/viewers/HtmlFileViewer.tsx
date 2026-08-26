"use client";

import { useEffect, useState } from "react";
import { MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES } from "../../filePaths";
import { PreviewFailure, PreviewLoading } from "../ProjectFilePreview";
import { PROJECT_PREVIEW_COPY } from "../previewCopy";
import { sanitizeProjectHtml } from "./sanitizeProjectHtml";

export function HtmlFileViewer({ url, onRetry }: { url: string; onRetry: () => Promise<void> }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let disposed = false;
    setHtml(null);
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("download");
        const declaredSize = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredSize) && declaredSize > MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES) throw new Error("size");
        const source = await response.text();
        if (new Blob([source]).size > MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES) throw new Error("size");
        const sanitized = sanitizeProjectHtml(source);
        if (!disposed) setHtml(sanitized);
      } catch {
        if (!controller.signal.aborted && !disposed) setFailed(true);
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [url]);

  if (failed) return <PreviewFailure message={PROJECT_PREVIEW_COPY.htmlError} onRetry={onRetry} />;
  if (!html) return <PreviewLoading label={PROJECT_PREVIEW_COPY.htmlSanitizing} />;
  return <iframe srcDoc={html} title={PROJECT_PREVIEW_COPY.htmlAria} sandbox="" referrerPolicy="no-referrer" className="h-[70vh] w-full rounded border bg-white" />;
}
