// @ts-nocheck
'use client';

import { getLinkAttributes } from '@platejs/link';

import type { TLinkElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { inlineSuggestionVariants } from '@/features/documents/plate/lib/suggestion';
import { cn } from '@/features/documents/plate/lib/utils';

export function LinkElement(props: PlateElementProps<TLinkElement>) {
  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{
        ...props.attributes,
        ...getLinkAttributes(props.editor, props.element),
        onMouseOver: (e) => {
          e.stopPropagation();
        },
      }}
      className={cn(
        'font-medium text-primary underline decoration-primary underline-offset-4',
        inlineSuggestionVariants()
      )}
    >
      {props.children}
    </PlateElement>
  );
}
