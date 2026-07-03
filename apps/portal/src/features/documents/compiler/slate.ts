/**
 * Slate (Plate) → Handlebars-HTML compiler.
 *
 * Plate stores documents as Slate JSON: an array of element/text nodes where
 * text nodes carry marks as boolean props ({ text, bold, italic, … }) and
 * elements are { type, children, …attrs }. This walks that tree and emits the
 * SAME semantic HTML the TipTap compiler produced (h1–h3, p, ul/ol/li, marks,
 * table.rt-table, hr, a, img), wrapped by the shared `compileShell` so the
 * FROZEN render pipeline (templateMerge.ts → gotenberg.ts) is unaffected.
 *
 * PURE: no react/@platejs, no I/O — runs in the save action, the preview action
 * and tsx tests identically. Deterministic byte-stable output.
 *
 * v1 scope: rich text + tables (the editor feel). Merge fields / line-item
 * loops are deferred — `mention` nodes render as their plain label for now.
 * Text and attributes are escaped and Handlebars braces neutralised via the
 * shared escapeText/escapeAttr (the W2 security invariant).
 */
import { escapeAttr, escapeText } from "./nodes";
import { compileShell } from "./shell";
import type { CompileOptions } from "./types";

export interface SlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  [k: string]: unknown;
}
export interface SlateElement {
  type?: string;
  children?: SlateNode[];
  url?: unknown;
  value?: unknown;
  align?: unknown;
  indent?: unknown;
  listStyleType?: unknown;
  [k: string]: unknown;
}
export type SlateNode = SlateText | SlateElement;

const isText = (n: SlateNode | undefined): n is SlateText =>
  !!n && typeof (n as SlateText).text === "string";

const ORDERED = new Set(["decimal", "upper-alpha", "lower-alpha", "upper-roman", "lower-roman"]);
const listTag = (styleType: unknown): "ol" | "ul" =>
  typeof styleType === "string" && ORDERED.has(styleType) ? "ol" : "ul";

/** Inline text with marks. Order fixed for byte-stable output. */
function serializeText(node: SlateText): string {
  let html = escapeText(node.text ?? "");
  if (html === "") return "";
  if (node.code) html = `<code>${html}</code>`;
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.underline) html = `<u>${html}</u>`;
  if (node.strikethrough) html = `<s>${html}</s>`;
  return html;
}

/** Inline content: text nodes + inline elements (links, mentions). */
function serializeInline(nodes: SlateNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (isText(n)) return serializeText(n);
      const el = n as SlateElement;
      switch (el.type) {
        case "a": {
          const href = typeof el.url === "string" ? el.url : "#";
          return `<a href="${escapeAttr(href)}">${serializeInline(el.children)}</a>`;
        }
        // Merge fields are deferred — render the mention label as plain text.
        case "mention":
          return escapeText(typeof el.value === "string" ? el.value : "");
        default:
          return serializeInline(el.children);
      }
    })
    .join("");
}

const alignAttr = (el: SlateElement): string => {
  const a = el.align;
  return a === "center" || a === "right" || a === "justify" ? ` style="text-align:${a}"` : "";
};

/** A run of consecutive Slate blocks that carry `listStyleType`, nested by `indent`. */
function serializeListRun(items: SlateElement[]): string {
  let idx = 0;
  const indentOf = (el: SlateElement): number =>
    typeof el.indent === "number" && el.indent > 0 ? el.indent : 1;

  function build(level: number): string {
    const tag = listTag(items[idx]?.listStyleType);
    let inner = "";
    while (idx < items.length) {
      const it = items[idx];
      if (!it) break;
      const ind = indentOf(it);
      if (ind < level) break;
      if (ind > level) {
        // Nest the deeper run inside the previous <li>.
        const nested = build(ind);
        inner = inner.replace(/<\/li>$/, `${nested}</li>`);
        continue;
      }
      inner += `<li>${serializeInline(it.children)}</li>`;
      idx++;
    }
    return `<${tag}>${inner}</${tag}>`;
  }
  const first = items[0];
  return first ? build(indentOf(first)) : "";
}

function serializeTable(el: SlateElement): string {
  const rows = (el.children ?? [])
    .map((tr) => {
      const cells = ((tr as SlateElement).children ?? [])
        .map((cell) => {
          const c = cell as SlateElement;
          const tag = c.type === "th" ? "th" : "td";
          return `<${tag}>${serializeBlocks(c.children)}</${tag}>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table class="rt-table">${rows}</table>`;
}

/** A single non-list block element. */
function serializeBlock(el: SlateElement): string {
  switch (el.type) {
    case "h1":
      return `<h1${alignAttr(el)}>${serializeInline(el.children)}</h1>`;
    case "h2":
      return `<h2${alignAttr(el)}>${serializeInline(el.children)}</h2>`;
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return `<h3${alignAttr(el)}>${serializeInline(el.children)}</h3>`;
    case "blockquote":
    case "callout":
      return `<blockquote${alignAttr(el)}>${serializeInline(el.children)}</blockquote>`;
    case "hr":
      return "<hr>";
    case "code_block": {
      const code = (el.children ?? [])
        .map((line) => escapeText(plainText(line as SlateElement)))
        .join("\n");
      return `<pre><code>${code}</code></pre>`;
    }
    case "table":
      return serializeTable(el);
    case "img":
    case "media_image": {
      const url = typeof el.url === "string" ? el.url : "";
      return url ? `<img src="${escapeAttr(url)}">` : "";
    }
    case "column_group":
      return (el.children ?? []).map((c) => serializeBlock(c as SlateElement)).join("");
    case "column":
    case "toggle":
      return serializeBlocks(el.children);
    case "p":
    default:
      return `<p${alignAttr(el)}>${serializeInline(el.children)}</p>`;
  }
}

/** Plain text of an element (used for code lines). */
function plainText(el: SlateElement): string {
  return (el.children ?? [])
    .map((n) => (isText(n) ? n.text ?? "" : plainText(n as SlateElement)))
    .join("");
}

/** Walk block-level children, grouping list runs into ul/ol. */
function serializeBlocks(nodes: SlateNode[] | undefined): string {
  const arr = nodes ?? [];
  const out: string[] = [];
  let i = 0;
  while (i < arr.length) {
    const node = arr[i];
    if (isText(node)) {
      // Loose inline text at block level — wrap in a paragraph.
      const html = serializeText(node);
      if (html) out.push(`<p>${html}</p>`);
      i++;
      continue;
    }
    const el = node as SlateElement;
    if (el.listStyleType) {
      const run: SlateElement[] = [];
      while (i < arr.length && !isText(arr[i]) && (arr[i] as SlateElement).listStyleType) {
        run.push(arr[i] as SlateElement);
        i++;
      }
      out.push(serializeListRun(run));
      continue;
    }
    out.push(serializeBlock(el));
    i++;
  }
  return out.join("");
}

/**
 * Compile a Plate (Slate) document into a complete Handlebars-HTML document.
 * `value` is the array stored in document_templates.doc_json for wysiwyg
 * templates. The output goes to the `html` column and is consumed unchanged by
 * templateMerge.ts → gotenberg.ts.
 */
export function compileSlateTemplate(value: SlateNode[] | undefined, opts: CompileOptions = {}): string {
  const body = serializeBlocks(Array.isArray(value) ? value : []);
  return compileShell(body, opts.pageSettings);
}
