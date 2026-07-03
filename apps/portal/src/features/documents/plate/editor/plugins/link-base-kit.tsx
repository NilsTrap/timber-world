// @ts-nocheck
import { BaseLinkPlugin } from '@platejs/link';

import { LinkElementStatic } from '@/features/documents/plate/ui/link-node-static';

export const BaseLinkKit = [BaseLinkPlugin.withComponent(LinkElementStatic)];
