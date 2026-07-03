// @ts-nocheck
'use client';

import { createPlatePlugin } from 'platejs/react';

import { FixedToolbar } from '@/features/documents/plate/ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/features/documents/plate/ui/fixed-toolbar-buttons';

export const FixedToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <FixedToolbar>
          <FixedToolbarButtons />
        </FixedToolbar>
      ),
    },
  }),
];
