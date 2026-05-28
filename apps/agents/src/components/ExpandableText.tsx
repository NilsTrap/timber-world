"use client";

import { useState } from "react";

export function ExpandableText({ text, limit = 180 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;

  return (
    <p className="text-sm text-[var(--charcoal-light)] leading-relaxed whitespace-pre-line">
      {long && !open ? text.slice(0, limit).trimEnd() + "… " : text}
      {long && (
        <button onClick={() => setOpen(!open)} className="ml-1 font-semibold text-[var(--forest-green)]">
          {open ? "Read less" : "Read more"}
        </button>
      )}
    </p>
  );
}
