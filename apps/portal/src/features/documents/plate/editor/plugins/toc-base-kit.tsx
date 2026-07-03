// @ts-nocheck
import { BaseTocPlugin } from '@platejs/toc';

import { TocElementStatic } from '@/features/documents/plate/ui/toc-node-static';

export const BaseTocKit = [BaseTocPlugin.withComponent(TocElementStatic)];
