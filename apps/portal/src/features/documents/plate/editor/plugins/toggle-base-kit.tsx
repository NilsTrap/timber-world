// @ts-nocheck
import { BaseTogglePlugin } from '@platejs/toggle';

import { ToggleElementStatic } from '@/features/documents/plate/ui/toggle-node-static';

export const BaseToggleKit = [
  BaseTogglePlugin.withComponent(ToggleElementStatic),
];
