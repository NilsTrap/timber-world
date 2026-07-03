// @ts-nocheck
'use client';

import { TrailingBlockPlugin, type Value } from 'platejs';
import { type TPlateEditor, useEditorRef } from 'platejs/react';

import { AIKit } from '@/features/documents/plate/editor/plugins/ai-kit';
import { AlignKit } from '@/features/documents/plate/editor/plugins/align-kit';
import { AutoformatKit } from '@/features/documents/plate/editor/plugins/autoformat-kit';
import { BasicBlocksKit } from '@/features/documents/plate/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/features/documents/plate/editor/plugins/basic-marks-kit';
import { BlockMenuKit } from '@/features/documents/plate/editor/plugins/block-menu-kit';
import { BlockPlaceholderKit } from '@/features/documents/plate/editor/plugins/block-placeholder-kit';
import { CalloutKit } from '@/features/documents/plate/editor/plugins/callout-kit';
import { CodeBlockKit } from '@/features/documents/plate/editor/plugins/code-block-kit';
import { ColumnKit } from '@/features/documents/plate/editor/plugins/column-kit';
import { CommentKit } from '@/features/documents/plate/editor/plugins/comment-kit';
import { CopilotKit } from '@/features/documents/plate/editor/plugins/copilot-kit';
import { CursorOverlayKit } from '@/features/documents/plate/editor/plugins/cursor-overlay-kit';
import { DateKit } from '@/features/documents/plate/editor/plugins/date-kit';
import { DiscussionKit } from '@/features/documents/plate/editor/plugins/discussion-kit';
import { DndKit } from '@/features/documents/plate/editor/plugins/dnd-kit';
import { DocxKit } from '@/features/documents/plate/editor/plugins/docx-kit';
import { EmojiKit } from '@/features/documents/plate/editor/plugins/emoji-kit';
import { ExitBreakKit } from '@/features/documents/plate/editor/plugins/exit-break-kit';
import { FixedToolbarKit } from '@/features/documents/plate/editor/plugins/fixed-toolbar-kit';
import { FloatingToolbarKit } from '@/features/documents/plate/editor/plugins/floating-toolbar-kit';
import { FontKit } from '@/features/documents/plate/editor/plugins/font-kit';
import { LineHeightKit } from '@/features/documents/plate/editor/plugins/line-height-kit';
import { LineItemsKit } from '@/features/documents/plate/editor/plugins/line-items-kit';
import { LinkKit } from '@/features/documents/plate/editor/plugins/link-kit';
import { ListKit } from '@/features/documents/plate/editor/plugins/list-kit';
import { MarkdownKit } from '@/features/documents/plate/editor/plugins/markdown-kit';
import { MathKit } from '@/features/documents/plate/editor/plugins/math-kit';
import { MediaKit } from '@/features/documents/plate/editor/plugins/media-kit';
import { MentionKit } from '@/features/documents/plate/editor/plugins/mention-kit';
import { SlashKit } from '@/features/documents/plate/editor/plugins/slash-kit';
import { SuggestionKit } from '@/features/documents/plate/editor/plugins/suggestion-kit';
import { TableKit } from '@/features/documents/plate/editor/plugins/table-kit';
import { TocKit } from '@/features/documents/plate/editor/plugins/toc-kit';
import { ToggleKit } from '@/features/documents/plate/editor/plugins/toggle-kit';

export const EditorKit = [
  ...CopilotKit,
  ...AIKit,

  // Elements
  ...BasicBlocksKit,
  ...CodeBlockKit,
  ...TableKit,
  ...LineItemsKit,
  ...ToggleKit,
  ...TocKit,
  ...MediaKit,
  ...CalloutKit,
  ...ColumnKit,
  ...MathKit,
  ...DateKit,
  ...LinkKit,
  ...MentionKit,

  // Marks
  ...BasicMarksKit,
  ...FontKit,

  // Block Style
  ...ListKit,
  ...AlignKit,
  ...LineHeightKit,

  // Collaboration
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Editing
  ...SlashKit,
  ...AutoformatKit,
  ...CursorOverlayKit,
  ...BlockMenuKit,
  ...DndKit,
  ...EmojiKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,

  // Parsers
  ...DocxKit,
  ...MarkdownKit,

  // UI
  ...BlockPlaceholderKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];

export type MyEditor = TPlateEditor<Value, (typeof EditorKit)[number]>;

export const useEditor = () => useEditorRef<MyEditor>();
