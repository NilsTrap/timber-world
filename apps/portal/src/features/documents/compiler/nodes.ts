/**
 * Node/mark serializers — the recursive core that turns TipTap ProseMirror JSON
 * into Handlebars-HTML. Deterministic (fixed attribute + mark order, no
 * Date/random), byte-stable, snapshot-testable. PURE: no react/@tiptap.
 *
 * THREE INVARIANTS:
 *  1. TEXT ESCAPING — literal text is HTML-escaped once AND stray Handlebars
 *     braces are neutralised ({→&#123; }→&#125;), so authored text can NEVER
 *     become a live merge expression.
 *  2. TOKENS RAW — only mergeField / lineItemsTable emit real {{ }} (never
 *     escaped); templateMerge keeps noEscape:false so merged values stay
 *     escaped at render time (unchanged security posture).
 *  3. ONE-WAY — never parse Handlebars HTML back into JSON.
 */
import { LINE_ITEM_COLUMNS, DEFAULT_LINE_ITEM_COLUMNS, basePathOf } from "./registry";
import type { TipTapNode } from "./types";

/** HTML-escape literal text AND neutralise stray Handlebars braces. */
export function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * Escape a value destined for a double-quoted HTML attribute. Crucially this
 * ALSO neutralises Handlebars braces (like escapeText) — otherwise a user-authored
 * link href / image src / logo URL containing "{{…}}" would inject a LIVE merge
 * token (data leak) or an unbalanced block that crashes the whole render.
 */
export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * A merge token is SAFE to emit raw iff it is `[helper ]path` — an optional
 * single helper word followed by a dotted data path, word chars + dots only.
 * This is the ONLY place authored braces reach the output, so a crafted token
 * ("#each x", "x}}{{#if y", "  ") must never open a block or unbalance the
 * template. Matches every catalog token (seller.name, money totals.totalCents,
 * fmtDate docDate) and rejects everything else.
 */
const SAFE_TOKEN = /^(?:[a-zA-Z][a-zA-Z0-9]* )?[a-zA-Z_][\w.]*$/;
function isSafeToken(token: string): boolean {
  return SAFE_TOKEN.test(token);
}

/** Marks applied inner→outer in a FIXED priority so output is deterministic. */
const MARK_ORDER = ["underline", "italic", "bold", "link"];

function serializeText(node: TipTapNode): string {
  let out = escapeText(node.text ?? "");
  const marks = (node.marks ?? [])
    .slice()
    .sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
  for (const m of marks) {
    switch (m.type) {
      case "bold":
      case "strong":
        out = `<strong>${out}</strong>`;
        break;
      case "italic":
      case "em":
        out = `<em>${out}</em>`;
        break;
      case "underline":
        out = `<u>${out}</u>`;
        break;
      case "strike":
        out = `<s>${out}</s>`;
        break;
      case "code":
        out = `<code>${out}</code>`;
        break;
      case "link": {
        const href = escapeAttr(String(m.attrs?.href ?? ""));
        out = `<a href="${href}">${out}</a>`;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

export function serializeChildren(nodes: TipTapNode[] | undefined): string {
  return (nodes ?? []).map(serializeNode).join("");
}

/** DFS for the first mergeField token in a subtree — for block-level hide-when-empty. */
function firstMergeFieldToken(node: TipTapNode): string | null {
  if (node.type === "mergeField") {
    const t = node.attrs?.token;
    return typeof t === "string" && t ? t : null;
  }
  for (const c of node.content ?? []) {
    const found = firstMergeFieldToken(c);
    if (found) return found;
  }
  return null;
}

/** Optional {{#if PATH}}…{{/if}} wrapper. condPath is a base data path (helper-stripped). */
function wrapIf(condPath: string | null, html: string): string {
  if (!condPath) return html;
  return `{{#if ${condPath}}}${html}{{/if}}`;
}

const ALIGN_STYLE = (attrs: Record<string, unknown> | undefined): string => {
  const a = attrs?.textAlign;
  return a === "center" || a === "right" || a === "justify" ? ` style="text-align:${a}"` : "";
};

/** Cell attributes for a user rich-text table cell (colspan/rowspan/colwidth). */
function cellAttrs(attrs: Record<string, unknown> | undefined): string {
  let out = "";
  const colspan = Number(attrs?.colspan ?? 1);
  const rowspan = Number(attrs?.rowspan ?? 1);
  if (colspan > 1) out += ` colspan="${colspan}"`;
  if (rowspan > 1) out += ` rowspan="${rowspan}"`;
  const colwidth = attrs?.colwidth;
  if (Array.isArray(colwidth) && typeof colwidth[0] === "number" && colwidth[0] > 0) {
    out += ` style="width:${colwidth[0]}px"`;
  }
  return out;
}

export function serializeNode(node: TipTapNode): string {
  switch (node.type) {
    case "text":
      return serializeText(node);

    case "paragraph": {
      const html = `<p${ALIGN_STYLE(node.attrs)}>${serializeChildren(node.content)}</p>`;
      return node.attrs?.hideWhenEmpty ? wrapIf(hideCond(node), html) : html;
    }

    case "heading": {
      const n = Number(node.attrs?.level);
      const level = Number.isFinite(n) ? Math.min(3, Math.max(1, Math.round(n))) : 1;
      const html = `<h${level}${ALIGN_STYLE(node.attrs)}>${serializeChildren(node.content)}</h${level}>`;
      return node.attrs?.hideWhenEmpty ? wrapIf(hideCond(node), html) : html;
    }

    case "bulletList":
      return `<ul>${serializeChildren(node.content)}</ul>`;
    case "orderedList":
      return `<ol>${serializeChildren(node.content)}</ol>`;
    case "listItem":
      return `<li>${serializeChildren(node.content)}</li>`;

    case "blockquote":
      return `<blockquote>${serializeChildren(node.content)}</blockquote>`;
    case "horizontalRule":
      return "<hr>";
    case "hardBreak":
      return "<br>";

    case "image": {
      const src = escapeAttr(String(node.attrs?.src ?? ""));
      if (!src) return "";
      const h = Number(node.attrs?.height);
      const style = Number.isFinite(h) && h > 0 ? ` style="max-height:${h}px"` : "";
      const alt = node.attrs?.alt ? ` alt="${escapeAttr(String(node.attrs.alt))}"` : "";
      return `<img src="${src}"${alt}${style}>`;
    }

    // ── User rich-text table (TableKit) — NEVER emits {{#each}} ──────────────
    case "table":
      return `<table class="rt-table"><tbody>${serializeChildren(node.content)}</tbody></table>`;
    case "tableRow":
      return `<tr>${serializeChildren(node.content)}</tr>`;
    case "tableHeader":
      return `<th${cellAttrs(node.attrs)}>${serializeChildren(node.content)}</th>`;
    case "tableCell":
      return `<td${cellAttrs(node.attrs)}>${serializeChildren(node.content)}</td>`;

    // ── Merge-field pill — the ONLY inline node that emits a live token ──────
    case "mergeField": {
      const token = String(node.attrs?.token ?? "").trim();
      // Drop anything that isn't a safe `[helper ]path` so a crafted/corrupted
      // token can never inject or unbalance Handlebars.
      if (!isSafeToken(token)) return "";
      const expr = `{{${token}}}`;
      return node.attrs?.hideWhen ? `{{#if ${basePathOf(token)}}}${expr}{{/if}}` : expr;
    }

    // ── Repeating line-items table — the {{#each lineItems}} block ───────────
    case "lineItemsTable": {
      const requested = node.attrs?.columns;
      const cols = (Array.isArray(requested) ? (requested as unknown[]).map(String) : DEFAULT_LINE_ITEM_COLUMNS).filter(
        // hasOwnProperty (NOT `in`) so inherited keys like "constructor"/"__proto__" can't pass.
        (c) => Object.prototype.hasOwnProperty.call(LINE_ITEM_COLUMNS, c)
      );
      const columns = cols.length > 0 ? cols : DEFAULT_LINE_ITEM_COLUMNS;
      const th = columns
        .map((c) => {
          const d = LINE_ITEM_COLUMNS[c]!;
          return `<th${d.num ? ' class="num"' : ""}>${escapeText(d.header)}</th>`;
        })
        .join("");
      const td = columns
        .map((c) => {
          const d = LINE_ITEM_COLUMNS[c]!;
          return `<td${d.num ? ' class="num"' : ""}>${d.cell}</td>`;
        })
        .join("");
      return `<table class="items"><thead><tr>${th}</tr></thead><tbody>{{#each lineItems}}<tr>${td}</tr>{{/each}}</tbody></table>`;
    }

    default:
      // Unknown node: recurse into children so nothing is silently dropped.
      return serializeChildren(node.content);
  }
}

/** Hide-when-empty condition for a block: the base path of its first (safe) merge field. */
function hideCond(node: TipTapNode): string | null {
  const token = firstMergeFieldToken(node);
  // Only derive a {{#if}} from a safe token; otherwise don't wrap (render always) — a
  // safe degradation that can never emit an unbalanced/injected condition.
  return token && isSafeToken(token) ? basePathOf(token) : null;
}
