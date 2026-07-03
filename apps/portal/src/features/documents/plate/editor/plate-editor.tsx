// @ts-nocheck
'use client';

import { normalizeStaticValue } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/features/documents/plate/editor/editor-kit';
import { SettingsDialog } from '@/features/documents/plate/editor/settings-dialog';
import { Editor, EditorContainer } from '@/features/documents/plate/ui/editor';

export function PlateEditor() {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value,
  });

  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Editor variant="demo" />
      </EditorContainer>

      <SettingsDialog />
    </Plate>
  );
}

// Timber World sample document so you can feel the editor on a real business doc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cell = (text: string, header = false): any => ({
  type: header ? 'th' : 'td',
  children: [{ type: 'p', children: [{ text, ...(header ? { bold: true } : {}) }] }],
});

const value = normalizeStaticValue([
  { type: 'h1', children: [{ text: 'SALES SPECIFICATION' }] },
  { type: 'p', children: [{ text: 'No. 1 · Deal TIMSOM001 · 02.07.2026', italic: true }] },
  { type: 'h3', children: [{ text: 'Seller' }] },
  { type: 'p', children: [{ text: 'Timber World SIA', bold: true }] },
  { type: 'p', children: [{ text: 'Brīvības iela 1, Riga, LV-1010, Latvia' }] },
  { type: 'p', children: [{ text: 'Reg. No: 40000000000 · VAT: LV40000000000' }] },
  { type: 'p', children: [{ text: 'sales@timberworld.lv · +371 2000 0000' }] },
  { type: 'h3', children: [{ text: 'Buyer' }] },
  { type: 'p', children: [{ text: 'DDC Distribution Ltd', bold: true }] },
  { type: 'p', children: [{ text: '10 Timber Yard, London, EC1A 1BB, United Kingdom' }] },
  { type: 'p', children: [{ text: 'Reg. No: GB123456789 · VAT: GB123456789' }] },
  { type: 'h3', children: [{ text: 'Terms' }] },
  {
    type: 'p',
    children: [
      {
        text: 'Incoterms: FCA Riga (Incoterms 2020) · Payment: 30% advance, balance before loading · Delivery: By truck, full load · Deadline: 15.08.2026',
      },
    ],
  },
  { type: 'h3', children: [{ text: 'Goods' }] },
  {
    type: 'table',
    children: [
      {
        type: 'tr',
        children: [
          cell('#', true),
          cell('Description', true),
          cell('Dimensions (mm)', true),
          cell('Pcs', true),
          cell('m³', true),
          cell('Unit (EUR)', true),
          cell('Total (EUR)', true),
        ],
      },
      {
        type: 'tr',
        children: [
          cell('1'),
          cell('Oak board, KD 8-10%, AB grade, planed'),
          cell('27 × 150 × 2000'),
          cell('120'),
          cell('0,972'),
          cell('680,00'),
          cell('660,96'),
        ],
      },
      {
        type: 'tr',
        children: [
          cell('2'),
          cell('Pine plank, KD, C grade'),
          cell('50 × 200 × 3000'),
          cell('40'),
          cell('1,200'),
          cell('320,00'),
          cell('384,00'),
        ],
      },
      {
        type: 'tr',
        children: [
          cell('3'),
          cell('Birch plywood, WBP, 18 mm'),
          cell('18 × 1250 × 2500'),
          cell('25'),
          cell('1,406'),
          cell('450,00'),
          cell('632,70'),
        ],
      },
    ],
  },
  { type: 'p', children: [{ text: 'Total volume: 3,578 m³' }] },
  { type: 'p', children: [{ text: 'Subtotal: 1 677,66 EUR' }] },
  { type: 'p', children: [{ text: 'VAT (21%): 352,31 EUR' }] },
  { type: 'p', children: [{ text: 'Total: 2 029,97 EUR', bold: true }] },
  { type: 'h3', children: [{ text: 'Notes' }] },
  {
    type: 'p',
    children: [{ text: 'Goods remain the property of the seller until full payment is received.' }],
  },
  { type: 'p', children: [{ text: '' }] },
]);
