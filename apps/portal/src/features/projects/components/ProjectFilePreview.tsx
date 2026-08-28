"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@timber/ui";
import { classifyProjectFile, getProjectPreviewKind } from "../filePaths";
import { PROJECT_PREVIEW_COPY } from "./previewCopy";
import { canvasRegionToBoundedPng, canvasToBoundedPng, MAX_CAPTURE_DIMENSION, scaledVisibleCanvasRegion, type RegisterProjectPreviewCapture } from "./viewers/projectPreviewCapture";

function ChunkLoading({ labelKey }: { labelKey: "prepareHtml" | "loadDxf" | "loadStep" }) {
  return <PreviewLoading label={PROJECT_PREVIEW_COPY[labelKey]} />;
}

const HtmlFileViewer = dynamic(() => import("./viewers/HtmlFileViewer").then((module) => module.HtmlFileViewer), {
  ssr: false,
  loading: () => <ChunkLoading labelKey="prepareHtml" />,
});
const DxfFileViewer = dynamic(() => import("./viewers/DxfFileViewer").then((module) => module.DxfFileViewer), {
  ssr: false,
  loading: () => <ChunkLoading labelKey="loadDxf" />,
});
const StepFileViewer = dynamic(() => import("./viewers/StepFileViewer").then((module) => module.StepFileViewer), {
  ssr: false,
  loading: () => <ChunkLoading labelKey="loadStep" />,
});

export interface ProjectPreviewSource {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  url: string;
}

interface PreviewBoundaryProps {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
}

class PreviewBoundary extends Component<PreviewBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep signed URLs and library internals out of user-visible errors.
  }

  componentDidUpdate(previous: PreviewBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ProjectFilePreview({
  source,
  onRetry,
  refreshError,
  registerCapture,
}: {
  source: ProjectPreviewSource;
  onRetry: () => Promise<void>;
  refreshError?: string | null;
  registerCapture?: RegisterProjectPreviewCapture;
}) {
  const kind = getProjectPreviewKind(source.fileName, source.mimeType);
  const fallback = <PreviewFailure message={PROJECT_PREVIEW_COPY.viewerError} onRetry={onRetry} />;
  let viewer: ReactNode;

  if (kind === "html") viewer = <HtmlFileViewer url={source.url} onRetry={onRetry} registerCapture={registerCapture} />;
  else if (kind === "dxf") viewer = <DxfFileViewer url={source.url} onRetry={onRetry} registerCapture={registerCapture} />;
  else if (kind === "step") viewer = <StepFileViewer url={source.url} onRetry={onRetry} registerCapture={registerCapture} />;
  else if (kind === "native") viewer = <NativeFileViewer source={source} onRetry={onRetry} registerCapture={registerCapture} />;
  else viewer = <PreviewFailure message={PROJECT_PREVIEW_COPY.unavailable} onRetry={onRetry} />;

  return (
    <div className="space-y-2">
      {refreshError ? <p role="alert" className="text-sm text-destructive">{refreshError}</p> : null}
      <PreviewBoundary resetKey={source.url} fallback={fallback}>{viewer}</PreviewBoundary>
    </div>
  );
}

function NativeFileViewer({ source, onRetry, registerCapture }: { source: ProjectPreviewSource; onRetry: () => Promise<void>; registerCapture?: RegisterProjectPreviewCapture }) {
  const isPdf = classifyProjectFile(source.fileName, source.mimeType) === "pdf";
  return isPdf
    ? <PdfFileViewer key={source.url} source={source} onRetry={onRetry} registerCapture={registerCapture} />
    : <RasterFileViewer key={source.url} source={source} onRetry={onRetry} registerCapture={registerCapture} />;
}

function RasterFileViewer({ source, onRetry, registerCapture }: { source: ProjectPreviewSource; onRetry: () => Promise<void>; registerCapture?: RegisterProjectPreviewCapture }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let disposed = false;
    setState("loading");
    setZoom(1);
    const image = new Image();
    const timeout = window.setTimeout(() => { if (!disposed) { image.src = ""; setState("error"); } }, 30_000);
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => { window.clearTimeout(timeout); if (!disposed) { imageRef.current = image; setState("ready"); } };
    image.onerror = () => { window.clearTimeout(timeout); if (!disposed) setState("error"); };
    image.src = source.url;
    return () => { disposed = true; window.clearTimeout(timeout); imageRef.current = null; registerCapture?.(null); };
  }, [registerCapture, source.url]);

  useEffect(() => {
    if (state !== "ready") return;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!viewport || !canvas || !image) return;
    const draw = () => {
      const width = Math.max(1, viewport.clientWidth);
      const height = Math.max(1, viewport.clientHeight);
      const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight) * zoom;
      const rawWidth = image.naturalWidth * fit;
      const rawHeight = image.naturalHeight * fit;
      const allocationScale = Math.min(1, (MAX_CAPTURE_DIMENSION * 2) / rawWidth, (MAX_CAPTURE_DIMENSION * 2) / rawHeight);
      const drawWidth = rawWidth * allocationScale;
      const drawHeight = rawHeight * allocationScale;
      canvas.width = Math.max(width, Math.ceil(drawWidth));
      canvas.height = Math.max(height, Math.ceil(drawHeight));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(viewport);
    registerCapture?.(() => canvasRegionToBoundedPng(canvas, viewport.scrollLeft, viewport.scrollTop, viewport.clientWidth, viewport.clientHeight));
    return () => { observer.disconnect(); registerCapture?.(null); };
  }, [registerCapture, state, zoom]);

  if (state === "error") return <PreviewFailure message={PROJECT_PREVIEW_COPY.nativeError} onRetry={onRetry} />;
  if (state === "loading") return <PreviewLoading label={PROJECT_PREVIEW_COPY.nativeLoading} />;
  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}><Minus className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="outline" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(4, value + 0.25))}><Plus className="h-4 w-4" /></Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void onRetry()}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> {PROJECT_PREVIEW_COPY.refresh}
        </Button>
      </div>
      <div ref={viewportRef} className="h-[70vh] w-full overflow-auto rounded border bg-white"><canvas ref={canvasRef} className="block max-w-none" aria-label={`Preview ${source.fileName}`} /></div>
    </div>
  );
}

function PdfFileViewer({ source, onRetry, registerCapture }: { source: ProjectPreviewSource; onRetry: () => Promise<void>; registerCapture?: RegisterProjectPreviewCapture }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    let renderTask: { cancel(): void; promise: Promise<void> } | null = null;
    setState("loading");
    registerCapture?.(null);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loadingTask = pdfjs.getDocument({ url: source.url, withCredentials: false });
        controller.signal.addEventListener("abort", () => loadingTask.destroy(), { once: true });
        const document = await loadingTask.promise;
        if (controller.signal.aborted) return;
        setPageCount(document.numPages);
        const pdfPage = await document.getPage(Math.min(page, document.numPages));
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("canvas");
        renderTask = pdfPage.render({ canvasContext: context, viewport, canvas });
        await renderTask.promise;
        registerCapture?.(() => {
          const visible = viewportRef.current;
          if (!visible || canvas.clientWidth < 1 || canvas.clientHeight < 1) throw new Error("The PDF preview is not ready to capture.");
          const region = scaledVisibleCanvasRegion({
            canvasWidth: canvas.width, canvasHeight: canvas.height,
            canvasClientWidth: canvas.clientWidth, canvasClientHeight: canvas.clientHeight,
            canvasOffsetLeft: canvas.offsetLeft, canvasOffsetTop: canvas.offsetTop,
            scrollLeft: visible.scrollLeft, scrollTop: visible.scrollTop,
            viewportWidth: visible.clientWidth, viewportHeight: visible.clientHeight,
          });
          return canvasRegionToBoundedPng(canvas, region.x, region.y, region.width, region.height);
        });
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    })();
    return () => { controller.abort(); renderTask?.cancel(); registerCapture?.(null); };
  }, [page, registerCapture, source.url]);
  if (state === "error") return <PreviewFailure message={PROJECT_PREVIEW_COPY.nativeError} onRetry={onRetry} />;
  return <div className="space-y-2"><div className="flex items-center justify-end gap-2"><Button type="button" size="sm" variant="outline" aria-label="Previous PDF page" disabled={page <= 1 || state === "loading"} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {pageCount || "…"}</span><Button type="button" size="sm" variant="outline" aria-label="Next PDF page" disabled={!pageCount || page >= pageCount || state === "loading"} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div><div ref={viewportRef} className="relative flex h-[70vh] w-full justify-center overflow-auto rounded border bg-slate-100 p-2"><canvas ref={canvasRef} className="h-max max-w-full bg-white shadow" aria-label={`Preview ${source.fileName}, page ${page}`} />{state === "loading" ? <div className="absolute inset-0"><PreviewLoading label={PROJECT_PREVIEW_COPY.nativeLoading} /></div> : null}</div></div>;
}

export function PreviewLoading({ label }: { label: string }) {
  return (
    <div className="flex h-[70vh] items-center justify-center rounded border bg-muted/20 text-sm text-muted-foreground" role="status">
      {label}
    </div>
  );
}

export function PreviewFailure({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded border bg-muted/20 p-6 text-center" role="alert">
      <p className="text-sm text-destructive">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => void onRetry()}>
        <RotateCcw className="mr-1.5 h-4 w-4" /> {PROJECT_PREVIEW_COPY.retryFresh}
      </Button>
    </div>
  );
}
