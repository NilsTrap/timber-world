"use client";

/**
 * LineItemsTable — a BLOCK atom TipTap node. The user designs ONE row by picking
 * which item-scope columns to show; at generation the compiler expands it to
 * <tbody>{{#each lineItems}}<tr>…</tr>{{/each}}</tbody>, i.e. one row per product
 * line. The NodeView is a designer: a live header/ghost-row preview + a column
 * checklist. The compiler reads node.attrs.columns; renderHTML is only for the
 * editor's internal copy/paste round-trip.
 */
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Checkbox, cn } from "@timber/ui";
import { DEFAULT_LINE_ITEM_COLUMNS, LINE_ITEM_COLUMNS } from "../../compiler/registry";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineItemsTable: {
      /** Insert a repeating line-items table (default column set). */
      insertLineItemsTable: () => ReturnType;
    };
  }
}

function LineItemsDesigner(props: NodeViewProps) {
  const raw = props.node.attrs.columns;
  const columns: string[] = (Array.isArray(raw) ? (raw as string[]) : DEFAULT_LINE_ITEM_COLUMNS).filter((c) =>
    Object.prototype.hasOwnProperty.call(LINE_ITEM_COLUMNS, c)
  );

  const toggle = (key: string) => {
    const next = columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key];
    props.updateAttributes({ columns: next });
  };

  return (
    <NodeViewWrapper
      className={cn("li-designer", props.selected && "li-designer--selected")}
      contentEditable={false}
    >
      <div className="li-designer__bar">
        <span className="li-designer__title">Line items table</span>
        <span className="li-designer__hint">↻ one row per product line at generation</span>
      </div>
      <table className="li-designer__preview">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className={LINE_ITEM_COLUMNS[c]?.num ? "num" : undefined}>
                {LINE_ITEM_COLUMNS[c]?.header ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((c) => (
              <td key={c} className="li-designer__ghost">
                …
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="li-designer__cols">
        <span className="li-designer__collabel">Columns</span>
        {Object.values(LINE_ITEM_COLUMNS).map((col) => (
          <label key={col.key} className="li-designer__col">
            <Checkbox
              checked={columns.includes(col.key)}
              onCheckedChange={() => toggle(col.key)}
            />
            <span>{col.header === "#" ? "No." : col.header}</span>
          </label>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export const LineItemsTable = Node.create({
  name: "lineItemsTable",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      columns: {
        default: DEFAULT_LINE_ITEM_COLUMNS,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "table[data-line-items]",
        getAttrs: (el) => {
          const raw = (el as HTMLElement).getAttribute("data-columns");
          if (!raw) return {};
          try {
            const cols = JSON.parse(raw);
            return Array.isArray(cols) ? { columns: cols } : {};
          } catch {
            return {};
          }
        },
      },
    ];
  },

  renderHTML({ node }) {
    return ["table", { "data-line-items": "", "data-columns": JSON.stringify(node.attrs.columns ?? DEFAULT_LINE_ITEM_COLUMNS) }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LineItemsDesigner);
  },

  addCommands() {
    return {
      insertLineItemsTable:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: "lineItemsTable", attrs: { columns: DEFAULT_LINE_ITEM_COLUMNS } }),
    };
  },
});
