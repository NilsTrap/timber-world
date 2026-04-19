"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";

interface ProductCardProps {
  productKey: string;
  title: string;
  description: string;
  imageUrl: string | null;
  altText: string | null;
}

export function ProductCard({ title, description, imageUrl, altText }: ProductCardProps) {
  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 24px; }
    img { width: 100%; max-height: 60vh; object-fit: contain; margin-bottom: 24px; border-radius: 8px; }
    p { font-size: 16px; line-height: 1.6; color: #444; }
    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <h1>${title.replace(/</g, "&lt;")}</h1>
  ${imageUrl ? `<img src="${imageUrl}" alt="${(altText || title).replace(/"/g, "&quot;")}" />` : ""}
  ${description ? `<p>${description.replace(/</g, "&lt;")}</p>` : ""}
  <script>
    ${imageUrl ? `
    // Wait for image to load before printing
    const img = document.querySelector('img');
    if (img) {
      if (img.complete) {
        window.print();
      } else {
        img.onload = () => window.print();
        img.onerror = () => window.print();
      }
    } else {
      window.print();
    }` : `window.print();`}
  </script>
</body>
</html>`);
    printWindow.document.close();
  }, [title, description, imageUrl, altText]);

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
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-lg font-semibold text-charcoal mb-2">
            {title}
          </h3>
          <button
            onClick={handlePrint}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-charcoal hover:bg-gray-100 transition-colors"
            title="Specification"
          >
            <Printer className="h-3.5 w-3.5" />
            Specification
          </button>
        </div>
        {description && (
          <p className="text-sm text-gray-600">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
