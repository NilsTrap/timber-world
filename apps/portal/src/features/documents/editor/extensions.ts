"use client";

/**
 * The shared TipTap extension set for the document-template editor. Centralised
 * so the editor component (and any headless getJSON usage) use exactly the same
 * schema. Headings are limited to 1–3 to match the compiler / seeded look.
 */
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { MergeField } from "./extensions/mergeField";
import { LineItemsTable } from "./extensions/lineItemsTable";

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image.configure({ inline: false, allowBase64: false }),
  TableKit.configure({ table: { resizable: true } }),
  MergeField,
  LineItemsTable,
];
