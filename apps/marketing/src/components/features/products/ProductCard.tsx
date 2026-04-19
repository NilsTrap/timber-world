"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";

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
  imageUrl: string | null;
  altText: string | null;
}

export function ProductCard({ title, description, specification, imageUrl, altText }: ProductCardProps) {
  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)} - Specification</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 24px; }
    h2 { font-size: 20px; font-weight: 600; margin-top: 28px; margin-bottom: 12px; color: #333; }
    img { width: 100%; max-height: 50vh; object-fit: contain; margin-bottom: 24px; border-radius: 8px; }
    .description { font-size: 16px; line-height: 1.6; color: #444; margin-bottom: 8px; }
    .specification { font-size: 15px; line-height: 1.7; color: #333; white-space: pre-wrap; }
    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(altText || title)}" />` : ""}
  ${description ? `<p class="description">${nl2br(description)}</p>` : ""}
  ${specification ? `<h2>Specification</h2><div class="specification">${nl2br(specification)}</div>` : ""}
  <script>
    ${imageUrl ? `
    const img = document.querySelector('img');
    if (img) {
      if (img.complete) { window.print(); }
      else { img.onload = () => window.print(); img.onerror = () => window.print(); }
    } else { window.print(); }` : `window.print();`}
  </script>
</body>
</html>`);
    printWindow.document.close();
  }, [title, description, specification, imageUrl, altText]);

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
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 border border-gray-200 hover:text-charcoal hover:border-gray-300 hover:bg-gray-50 transition-colors"
          title="Specification"
        >
          <Printer className="h-3.5 w-3.5" />
          Specification
        </button>
      </div>
    </div>
  );
}
