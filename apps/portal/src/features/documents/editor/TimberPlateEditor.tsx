"use client";

/**
 * TimberPlateEditor — the controlled Plate (Slate) editor used by the Document
 * Templates Visual tab. Wraps the vendored Plate editor kit + toolbar in a
 * TooltipProvider and reports value changes up. The editor is uncontrolled
 * after mount (Plate owns its internal state); remount with a fresh `key` when
 * loading a different template so it re-initialises with new content.
 *
 * v1: rich text + tables (merge fields deferred). doc_json stores the Slate
 * value; saveTemplate compiles it to HTML via compiler/slate.ts.
 */
import { Plate, usePlateEditor } from "platejs/react";
import { EditorKit } from "@/features/documents/plate/editor/editor-kit";
import { Editor, EditorContainer } from "@/features/documents/plate/ui/editor";
import { TooltipProvider } from "@/features/documents/plate/ui/tooltip";
import type { SlateNode } from "../compiler/slate";

export function TimberPlateEditor({
  value,
  onChange,
}: {
  value: SlateNode[];
  onChange: (value: SlateNode[]) => void;
}) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: value as any,
  });

  return (
    <TooltipProvider>
      <Plate
        editor={editor}
        onChange={({ value: v }) => onChange(v as unknown as SlateNode[])}
      >
        <EditorContainer>
          <Editor variant="default" />
        </EditorContainer>
      </Plate>
    </TooltipProvider>
  );
}
