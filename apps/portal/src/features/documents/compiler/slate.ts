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
import { LINE_ITEM_COLUMNS, DEFAULT_LINE_ITEM_COLUMNS, basePathOf, isSafeFieldKey, type LineItemColumn } from "./registry";
import type { CompileOptions } from "./types";

/**
 * A merge-field token: an optional single helper prefix ("money x", "fmtDate x")
 * then a dotted data path. Anything outside this shape is dropped, so authored
 * fields can NEVER open a Handlebars block or inject an unbalanced expression.
 */
const SAFE_TOKEN = /^(?:[a-zA-Z][a-zA-Z0-9]* )?[a-zA-Z_][\w.]*$/;

/** A Plate mention node carries the Handlebars token in `value` → `{{token}}`. */
function mergeFieldHtml(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token || !SAFE_TOKEN.test(token)) return "";
  return `{{${token}}}`;
}

/**
 * Optional hide-when-empty: a block carrying `hideWhen: "<token>"` is wrapped in
 * {{#if <basePath>}}…{{/if}} so it collapses when the deal has no value (mirrors
 * the seeded templates' `{{#if seller.address}}` line guards). Only a safe token
 * produces a wrapper; anything else renders the block unconditionally.
 */
function withHideWhen(el: SlateElement, html: string): string {
  const hw = (el as { hideWhen?: unknown }).hideWhen;
  if (typeof hw === "string" && SAFE_TOKEN.test(hw.trim())) {
    return `{{#if ${basePathOf(hw.trim())}}}${html}{{/if}}`;
  }
  return html;
}

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
        // A merge field — emit the Handlebars token (filled per-deal at render).
        case "mention":
          return mergeFieldHtml(el.value);
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

/** The persisted def for a dynamic (catalog-field) column, stored on the node. */
interface StoredColumnDef {
  header?: unknown;
  num?: unknown;
}

/**
 * Resolve a chosen column KEY to a concrete `LineItemColumn`:
 *   • a fixed key → its static registry def (LINE_ITEM_COLUMNS);
 *   • an `attr.<fieldKey>` key → the header STORED on the node (columnDefs) so
 *     this stays DB-FREE, with the cell DERIVED as `{{lookup attr "<fieldKey>"}}`
 *     (fieldKey = the `attr.` prefix stripped). A since-deleted catalog field
 *     still resolves — the stored header renders and the cell yields empty (the
 *     assembler simply has no `attr.<fieldKey>` value), never a crash;
 *   • any other unknown key → dropped (null), as before.
 */
function resolveLineItemColumn(
  key: string,
  defs: Record<string, StoredColumnDef> | undefined,
): LineItemColumn | null {
  if (Object.prototype.hasOwnProperty.call(LINE_ITEM_COLUMNS, key)) return LINE_ITEM_COLUMNS[key]!;
  if (key.startsWith("attr.")) {
    const fieldKey = key.slice("attr.".length);
    if (!fieldKey) return null;
    const def = defs?.[key];
    const header = typeof def?.header === "string" ? def.header : fieldKey;
    // Defence in depth: a non-slug fieldKey can't inject Handlebars — render empty.
    return { key, header, cell: isSafeFieldKey(fieldKey) ? `{{lookup attr "${fieldKey}"}}` : "", num: def?.num === true };
  }
  return null;
}

/**
 * The repeating line-items table. The Slate node stores the chosen column KEYS
 * (`columns`) plus, for dynamic catalog-field columns, their resolved defs
 * (`columnDefs["attr.<fieldKey>"] = { header, num }`) so the header text travels
 * inside doc_json and this renderer needs NO DB read. Each key resolves via
 * `resolveLineItemColumn`; the body row is wrapped in {{#each lineItems}}…{{/each}}
 * (the seeded look).
 */
function serializeLineItems(el: SlateElement): string {
  const rawCols = Array.isArray((el as { columns?: unknown }).columns)
    ? (el as { columns: unknown[] }).columns.filter((k): k is string => typeof k === "string")
    : [];
  const defs = (el as { columnDefs?: Record<string, StoredColumnDef> }).columnDefs;
  const resolved = rawCols
    .map((k) => resolveLineItemColumn(k, defs))
    .filter((c): c is LineItemColumn => c !== null);
  const cols = resolved.length
    ? resolved
    : DEFAULT_LINE_ITEM_COLUMNS.map((k) => LINE_ITEM_COLUMNS[k]!);
  const th = cols
    .map((d) => `<th${d.num ? ' class="num"' : ""}>${escapeText(d.header)}</th>`)
    .join("");
  const td = cols.map((d) => `<td${d.num ? ' class="num"' : ""}>${d.cell}</td>`).join("");
  return `<table class="items"><thead><tr>${th}</tr></thead><tbody>{{#each lineItems}}<tr>${td}</tr>{{/each}}</tbody></table>`;
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
      return `<blockquote${alignAttr(el)}>${serializeInline(el.children)}</blockquote>`;
    // A callout = the bordered "box" look (payment details, notes highlight).
    case "callout":
      return `<div class="callout-box">${serializeBlocks(el.children)}</div>`;
    case "hr":
      return "<hr>";
    case "code_block": {
      const code = (el.children ?? [])
        .map((line) => escapeText(plainText(line as SlateElement)))
        .join("\n");
      return `<pre><code>${code}</code></pre>`;
    }
    case "line_items":
      return serializeLineItems(el);
    case "table":
      return serializeTable(el);
    case "img":
    case "media_image": {
      const url = typeof el.url === "string" ? el.url : "";
      return url ? `<img src="${escapeAttr(url)}">` : "";
    }
    // Side-by-side columns (e.g. Seller | Buyer). Each column flexes equally.
    case "column_group":
      return `<div class="doc-cols">${(el.children ?? [])
        .map((c) => `<div class="doc-col">${serializeBlocks((c as SlateElement).children)}</div>`)
        .join("")}</div>`;
    case "column":
      return `<div class="doc-col">${serializeBlocks(el.children)}</div>`;
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
    out.push(withHideWhen(el, serializeBlock(el)));
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
