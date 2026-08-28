"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES } from "../../filePaths";
import { PreviewFailure, PreviewLoading } from "../ProjectFilePreview";
import { PROJECT_PREVIEW_COPY } from "../previewCopy";
import { sanitizeProjectHtml } from "./sanitizeProjectHtml";
import { canvasToBoundedPng, type RegisterProjectPreviewCapture } from "./projectPreviewCapture";

async function waitForHtmlPreviewAssets(document: Document) {
  await document.fonts?.ready;
  await Promise.all(Array.from(document.images, async (image) => {
    try {
      await image.decode();
    } catch {
      // A broken image should not prevent capturing the rest of the preview.
    }
  }));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function drawVisibleHtmlImages(canvas: HTMLCanvasElement, document: Document, viewportWidth: number, viewportHeight: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const scaleX = canvas.width / viewportWidth;
  const scaleY = canvas.height / viewportHeight;
  for (const image of Array.from(document.images)) {
    if (!image.complete || image.naturalWidth < 1 || image.naturalHeight < 1) continue;
    const rect = image.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewportWidth, rect.right);
    const bottom = Math.min(viewportHeight, rect.bottom);
    if (right <= left || bottom <= top || rect.width < 1 || rect.height < 1) continue;
    const sourceX = ((left - rect.left) / rect.width) * image.naturalWidth;
    const sourceY = ((top - rect.top) / rect.height) * image.naturalHeight;
    const sourceWidth = ((right - left) / rect.width) * image.naturalWidth;
    const sourceHeight = ((bottom - top) / rect.height) * image.naturalHeight;
    try {
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, left * scaleX, top * scaleY, (right - left) * scaleX, (bottom - top) * scaleY);
    } catch {
      // Keep the rendered layout when an individual cross-origin image cannot be copied safely.
    }
  }
}

export function HtmlFileViewer({ url, onRetry, registerCapture }: { url: string; onRetry: () => Promise<void>; registerCapture?: RegisterProjectPreviewCapture }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
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
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); registerCapture?.(null); };
  }, [registerCapture, url]);

  if (failed) return <PreviewFailure message={PROJECT_PREVIEW_COPY.htmlError} onRetry={onRetry} />;
  if (!html) return <PreviewLoading label={PROJECT_PREVIEW_COPY.htmlSanitizing} />;
  return <iframe ref={iframeRef} srcDoc={html} title={PROJECT_PREVIEW_COPY.htmlAria} sandbox="allow-same-origin" referrerPolicy="no-referrer" className="h-[70vh] w-full rounded border bg-white" onLoad={() => {
    registerCapture?.(async () => {
      const frameWindow = iframeRef.current?.contentWindow;
      const frameDocument = iframeRef.current?.contentDocument;
      const documentElement = frameDocument?.documentElement;
      if (!frameWindow || !frameDocument || !documentElement) throw new Error("The HTML preview is not ready to capture.");
      await waitForHtmlPreviewAssets(frameDocument);
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(documentElement, {
        x: frameWindow.scrollX,
        y: frameWindow.scrollY,
        width: frameWindow.innerWidth,
        height: frameWindow.innerHeight,
        scale: 1,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        imageTimeout: 30_000,
        logging: false,
      });
      drawVisibleHtmlImages(canvas, frameDocument, frameWindow.innerWidth, frameWindow.innerHeight);
      return canvasToBoundedPng(canvas);
    });
  }} />;
}
