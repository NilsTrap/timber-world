// @ts-nocheck
"use client";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import { BracesIcon, SearchIcon } from "lucide-react";
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
 *
 * S4 · a live search filters the (growing) list by label OR token as you type;
 * empty groups drop out. Printable keys stay in the box (Radix typeahead is
 * suppressed); Arrow/Enter/Escape still reach the menu so you can keyboard down
 * into the filtered results and pick one.
 */
export function MergeFieldToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const insertField = (token: string) => {
    editor.tf.focus();
    editor.tf.insertNodes(
      { children: [{ text: "" }], type: "mention", value: token },
      { select: true },
    );
  };

  // Filter groups/items by friendly label OR raw token; hide now-empty groups.
  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MERGE_FIELD_GROUPS;
    return MERGE_FIELD_GROUPS.map((g) => ({
      heading: g.heading,
      items: g.items.filter(
        (it) => it.label.toLowerCase().includes(q) || it.token.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery(""); // reset the filter each time the menu closes
  };

  return (
    <DropdownMenu modal={false} onOpenChange={handleOpenChange} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Insert merge field">
          <BracesIcon />
          Field
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="flex max-h-[70vh] min-w-[220px] flex-col overflow-hidden p-0"
        // Keep the caret in the search box on open (instead of the first item).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {/* Search — pinned at the top; typing filters the list live. */}
        <div className="flex items-center gap-2 border-b bg-popover px-2 py-1.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Swallow printable keys so Radix's menu typeahead doesn't hijack
              // them; let Arrow/Enter/Escape/Tab through to navigate the results.
              if (e.key.length === 1) e.stopPropagation();
            }}
            placeholder="Search fields…"
            aria-label="Search merge fields"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No fields match your search.</p>
          ) : (
            groups.map((g) => (
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
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
