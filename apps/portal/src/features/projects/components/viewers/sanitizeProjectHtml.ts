import DOMPurify from "isomorphic-dompurify";

const PREVIEW_CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";

export function sanitizeProjectHtml(source: string): string {
  const sanitized = String(DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ["script", "iframe", "frame", "frameset", "object", "embed", "form", "input", "button", "textarea", "select", "meta", "base"],
    FORBID_ATTR: ["srcdoc"],
  }));
  const policy = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  if (/<head(?:\s[^>]*)?>/i.test(sanitized)) {
    return `<!doctype html>${sanitized.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${policy}`)}`;
  }
  return `<!doctype html><html><head>${policy}</head><body>${sanitized}</body></html>`;
}
