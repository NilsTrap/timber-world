// @ts-nocheck
"use client";

import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useReadOnly, useSelected } from "platejs/react";
import { SlidersHorizontalIcon, TriangleAlertIcon } from "lucide-react";

import {
  LINE_ITEM_COLUMNS,
  DEFAULT_LINE_ITEM_COLUMNS,
  catalogFieldColumn,
} from "@/features/documents/compiler/registry";
import { useCatalogTemplateFields } from "@/features/documents/plate/hooks/use-catalog-template-fields";
import { Checkbox } from "@/features/documents/plate/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/features/documents/plate/ui/popover";
import { ToolbarButton } from "@/features/documents/plate/ui/toolbar";

const ATTR_PREFIX = "attr.";
const attrKeyOf = (fieldKey: string) => `${ATTR_PREFIX}${fieldKey}`;
const fieldKeyOf = (key: string) => key.slice(ATTR_PREFIX.length);
const isAttrKey = (key: string) => key.startsWith(ATTR_PREFIX);

/**
 * The repeating line-items ("Goods") table in the editor: a void block with a
 * live header/ghost-row preview plus a COLUMN DESIGNER (popover, shown when the
 * block is selected) to pick which columns appear. Two kinds of column:
 *   • the fixed 8 (LINE_ITEM_COLUMNS) — resolved from the shared registry;
 *   • dynamic CATALOG fields (`attr.<fieldKey>`) — the resolved header + num flag
 *     are STORED on the element (`element.columnDefs`) alongside the ordered
 *     `element.columns`, so the compiler renders the header WITHOUT a DB read.
 * Toggling writes the selected column KEYS (order preserved: new ones append) via
 * `editor.tf.setNodes`. At generation the compiler expands this into
 * {{#each lineItems}}…{{/each}} (one row per product line). A column pointing at
 * a since-deleted catalog field still renders (stored header, empty cell) and
 * raises an inline warning — never a hard block.
 */
export function LineItemsElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const selected = useSelected();
  const readOnly = useReadOnly();
  const { fields, loading } = useCatalogTemplateFields();

  const element = props.element ?? {};
  const columns: string[] = Array.isArray(element.columns) ? element.columns : [];
  const columnDefs: Record<string, { header?: string; num?: boolean }> =
    element.columnDefs && typeof element.columnDefs === "object" ? element.columnDefs : {};

  const fieldByKey = React.useMemo(
    () => new Map(fields.map((f) => [f.fieldKey, f])),
    [fields],
  );

  // Effective preview columns mirror the compiler's fallback: empty → the default set.
  const previewCols = columns.length ? columns : DEFAULT_LINE_ITEM_COLUMNS;

  const headerOf = (key: string): string => {
    if (LINE_ITEM_COLUMNS[key]) return LINE_ITEM_COLUMNS[key].header;
    if (isAttrKey(key)) {
      const fk = fieldKeyOf(key);
      return fieldByKey.get(fk)?.fieldLabel ?? columnDefs[key]?.header ?? fk;
    }
    return key;
  };
  const isNum = (key: string): boolean =>
    LINE_ITEM_COLUMNS[key]?.num ?? columnDefs[key]?.num ?? false;
  const cellOf = (key: string): string => {
    if (LINE_ITEM_COLUMNS[key]) return LINE_ITEM_COLUMNS[key].cell;
    if (isAttrKey(key)) return `{{lookup attr "${fieldKeyOf(key)}"}}`;
    return `{{${key}}}`;
  };

  // Chosen attr.* columns whose catalog field no longer exists (once fields load).
  const missingKeys = React.useMemo(() => {
    if (loading) return [] as string[];
    return columns.filter((k) => isAttrKey(k) && !fieldByKey.has(fieldKeyOf(k)));
  }, [columns, fieldByKey, loading]);

  const write = (nextColumns: string[], nextDefs: Record<string, unknown>) => {
    const path = editor.api.findPath(props.element);
    if (!path) return;
    editor.tf.setNodes({ columns: nextColumns, columnDefs: nextDefs }, { at: path });
  };

  // Fixed columns carry no def — just add/remove the key (order preserved).
  const toggleFixed = (key: string) => {
    if (readOnly) return;
    const next = columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key];
    write(next, columnDefs);
  };

  // Attr columns store their resolved {header,num} so the compiler stays DB-free.
  const toggleAttr = (field: { fieldKey: string; fieldLabel: string; fieldType: string }) => {
    if (readOnly) return;
    const key = attrKeyOf(field.fieldKey);
    if (columns.includes(key)) {
      const nextDefs = { ...columnDefs };
      delete nextDefs[key];
      write(columns.filter((c) => c !== key), nextDefs);
    } else {
      const col = catalogFieldColumn(field as never);
      write([...columns, key], { ...columnDefs, [key]: { header: col.header, num: col.num } });
    }
  };

  // Remove a column by key (used for orphaned "removed field" entries).
  const removeKey = (key: string) => {
    if (readOnly) return;
    const nextDefs = { ...columnDefs };
    delete nextDefs[key];
    write(columns.filter((c) => c !== key), nextDefs);
  };

  return (
    <PlateElement {...props}>
      <div
        contentEditable={false}
        className="my-2 select-none rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-2"
      >
        <div className="mb-1.5 flex items-center gap-2 px-1 text-xs">
          <span className="font-medium">▦ Line items table</span>
          <span className="text-muted-foreground">one row per product line at generation</span>
          <span className="grow" />
          {!readOnly && (
            <Popover>
              <PopoverTrigger asChild>
                <ToolbarButton
                  className="h-6 gap-1 px-2 text-xs"
                  tooltip="Choose columns"
                >
                  <SlidersHorizontalIcon />
                  Columns
                </ToolbarButton>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-64 p-0"
                contentEditable={false}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="max-h-[60vh] overflow-y-auto p-2">
                  <div className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Columns
                  </div>
                  {Object.values(LINE_ITEM_COLUMNS).map((col) => (
                    <label
                      key={col.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={columns.includes(col.key)}
                        onCheckedChange={() => toggleFixed(col.key)}
                      />
                      <span>{col.header === "#" ? "No." : col.header}</span>
                    </label>
                  ))}

                  <div className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Catalog fields
                  </div>
                  {loading ? (
                    <div className="px-1 py-1 text-xs text-muted-foreground">Loading…</div>
                  ) : fields.length === 0 ? (
                    <div className="px-1 py-1 text-xs text-muted-foreground">
                      No catalog fields
                    </div>
                  ) : (
                    fields.map((f) => {
                      const key = attrKeyOf(f.fieldKey);
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
                        >
                          <Checkbox
                            checked={columns.includes(key)}
                            onCheckedChange={() => toggleAttr(f)}
                          />
                          <span className="truncate">
                            {f.fieldLabel}
                            {f.unit ? (
                              <span className="text-muted-foreground"> ({f.unit})</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })
                  )}

                  {missingKeys.length > 0 && (
                    <>
                      <div className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                        Removed fields
                      </div>
                      {missingKeys.map((key) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
                        >
                          <Checkbox checked onCheckedChange={() => removeKey(key)} />
                          <span className="truncate text-destructive">
                            {columnDefs[key]?.header ?? fieldKeyOf(key)}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {missingKeys.length > 0 && (
          <div className="mb-1.5 flex flex-col gap-0.5 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {missingKeys.map((key) => (
              <span key={key} className="flex items-center gap-1">
                <TriangleAlertIcon className="size-3 shrink-0" />
                Field &lsquo;{fieldKeyOf(key)}&rsquo; no longer exists
              </span>
            ))}
          </div>
        )}

        <div className="overflow-hidden rounded border bg-background">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#3c525c] text-white">
                {previewCols.map((k) => (
                  <th
                    key={k}
                    className={`border-r border-white/20 px-2 py-1 font-medium last:border-r-0 ${
                      isNum(k) ? "text-right" : "text-left"
                    }`}
                  >
                    {headerOf(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {previewCols.map((k) => (
                  <td
                    key={k}
                    className={`border-t px-2 py-1 font-mono text-[10px] text-muted-foreground ${
                      isNum(k) ? "text-right" : "text-left"
                    }`}
                  >
                    {cellOf(k)}
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
