// @ts-nocheck
'use client';

import { CalloutPlugin } from '@platejs/callout/react';

import { CalloutElement } from '@/features/documents/plate/ui/callout-node';

export const CalloutKit = [CalloutPlugin.withComponent(CalloutElement)];
