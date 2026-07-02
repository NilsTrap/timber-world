"use client";

/**
 * MergeField — an ATOMIC INLINE TipTap node rendered as a friendly pill. It
 * stores the raw Handlebars token (with any helper prefix) in attrs and shows a
 * human label, so the user never sees a raw {{token}}. The compiler reads
 * node.attrs.token directly; this extension's renderHTML only governs the
 * editor's internal copy/paste HTML (round-trips via the data-* attributes).
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { MERGE_FIELD_LABELS } from "../../compiler/registry";

export interface InsertMergeFieldOptions {
  token: string;
  label?: string;
  hideWhen?: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mergeField: {
      /** Insert a merge-field pill at the selection. */
      insertMergeField: (opts: InsertMergeFieldOptions) => ReturnType;
      /** Toggle "hide when empty" on the selected merge-field pill. */
      toggleMergeFieldHideWhen: () => ReturnType;
    };
  }
}

function MergeFieldPill(props: NodeViewProps) {
  const { label, token, hideWhen } = props.node.attrs as { label?: string; token?: string; hideWhen?: boolean };
  return (
    <NodeViewWrapper
      as="span"
      className={
        "merge-pill" + (props.selected ? " merge-pill--selected" : "") + (hideWhen ? " merge-pill--optional" : "")
      }
      contentEditable={false}
      data-token={token}
      title={hideWhen ? `${token} (hidden when empty)` : token}
    >
      {label || token}
      {hideWhen ? <span className="merge-pill__opt" aria-hidden>?</span> : null}
    </NodeViewWrapper>
  );
}

export const MergeField = Node.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: { default: "" },
      label: { default: "" },
      hideWhen: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },

  renderHTML({ node }) {
    const attrs: Record<string, string> = { "data-merge-field": String(node.attrs.token ?? "") };
    if (node.attrs.hideWhen) attrs["data-hide-when"] = "1";
    return ["span", mergeAttributes(attrs), String(node.attrs.label || node.attrs.token || "")];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MergeFieldPill);
  },

  addCommands() {
    return {
      insertMergeField:
        (opts) =>
        ({ commands }) =>
          commands.insertContent({
            type: "mergeField",
            attrs: {
              token: opts.token,
              label: opts.label ?? MERGE_FIELD_LABELS[opts.token] ?? opts.token,
              hideWhen: !!opts.hideWhen,
            },
          }),
      toggleMergeFieldHideWhen:
        () =>
        ({ state, commands }) => {
          const { from, to } = state.selection;
          let target: { pos: number; hideWhen: boolean } | null = null;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === "mergeField" && target === null) {
              target = { pos, hideWhen: !!node.attrs.hideWhen };
            }
          });
          if (target === null) return false;
          return commands.updateAttributes("mergeField", { hideWhen: !(target as { hideWhen: boolean }).hideWhen });
        },
    };
  },
});
