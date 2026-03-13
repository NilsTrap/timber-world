/**
 * Print HTML content using a hidden iframe.
 *
 * This avoids Radix dialog positioning constraints and popup blockers.
 * The content is rendered in a clean iframe with its own styles,
 * so multi-page printing works naturally.
 */
export function printHtml(html: string, styles: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<title>Print</title>
<style>${styles}</style>
</head>
<body>${html}</body>
</html>`);
  doc.close();

  // Wait for content to render before printing
  const tryPrint = () => {
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
    // Clean up after a delay to allow print dialog to grab the content
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  };

  // Give the browser a frame to lay out the content
  if (iframe.contentWindow) {
    iframe.contentWindow.addEventListener("afterprint", () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    });
  }
  setTimeout(tryPrint, 100);
}

export const PRINT_STYLES_TABLE = `
  @page { size: 210mm 297mm; margin: 10mm; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 15px; margin: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 8pt; white-space: nowrap; }
  th, td { text-align: left; padding: 3px 4px; }
  thead tr { border-bottom: 2px solid black; }
  tbody tr { border-bottom: 1px solid #d1d5db; }
  tfoot tr { border-top: 2px solid black; font-weight: bold; }
  th { font-weight: 600; }
  td.right, th.right { text-align: right; }
  .tabnum { font-variant-numeric: tabular-nums; }
  .medium { font-weight: 500; }
  .header { margin-bottom: 20px; }
  .header h1 { font-size: 16px; font-weight: bold; margin: 0 0 4px; }
  .header p { font-size: 11px; color: #4b5563; margin: 2px 0; }
  .timestamp { margin-top: 12px; font-size: 9px; color: #6b7280; }
`;

export const PRINT_STYLES_PORTRAIT = `
  @page { size: 210mm 297mm; margin: 15mm; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; margin: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 11pt; }
  th, td { text-align: left; padding: 8px 6px; }
  thead tr { border-bottom: 2px solid black; }
  tbody tr { border-bottom: 1px solid #d1d5db; }
  tfoot tr { border-top: 2px solid black; font-weight: bold; }
  th { font-weight: 600; }
  td.right, th.right { text-align: right; }
  .tabnum { font-variant-numeric: tabular-nums; }
  .medium { font-weight: 500; }
  .mono { font-family: ui-monospace, monospace; font-weight: 500; }
  .top { vertical-align: top; }
  .wrap { white-space: pre-wrap; }
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 18px; font-weight: bold; margin: 0 0 4px; }
  .header p { font-size: 13px; color: #4b5563; margin: 2px 0; }
  .timestamp { margin-top: 16px; font-size: 11px; color: #6b7280; }
  .no-desc { color: #9ca3af; font-style: italic; }
  .checkbox { width: 14px; height: 14px; border: 2px solid #9ca3af; display: inline-block; }
`;
