// @ts-nocheck
import { BaseMentionPlugin } from '@platejs/mention';

import { MentionElementStatic } from '@/features/documents/plate/ui/mention-node-static';

export const BaseMentionKit = [
  BaseMentionPlugin.withComponent(MentionElementStatic),
];
