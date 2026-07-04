// @ts-nocheck
"use client";

import { Table2Icon } from "lucide-react";
import { useEditorRef } from "platejs/react";
import type * as React from "react";

import { DEFAULT_LINE_ITEM_COLUMNS } from "@/features/documents/compiler/registry";

import { ToolbarButton } from "./toolbar";

/**
 * Insert the repeating goods (line-items) table — a `line_items` void block seeded
 * with the default fixed columns and an empty `columnDefs` (dynamic catalog-field
 * columns are added afterwards from the block's own column designer). The compiler
 * expands it into {{#each lineItems}}…{{/each}} at generation.
 */
export function LineItemsToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      tooltip="Insert line-items table"
      {...props}
      onClick={() => {
        editor.tf.focus();
        editor.tf.insertNodes(
          {
            type: "line_items",
            columns: [...DEFAULT_LINE_ITEM_COLUMNS],
            columnDefs: {},
            children: [{ text: "" }],
          },
          { select: true },
        );
      }}
    >
      <Table2Icon />
      Goods
    </ToolbarButton>
  );
}
