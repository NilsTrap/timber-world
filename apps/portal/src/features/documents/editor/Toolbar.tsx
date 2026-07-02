"use client";

/**
 * Toolbar for the document-template editor. Word/Docs-style formatting +
 * insert-field (grouped, friendly labels) + insert repeating line-items table +
 * table row/col ops + an inline link editor. State is read reactively via
 * useEditorState. The rich insert-field palette / logo / page settings are
 * extended in W5.
 */
import { useMemo, useRef, useState } from "react";
import { type Editor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ChevronDown,
  Columns3,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pilcrow,
  Rows3,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@timber/ui";
import { MERGE_FIELD_GROUPS } from "../compiler/registry";

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-xs transition-colors",
        "hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent",
        active ? "bg-muted text-foreground" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />;

export function Toolbar({ editor }: { editor: Editor }) {
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      para: e.isActive("paragraph"),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      alignL: e.isActive({ textAlign: "left" }),
      alignC: e.isActive({ textAlign: "center" }),
      alignR: e.isActive({ textAlign: "right" }),
      link: e.isActive("link"),
      inTable: e.isActive("table"),
      inMergeField: e.isActive("mergeField"),
      hideWhenEmpty: !!e.getAttributes("mergeField").hideWhen,
    }),
  });

  const chain = () => editor.chain().focus();

  const openLink = () => {
    setLinkUrl((editor.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
    setFieldsOpen(false);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  };
  const applyLink = () => {
    const href = linkUrl.trim();
    if (href) chain().extendMarkRange("link").setLink({ href }).run();
    else chain().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  const groups = useMemo(() => MERGE_FIELD_GROUPS, []);

  return (
    <div className="relative flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
      {/* Block type */}
      <Btn title="Heading 1" active={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </Btn>
      <Btn title="Heading 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Btn>
      <Btn title="Heading 3" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </Btn>
      <Btn title="Normal text" active={s.para && !s.h1 && !s.h2 && !s.h3} onClick={() => chain().setParagraph().run()}>
        <Pilcrow className="h-4 w-4" />
      </Btn>
      <Sep />
      {/* Marks */}
      <Btn title="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn title="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn title="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Btn>
      <Btn title={s.link ? "Edit link" : "Add link"} active={s.link} onClick={openLink}>
        <Link2 className="h-4 w-4" />
      </Btn>
      {s.link && (
        <Btn title="Remove link" onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
          <Link2Off className="h-4 w-4" />
        </Btn>
      )}
      <Sep />
      {/* Lists */}
      <Btn title="Bullet list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Btn>
      <Btn title="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Sep />
      {/* Align */}
      <Btn title="Align left" active={s.alignL} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </Btn>
      <Btn title="Align center" active={s.alignC} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </Btn>
      <Btn title="Align right" active={s.alignR} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </Btn>
      <Sep />
      {/* Insert field */}
      <Btn title="Insert field" active={fieldsOpen} onClick={() => { setFieldsOpen((o) => !o); setLinkOpen(false); }}>
        <Braces className="h-4 w-4" />
        <span className="hidden sm:inline">Field</span>
        <ChevronDown className="h-3 w-3" />
      </Btn>
      {/* Insert line-items */}
      <Btn title="Insert line-items table" onClick={() => editor.chain().focus().insertLineItemsTable().run()}>
        <Rows3 className="h-4 w-4" />
        <span className="hidden sm:inline">Line items</span>
      </Btn>
      {/* Hide-when-empty toggle — only when a merge-field pill is selected */}
      {s.inMergeField && (
        <Btn
          title={
            s.hideWhenEmpty
              ? "Field is hidden when empty — click to always show it"
              : "Hide this field (and its line) when it has no value"
          }
          active={s.hideWhenEmpty}
          onClick={() => editor.chain().focus().toggleMergeFieldHideWhen().run()}
        >
          <EyeOff className="h-4 w-4" />
        </Btn>
      )}
      <Sep />
      {/* Table */}
      <Btn
        title="Insert table"
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon className="h-4 w-4" />
      </Btn>
      {s.inTable && (
        <>
          <Btn title="Add row" onClick={() => chain().addRowAfter().run()}>
            <Rows3 className="h-4 w-4" />+
          </Btn>
          <Btn title="Add column" onClick={() => chain().addColumnAfter().run()}>
            <Columns3 className="h-4 w-4" />+
          </Btn>
          <Btn title="Delete row" onClick={() => chain().deleteRow().run()}>
            <Rows3 className="h-4 w-4" />−
          </Btn>
          <Btn title="Delete column" onClick={() => chain().deleteColumn().run()}>
            <Columns3 className="h-4 w-4" />−
          </Btn>
          <Btn title="Delete table" onClick={() => chain().deleteTable().run()}>
            <Trash2 className="h-4 w-4" />
          </Btn>
        </>
      )}

      {/* Insert-field dropdown */}
      {fieldsOpen && (
        <div
          className="absolute left-2 top-full z-20 mt-1 max-h-[60vh] w-64 overflow-auto rounded-md border bg-popover p-2 shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {groups.map((g) => (
            <div key={g.heading} className="mb-2 last:mb-0">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.heading}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.items.map((it) => (
                  <button
                    key={it.token}
                    type="button"
                    title={it.token}
                    onClick={() => {
                      editor.chain().focus().insertMergeField({ token: it.token, label: it.label }).run();
                      setFieldsOpen(false);
                    }}
                    className="rounded border bg-muted/40 px-2 py-0.5 text-[11px] hover:bg-muted"
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline link editor */}
      {linkOpen && (
        <div
          className="absolute left-2 top-full z-20 mt-1 flex w-80 items-center gap-1 rounded-md border bg-popover p-2 shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://…"
            className="h-7 flex-1 rounded border px-2 text-xs"
          />
          <button type="button" onClick={applyLink} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
