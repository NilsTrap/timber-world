// @ts-nocheck
"use client";

import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { LINE_ITEM_COLUMNS } from "@/features/documents/compiler/registry";

/**
 * The repeating line-items ("Goods") table as it appears in the editor: a void
 * block showing the chosen columns and one placeholder row. At document
 * generation the compiler expands this into {{#each lineItems}}…{{/each}} so it
 * becomes one row per product line. Not inline-editable here (columns are fixed
 * for now); it is preserved verbatim on save.
 */
export function LineItemsElement(props: PlateElementProps) {
  const cols: string[] = Array.isArray(props.element?.columns) ? props.element.columns : [];
  return (
    <PlateElement {...props}>
      <div
        contentEditable={false}
        className="my-2 select-none rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-2"
      >
        <div className="mb-1.5 flex items-center gap-2 px-1 text-xs">
          <span className="font-medium">▦ Line items table</span>
          <span className="text-muted-foreground">one row per product line at generation</span>
        </div>
        <div className="overflow-hidden rounded border bg-background">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#3c525c] text-white">
                {cols.map((k) => (
                  <th key={k} className="border-r border-white/20 px-2 py-1 text-left font-medium last:border-r-0">
                    {LINE_ITEM_COLUMNS[k]?.header ?? k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {cols.map((k) => (
                  <td key={k} className="border-t px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {`{{${k}}}`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {props.children}
    </PlateElement>
  );
}
