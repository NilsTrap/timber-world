// @ts-nocheck
"use client";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import { BracesIcon } from "lucide-react";
import { useEditorRef } from "platejs/react";
import * as React from "react";

import { MERGE_FIELD_GROUPS } from "@/features/documents/compiler/registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/features/documents/plate/ui/dropdown-menu";

import { ToolbarButton, ToolbarMenuGroup } from "./toolbar";

/**
 * Insert-merge-field menu: pick a deal field (Seller name, Total, …) and drop it
 * into the document as a mention node. The compiler turns it into {{token}} so it
 * fills the deal's real value at generation. (The repeating goods table is a
 * separate block, not listed here.)
 */
export function MergeFieldToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const insertField = (token: string) => {
    editor.tf.focus();
    editor.tf.insertNodes(
      { children: [{ text: "" }], type: "mention", value: token },
      { select: true },
    );
  };

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Insert merge field">
          <BracesIcon />
          Field
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="flex max-h-[70vh] min-w-0 flex-col overflow-y-auto"
      >
        {MERGE_FIELD_GROUPS.map((g) => (
          <ToolbarMenuGroup key={g.heading} label={g.heading}>
            {g.items.map((it) => (
              <DropdownMenuItem
                className="min-w-[180px]"
                key={g.heading + it.token}
                onSelect={() => insertField(it.token)}
              >
                {it.label}
              </DropdownMenuItem>
            ))}
          </ToolbarMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
