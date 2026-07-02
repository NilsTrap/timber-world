/**
 * WYSIWYG template compiler — SKELETON (W0 spike; expanded in W2).
 *
 * Walks a TipTap ProseMirror JSON document and emits a complete, standalone
 * Handlebars-HTML document that the FROZEN render pipeline (templateMerge.ts ->
 * gotenberg.ts) consumes unchanged. TipTap JSON is the editable source of truth;
 * this HTML is a derived artifact written to document_templates.html on save.
 *
 * W0 scope = just enough node coverage to prove the JSON -> Handlebars-HTML ->
 * mergeTemplate round-trip end to end. W2 replaces this with the full,
 * registry-driven, fully unit-tested module (compiler/{types,registry,nodes,
 * shell,index}.ts): all marks/nodes, hide-when-empty {{#if}}, logo/footer/page
 * settings, and golden compile->merge tests.
 *
 * PURE: imports NO react/@tiptap, no I/O — runs in the save server action, the
 * preview action, and tsx tests identically.
 */

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
}

export interface TipTapDoc {
  type: "doc";
  content?: TipTapNode[];
}

export interface PageSettings {
  marginMm?: number;
  logoUrl?: string | null;
  footerText?: string | null;
}

export interface CompileOptions {
  pageSettings?: PageSettings;
}

/**
 * Line-items column catalog — each item-scope column maps to its header + the
 * loop-item-scoped Handlebars cell expression (NO path prefix; resolved inside
 * {{#each lineItems}}). W2 lifts this into compiler/registry.ts (shared with the
 * palette + designer so labels/tokens can't drift).
 */
const LINE_ITEM_COLUMNS: Record<string, { header: string; cell: string; num: boolean }> = {
  lineNo: { header: "#", cell: "{{lineNo}}", num: true },
  description: { header: "Description", cell: "{{description}}", num: false },
  dimensions: { header: "Dimensions (mm)", cell: "{{dimensions}}", num: false },
  pieces: { header: "Pcs", cell: "{{pieces}}", num: true },
  volumeM3: { header: "m³", cell: "{{fmtM3 volumeM3}}", num: true },
  unit: { header: "Unit", cell: "{{unit}}", num: false },
  unitPriceCents: { header: "Unit price", cell: "{{money unitPriceCents}}", num: true },
  lineTotalCents: { header: "Total", cell: "{{money lineTotalCents}}", num: true },
};

const DEFAULT_LINE_ITEM_COLUMNS = Object.keys(LINE_ITEM_COLUMNS);

/**
 * HTML-escape literal text AND neutralise stray Handlebars braces, so authored
 * text can never become a live merge expression — only mergeField/lineItemsTable
 * emit real {{ }}. (Invariant preserved from the skeleton through W2.)
 */
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function serializeText(node: TipTapNode): string {
  let out = escapeText(node.text ?? "");
  // Marks applied inner -> outer in a FIXED order for deterministic output.
  const order = ["underline", "italic", "bold", "link"];
  const marks = (node.marks ?? [])
    .slice()
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const m of marks) {
    if (m.type === "bold") out = `<strong>${out}</strong>`;
    else if (m.type === "italic") out = `<em>${out}</em>`;
    else if (m.type === "underline") out = `<u>${out}</u>`;
    else if (m.type === "link") out = `<a href="${escapeAttr(String(m.attrs?.href ?? ""))}">${out}</a>`;
  }
  return out;
}

function serializeChildren(nodes: TipTapNode[] | undefined): string {
  return (nodes ?? []).map(serializeNode).join("");
}

function serializeNode(node: TipTapNode): string {
  switch (node.type) {
    case "text":
      return serializeText(node);
    case "paragraph": {
      const align = node.attrs?.textAlign as string | undefined;
      const style = align && align !== "left" ? ` style="text-align:${align}"` : "";
      return `<p${style}>${serializeChildren(node.content)}</p>`;
    }
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `<h${level}>${serializeChildren(node.content)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${serializeChildren(node.content)}</ul>`;
    case "orderedList":
      return `<ol>${serializeChildren(node.content)}</ol>`;
    case "listItem":
      return `<li>${serializeChildren(node.content)}</li>`;
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    case "mergeField":
      // The token carries any helper prefix (e.g. "money totals.totalCents").
      return `{{${String(node.attrs?.token ?? "")}}}`;
    case "lineItemsTable": {
      const cols =
        (node.attrs?.columns as string[] | undefined)?.filter((c) => c in LINE_ITEM_COLUMNS) ??
        DEFAULT_LINE_ITEM_COLUMNS;
      const th = cols
        .map((c) => {
          const d = LINE_ITEM_COLUMNS[c]!;
          return `<th${d.num ? ' class="num"' : ""}>${escapeText(d.header)}</th>`;
        })
        .join("");
      const td = cols
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

/** Minimal print CSS lifted from the seeded templates so the PDF look matches. */
const BASE_CSS = `* { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px 24px; }
h1 { font-size: 16px; margin: 0 0 6px; } h2 { font-size: 14px; margin: 8px 0 4px; } h3 { font-size: 12px; margin: 6px 0 3px; }
ul, ol { margin: 4px 0; padding-left: 18px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; }
.num { text-align: right; }`;

/**
 * Compile a TipTap doc into a complete Handlebars-HTML document.
 * The output drops straight into gotenberg's index.html; the {{ }} tokens are
 * resolved by the unchanged templateMerge.ts against DocumentData.
 */
export function compileTemplate(doc: TipTapDoc, opts: CompileOptions = {}): string {
  const margin = opts.pageSettings?.marginMm ?? 12;
  const logo = opts.pageSettings?.logoUrl
    ? `<img src="${escapeAttr(opts.pageSettings.logoUrl)}" style="max-height:64px">`
    : "";
  const body = serializeChildren(doc.content);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}
@page { size: A4; margin: ${margin}mm; }
</style></head><body>${logo}${body}</body></html>`;
}
