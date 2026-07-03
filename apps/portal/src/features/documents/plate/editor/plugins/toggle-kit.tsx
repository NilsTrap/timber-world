// @ts-nocheck
'use client';

import { TogglePlugin } from '@platejs/toggle/react';

import { IndentKit } from '@/features/documents/plate/editor/plugins/indent-kit';
import { ToggleElement } from '@/features/documents/plate/ui/toggle-node';

export const ToggleKit = [
  ...IndentKit,
  TogglePlugin.withComponent(ToggleElement),
];
