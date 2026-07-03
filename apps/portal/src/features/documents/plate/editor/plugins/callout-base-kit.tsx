// @ts-nocheck
import { BaseCalloutPlugin } from '@platejs/callout';

import { CalloutElementStatic } from '@/features/documents/plate/ui/callout-node-static';

export const BaseCalloutKit = [
  BaseCalloutPlugin.withComponent(CalloutElementStatic),
];
