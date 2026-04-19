"use client";

import { useCallback } from "react";
import Image from "next/image";
import { FileText } from "lucide-react";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nl2br(str: string): string {
  return escapeHtml(str).replace(/\n/g, "<br />");
}

interface ProductCardProps {
  productKey: string;
  title: string;
  description: string;
  specification: string;
  specificationLabel?: string;
  printLabel?: string;
  imageUrl: string | null;
  altText: string | null;
}

export function ProductCard({ title, description, specification, specificationLabel = "Specification", printLabel = "Print", imageUrl, altText }: ProductCardProps) {
  const handleOpen = useCallback(() => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)} - ${escapeHtml(specificationLabel)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; padding-top: 60px; color: #1a1a1a; }
    .print-bar { position: fixed; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 10px 24px; background: #f8f8f8; border-bottom: 1px solid #e0e0e0; z-index: 10; }
    .print-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border: 1px solid #ccc; border-radius: 6px; background: #fff; font-size: 13px; font-weight: 500; color: #333; cursor: pointer; transition: all 0.15s; }
    .print-btn:hover { background: #f0f0f0; border-color: #999; }
    .print-btn svg { width: 14px; height: 14px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 24px; }
    h2 { font-size: 20px; font-weight: 600; margin-top: 28px; margin-bottom: 12px; color: #333; }
    img { width: 100%; max-height: 50vh; object-fit: contain; margin-bottom: 24px; border-radius: 8px; }
    .description { font-size: 16px; line-height: 1.6; color: #444; margin-bottom: 8px; }
    .specification { font-size: 15px; line-height: 1.7; color: #333; white-space: pre-wrap; }
    @media print {
      .print-bar { display: none; }
      body { padding: 20px; padding-top: 20px; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      ${escapeHtml(printLabel)}
    </button>
  </div>
  <h1>${escapeHtml(title)}</h1>
  ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(altText || title)}" />` : ""}
  ${description ? `<p class="description">${nl2br(description)}</p>` : ""}
  ${specification ? `<h2>${escapeHtml(specificationLabel)}</h2><div class="specification">${nl2br(specification)}</div>` : ""}
</body>
</html>`);
    w.document.close();
  }, [title, description, specification, specificationLabel, printLabel, imageUrl, altText]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="aspect-video relative bg-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={altText || title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-sm">No image</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-heading text-lg font-semibold text-charcoal mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 mb-3">
            {description}
          </p>
        )}
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 border border-gray-200 hover:text-charcoal hover:border-gray-300 hover:bg-gray-50 transition-colors"
          title={specificationLabel}
        >
          <FileText className="h-3.5 w-3.5" />
          {specificationLabel}
        </button>
      </div>
    </div>
  );
}
