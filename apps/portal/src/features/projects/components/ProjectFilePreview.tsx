"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@timber/ui";
import { getProjectPreviewKind } from "../filePaths";
import { PROJECT_PREVIEW_COPY } from "./previewCopy";

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
}: {
  source: ProjectPreviewSource;
  onRetry: () => Promise<void>;
  refreshError?: string | null;
}) {
  const kind = getProjectPreviewKind(source.fileName, source.mimeType);
  const fallback = <PreviewFailure message={PROJECT_PREVIEW_COPY.viewerError} onRetry={onRetry} />;
  let viewer: ReactNode;

  if (kind === "html") viewer = <HtmlFileViewer url={source.url} onRetry={onRetry} />;
  else if (kind === "dxf") viewer = <DxfFileViewer url={source.url} onRetry={onRetry} />;
  else if (kind === "step") viewer = <StepFileViewer url={source.url} onRetry={onRetry} />;
  else if (kind === "native") viewer = <NativeFileViewer source={source} onRetry={onRetry} />;
  else viewer = <PreviewFailure message={PROJECT_PREVIEW_COPY.unavailable} onRetry={onRetry} />;

  return (
    <div className="space-y-2">
      {refreshError ? <p role="alert" className="text-sm text-destructive">{refreshError}</p> : null}
      <PreviewBoundary resetKey={source.url} fallback={fallback}>{viewer}</PreviewBoundary>
    </div>
  );
}

function NativeFileViewer({ source, onRetry }: { source: ProjectPreviewSource; onRetry: () => Promise<void> }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    let disposed = false;
    setState("loading");
    void fetch(source.url, {
      method: "HEAD",
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }).then((response) => {
      if (!disposed) setState(response.ok || response.status === 405 || response.status === 501 ? "ready" : "error");
    }).catch(() => { if (!disposed) setState("error"); }).finally(() => window.clearTimeout(timeout));
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [source.url]);

  if (state === "error") return <PreviewFailure message={PROJECT_PREVIEW_COPY.nativeError} onRetry={onRetry} />;
  if (state === "loading") return <PreviewLoading label={PROJECT_PREVIEW_COPY.nativeLoading} />;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => void onRetry()}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> {PROJECT_PREVIEW_COPY.refresh}
        </Button>
      </div>
      <iframe
        src={source.url}
        title={`Preview ${source.fileName}`}
        sandbox=""
        referrerPolicy="no-referrer"
        className="h-[70vh] w-full rounded border bg-white"
        onError={() => setState("error")}
      />
    </div>
  );
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
