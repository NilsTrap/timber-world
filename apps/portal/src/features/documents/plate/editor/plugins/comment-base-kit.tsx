// @ts-nocheck
import { BaseCommentPlugin } from '@platejs/comment';

import { CommentLeafStatic } from '@/features/documents/plate/ui/comment-node-static';

export const BaseCommentKit = [
  BaseCommentPlugin.withComponent(CommentLeafStatic),
];
