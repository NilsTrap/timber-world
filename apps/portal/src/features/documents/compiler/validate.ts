/**
 * Template token-validation pass (S4) — WARN-only, NEVER hard-blocks.
 *
 * Walks a Plate (Slate) template and reports placeholders that WON'T resolve at
 * generation time, so a house author can catch a stale/renamed binding before it
 * ships as a silently-empty field:
 *   • unknown_token     — a scalar `mention` whose base path is not a known
 *                         DocumentData binding (and not a live catalog attr).
 *   • unknown_field     — a line-items `attr.<key>` COLUMN whose <key> is no
 *                         longer a catalog field (a deleted/renamed attribute).
 *   • unknown_condition — a block `hideWhen` referencing an unknown path (the
 *                         {{#if}} is always-false → the block is always hidden).
 *
 * PURE: no react/@platejs, no supabase, no I/O — runs in the save action, in the
 * editor (live), and in tsx tests identically. The DB read that supplies
 * `catalogFieldKeys` happens in the CALLER; this validator only compares strings.
 * Never throws.
 */
import { basePathOf } from "./registry";
import type { SlateElement, SlateNode } from "./slate";

export type TemplateWarningKind = "unknown_token" | "unknown_field" | "unknown_condition";

export interface TemplateWarning {
  kind: TemplateWarningKind;
  /** For unknown_token / unknown_condition — the offending token/expression. */
  token?: string;
  /** For unknown_field — the offending catalog field key. */
  field?: string;
  /** Human-readable, editor-surfaceable message. */
  message: string;
}

export interface TemplateValidation {
  warnings: TemplateWarning[];
}

export interface ValidateTemplateInput {
  /** The Plate document (preferred, richest input — columns + hideWhen visible here). */
  docJson?: SlateNode[] | null;
  /** Compiled Handlebars-HTML fallback (scalar `{{token}}` scan only) when docJson is absent. */
  compiledHtml?: string | null;
  /** Every VALID scalar token from the registry (helpers ok — normalised to base paths internally). */
  knownScalarTokens: string[];
  /**
   * Current catalog field keys, for attr-drift checks. Pass `null` when the
   * catalog set is UNKNOWN (e.g. a transient DB read failure, or still loading)
   * so attr checks are SKIPPED rather than producing false "deleted field"
   * warnings. Pass `[]` only when you know the catalog is genuinely empty.
   */
  catalogFieldKeys: string[] | null;
}

const isText = (n: SlateNode | undefined): boolean =>
  !!n && typeof (n as { text?: unknown }).text === "string";

/** Does a base path resolve — a known scalar binding, or a live catalog attr? */
function resolves(basePath: string, knownBasePaths: Set<string>, catalogFieldKeys: string[] | null): boolean {
  if (knownBasePaths.has(basePath)) return true;
  if (basePath.startsWith("attr.")) {
    // A catalog attribute: resolvable when the field still exists (or the catalog
    // set is unknown, in which case we don't second-guess it).
    if (catalogFieldKeys === null) return true;
    return catalogFieldKeys.includes(basePath.slice("attr.".length));
  }
  return false;
}

/** Walk a Slate tree, collecting mention tokens, line-items columns and hideWhen strings. */
function collect(
  nodes: SlateNode[] | undefined,
  acc: { mentions: string[]; columns: string[]; hideWhens: string[] },
): void {
  for (const n of nodes ?? []) {
    if (isText(n)) continue;
    const el = n as SlateElement;

    if (el.type === "mention" && typeof el.value === "string") {
      acc.mentions.push(el.value.trim());
    }

    if (el.type === "line_items" && Array.isArray((el as { columns?: unknown }).columns)) {
      for (const k of (el as { columns: unknown[] }).columns) {
        if (typeof k === "string") acc.columns.push(k);
      }
    }

    const hw = (el as { hideWhen?: unknown }).hideWhen;
    if (typeof hw === "string" && hw.trim()) acc.hideWhens.push(hw.trim());

    collect(el.children, acc);
  }
}

/** Scalar `{{token}}` tokens from compiled html — the fallback when docJson is absent. */
function scanHtmlTokens(html: string): string[] {
  const out: string[] = [];
  const re = /\{\{\s*([^{}#/][^{}]*?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tok = (m[1] ?? "").trim();
    // Skip block/loop-scope expressions (helpers like `lookup attr "x"`, `each`) —
    // those are line-item cells, not scalar bindings.
    if (tok && !tok.includes('"') && tok !== "this") out.push(tok);
  }
  return out;
}

/**
 * Validate a template's placeholders. Best-effort, never throws, never blocks —
 * an empty `warnings` array means "nothing suspicious found".
 */
export function validateTemplate(input: ValidateTemplateInput): TemplateValidation {
  const warnings: TemplateWarning[] = [];
  const seen = new Set<string>();
  const push = (w: TemplateWarning) => {
    const key = `${w.kind}:${w.token ?? w.field ?? ""}`;
    if (seen.has(key)) return; // dedupe: one warning per distinct token/field
    seen.add(key);
    warnings.push(w);
  };

  const knownBasePaths = new Set((input.knownScalarTokens ?? []).map((t) => basePathOf(t)));
  const { catalogFieldKeys } = input;

  try {
    if (Array.isArray(input.docJson)) {
      const acc = { mentions: [] as string[], columns: [] as string[], hideWhens: [] as string[] };
      collect(input.docJson, acc);

      for (const token of acc.mentions) {
        if (!token) continue;
        const bp = basePathOf(token);
        if (!resolves(bp, knownBasePaths, catalogFieldKeys)) {
          push({
            kind: "unknown_token",
            token,
            message: `Placeholder "{{${token}}}" won't resolve — no matching deal field.`,
          });
        }
      }

      // Line-items attr.<key> columns for a since-deleted/renamed catalog field.
      if (catalogFieldKeys !== null) {
        for (const key of acc.columns) {
          if (!key.startsWith("attr.")) continue; // fixed columns are always valid
          const fieldKey = key.slice("attr.".length);
          if (fieldKey && !catalogFieldKeys.includes(fieldKey)) {
            push({
              kind: "unknown_field",
              field: fieldKey,
              message: `Table column "${fieldKey}" refers to a catalog field that no longer exists.`,
            });
          }
        }
      }

      for (const hw of acc.hideWhens) {
        const bp = basePathOf(hw);
        if (!resolves(bp, knownBasePaths, catalogFieldKeys)) {
          push({
            kind: "unknown_condition",
            token: hw,
            message: `Hide-when-empty condition "${hw}" references an unknown field.`,
          });
        }
      }
    } else if (typeof input.compiledHtml === "string") {
      // Fallback: only scalar tokens are recoverable from compiled html.
      for (const token of scanHtmlTokens(input.compiledHtml)) {
        const bp = basePathOf(token);
        if (!resolves(bp, knownBasePaths, catalogFieldKeys)) {
          push({
            kind: "unknown_token",
            token,
            message: `Placeholder "{{${token}}}" won't resolve — no matching deal field.`,
          });
        }
      }
    }
  } catch {
    // Validation is advisory — on any unexpected shape, return what we have.
  }

  return { warnings };
}
