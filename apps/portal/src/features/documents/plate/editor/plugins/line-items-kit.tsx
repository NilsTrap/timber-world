// @ts-nocheck
"use client";

import { createPlatePlugin } from "platejs/react";
import { LineItemsElement } from "@/features/documents/plate/ui/line-items-node";

/** The custom `line_items` void block (the repeating goods table). */
export const LineItemsPlugin = createPlatePlugin({
  key: "line_items",
  node: {
    isElement: true,
    isVoid: true,
    type: "line_items",
  },
}).withComponent(LineItemsElement);

export const LineItemsKit = [LineItemsPlugin];
