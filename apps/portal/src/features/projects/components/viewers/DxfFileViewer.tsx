"use client";

import { useEffect, useRef, useState } from "react";
import { ScanSearch } from "lucide-react";
import { Button } from "@timber/ui";
import type { DxfViewer as DxfViewerInstance, LayerInfo } from "dxf-viewer";
import { PreviewFailure, PreviewLoading } from "../ProjectFilePreview";
import { PROJECT_PREVIEW_COPY } from "../previewCopy";
import { canvasToBoundedPng, type RegisterProjectPreviewCapture } from "./projectPreviewCapture";

export function DxfFileViewer({ url, onRetry, registerCapture }: { url: string; onRetry: () => Promise<void>; registerCapture?: RegisterProjectPreviewCapture }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<DxfViewerInstance | null>(null);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let viewer: DxfViewerInstance | null = null;
    let timeout = 0;
    setLoading(true);
    setFailed(false);
    setLayers([]);
    setHiddenLayers(new Set());
    void (async () => {
      try {
        const [{ DxfViewer }, { Color }] = await Promise.all([import("dxf-viewer"), import("three")]);
        if (disposed) return;
        viewer = new DxfViewer(container, {
          autoResize: true,
          antialias: true,
          clearColor: new Color("#ffffff"),
          blackWhiteInversion: true,
        });
        viewerRef.current = viewer;
        const load = viewer.Load({
          url,
          workerFactory: () => new Worker(new URL("./dxfViewer.worker.ts", import.meta.url), { type: "module" }),
        });
        const timed = new Promise<never>((_, reject) => {
          timeout = window.setTimeout(() => reject(new Error("timeout")), 60_000);
        });
        await Promise.race([load, timed]);
        window.clearTimeout(timeout);
        if (disposed) return;
        const bounds = viewer.GetBounds();
        if (!bounds || ![bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].every(Number.isFinite)) throw new Error("empty");
        setLayers([...viewer.GetLayers()].sort((a, b) => a.displayName.localeCompare(b.displayName)));
        registerCapture?.(async () => {
          const canvas = container.querySelector("canvas");
          if (!canvas) throw new Error("The drawing preview is not ready to capture.");
          viewer?.Render();
          return canvasToBoundedPng(canvas);
        });
        setLoading(false);
      } catch {
        window.clearTimeout(timeout);
        try { viewer?.Destroy(); } catch { /* Viewer can already be terminating its worker. */ }
        viewerRef.current = null;
        if (!disposed) { setLoading(false); setFailed(true); }
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      viewerRef.current = null;
      registerCapture?.(null);
      try { viewer?.Destroy(); } catch { /* Viewer can already be terminating its worker. */ }
    };
  }, [registerCapture, url]);

  const fitDrawing = () => {
    const viewer = viewerRef.current;
    const bounds = viewer?.GetBounds();
    if (viewer && bounds) viewer.FitView(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, 0.1);
  };

  const toggleLayer = (layer: LayerInfo) => {
    const willShow = hiddenLayers.has(layer.name);
    viewerRef.current?.ShowLayer(layer.name, willShow);
    setHiddenLayers((current) => {
      const next = new Set(current);
      if (willShow) next.delete(layer.name); else next.add(layer.name);
      return next;
    });
  };

  if (failed) return <PreviewFailure message={PROJECT_PREVIEW_COPY.dxfError} onRetry={onRetry} />;
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={fitDrawing}>
          <ScanSearch className="mr-1.5 h-4 w-4" /> {PROJECT_PREVIEW_COPY.fitDrawing}
        </Button>
        {layers.length > 1 ? <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_PREVIEW_COPY.layers}</span> : null}
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {layers.map((layer) => (
            <Button key={layer.name} type="button" size="sm" variant={hiddenLayers.has(layer.name) ? "outline" : "secondary"} aria-pressed={!hiddenLayers.has(layer.name)} onClick={() => toggleLayer(layer)}>
              {layer.displayName}
            </Button>
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{PROJECT_PREVIEW_COPY.visualReference}</span>
      </div>
      <div className="relative h-[70vh] overflow-hidden rounded border bg-white">
        <div ref={containerRef} className="h-full w-full" aria-label={PROJECT_PREVIEW_COPY.dxfAria} />
        {loading ? <div className="absolute inset-0"><PreviewLoading label={PROJECT_PREVIEW_COPY.dxfParsing} /></div> : null}
      </div>
    </div>
  );
}
