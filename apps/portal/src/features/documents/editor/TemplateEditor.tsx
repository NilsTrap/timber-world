"use client";

/**
 * TemplateEditor — the TipTap visual editor for a document template. TipTap JSON
 * is the source of truth: initial content is set ONCE from `value`; edits are
 * reported via onChange(editor.getJSON()). Uncontrolled by design (no content
 * prop re-feed), immediatelyRender:false for Next SSR safety.
 */
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { editorExtensions } from "./extensions";
import { Toolbar } from "./Toolbar";
import type { TipTapDoc } from "../compiler";
import "./editor.css";

export const EMPTY_DOC: TipTapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function TemplateEditor({
  value,
  onChange,
  editable = true,
}: {
  value: TipTapDoc;
  onChange?: (doc: TipTapDoc) => void;
  editable?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    extensions: editorExtensions,
    content: value ?? EMPTY_DOC,
    editorProps: { attributes: { class: "tw-doc focus:outline-none" } },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON() as unknown as TipTapDoc),
  });

  // Keep editability in sync without re-feeding content (which would move the cursor).
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className="p-6 text-sm text-muted-foreground">Loading editor…</div>;
  }

  return (
    <div className="tw-doc-editor overflow-hidden rounded-md border">
      <Toolbar editor={editor} />
      <div className="tw-doc-scroll bg-neutral-100 p-4">
        <div className="tw-doc-page mx-auto bg-white shadow-sm">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
