import { PDFDocument, rgb } from "pdf-lib";
import { parse, serialize, type DefaultTreeAdapterTypes } from "parse5";

export interface CleanupFinding { type: "matched_term" | "metadata"; label: string }
export interface TextCleanupResult { output: string; findings: CleanupFinding[] }

export function normaliseSensitiveTerms(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim().toLocaleLowerCase()).filter((value): value is string => !!value && value.length >= 3))]
    .sort((a, b) => b.length - a.length);
}

function redact(input: string, terms: readonly string[]): TextCleanupResult {
  let output = input;
  const findings: CleanupFinding[] = [];
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "giu");
    if (!pattern.test(output)) continue;
    output = output.replace(pattern, "[REMOVED]");
    findings.push({ type: "matched_term", label: term });
  }
  return { output, findings };
}

export function cleanHtmlText(input: string, terms: readonly string[]): TextCleanupResult {
  const safe = sanitizeHtml(input);
  return redact(safe, terms);
}

function sanitizeHtml(input: string): string {
  // parse5 is browser-independent and is bundled cleanly by the Vercel server
  // runtime. Parsing first also normalises malformed markup and HTML entities.
  const document = parse(input);
  sanitizeChildren(document);
  return serialize(document);
}

const DROP_HTML_TAGS = new Set(["base", "embed", "iframe", "link", "math", "meta", "object", "script", "style", "svg"]);
const UNWRAP_HTML_TAGS = new Set(["form"]);
const URL_ATTRIBUTES = new Set(["action", "formaction", "href", "src", "xlink:href"]);

function sanitizeChildren(parent: DefaultTreeAdapterTypes.ParentNode): void {
  const children: DefaultTreeAdapterTypes.ChildNode[] = [];
  for (const child of parent.childNodes) {
    if (!("tagName" in child)) { children.push(child); continue; }
    const tagName = child.tagName.toLocaleLowerCase();
    if (DROP_HTML_TAGS.has(tagName)) continue;
    sanitizeChildren(child);
    if (UNWRAP_HTML_TAGS.has(tagName)) { children.push(...child.childNodes); continue; }
    child.attrs = child.attrs.filter((attribute) => {
      const name = attribute.name.toLocaleLowerCase();
      if (name === "srcdoc" || name.startsWith("on")) return false;
      return !URL_ATTRIBUTES.has(name) || !isDangerousHtmlUrl(attribute.value);
    });
    children.push(child);
  }
  parent.childNodes = children;
  for (const child of children) child.parentNode = parent;
}

function isDangerousHtmlUrl(value: string): boolean {
  const protocol = value.replace(/[\u0000-\u0020\u007f]+/gu, "").toLocaleLowerCase();
  return protocol.startsWith("javascript:") || protocol.startsWith("vbscript:") || protocol.startsWith("data:text/html");
}

export function cleanDxfText(input: string, terms: readonly string[]): TextCleanupResult {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const findings: CleanupFinding[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = lines[index]?.trim();
    if (!code || !["1", "3", "300", "301", "302", "303", "304", "305"].includes(code)) continue;
    const result = redact(lines[index + 1] ?? "", terms);
    lines[index + 1] = result.output;
    findings.push(...result.findings);
  }
  return { output: lines.join("\n"), findings: dedupeFindings(findings) };
}

export function cleanPlainText(input: string, terms: readonly string[]): TextCleanupResult { return redact(input, terms); }

export async function cleanPdfBytes(input: ArrayBuffer, terms: readonly string[] = []): Promise<{ output: Uint8Array; findings: CleanupFinding[] }> {
  const document = await PDFDocument.load(input, { ignoreEncryption: true });
  const findings: CleanupFinding[] = [];
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const parsed = await pdfjs.getDocument({ data: new Uint8Array(input.slice(0)) }).promise;
    for (let pageIndex = 0; pageIndex < parsed.numPages; pageIndex++) {
      const content = await (await parsed.getPage(pageIndex + 1)).getTextContent();
      const outputPage = document.getPage(pageIndex);
      for (const item of content.items as Array<{ str?: string; width?: number; height?: number; transform?: number[] }>) {
        const label = terms.find((term) => item.str?.toLocaleLowerCase().includes(term));
        if (!label || !item.transform) continue;
        outputPage.drawRectangle({ x: item.transform[4] ?? 0, y: (item.transform[5] ?? 0) - 2, width: Math.max(item.width ?? 0, 8), height: Math.max(item.height ?? Math.abs(item.transform[3] ?? 0), 8) + 4, color: rgb(1, 1, 1) });
        findings.push({ type: "matched_term", label });
      }
    }
    await parsed.destroy();
  } catch { /* malformed/image-only PDFs still receive the prototype title-block cleanup */ }
  document.setTitle(""); document.setAuthor(""); document.setSubject(""); document.setKeywords([]);
  document.setProducer("Nilitto clean copy"); document.setCreator("Nilitto");
  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    page.drawRectangle({ x: width * 0.78, y: 0, width: width * 0.22, height: height * 0.24, color: rgb(1, 1, 1) });
  }
  findings.push({ type: "metadata", label: "PDF metadata and title block" });
  return { output: await document.save(), findings: dedupeFindings(findings) };
}

export function dedupeFindings(findings: CleanupFinding[]): CleanupFinding[] {
  return [...new Map(findings.map((finding) => [`${finding.type}:${finding.label}`, finding])).values()];
}
