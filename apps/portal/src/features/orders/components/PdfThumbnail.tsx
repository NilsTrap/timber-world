"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Loader2 } from "lucide-react";
import { getOrderFileUrl } from "../actions/getOrderFileUrl";
import type { OrderFile } from "../types";

interface PdfThumbnailProps {
  /** The PDF file to thumbnail */
  file: OrderFile;
  /** Click handler (e.g., open preview) */
  onClick?: () => void;
  /** Height in pixels */
  height?: number;
}

export function PdfThumbnail({ file, onClick, height = 140 }: PdfThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await getOrderFileUrl(file.id);
      if (result.success) {
        setUrl(result.data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [file.id]);

  useEffect(() => {
    loadUrl();
  }, [loadUrl]);

  // Scale: render a large iframe showing just the first page, then scale down.
  // Use landscape aspect ratio (A4 landscape ≈ 1.414) since most order PDFs are landscape.
  const iframeScale = 0.2;
  const displayWidth = height * 1.414; // landscape ratio
  const iframeWidth = displayWidth / iframeScale;
  const iframeHeight = height / iframeScale;

  return (
    <div
      className={`relative rounded-md border bg-white overflow-hidden shrink-0 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      style={{ width: displayWidth, height }}
      onClick={onClick}
      title={file.fileName}
    >
      {loading && (
        <div className="flex items-center justify-center w-full h-full">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px] px-1">{file.fileName}</span>
        </div>
      )}
      {url && !error && (
        <iframe
          src={`${url}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
          style={{
            width: iframeWidth,
            height: iframeHeight,
            transform: `scale(${iframeScale})`,
            transformOrigin: "top left",
            border: "none",
            pointerEvents: "none",
          }}
          title={file.fileName}
          tabIndex={-1}
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
}
