"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders HTML+CSS in an iframe so the preview matches the print output exactly.
 * Scales the content to fit the container width without horizontal scrolling.
 */
export function DocumentPreviewIframe({
  html,
  styles,
  height = "70vh",
}: {
  html: string;
  styles: string;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);

  // A4 portrait content width in px (approx 210mm at 96dpi minus margins)
  const CONTENT_WIDTH = 860;
  const CONTENT_HEIGHT = 1200;

  useEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      if (!container) return;
      const available = container.clientWidth - 4;
      const s = Math.min(1, available / CONTENT_WIDTH);
      setScale(s);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const previewStyles = styles.replace(/@page\s*\{[^}]*\}/g, "");

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<style>
${previewStyles}
body { padding: 16px 20px; margin: 0; background: white; width: ${CONTENT_WIDTH - 40}px; }
</style>
</head>
<body>${html}</body>
</html>`);
    doc.close();
  }, [html, styles]);

  // The scaled height the iframe visually occupies
  const scaledHeight = CONTENT_HEIGHT * scale;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        maxHeight: height,
        overflow: "auto",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        background: "#f9f9f9",
      }}
    >
      <div style={{ height: `${scaledHeight}px`, overflow: "hidden" }}>
        <iframe
          ref={iframeRef}
          style={{
            width: `${CONTENT_WIDTH}px`,
            height: `${CONTENT_HEIGHT}px`,
            border: "none",
            background: "white",
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            display: "block",
          }}
          title="Document preview"
        />
      </div>
    </div>
  );
}
